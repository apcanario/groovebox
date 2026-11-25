/**
 * The Drop's sound (spec 8.9): the overlay that sits on top of the song while a drop builds, plays and winds down,
 * and the build and impact voices. It never writes the song: every extra layer is its own voice here, fed the notes
 * the sequencer plays, and everything returns to normal on the bar line the wind-down ends.
 *
 * The master path runs through it: master -> sweep filters -> gap -> pre -> comp -> high-pass -> low-pass -> lo-fi master.
 * - `gap` silences the music for the cliffhanger; `pre` is where the level follower listens (a held chord joins there).
 * - `comp` keeps the drop at the loudness of the section it came from (bigger means wider, not louder, spec 8.9): the
 *   engine sets it from the follower's readings, down when the extra layers add, up by at most COMP_TOP when the
 *   deeper pump takes, so the drop is never louder than the section.
 * - the high-pass and low-pass are the build's sweep (the low end filtered out, or the top closed).
 * - the impact voices join after `comp`, so the follower does not hear them; they sit 2 dB under what they were (P10
 *   review S3), so the impact's peak keeps a margin under the limiter.
 *
 * The extra layers are stereo pairs (left and right panned out by the width), each pair with its own level, which
 * is how the drop opens (or blooms), and how it narrows and falls away. Voices are native oscillators and noise
 * buffers made per note, at most VOICE_CAP alive at once (P10, the voice cap): a voice past it is not played. Every
 * voice counts, the riser and the impact's included (P10 review M1). A note the instrument holds over bar lines gets
 * one voice for as long as it is held (P10 review S8): `holdNotes` starts it, `letGo` ends it with its release.
 */
import * as Tone from "tone";
import { createRng } from "../music/random.ts";
import type { DropRecipe } from "../music/drop.ts";

/** At most this many overlay oscillators and noise hits sound at once (every voice of the overlay); one past it is not played. */
export const VOICE_CAP = 48;

/** The most the level follower lifts the drop (+2 dB), to make up for the deeper pump. */
export const COMP_TOP = 1.25;

/** The impact voices' level against P10's first build (-2 dB, P10 review S3). */
const IMPACT = Math.pow(10, -2 / 20);

/** A voice that can be let go early (a held note's), with its release. */
interface Voice {
  release(t: number): void;
}

const raw = (): AudioContext => Tone.getContext().rawContext as unknown as AudioContext;
const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Hold a param where it is at `t` (else now) and clear what is scheduled after. */
function hold(p: AudioParam, t: number): void {
  const at = Math.max(t, raw().currentTime);
  if (typeof p.cancelAndHoldAtTime === "function") p.cancelAndHoldAtTime(at);
  else {
    p.cancelScheduledValues(at);
    p.setValueAtTime(p.value, at);
  }
}

/** A left and a right bus, each through an optional filter and a panner, into one level. */
class Pair {
  readonly l: GainNode;
  readonly r: GainNode;
  readonly pl: StereoPannerNode;
  readonly pr: StereoPannerNode;
  readonly out: GainNode;
  readonly filters: BiquadFilterNode[] = [];

  constructor(dest: AudioNode, filter?: { type: BiquadFilterType; hz: number; q: number }) {
    const c = raw();
    this.l = c.createGain();
    this.r = c.createGain();
    this.pl = c.createStereoPanner();
    this.pr = c.createStereoPanner();
    this.out = c.createGain();
    this.out.gain.value = 0;
    for (const [side, pan] of [
      [this.l, this.pl],
      [this.r, this.pr],
    ] as const) {
      if (filter) {
        const f = c.createBiquadFilter();
        f.type = filter.type;
        f.frequency.value = filter.hz;
        f.Q.value = filter.q;
        side.connect(f).connect(pan);
        this.filters.push(f);
      } else side.connect(pan);
      pan.connect(this.out);
    }
    this.out.connect(dest);
  }

