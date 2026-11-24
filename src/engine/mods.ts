/**
 * P7 sound additions (spec 8.7, 8.10) that sit beside the instruments: a native low-frequency oscillator, the
 * breath of the noise wave, the swappable long reverb, the lo-fi master and the air layer. Only src/engine/ imports Tone.
 *
 * Every one is switchable off, and off costs nothing: its sources stop and it leaves the chain after a fade.
 * Every switch fades (setTargetAtTime from wherever the value is), so switching while playing makes no step.
 * No filter here opens past 10 kHz (C1); the lo-fi crusher is a plain wave shaper, not oversampled (C1's cost note).
 */
import * as Tone from "tone";
import { createRng } from "../music/random.ts";
import { REVERB_LOOP_HZ, lofiAmount, loopLowpass, reverbImpulse, reverbPlan } from "../music/sound.ts";

const RAMP = 0.03;

/** The native AudioParam under a Tone Param or Signal. */
export function nativeParam(p: unknown): AudioParam {
  let q = p as { _param?: unknown };
  while (q._param) q = q._param as { _param?: unknown };
  return q as unknown as AudioParam;
}

/**
 * For the smoke test's proof that its click checks can fail (P9 review E3: the lo-fi, air and reverb switches): with
 * `hard` set, glideParam steps instead of gliding. Never set by the app.
 */
export const modsDebug = { hard: false };

/** Move a parameter to `value` from `at` (else now), from wherever it is: no step. */
export function glideParam(param: unknown, value: number, at?: number, tau = RAMP / 4): void {
  const p = typeof AudioParam !== "undefined" && param instanceof AudioParam ? param : nativeParam(param);
  const t = Math.max(at ?? 0, Tone.getContext().currentTime);
  p.cancelScheduledValues(t);
  if (modsDebug.hard) p.setValueAtTime(value, t);
  else p.setTargetAtTime(value, t, tau);
}

/**
 * Seconds to wait before freeing what a fade starting at audio time `at` (else now) silences: until the fade has
 * started and run `seconds`, plus the lookahead and a margin. P7 review S5: timed from `at`, not from now, so a fade
 * scheduled past the lookahead is never cut before it starts.
 */
export function fadeWait(at: number | undefined, now: number, lookAhead: number, seconds: number): number {
  return Math.max(0, (at ?? now) - now) + lookAhead + seconds + 0.05;
}

/** Run `fn` once a fade of `seconds` from audio time `at` (else now) is done. */
export function afterFade(fn: () => void, seconds = RAMP, at?: number): void {
  const ctx = Tone.getContext();
  ctx.setTimeout(fn, fadeWait(at, ctx.currentTime, ctx.lookAhead, seconds));
}

function raw(): BaseAudioContext {
  return Tone.getContext().rawContext as unknown as BaseAudioContext;
}

/**
 * A sine LFO of native nodes, cheaper than Tone.LFO's chain, with three outputs: `bi` (-1..1), `uni` (0..1) and
 * `neg` (-1..0). It can start at a given phase (radians of a cosine), so a tempo-synced LFO lines up with the bar.
 */
export class Lfo {
  /** Native sources (oscillator and offset) running over every Lfo, for the smoke test: 0 with everything off. */
  static sources = 0;
  readonly bi: GainNode;
  readonly uni: GainNode;
  readonly neg: GainNode;
  private osc: OscillatorNode | null = null;
  /** The running oscillator's own gain into `bi`, so a restart can crossfade (P9 review M1). */
  private oscGain: GainNode | null = null;
  private readonly half: GainNode;
  /** The 0.5 offset of `uni` and `neg`: runs only while the oscillator does (P7 review M5: off costs nothing). */
  private lift: ConstantSourceNode | null = null;
  private readonly drop: GainNode;
  private hz = 0.1;

  constructor() {
    const ctx = raw();
    this.bi = ctx.createGain();
    this.half = ctx.createGain();
    this.half.gain.value = 0.5;
    this.uni = ctx.createGain();
    this.neg = ctx.createGain();
    this.drop = ctx.createGain();
    this.drop.gain.value = -1;
    this.bi.connect(this.half);
    this.half.connect(this.uni);
    this.half.connect(this.neg);
    this.drop.connect(this.neg);
  }

