/**
 * T3 (spec 9.4): the six punch pads, as native nodes on the master path between the Drop's overlay and the lo-fi
 * master. Every move is scheduled ahead on the audio clock with a ramp that finishes on the line
 * `src/music/punch.ts` names, so the pad is fully in on its start line and fully out on its end line. Each pad has
 * its own nodes, so any number can be held at once.
 *
 *   input -> stutter (dry, or the last half beat looped in a delay line) -> filter (low-pass) -> sum -> output
 *   sum -> echo send -> delay (dotted eighth, fed back) -> output
 *   sum -> wash send -> reverb (a seeded noise tail) -> output
 *   riser (seeded noise through a band-pass) -> output
 *   Cut works on the drums' and the bass's own input gains (given), so their sends' tails ring on.
 *
 * No Tone here: only the AudioContext, so the unit tests drive it with a fake context on a fake clock.
 */
import { createRng } from "../music/random.ts";
import { PUNCH_PADS, PUNCH_RULES, RISER_FALL_BEATS, beatAt, punchEnd, punchStart, timeOfBeat, type PunchGrid, type PunchPad } from "../music/punch.ts";

/** Seed of the punch rack's noise (the riser's and the wash's tail); fixed, so the same sound every time. */
export const PUNCH_SEED = 0x9e45;

/** The short ramp that lands a switch on its line (5 ms, never a step). */
const R = 0.005;
/** Filter: the cutoff when open and the floor it sweeps down to, and how many beats the sweep takes. */
export const FILTER_OPEN = 20000;
export const FILTER_FLOOR = 280;
export const FILTER_SWEEP_BEATS = 2;
/** Filter: the opening ramp before its line. */
const FILTER_OPEN_RAMP = 0.02;
/** Echo: a dotted eighth, fed back. */
const ECHO_BEATS = 0.75;
const ECHO_FEEDBACK = 0.5;
const ECHO_RETURN = 0.7;
/** Wash: the reverb tail's length (s) and its return level. */
const WASH_SECONDS = 3.5;
const WASH_RETURN = 0.6;
/** Riser: its band-pass sweep (Hz), the beats it takes to the top, and its peak level. */
const RISER_FROM = 300;
const RISER_TO = 9000;
const RISER_BEATS = 8;
export const RISER_PEAK = 0.18;

/** What a pad is doing: off, in (held, or a tap running), or ending on a line already scheduled. */
export interface PunchState {
  pad: PunchPad;
  held: boolean;
  /** Audio time it starts (or started); null when off. */
  start: number | null;
  /** Audio time it ends, once known (a tap's at once, a hold's on release); null while held or off. */
  end: number | null;
}

interface Slot {
  held: boolean;
  start: number | null;
  end: number | null;
  /** Bumped on every press, so a late housekeeping callback for an older press does nothing. */
  gen: number;
}

/** Hold a param where it is at `t` and clear what is scheduled after. */
function hold(p: AudioParam, t: number): void {
  if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(t);
  else {
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
  }
}

/** A linear move to `v` that finishes at `t`, from where the param is at `t - len`. */
function landAt(p: AudioParam, v: number, t: number, len = R): void {
  hold(p, t - len);
  p.linearRampToValueAtTime(v, t);
}

export class PunchRack {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly slots = new Map<PunchPad, Slot>();
  // Stutter.
  private readonly dry: GainNode;
  private readonly rec: GainNode;
  private readonly loop: DelayNode;
  private readonly fb: GainNode;
  private readonly wet: GainNode;
  // Filter.
  readonly filter: BiquadFilterNode;
  // Echo.
  readonly echoSend: GainNode;
  private readonly echo: DelayNode;
  // Wash.
  readonly washSend: GainNode;
  private wash: ConvolverNode | null = null;
  private washLinked = false;
  // Riser.
  readonly riserGain: GainNode;
  readonly riserBand: BiquadFilterNode;
  private riserSrc: AudioBufferSourceNode | null = null;
  private noise: AudioBuffer | null = null;