  /** Spread the two sides to -s and +s from `t`, over `tau`. */
  spread(s: number, t: number, tau = 0.02): void {
    hold(this.pl.pan, t);
    hold(this.pr.pan, t);
    this.pl.pan.setTargetAtTime(-s, t, tau);
    this.pr.pan.setTargetAtTime(s, t, tau);
  }

  side(i: number): GainNode {
    return i % 2 === 0 ? this.l : this.r;
  }
}

export type OverlayGroup = "synth" | "bass" | "drums" | "leads";

export class DropOverlay {
  readonly input: GainNode;
  readonly output: BiquadFilterNode;
  /** Where the level follower listens: the music after the gap, before `comp`. */
  readonly pre: GainNode;
  private gap: GainNode;
  private comp: GainNode;
  private hp: BiquadFilterNode;
  private lp: BiquadFilterNode;
  private impactBus: GainNode;
  private holdBus: BiquadFilterNode;
  private fxBus: GainNode;
  private verb: GainNode;
  private leadIn: GainNode;
  private groups: Record<OverlayGroup, Pair>;
  private noise: AudioBuffer;
  private rng = createRng(0x0d0b);
  private riser: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  /** Overlay voices sounding now, and notes not played because the cap was full (for the smoke test). */
  live = 0;
  dropped = 0;
  /** Most voices sounding at once since the last read (for the smoke test's cost line). */
  most = 0;
  private spreadNow = 0.8;
  /** Voices of the notes held over bar lines, by instrument (P10 review S8). */
  private held = new Map<string, Voice[]>();
  /** Set while `holdNotes` starts voices: they are collected here. */
  private collect: Voice[] | null = null;
  /** A bloom keeps its grown reverb through the drop and lets it go over the wind-down (P10 review M4). */
  private keepVerb = false;

  constructor(dest: { duck: Tone.InputNode; drums: Tone.InputNode; reverb: Tone.InputNode }) {
    const c = raw();
    this.input = c.createGain();
    this.gap = c.createGain();
    this.pre = c.createGain();
    this.comp = c.createGain();
    this.hp = c.createBiquadFilter();
    this.hp.type = "highpass";
    this.hp.frequency.value = 10;
    this.hp.Q.value = 0.7;
    this.lp = c.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.frequency.value = 20000;
    this.lp.Q.value = 0.7;
    this.output = this.lp;
    this.input.connect(this.gap).connect(this.pre).connect(this.comp).connect(this.hp).connect(this.lp);
    this.impactBus = c.createGain();
    this.impactBus.connect(this.hp);
    this.holdBus = c.createBiquadFilter();
    this.holdBus.type = "lowpass";
    this.holdBus.frequency.value = 700;
    this.holdBus.connect(this.pre);
    // The build's riser and roll go to the drum bus (not ducked by the kick).
    this.fxBus = c.createGain();
    Tone.connect(this.fxBus, dest.drums);
    // The reverb grows: the instruments' own sound sent once more into the shared reverb, 0 outside a build.
    this.verb = c.createGain();
    this.verb.gain.value = 0;
    Tone.connect(this.verb, dest.reverb);
    const duck = c.createGain();
    Tone.connect(duck, dest.duck);
    const drums = c.createGain();
    Tone.connect(drums, dest.drums);
    this.groups = {
      synth: new Pair(duck, { type: "lowpass", hz: 5000, q: 0.5 }),
      // The bass's wide upper layer, filtered: the centre stays as it was.
      bass: new Pair(duck, { type: "bandpass", hz: 900, q: 0.6 }),
      drums: new Pair(drums),
      leads: new Pair(duck, { type: "lowpass", hz: 7000, q: 0.5 }),
    };
    // The lead doubled an octave up with a short stereo delay: straight on the left, 14 ms later on the right.
    this.leadIn = c.createGain();
    this.leadIn.connect(this.groups.leads.l);
    const d = c.createDelay(0.05);
    d.delayTime.value = 0.014;
    this.leadIn.connect(d).connect(this.groups.leads.r);
    // Noise from the seeded generator, two seconds, shared by every noise voice.
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const ch = this.noise.getChannelData(0);
    const r = createRng(0x5eed);
    for (let i = 0; i < ch.length; i++) ch[i] = r.next() * 2 - 1;
  }