  get running(): boolean {
    return this.osc !== null;
  }

  /**
   * Start (or restart) at audio time `at`, `hz` cycles a second, at phase `phase` of a cosine (0: the top). A restart
   * while it runs (Play pressed again, so a synced LFO lines up with the bar) crossfades from the old phase to the new
   * over Lfo.XFADE: what it moves glides there instead of stepping (P9 review M1).
   */
  start(at: number, hz: number, phase = 0): void {
    const ctx = raw();
    const t = Math.max(at, ctx.currentTime);
    const osc = ctx.createOscillator();
    // cos(wt + phase) as a periodic wave: real is the cosine part, imag the sine part.
    const real = new Float32Array([0, Math.cos(phase)]);
    const imag = new Float32Array([0, -Math.sin(phase)]);
    osc.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: true }));
    osc.frequency.value = hz;
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(this.bi);
    osc.start(t);
    const was = this.osc;
    const wasGain = this.oscGain;
    if (was && wasGain && this.lift) {
      wasGain.gain.cancelScheduledValues(t);
      wasGain.gain.setValueAtTime(1, t);
      wasGain.gain.linearRampToValueAtTime(0, t + Lfo.XFADE);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + Lfo.XFADE);
      was.stop(t + Lfo.XFADE);
      was.onended = () => {
        was.disconnect();
        wasGain.disconnect();
      };
    } else {
      this.stop(t);
      const lift = ctx.createConstantSource();
      lift.offset.value = 0.5;
      lift.connect(this.uni);
      lift.connect(this.drop);
      lift.start(t);
      this.lift = lift;
      Lfo.sources += 2;
    }
    this.osc = osc;
    this.oscGain = g;
    this.hz = hz;
  }

  /** A restart's crossfade, in seconds. */
  static readonly XFADE = 0.015;

  /**
   * A new rate from `at`; the phase runs on, unbroken. The frequency moves over a few milliseconds, not in one
   * sample (P9 review M10); a synced LFO is put back on the bar at the next Play.
   */
  rate(hz: number, at?: number): void {
    this.hz = hz;
    const f = this.osc?.frequency;
    if (!f) return;
    const t = Math.max(at ?? 0, raw().currentTime);
    f.cancelScheduledValues(t);
    f.setTargetAtTime(hz, t, 0.004);
  }

  get frequency(): number {
    return this.hz;
  }

  stop(at?: number): void {
    const osc = this.osc;
    if (!osc) return;
    const lift = this.lift;
    const g = this.oscGain;
    this.osc = null;
    this.lift = null;
    this.oscGain = null;
    Lfo.sources -= 2;
    const t = Math.max(at ?? 0, raw().currentTime);
    for (const n of [osc, lift]) {
      if (!n) continue;
      n.stop(t);
      n.onended = () => {
        n.disconnect();
        if (n === osc) g?.disconnect();
      };
    }
  }

}

/** A depth gain from an LFO output into a native parameter: connected while its depth is above 0. */
export class ModRoute {
  readonly gain: GainNode;
  private on = false;
  private gen = 0;
  constructor(
    from: AudioNode,
    private readonly to: AudioParam,
  ) {
    this.gain = raw().createGain();
    this.gain.gain.value = 0;
    from.connect(this.gain);
  }
  set(depth: number, at?: number): void {
    const gen = ++this.gen;
    if (depth !== 0 && !this.on) {
      this.gain.connect(this.to);
      this.on = true;
    }
    glideParam(this.gain.gain, depth, at);
    if (depth === 0 && this.on)
      afterFade(
        () => {
          if (gen !== this.gen || !this.on) return;
          this.gain.disconnect();
          this.on = false;
        },
        RAMP,
        at,
      );
  }
}

/**
 * The noise wave's breath (spec 8.7): pink noise through a band-pass that follows the top note, shaped by the
 * instrument's envelope. One per instrument (it breathes with every note, not per voice), running only while the
 * noise wave is in use and the transport plays (P7 review M6).
 */