  constructor(
    private readonly ctx: BaseAudioContext,
    /** Where the transport stands on the audio clock (null while stopped). */
    private readonly grid: () => PunchGrid | null,
    /** The gains Cut silences: the drums' and the bass's own input gain. */
    private readonly cuts: readonly AudioParam[],
    /** Housekeeping after a fade (disconnect an idle reverb); the engine passes setTimeout. */
    private readonly later: (fn: () => void, seconds: number) => void = (fn, s) => void setTimeout(fn, s * 1000),
  ) {
    for (const pad of PUNCH_PADS) this.slots.set(pad, { held: false, start: null, end: null, gen: 0 });
    const g = (v: number): GainNode => {
      const n = ctx.createGain();
      n.gain.value = v;
      return n;
    };
    this.input = g(1);
    this.output = g(1);
    this.dry = g(1);
    this.rec = g(1);
    this.loop = ctx.createDelay(2);
    this.fb = g(0);
    this.wet = g(0);
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = FILTER_OPEN;
    this.filter.Q.value = 0.9;
    const sum = g(1);
    this.input.connect(this.dry).connect(this.filter);
    this.input.connect(this.rec).connect(this.loop);
    this.loop.connect(this.fb).connect(this.loop);
    this.loop.connect(this.wet).connect(this.filter);
    this.filter.connect(sum).connect(this.output);
    // Echo.
    this.echoSend = g(0);
    this.echo = ctx.createDelay(4);
    const echoFb = g(ECHO_FEEDBACK);
    sum.connect(this.echoSend).connect(this.echo);
    this.echo.connect(echoFb).connect(this.echo);
    this.echo.connect(g(ECHO_RETURN)).connect(this.output);
    // Wash: its reverb is made on the first tap.
    this.washSend = g(0);
    sum.connect(this.washSend);
    // Riser.
    this.riserBand = ctx.createBiquadFilter();
    this.riserBand.type = "bandpass";
    this.riserBand.frequency.value = RISER_FROM;
    this.riserBand.Q.value = 3;
    this.riserGain = g(0);
    this.riserBand.connect(this.riserGain).connect(this.output);
  }

  /** What every pad is doing now (a pad whose end has passed reads as off). */
  state(now = this.ctx.currentTime): PunchState[] {
    return PUNCH_PADS.map((pad) => {
      const s = this.slots.get(pad)!;
      const over = !s.held && s.end !== null && s.end <= now;
      return { pad, held: s.held, start: over ? null : s.start, end: over ? null : s.end };
    });
  }

  /** Whether a pad is in now or will be (held, a tap running, or a release not yet on its line). */
  active(pad: PunchPad, now = this.ctx.currentTime): boolean {
    const s = this.slots.get(pad)!;
    return s.held || (s.end !== null && s.end > now);
  }

  /**
   * A pad pressed (down) or let go (up) at audio time `now`. A tap pad acts on press and ignores the release.
   * Returns the pad's state after it, or null while the transport is stopped (nothing to land on).
   */
  press(pad: PunchPad, down: boolean, now = this.ctx.currentTime): PunchState | null {
    const g = this.grid();
    const s = this.slots.get(pad)!;
    if (!g) return null;
    const rule = PUNCH_RULES[pad];
    if (down) {
      if (s.held) return this.one(pad);
      const live = s.end !== null && s.end > now && s.start !== null;
      s.gen++;
      if (rule.kind === "tap") {
        const start = punchStart(pad, g, now);
        const end = punchEnd(pad, g, start, now);
        // A second tap while it runs keeps it in and moves its end on.
        this.tap(pad, g, live ? null : start, end);
        s.start = live ? s.start : start;
        s.end = end;
        return this.one(pad);
      }
      s.held = true;
      if (live) {
        // Pressed again before its release landed: stay in, the scheduled end is cleared.
        this.resume(pad, g, now);
        s.end = null;
        return this.one(pad);
      }
      s.start = punchStart(pad, g, now);
      s.end = null;
      this.begin(pad, g, s.start);
      return this.one(pad);
    }
    if (rule.kind === "tap" || !s.held || s.start === null) return this.one(pad);
    s.held = false;
    s.end = punchEnd(pad, g, s.start, now);
    this.finish(pad, g, s.start, s.end);
    return this.one(pad);
  }