  /** Every instrument's own sound also goes to the build's reverb send. */
  feedReverb(levels: Tone.ToneAudioNode[]): void {
    for (const l of levels) Tone.connect(l, this.verb);
  }

  // ---- The build -------------------------------------------------------------------------------

  /**
   * The build starts at `t` and lasts `seconds` (spec 8.9 step 1): the low end filtered out (or the top closed), the
   * riser, the reverb growing. A bloom opens the extra layers over the build instead.
   */
  begin(t: number, r: DropRecipe, seconds: number, levels: Record<OverlayGroup, number>): void {
    const end = t + seconds;
    this.keepVerb = r.bloom && r.parts.reverb;
    this.spreadNow = 0.5 + 0.5 * r.width;
    for (const g of Object.values(this.groups)) g.spread(this.spreadNow, t);
    if (r.parts.sweep === "high") {
      hold(this.hp.frequency, t);
      this.hp.frequency.setValueAtTime(10, t);
      this.hp.frequency.exponentialRampToValueAtTime(380, end - 0.01);
    } else if (r.parts.sweep === "low") {
      hold(this.lp.frequency, t);
      this.lp.frequency.setValueAtTime(20000, t);
      this.lp.frequency.exponentialRampToValueAtTime(450, end - 0.01);
    }
    if (r.parts.reverb) {
      hold(this.verb.gain, t);
      this.verb.gain.setValueAtTime(0, t);
      this.verb.gain.linearRampToValueAtTime(0.45, end);
    }
    if (r.parts.riser) this.startRiser(t, end);
    if (r.bloom) {
      for (const k of Object.keys(levels) as OverlayGroup[]) {
        const g = this.groups[k].out.gain;
        hold(g, t);
        g.linearRampToValueAtTime(levels[k], end);
      }
    }
  }