export class Breath {
  private readonly noise = new Tone.Noise("pink");
  private readonly band = new Tone.Filter({ frequency: 2000, type: "bandpass", Q: 1.6, rolloff: -12 });
  private readonly env = new Tone.AmplitudeEnvelope({ attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 });
  private readonly out: Tone.Gain;
  private live = false;
  private gen = 0;
  /** The noise wave is chosen; the transport plays; the release its stop waits for. */
  private chosen = false;
  private playing: boolean;
  private releaseTime = 0.3;

  constructor(dest: Tone.InputNode, playing: boolean) {
    // Mono (Tone's noise buffers are stereo): the voices into the same filter are mono, and a stereo input arriving
    // makes Chrome rebuild the filter's per-channel state, which cuts the sound for a moment (measured: a click on
    // every switch to the noise wave while a drone held).
    this.out = new Tone.Gain(0.9);
    this.out.channelCount = 1;
    this.out.channelCountMode = "explicit";
    this.out.connect(dest);
    this.noise.chain(this.band, this.env, this.out);
    this.playing = playing;
  }

  /** The band's centre for a note: an octave over it, never past 8 kHz (under C1's 10 kHz). */
  private static centre(hz: number): number {
    return Math.min(8000, Math.max(200, hz * 2));
  }

  /** The noise wave chosen or not; `release`: how long a note still sounding takes to fade. */
  setOn(on: boolean, release = 0.3): void {
    this.chosen = on;
    this.releaseTime = release;
    this.update();
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.update();
  }

  private update(): void {
    const want = this.chosen && this.playing;
    const gen = ++this.gen;
    if (want && !this.live) {
      this.noise.start();
      this.live = true;
    } else if (!want && this.live) {
      this.env.triggerRelease(Tone.now());
      afterFade(() => {
        if (gen !== this.gen || !this.live) return;
        this.noise.stop();
        this.live = false;
      }, this.releaseTime + 0.1);
    }
  }

  get on(): boolean {
    return this.live;
  }

  shape(e: { attack: number; decay: number; sustain: number; release: number }): void {
    this.env.set({ attack: Math.max(0.005, e.attack), decay: Math.max(0.01, e.decay), sustain: e.sustain, release: Math.max(0.01, e.release) });
  }

  play(hz: number, time: number, dur: number, vel: number): void {
    if (!this.live) return;
    glideParam(this.band.frequency, Breath.centre(hz), time);
    this.env.triggerAttackRelease(Math.max(0.01, dur), time, vel);
  }

  hold(hz: number, time: number, vel: number): void {
    if (!this.live) return;
    glideParam(this.band.frequency, Breath.centre(hz), time);
    this.env.triggerAttack(time, vel);
  }

  glide(hz: number, time: number, seconds: number): void {
    if (this.live) glideParam(this.band.frequency, Breath.centre(hz), time, seconds / 3);
  }

  release(time: number): void {
    this.env.triggerRelease(Math.max(time, Tone.now()));
  }

  dispose(): void {
    this.noise.dispose();
    this.band.dispose();
    this.env.dispose();
    this.out.dispose();
  }
}

/**
 * The shared reverb with a decay that can be changed while playing (spec 8.10: up to 20 seconds). P7, for the phone's
 * CPU: the impulse is never longer than REVERB_IR (3.2 s, the length G1 shipped); a longer decay feeds the output
 * back through a delay of the impulse's length (reverbPlan), so 20 s costs what 3.2 s does. A new decay builds a new
 * slot beside the old one; the sends cross over to it in a fade and the old one rings out, then is freed.
 *
 * P7 review E2: at most two slots live at once, the one sounding and one ringing out. When a third is needed (a drag
 * of the Tail dial), the ringing one fades out over about 0.3 s and is freed before the new one is built.
 * P7 review S2: inside the loop a one-pole low-pass darkens each pass, and the loop's delay swings by under a
 * millisecond, so the tail is not the same noise repeated every 3.2 s.
 */