  /** Every pad out at once (Stop): ramps from now, nothing held. */
  reset(now = this.ctx.currentTime): void {
    const t = now + R;
    for (const pad of PUNCH_PADS) {
      const s = this.slots.get(pad)!;
      s.gen++;
      s.held = false;
      s.start = null;
      s.end = null;
    }
    for (const c of this.cuts) landAt(c, 1, t);
    landAt(this.dry.gain, 1, t);
    landAt(this.rec.gain, 1, t);
    landAt(this.fb.gain, 0, t);
    landAt(this.wet.gain, 0, t);
    hold(this.filter.frequency, now);
    this.filter.frequency.exponentialRampToValueAtTime(FILTER_OPEN, now + FILTER_OPEN_RAMP);
    landAt(this.echoSend.gain, 0, t);
    landAt(this.washSend.gain, 0, t);
    this.riserOff(now, 0.05);
  }

  private one(pad: PunchPad): PunchState {
    return this.state().find((x) => x.pad === pad)!;
  }

  /** A hold pad in, fully on `t`. */
  private begin(pad: PunchPad, g: PunchGrid, t: number): void {
    switch (pad) {
      case "cut":
        for (const c of this.cuts) landAt(c, 0, t);
        return;
      case "filter": {
        const f = this.filter.frequency;
        hold(f, t);
        f.exponentialRampToValueAtTime(FILTER_FLOOR, timeOfBeat(g, beatAt(g, t) + FILTER_SWEEP_BEATS));
        return;
      }
      case "stutter": {
        // The loop is the half beat just before `t`; its length is set while the loop is out of the mix.
        const half = 30 / g.bpm;
        hold(this.loop.delayTime, t - R - 1e-3);
        this.loop.delayTime.setValueAtTime(half, t - R - 1e-3);
        landAt(this.dry.gain, 0, t);
        landAt(this.rec.gain, 0, t);
        landAt(this.fb.gain, 1, t);
        landAt(this.wet.gain, 1, t);
        return;
      }
      case "riser":
        return this.riserOn(g, t);
      default:
        return;
    }
  }

  /** Pressed again while its release is still ahead: the scheduled end is cleared, the pad stays in. */
  private resume(pad: PunchPad, g: PunchGrid, now: number): void {
    const t = now + R;
    switch (pad) {
      case "cut":
        for (const c of this.cuts) landAt(c, 0, t);
        return;
      case "filter": {
        const f = this.filter.frequency;
        hold(f, now);
        f.exponentialRampToValueAtTime(FILTER_FLOOR, timeOfBeat(g, beatAt(g, now) + FILTER_SWEEP_BEATS));
        return;
      }
      case "stutter":
        landAt(this.dry.gain, 0, t);
        landAt(this.rec.gain, 0, t);
        landAt(this.fb.gain, 1, t);
        landAt(this.wet.gain, 1, t);
        return;
      case "riser": {
        // The fall is cancelled: a fresh source takes over (noise into noise), and it rises again from where it is.
        this.riserSource(t);
        const top = timeOfBeat(g, beatAt(g, now) + RISER_BEATS / 2);
        hold(this.riserGain.gain, t);
        this.riserGain.gain.linearRampToValueAtTime(RISER_PEAK, top);
        hold(this.riserBand.frequency, t);
        this.riserBand.frequency.exponentialRampToValueAtTime(RISER_TO, top);
        return;
      }
      default:
        return;
    }
  }

  /** A hold pad out, fully off on `end`. */
  private finish(pad: PunchPad, g: PunchGrid, _start: number, end: number): void {
    switch (pad) {
      case "cut":
        for (const c of this.cuts) landAt(c, 1, end);
        return;
      case "filter": {
        const f = this.filter.frequency;
        hold(f, end - FILTER_OPEN_RAMP);
        f.exponentialRampToValueAtTime(FILTER_OPEN, end);
        return;
      }
      case "stutter":
        landAt(this.dry.gain, 1, end);
        landAt(this.rec.gain, 1, end);
        landAt(this.fb.gain, 0, end);
        landAt(this.wet.gain, 0, end);
        return;
      case "riser": {
        const fall = (RISER_FALL_BEATS * 60) / g.bpm;
        this.riserOff(end, fall);
        // The riser is silent one beat after its fall starts: that is its end.
        this.slots.get("riser")!.end = end + fall;
        return;
      }
      default:
        return;
    }
  }