  private startRiser(t: number, end: number): void {
    this.stopRiser(t);
    if (!this.room()) return;
    const c = raw();
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(300, t);
    filter.frequency.exponentialRampToValueAtTime(8000, end);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.22, end);
    src.connect(filter).connect(gain).connect(this.fxBus);
    src.start(t);
    this.track(src, [filter, gain]);
    this.riser = { src, gain, filter };
  }

  private stopRiser(t: number): void {
    const r = this.riser;
    if (!r) return;
    this.riser = null;
    hold(r.gain.gain, t);
    r.gain.gain.setTargetAtTime(0, t, 0.01);
    try {
      r.src.stop(Math.max(t, raw().currentTime) + 0.08);
    } catch {
      // already stopped
    }
  }

  /** The roll's hits of one bar from `t` (sixteenths `at`, velocities from rollHits). */
  roll(t: number, sixteenth: number, hits: { at: number; vel: number }[]): void {
    hits.forEach((h, i) => {
      const at = t + h.at * sixteenth;
      this.noiseHit(at, 0.09, 0.22 * h.vel, "bandpass", 1900, 0.9, this.fxBus, i % 2 === 0 ? -0.25 : 0.25);
      this.tone(at, 190, 140, 0.06, 0.12 * h.vel, this.fxBus);
    });
  }

  /**
   * The cliffhanger from `t` to the bar line `end` (spec 8.9 step 2): Gap silences the music; Hold silences it too and
   * lets one filtered chord hang. The riser stops with it.
   */
  cliff(t: number, end: number, kind: "gap" | "hold", chord: number[]): void {
    hold(this.gap.gain, t);
    this.gap.gain.linearRampToValueAtTime(0, t + 0.012);
    this.stopRiser(t);
    if (kind === "hold")
      for (const [i, m] of chord.slice(0, 4).entries())
        this.osc("sawtooth", m, i % 2 ? 6 : -6, t, end - t - 0.01, 0.045, 0.01, 0.04, this.holdBus);
  }

  // ---- The impact and the drop ----------------------------------------------------------------

  /**
   * The bar line of the drop (spec 8.9 steps 3 and 4): the music back in, filters open, the riser and the reverb's
   * growth gone, the impact voices, and the extra layers at their levels.
   */
  impact(t: number, r: DropRecipe, bar: number, levels: Record<OverlayGroup, number>, comp: number | null): void {
    this.normalAt(t, this.keepVerb);
    // P10 review S1: a bloom arrives with no step in the gain (the follower has been at it through the build).
    if (comp !== null) this.setComp(comp, t, 0.01);
    if (!r.bloom)
      for (const k of Object.keys(levels) as OverlayGroup[]) {
        const g = this.groups[k].out.gain;
        hold(g, t);
        g.setTargetAtTime(levels[k], t, 0.01);
      }
    const c = raw();
    if (r.impact.sweep)
      for (const pan of [-0.6, 0.6]) {
        if (!this.room()) break;
        const src = this.noiseSource();
        const f = c.createBiquadFilter();
        f.type = "bandpass";
        f.Q.value = 1.4;
        f.frequency.setValueAtTime(7000, t);
        f.frequency.exponentialRampToValueAtTime(180, t + bar);
        const g = c.createGain();
        g.gain.setValueAtTime(0.2 * IMPACT, t);
        g.gain.setTargetAtTime(0, t, bar / 3);
        const p = c.createStereoPanner();
        p.pan.value = pan;
        src.connect(f).connect(g).connect(p).connect(this.impactBus);
        src.start(t, this.rng.next());
        src.stop(t + bar * 1.2);
        this.track(src, [f, g, p]);
      }
    if (r.impact.sub && this.room()) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(78, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35 * IMPACT, t + 0.006);
      g.gain.setTargetAtTime(0, t + 0.05, 0.45);
      o.connect(g).connect(this.impactBus);
      o.start(t);
      o.stop(t + 2.6);
      this.track(o, [g]);
    }
    if (r.impact.burst)
      for (const pan of [-1, 1]) this.noiseHit(t, 0.5, 0.16 * IMPACT, "highpass", 2600, 0.7, this.impactBus, pan);
  }

  /** The level of one group from `t` (the Width knob turned while the drop is on). */
  level(k: OverlayGroup, v: number, t: number): void {
    const g = this.groups[k].out.gain;
    hold(g, t);
    g.setTargetAtTime(v, t, 0.05);
  }

  /** Spread every pair to the width `w` (0..1) from `t`. */
  width(w: number, t: number): void {
    this.spreadNow = 0.5 + 0.5 * w;
    for (const g of Object.values(this.groups)) g.spread(this.spreadNow, t, 0.05);
  }

  /**
   * The follower's gain (spec 8.9: the drop sits at the loudness of the section it came from). It may lift by at most
   * COMP_TOP, only to make up what the deeper pump takes, never past the section's own level (the engine aims at it).
   */
  setComp(v: number, t = raw().currentTime, tau = 0.15): void {
    const g = this.comp.gain;
    hold(g, t);
    g.setTargetAtTime(Math.max(0.2, Math.min(COMP_TOP, v)), t, tau);
  }

  get compValue(): number {
    return this.comp.gain.value;
  }

  /**
   * The wind-down from `t` over `seconds`: the extra layers narrow and fall away, and the follower's gain comes back
   * to 1 with them (P10 review S2: the follower is held after the drop's first two bars); a bloom's reverb goes too.
   */
  wind(t: number, seconds: number): void {
    hold(this.comp.gain, t);
    this.comp.gain.linearRampToValueAtTime(1, t + seconds);
    if (this.keepVerb) {
      hold(this.verb.gain, t);
      this.verb.gain.linearRampToValueAtTime(0, t + seconds);
    }
    for (const g of Object.values(this.groups)) {
      hold(g.out.gain, t);
      g.out.gain.linearRampToValueAtTime(0, t + seconds);
      hold(g.pl.pan, t);
      hold(g.pr.pan, t);
      g.pl.pan.linearRampToValueAtTime(0, t + seconds);
      g.pr.pan.linearRampToValueAtTime(0, t + seconds);
    }
  }

  /** The bar line where the music is back at its normal size (after the wind-down, or a cancelled build). */
  end(t: number): void {
    this.keepVerb = false;
    this.normalAt(t);
    this.setComp(1, t, 0.02);
    for (const k of [...this.held.keys()]) this.letGo(k, t);
    for (const g of Object.values(this.groups)) {
      hold(g.out.gain, t);
      g.out.gain.setTargetAtTime(0, t, 0.02);
    }
  }

  /** Everything back at once (Stop). */
  reset(): void {
    const t = raw().currentTime;
    this.end(t);
    for (const s of [...this.sources]) {
      try {
        s.stop(t + 0.05);
      } catch {
        // not started or already stopped
      }
    }
  }

  private normalAt(t: number, keepVerb = false): void {
    hold(this.gap.gain, t);
    this.gap.gain.setTargetAtTime(1, t, 0.002);
    hold(this.hp.frequency, t);
    this.hp.frequency.setTargetAtTime(10, t, 0.004);
    hold(this.lp.frequency, t);
    this.lp.frequency.setTargetAtTime(20000, t, 0.004);
    if (!keepVerb) {
      hold(this.verb.gain, t);
      this.verb.gain.setTargetAtTime(0, t, 0.4);
    }
    this.stopRiser(t);
  }

  /**
   * P10 review S8: the notes an instrument holds over bar lines (`key`: the instrument), doubled once for as long as
   * they sound (`dur`, Infinity until let go), not again on every bar line. Replaces what the instrument held before.
   */
  holdNotes(key: string, kind: "synth" | "bass" | "lead", notes: number[], t: number, dur: number, vel: number, pad: boolean): void {
    this.letGo(key, t);
    const voices: Voice[] = [];
    this.collect = voices;
    if (kind === "synth") this.synth(notes, t, dur, vel, true);
    else if (kind === "bass") this.bass(notes[0], t, dur, vel, true);
    else this.lead(notes, t, dur, vel, pad);
    this.collect = null;
    this.held.set(key, voices);
  }

  /** The instrument's held voices let go at `t`, with their release. */
  letGo(key: string, t: number): void {
    const v = this.held.get(key);
    if (!v) return;
    this.held.delete(key);
    for (const x of v) x.release(t);
  }

  /** An instrument has voices held by `holdNotes`. */
  holding(key: string): boolean {
    return this.held.has(key);
  }

  // ---- The extra layers' notes ----------------------------------------------------------------

  /** Synth: extra detuned voices panned wide, and a second layer an octave up. */
  synth(notes: number[], t: number, dur: number, vel: number, soft = false): void {
    const g = this.groups.synth;
    const [a, r] = soft ? [0.25, 0.6] : [0.006, 0.12];
    for (const [i, m] of notes.slice(0, 4).entries()) {
      this.osc("sawtooth", m, -16, t, dur, 0.04 * vel, a, r, g.l);
      this.osc("sawtooth", m, 16, t, dur, 0.04 * vel, a, r, g.r);
      this.osc("triangle", m + 12, 0, t, dur, 0.035 * vel, a, r, g.side(i));
    }
  }

  /** Bass: a wide, filtered upper layer around the centre, an octave up. */
  bass(midi: number, t: number, dur: number, vel: number, soft = false): void {
    const g = this.groups.bass;
    const [a, r] = soft ? [0.25, 0.6] : [0.006, 0.08];
    this.osc("sawtooth", midi + 12, -12, t, dur, 0.06 * vel, a, r, g.l);
    this.osc("sawtooth", midi + 12, 12, t, dur, 0.06 * vel, a, r, g.r);
  }

  /** Layers: the lead doubled an octave up (short stereo delay); a pad wider and brighter. */
  lead(notes: number[], t: number, dur: number, vel: number, pad: boolean): void {
    // The pad: an octave up, a detuned voice on each side (they beat against each other, so the two sides differ).
    if (pad)
      for (const m of notes.slice(0, 4)) {
        this.osc("sawtooth", m + 12, -9, t, dur, 0.06 * vel, 0.35, 0.9, this.groups.leads.l);
        this.osc("sawtooth", m + 12, 9, t, dur, 0.06 * vel, 0.35, 0.9, this.groups.leads.r);
      }
    else for (const m of notes.slice(0, 3)) this.osc("triangle", m + 12, 0, t, dur, 0.065 * vel, 0.005, 0.12, this.leadIn);
  }

  /** Drums: open hats on the off-beats, a ride-like shimmer on every sixteenth and extra percussion, panned out. */
  drumStep(t: number, step: number): void {
    const out = this.groups.drums;
    if (step % 4 === 2) this.noiseHit(t, 0.16, 0.09, "highpass", 7000, 0.7, out.l);
    this.noiseHit(t, 0.06, step % 2 === 0 ? 0.05 : 0.032, "bandpass", 9500, 1.2, out.r);
    if (step === 3 || step === 11) this.tone(t, 330, 220, 0.16, 0.1, out.side(step === 3 ? 0 : 1));
    if (step === 14) this.tone(t, 420, 300, 0.12, 0.07, out.r);
  }

  // ---- Voices -----------------------------------------------------------------------------------

  private room(): boolean {
    if (this.live >= VOICE_CAP) {
      this.dropped++;
      return false;
    }
    return true;
  }

  private track(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.live++;
    this.most = Math.max(this.most, this.live);
    this.sources.add(src);
    src.onended = () => {
      this.live--;
      this.sources.delete(src);
      src.disconnect();
      for (const n of nodes) n.disconnect();
    };
  }

  private osc(type: OscillatorType, midi: number, detune: number, t: number, dur: number, peak: number, attack: number, release: number, dest: AudioNode): void {
    if (!this.room()) return;
    const c = raw();
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = hz(midi);
    o.detune.value = detune;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    o.connect(g).connect(dest);
    o.start(t);
    const stopAt = (off: number): void => {
      g.gain.setTargetAtTime(0, off, release / 4);
      o.stop(off + release * 1.3 + 0.02);
    };
    if (Number.isFinite(dur)) {
      const off = t + Math.max(attack, dur);
      g.gain.setValueAtTime(peak, off);
      stopAt(off);
    }
    this.track(o, [g]);
    let done = false;
    this.collect?.push({
      release: (at: number) => {
        if (done) return;
        done = true;
        hold(g.gain, at);
        try {
          stopAt(Math.max(at, raw().currentTime));
        } catch {
          // already ended
        }
      },
    });
  }

  private noiseSource(): AudioBufferSourceNode {
    const s = raw().createBufferSource();
    s.buffer = this.noise;
    return s;
  }

  private noiseHit(t: number, decay: number, peak: number, type: BiquadFilterType, f: number, q: number, dest: AudioNode, pan = 0): void {
    if (!this.room()) return;
    const c = raw();
    const src = this.noiseSource();
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = f;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.002, decay / 4);
    const nodes: AudioNode[] = [filter, g];
    src.connect(filter).connect(g);
    if (pan) {
      const p = c.createStereoPanner();
      p.pan.value = pan * this.spreadNow;
      g.connect(p).connect(dest);
      nodes.push(p);
    } else g.connect(dest);
    src.start(t, this.rng.next() * 1.5);
    src.stop(t + decay * 1.5 + 0.02);
    this.track(src, nodes);
  }

  /** A short tuned hit falling from `from` to `to` Hz (the roll's body, the percussion). */
  private tone(t: number, from: number, to: number, decay: number, peak: number, dest: AudioNode): void {
    if (!this.room()) return;
    const c = raw();
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.002, decay / 4);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + decay * 1.5 + 0.02);
    this.track(o, [g]);
  }
}