interface ReverbSlot {
  gate: GainNode;
  conv: ConvolverNode;
  out: GainNode;
  delay: DelayNode | null;
  tone: IIRFilterNode | null;
  loop: GainNode | null;
  swing: OscillatorNode | null;
  swingDepth: GainNode | null;
  decay: number;
  freed: boolean;
}

/** How long the ringing reverb takes to fade when a third is needed, and the wait before it is freed (about -60 dB). */
const REVERB_KILL_TAU = 0.06;
const REVERB_KILL = 0.42;

export class ReverbBank {
  readonly input = new Tone.Gain(1);
  private current: ReverbSlot;
  /** The previous reverb, ringing out its tail; null once freed. */
  private ringing: ReverbSlot | null = null;
  /** A ringing reverb fading out early to make room; the next swap waits for it to be freed. */
  private fading: ReverbSlot | null = null;
  private gen = 0;
  private wanted: number;
  private wantedAt: number | undefined;
  private seed = 1;
  /** Slots built and not yet freed, and the most there have been at once (for the smoke test: never above 2). */
  slots = 0;
  maxSlots = 0;

  constructor(
    private readonly dest: Tone.InputNode,
    decay: number,
  ) {
    this.current = this.slot(decay, 1);
    this.wanted = decay;
  }

  /** One reverb: input gate, convolver, the feedback loop for a decay past the impulse, output. */
  private slot(decay: number, gain: number): ReverbSlot {
    const ctx = raw();
    const { length, feedback } = reverbPlan(decay);
    const [l, r] = reverbImpulse(length, decay, ctx.sampleRate, createRng(this.seed++));
    const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
    buf.copyToChannel(l, 0);
    buf.copyToChannel(r, 1);
    const gate = ctx.createGain();
    gate.gain.value = gain;
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    const out = ctx.createGain();
    Tone.connect(this.input, gate);
    gate.connect(conv);
    conv.connect(out);
    Tone.connect(out, this.dest);
    let delay: DelayNode | null = null;
    let tone: IIRFilterNode | null = null;
    let loop: GainNode | null = null;
    let swing: OscillatorNode | null = null;
    let swingDepth: GainNode | null = null;
    if (feedback > 0) {
      const { feedforward, feedback: fb } = loopLowpass(REVERB_LOOP_HZ, ctx.sampleRate);
      const len = buf.length / ctx.sampleRate;
      delay = ctx.createDelay(length + 0.1);
      // 0.4 ms short of the impulse, swung by 0.4 ms each way once every 7.7 s: the passes never line up exactly.
      delay.delayTime.value = len - 0.0004;
      tone = ctx.createIIRFilter(feedforward, fb);
      loop = ctx.createGain();
      loop.gain.value = feedback;
      out.connect(delay);
      delay.connect(tone);
      tone.connect(loop);
      loop.connect(out);
      swing = ctx.createOscillator();
      swing.frequency.value = 0.13;
      swingDepth = ctx.createGain();
      swingDepth.gain.value = 0.0004;
      swing.connect(swingDepth);
      swingDepth.connect(delay.delayTime);
      swing.start();
    }
    this.slots++;
    this.maxSlots = Math.max(this.maxSlots, this.slots);
    return { gate, conv, out, delay, tone, loop, swing, swingDepth, decay, freed: false };
  }

  /** The decay now sounding, in seconds. */
  get decay(): number {
    return this.current.decay;
  }

  /** The decay asked for last (it sounds once its reverb is built). */
  get target(): number {
    return this.wanted;
  }

  /**
   * Ask for a decay from audio time `at` (else now; P7 review M2: a vibe's bar line). Moves within 0.3 s of each
   * other build one reverb, for the last of them.
   */
  setDecay(seconds: number, at?: number): void {
    this.wanted = seconds;
    this.wantedAt = at;
    const gen = ++this.gen;
    Tone.getContext().setTimeout(() => {
      if (gen === this.gen) this.change();
    }, 0.3);
  }