  /** Echo or Wash: the send fully open on `start` (null: already open) and closed on `end`. */
  private tap(pad: PunchPad, g: PunchGrid, start: number | null, end: number): void {
    const send = pad === "echo" ? this.echoSend : this.washSend;
    if (pad === "echo" && start !== null) {
      const d = (ECHO_BEATS * 60) / g.bpm;
      if (Math.abs(this.echo.delayTime.value - d) > 1e-3) {
        // Set while the send is closed (a tempo change), a short glide rather than a step.
        hold(this.echo.delayTime, start - R - 1e-3);
        this.echo.delayTime.linearRampToValueAtTime(d, start - R);
      }
    }
    if (pad === "wash") this.linkWash();
    if (start !== null) landAt(send.gain, 1, start);
    else hold(send.gain, this.ctx.currentTime);
    landAt(send.gain, 0, end);
    if (pad === "wash") {
      const gen = this.slots.get("wash")!.gen;
      // The reverb is cut from its send once its tail has rung out, so an idle reverb costs nothing.
      this.later(() => {
        if (this.slots.get("wash")!.gen === gen) this.unlinkWash();
      }, end - this.ctx.currentTime + WASH_SECONDS + 0.5);
    }
  }

  private linkWash(): void {
    if (!this.wash) {
      this.wash = this.ctx.createConvolver();
      this.wash.buffer = this.tail();
      const ret = this.ctx.createGain();
      ret.gain.value = WASH_RETURN;
      this.wash.connect(ret).connect(this.output);
    }
    if (!this.washLinked) {
      this.washSend.connect(this.wash);
      this.washLinked = true;
    }
  }

  private unlinkWash(): void {
    if (!this.wash || !this.washLinked) return;
    this.washSend.disconnect(this.wash);
    this.washLinked = false;
  }

  /** Whether the wash reverb is linked to its send (for the tests: idle, it is not). */
  washOn(): boolean {
    return this.washLinked;
  }

  /** The wash reverb's impulse: seeded stereo noise falling away over WASH_SECONDS. */
  private tail(): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const n = Math.floor(rate * WASH_SECONDS);
    const b = this.ctx.createBuffer(2, n, rate);
    const rng = createRng(PUNCH_SEED + 1);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (rng.next() * 2 - 1) * Math.pow(1 - i / n, 3);
    }
    return b;
  }

  /** Two seconds of seeded white noise for the riser, looped. */
  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const rate = this.ctx.sampleRate;
    const n = rate * 2;
    const b = this.ctx.createBuffer(1, n, rate);
    const rng = createRng(PUNCH_SEED);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = rng.next() * 2 - 1;
    return (this.noise = b);
  }

  /** A new noise source into the riser's band-pass from `t`; the one before it stops there. */
  private riserSource(t: number): void {
    this.riserSrc?.stop(t + R);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    src.connect(this.riserBand);
    src.start(t);
    this.riserSrc = src;
  }

  /** From silence: the riser starts on `t` and climbs for RISER_BEATS. */
  private riserOn(g: PunchGrid, t: number): void {
    this.riserSource(t - R);
    const top = timeOfBeat(g, beatAt(g, t) + RISER_BEATS);
    const gain = this.riserGain.gain;
    hold(gain, t - R);
    gain.linearRampToValueAtTime(RISER_PEAK, top);
    const f = this.riserBand.frequency;
    hold(f, t - R);
    f.exponentialRampToValueAtTime(RISER_TO, top);
  }

  /** The riser falls to silence from `t` over `len` seconds; its source stops after. */
  private riserOff(t: number, len: number): void {
    const gain = this.riserGain.gain;
    hold(gain, t);
    gain.linearRampToValueAtTime(0, t + len);
    const f = this.riserBand.frequency;
    hold(f, t);
    f.exponentialRampToValueAtTime(RISER_FROM, t + len);
    // A later press replaces this stop time with its own (the last stop() called is the one applied).
    this.riserSrc?.stop(t + len + 0.01);
  }
}