  private change(): void {
    if (this.fading) return; // it calls back once freed
    if (Math.abs(this.wanted - this.current.decay) < 0.05) return;
    const r = this.ringing;
    if (r) {
      // A third reverb is needed: the ringing one fades out and is freed first.
      this.ringing = null;
      this.fading = r;
      glideParam(r.out.gain, 0, undefined, REVERB_KILL_TAU);
      Tone.getContext().setTimeout(() => {
        this.free(r);
        this.fading = null;
        this.change();
      }, REVERB_KILL);
      return;
    }
    this.swap(this.wanted, this.wantedAt);
  }

  private swap(decay: number, at?: number): void {
    const now = Tone.getContext().currentTime;
    const t = Math.max(at ?? 0, now);
    const old = this.current;
    const next = this.slot(decay, 0);
    this.current = next;
    this.ringing = old;
    glideParam(next.gate.gain, 1, t, 0.05);
    glideParam(old.gate.gain, 0, t, 0.05);
    // The old reverb rings out its own tail, then is freed.
    Tone.getContext().setTimeout(() => this.free(old), t - now + old.decay + 1);
  }

  private free(s: ReverbSlot): void {
    if (s.freed) return;
    s.freed = true;
    this.slots--;
    if (this.ringing === s) this.ringing = null;
    try {
      this.input.disconnect(s.gate);
    } catch {
      // already gone
    }
    s.swing?.stop();
    for (const n of [s.gate, s.conv, s.out, s.delay, s.tone, s.loop, s.swing, s.swingDepth]) n?.disconnect();
  }
}

/**
 * The lo-fi master (spec 8.7): a slow pitch wobble (a delay line swung by a slow LFO), a bit-crush (a staircase
 * wave shaper, 8 bits) with a 6 kHz low-pass after it, and a hiss layer. Crossfaded against the dry master; off,
 * its wobble and hiss stop and the wet path leaves the chain.
 */
export class LoFi {
  readonly input = new Tone.Gain(1);
  readonly output = new Tone.Gain(1);
  private readonly dry = new Tone.Gain(1);
  private readonly wet = new Tone.Gain(0);
  private readonly delay = new Tone.Delay({ delayTime: 0.008, maxDelay: 0.03 });
  private readonly crush = new Tone.WaveShaper(LoFi.stairs(8), 4096);
  private readonly tone = new Tone.Filter({ frequency: 6000, type: "lowpass", rolloff: -12 });
  private readonly hiss = new Tone.Noise("pink");
  private readonly hissBand = new Tone.Filter({ frequency: 3000, type: "bandpass", Q: 0.5 });
  private readonly hissGain = new Tone.Gain(0);
  private readonly wobble = new Lfo();
  private readonly wobbleDepth: ModRoute;
  private on = false;
  private gen = 0;
  amount = 0;
  /** The transport runs: the hiss plays only then. */
  private playing = false;

  /** Seconds a reconnected delay line takes to play out what it held (its 8 ms, the wobble's 2 ms and a margin). */
  static readonly REFILL = 0.02;

  /** A staircase curve: `bits` of resolution over -1..1. */
  static stairs(bits: number): Float32Array {
    const n = 4096;
    const q = Math.pow(2, bits - 1);
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.round(((i / (n - 1)) * 2 - 1) * q) / q;
    return c;
  }

  constructor() {
    this.input.chain(this.dry, this.output);
    this.delay.chain(this.crush, this.tone, this.wet, this.output);
    this.hiss.chain(this.hissBand, this.hissGain, this.output);
    // About 2 ms of swing at 0.4 Hz: a pitch wobble of about 9 cents.
    this.wobbleDepth = new ModRoute(this.wobble.bi, nativeParam(this.delay.delayTime));
  }

  /** 0 off, 1 on (a fade either way). Anything above 0 is on (P7 review M4: a value between would comb-filter). */
  set(v: number, at?: number): void {
    const a = lofiAmount(v);
    if (a === this.amount) return;
    this.amount = a;
    const gen = ++this.gen;
    if (a > 0 && !this.on) {
      this.input.connect(this.delay);
      this.wobble.start(Tone.getContext().currentTime, 0.4);
      this.on = true;
      // P9 review E3 (found by the master click check on a sine): a delay line reconnected still holds the last
      // milliseconds it heard before it was cut, and plays them out first; its join with the new sound is a step.
      // The crossfade waits until the line has been refilled.
      at = Math.max(at ?? 0, Tone.getContext().currentTime) + LoFi.REFILL;
    }
    glideParam(this.dry.gain, Math.cos((a * Math.PI) / 2), at);
    glideParam(this.wet.gain, Math.sin((a * Math.PI) / 2), at);
    this.wobbleDepth.set(a * 0.002, at);
    this.setHiss(at);
    if (a === 0 && this.on)
      afterFade(
        () => {
          if (gen !== this.gen || !this.on) return;
          this.input.disconnect(this.delay);
          this.wobble.stop();
          this.on = false;
        },
        RAMP,
        at,
      );
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.setHiss();
  }

  private hissOn = false;
  private hissGen = 0;
  private setHiss(at?: number): void {
    const want = this.amount > 0 && this.playing;
    const gen = ++this.hissGen;
    if (want && !this.hissOn) {
      this.hiss.start();
      this.hissOn = true;
    }
    glideParam(this.hissGain.gain, want ? 0.012 * this.amount : 0, at);
    if (!want && this.hissOn)
      afterFade(
        () => {
          if (gen !== this.hissGen || !this.hissOn) return;
          this.hiss.stop();
          this.hissOn = false;
        },
        RAMP,
        at,
      );
  }

  get active(): boolean {
    return this.on;
  }
}

/**
 * The air layer (spec 8.10): pink noise through a band-pass that wanders over two octaves once every 23 s, its level
 * breathing once every 9 s, into the master and the reverb. It runs only while its level is above 0 and the
 * transport plays.
 */
export class Air {
  private readonly noise = new Tone.Noise("pink");
  private readonly band = new Tone.Filter({ frequency: 2500, type: "bandpass", Q: 0.9, rolloff: -12 });
  private readonly breathe = new Tone.Gain(0.6);
  private readonly level = new Tone.Gain(0);
  private readonly sweep = new Lfo();
  private readonly lung = new Lfo();
  private readonly sweepRoute: ModRoute;
  private readonly lungRoute: ModRoute;
  private on = false;
  private gen = 0;
  amount = 0;
  private playing = false;

  constructor(dest: Tone.InputNode, reverb: Tone.InputNode) {
    this.noise.chain(this.band, this.breathe, this.level);
    this.level.connect(dest);
    this.level.connect(reverb);
    // The band moves down by up to two octaves (never above its 2.5 kHz centre); the level swings 0.2..1.
    this.sweepRoute = new ModRoute(this.sweep.neg, nativeParam(this.band.detune));
    this.lungRoute = new ModRoute(this.lung.bi, nativeParam(this.breathe.gain));
  }

  set(v: number, at?: number): void {
    this.amount = Math.max(0, Math.min(1, v));
    this.update(at);
  }

  setPlaying(on: boolean): void {
    this.playing = on;
    this.update();
  }

  private update(at?: number): void {
    const want = this.amount > 0 && this.playing;
    const gen = ++this.gen;
    if (want && !this.on) {
      const now = Tone.getContext().currentTime;
      this.noise.start();
      this.sweep.start(now, 1 / 23, Math.PI);
      this.lung.start(now, 1 / 9, Math.PI);
      this.sweepRoute.set(2400);
      this.lungRoute.set(0.4);
      this.on = true;
    }
    // Air sits low: at 1 about -32 dB before the master.
    glideParam(this.level.gain, want ? 0.05 * this.amount : 0, at, want ? 0.3 : RAMP / 4);
    if (!want && this.on)
      afterFade(() => {
        if (gen !== this.gen || !this.on) return;
        this.noise.stop();
        this.sweep.stop();
        this.lung.stop();
        this.sweepRoute.set(0);
        this.lungRoute.set(0);
        this.on = false;
      }, 0.1, at);
  }

  get active(): boolean {
    return this.on;
  }
}
