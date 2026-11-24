/**
 * Effects (P9, spec 8.8): the twelve effects and the two slots each instrument has, built from native Web Audio
 * nodes (cheaper than Tone's) and, for Crush and Shifter, a small AudioWorklet. Only src/engine/ imports Tone.
 *
 * A slot sits in its instrument's channel after the filter and drive and before the level dial, so the sends and the
 * Drop's meters hear the effect. Each slot is a dry path and, while on, its effect: switching crossfades the two with
 * setTargetAtTime curves from wherever they are (no step, so no click). An off slot is disconnected: once its fade is
 * done the effect is cut from the slot's input and output, its sources stop, and a fresh copy is built, unconnected,
 * ready for the next switch on, so switching on costs no node construction and no stale delay line replays. Changing
 * a slot's effect while it is on builds the new effect and crossfades from the old one, which is then freed.
 *
 * The synced effects (Tremolo, Pan, Gate, Vowel's movement, Echo's time, and Phaser and Flanger at a note value) follow
 * the tempo; Tremolo, Pan and Vowel start their cycle on the bar when the transport starts. Gate is scheduled from the
 * sequencer's steps on the audio clock. Ring's Follow is told each note the instrument plays. Every mapping from a
 * knob to a value lives in src/music/effects.ts. No filter here opens past 10 kHz (C1).
 */
import * as Tone from "tone";
import {
  FORMANT_GAINS,
  SYNC_RATES,
  type EffectId,
  type FxKnobs,
  type FxSlot,
  chorusDepth,
  chorusHz,
  crushBits,
  crushRate,
  echoBeats,
  feedback,
  formantCents,
  formantsAt,
  fuzzDrive,
  fuzzToneHz,
  gateOpen,
  gatePattern,
  gateTau,
  mixGains,
  phaserCents,
  rateHz,
  ringCarrier,
  shiftFeedback,
  shiftHz,
  stepIndex,
  sweepRate,
  vowelBeats,
  vowelSwing,
} from "../music/effects.ts";
import { afterFade, Lfo, ModRoute } from "./mods.ts";

const RAMP = 0.03;

function raw(): BaseAudioContext {
  return Tone.getContext().rawContext as unknown as BaseAudioContext;
}
const now = (): number => raw().currentTime;

/** The transport as the synced effects read it: beats at an audio time (0 while stopped) and the tempo. */
export interface FxClock {
  beatsAt(t: number): number;
  bpm(): number;
}

/**
 * For the smoke test's proof that its click check can fail (P9): with `hard` set, every slot switch steps its gains
 * at once instead of ramping them. Never set by the app.
 */
export const fxDebug = { hard: false };

/** Move a native parameter to `value` from `at` (else now), from wherever it is: no step. */
function glide(p: AudioParam, value: number, at?: number, tau = RAMP / 4): void {
  const t = Math.max(at ?? 0, now());
  p.cancelScheduledValues(t);
  p.setTargetAtTime(value, t, tau);
}

/** A slot's switch: a ramp, or (fxDebug.hard) a step. */
function fade(p: AudioParam, value: number, at?: number): void {
  if (!fxDebug.hard) return glide(p, value, at);
  const t = Math.max(at ?? 0, now());
  p.cancelScheduledValues(t);
  p.setValueAtTime(value, t);
}

// ---- The worklet: Crush and Shifter --------------------------------------------------------------

const FX_WORKLET = `
class GbCrush extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "bits", defaultValue: 8, minValue: 1, maxValue: 16, automationRate: "k-rate" },
      { name: "rate", defaultValue: 8000, minValue: 100, maxValue: 96000, automationRate: "k-rate" },
    ];
  }
  constructor() { super(); this.ph = 1; this.held = [0, 0]; }
  process(inputs, outputs, p) {
    const inp = inputs[0], out = outputs[0];
    if (!inp || !inp.length) return true;
    const q = Math.pow(2, p.bits[0] - 1), step = p.rate[0] / sampleRate;
    for (let i = 0; i < out[0].length; i++) {
      this.ph += step;
      const take = this.ph >= 1;
      if (take) this.ph -= Math.floor(this.ph);
      for (let c = 0; c < out.length; c++) {
        const src = inp[c] || inp[0];
        if (take) this.held[c] = Math.round(src[i] * q) / q;
        out[c][i] = this.held[c];
      }
    }
    return true;
  }
}
registerProcessor("gb-crush", GbCrush);

// Frequency shift: a Hilbert pair of allpass chains (O. Niemitalo's coefficients) and a quadrature carrier.
const HA = [0.6923878, 0.9360654322959, 0.988229522686, 0.9987488452737].map((a) => a * a);
const HB = [0.4021921162426, 0.856171088242, 0.9722909545651, 0.9952884791278].map((a) => a * a);
class GbShift extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "shift", defaultValue: 0, minValue: -2000, maxValue: 2000, automationRate: "k-rate" },
      { name: "feedback", defaultValue: 0, minValue: 0, maxValue: 0.95, automationRate: "k-rate" },
    ];
  }
  constructor() {
    super();
    this.a = new Float64Array(16); this.b = new Float64Array(16);
    this.bd = 0; this.prev = 0; this.c = 1; this.s = 0;
  }
  chain(st, co, x) {
    for (let k = 0; k < 4; k++) {
      const o = k * 4;
      const y = co[k] * (x + st[o + 3]) - st[o + 1];
      st[o + 1] = st[o]; st[o] = x; st[o + 3] = st[o + 2]; st[o + 2] = y;
      x = y;
    }
    return x;
  }
  process(inputs, outputs, p) {
    const inp = inputs[0], out = outputs[0][0];
    if (!inp || !inp.length) return true;
    const src = inp[0], w = 2 * Math.PI * p.shift[0] / sampleRate, fb = p.feedback[0];
    const dc = Math.cos(w), ds = Math.sin(w);
    let c = this.c, s = this.s;
    for (let i = 0; i < out.length; i++) {
      const x = src[i] + fb * this.prev;
      const a = this.chain(this.a, HA, x);
      const b = this.chain(this.b, HB, x);
      const bd = this.bd; this.bd = b;
      const y = a * c - bd * s;
      out[i] = y;
      this.prev = Math.max(-2, Math.min(2, y));
      const c2 = c * dc - s * ds; s = c * ds + s * dc; c = c2;
    }
    const n = Math.hypot(c, s) || 1;
    this.c = c / n; this.s = s / n;
    return true;
  }
}
registerProcessor("gb-shift", GbShift);
`;

let workletReady: Promise<void> | null = null;
let workletLoaded = false;

/** Load the effects' worklet module once per context (Graph.build awaits it). */
export function loadFxWorklet(): Promise<void> {
  if (!workletReady) {
    const ctx = raw() as unknown as { audioWorklet?: { addModule(url: string): Promise<void> } };
    const url = URL.createObjectURL(new Blob([FX_WORKLET], { type: "text/javascript" }));
    workletReady = (ctx.audioWorklet?.addModule(url) ?? Promise.reject(new Error("no AudioWorklet")))
      .then(() => {
        workletLoaded = true;
      })
      .catch(() => {
        // Without the worklet Crush and Shifter pass the sound through unchanged.
      })
      .finally(() => URL.revokeObjectURL(url));
  }
  return workletReady;
}

/** Worklet nodes made here (Tone's context wraps the native one, so `instanceof AudioWorkletNode` does not hold). */
const worklets = new WeakSet<AudioNode>();

function worklet(name: string, params: Record<string, number>, mono = false): AudioNode {
  if (!workletLoaded) return raw().createGain();
  const n = Tone.getContext().createAudioWorkletNode(name, { parameterData: params, ...(mono ? { outputChannelCount: [1] } : {}) });
  worklets.add(n);
  return n;
}
function wparam(n: AudioNode, name: string): AudioParam | null {
  return worklets.has(n) ? ((n as AudioWorkletNode).parameters.get(name) ?? null) : null;
}

// ---- LFOs for the effects --------------------------------------------------------------------

/** One sine LFO with a sine-to-square Shape: the square path is the sine through a steep tanh. */
class ShapedLfo {
  readonly lfo = new Lfo();
  /** -1..1, shaped. */
  readonly out: GainNode;
  private readonly sine: GainNode;
  private readonly square: GainNode;
  private readonly shaper: WaveShaperNode;
  constructor() {
    const ctx = raw();
    this.out = ctx.createGain();
    this.sine = ctx.createGain();
    this.square = ctx.createGain();
    this.square.gain.value = 0;
    this.shaper = ctx.createWaveShaper();
    const c = new Float32Array(1025);
    for (let i = 0; i < c.length; i++) c[i] = Math.tanh(6 * ((i / 1024) * 2 - 1)) / Math.tanh(6);
    this.shaper.curve = c;
    this.lfo.bi.connect(this.sine);
    this.lfo.bi.connect(this.shaper);
    this.shaper.connect(this.square);
    this.sine.connect(this.out);
    this.square.connect(this.out);
  }
  shape(v: number, at?: number): void {
    glide(this.sine.gain, 1 - v, at);
    glide(this.square.gain, v, at);
  }
  nodes(): AudioNode[] {
    return [this.out, this.sine, this.square, this.shaper, this.lfo.bi, this.lfo.uni, this.lfo.neg];
  }
}

// ---- The effects -----------------------------------------------------------------------------

/**
 * One effect: `input` to `output`, its own dry blend inside where it has a Mix knob. `start` runs its sources (from the
 * slot's switch on), `stop` ends them; nothing runs while it is off.
 */
abstract class Effect {
  readonly input: GainNode;
  readonly output: GainNode;
  protected k: FxKnobs;
  private readonly owned: AudioNode[] = [];
  protected running = false;
  constructor(
    readonly id: EffectId,
    protected readonly clock: FxClock,
    knobs: FxKnobs,
  ) {
    this.k = [...knobs];
    this.input = this.own(raw().createGain());
    this.output = this.own(raw().createGain());
  }
  get knobs(): FxKnobs {
    return [...this.k];
  }
  get isRunning(): boolean {
    return this.running;
  }
  protected own<T extends AudioNode>(n: T): T {
    this.owned.push(n);
    return n;
  }
  /** Set every knob, ramped from `at` (else now). */
  abstract set(k: FxKnobs, at?: number): void;
  start(_at: number): void {
    this.running = true;
  }
  stop(): void {
    this.running = false;
  }
  /** The transport starts at `at`: synced movement restarts there, on the bar. */
  restart(_at: number): void {}
  tempo(_bpm: number, _at?: number): void {}
  note(_hz: number, _time: number): void {}
  step(_time: number, _step: number): void {}
  dispose(): void {
    this.stop();
    for (const n of this.owned) {
      try {
        n.disconnect();
      } catch {
        // already gone
      }
      if (worklets.has(n)) (n as AudioWorkletNode).port.close();
    }
  }
}

/** A blend of the dry input and a wet path, by a Mix knob. */
abstract class Blend extends Effect {
  protected readonly dry: GainNode;
  protected readonly wet: GainNode;
  constructor(id: EffectId, clock: FxClock, knobs: FxKnobs, private readonly half: boolean) {
    super(id, clock, knobs);
    this.dry = this.own(raw().createGain());
    this.wet = this.own(raw().createGain());
    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.wet.connect(this.output);
  }
  protected mix(v: number, at?: number, wetScale = 1): void {
    const [d, w] = mixGains(v, this.half);
    glide(this.dry.gain, d, at);
    glide(this.wet.gain, w * wetScale, at);
  }
}

/** Starts a free or tempo-synced LFO; a synced one starts at the top of its cycle on every multiple of its length. */
function startLfo(lfo: Lfo, clock: FxClock, at: number, r: { hz: number } | { beats: number }): void {
  if ("hz" in r) return lfo.start(at, r.hz, 0);
  const phase = 2 * Math.PI * ((clock.beatsAt(at) / r.beats) % 1);
  lfo.start(at, rateHz(r, clock.bpm()), phase);
}

class Chorus extends Blend {
  private readonly lfo = new Lfo();
  private readonly dl: DelayNode;
  private readonly dr: DelayNode;
  private readonly depthL: GainNode;
  private readonly depthR: GainNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("chorus", clock, k, true);
    const ctx = raw();
    this.dl = this.own(ctx.createDelay(0.05));
    this.dr = this.own(ctx.createDelay(0.05));
    this.dl.delayTime.value = 0.012;
    this.dr.delayTime.value = 0.017;
    const merge = this.own(ctx.createChannelMerger(2));
    this.input.connect(this.dl);
    this.input.connect(this.dr);
    this.dl.connect(merge, 0, 0);
    this.dr.connect(merge, 0, 1);
    merge.connect(this.wet);
    this.depthL = this.own(ctx.createGain());
    this.depthR = this.own(ctx.createGain());
    this.lfo.bi.connect(this.depthL);
    this.lfo.bi.connect(this.depthR);
    this.depthL.connect(this.dl.delayTime);
    this.depthR.connect(this.dr.delayTime);
    this.own(this.lfo.bi);
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    this.mix(k[0], at);
    if (this.running) this.lfo.rate(chorusHz(k[1]), at);
    glide(this.depthL.gain, chorusDepth(k[2]), at);
    glide(this.depthR.gain, -chorusDepth(k[2]), at);
  }
  override start(at: number): void {
    super.start(at);
    this.lfo.start(at, chorusHz(this.k[1]), 0);
  }
  override stop(): void {
    super.stop();
    this.lfo.stop();
  }
}

/** Phaser and Flanger: a sweep at a free rate or a note value. */
abstract class Sweep extends Blend {
  protected readonly lfo = new Lfo();
  protected rateKnob: number;
  constructor(id: EffectId, clock: FxClock, k: FxKnobs) {
    super(id, clock, k, true);
    this.rateKnob = k[1];
    this.own(this.lfo.bi);
  }
  protected setRate(v: number, at?: number): void {
    const was = sweepRate(this.rateKnob);
    this.rateKnob = v;
    const r = sweepRate(v);
    if (!this.running || r === was) return;
    // The phase runs on unbroken at the new rate: no step.
    this.lfo.rate(rateHz(r, this.clock.bpm()), at);
  }
  override start(at: number): void {
    super.start(at);
    startLfo(this.lfo, this.clock, at, sweepRate(this.rateKnob));
  }
  override restart(at: number): void {
    if (this.running && "beats" in sweepRate(this.rateKnob)) startLfo(this.lfo, this.clock, at, sweepRate(this.rateKnob));
  }
  override tempo(bpm: number, at?: number): void {
    const r = sweepRate(this.rateKnob);
    if (this.running && "beats" in r) this.lfo.rate(rateHz(r, bpm), at);
  }
  override stop(): void {
    super.stop();
    this.lfo.stop();
  }
}

class Phaser extends Sweep {
  private readonly depth: GainNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("phaser", clock, k);
    const ctx = raw();
    this.depth = this.own(ctx.createGain());
    this.lfo.bi.connect(this.depth);
    let prev: AudioNode = this.input;
    for (const hz of [500, 900, 1400, 2100]) {
      const ap = this.own(ctx.createBiquadFilter());
      ap.type = "allpass";
      ap.frequency.value = hz;
      ap.Q.value = 0.6;
      this.depth.connect(ap.detune);
      prev.connect(ap);
      prev = ap;
    }
    prev.connect(this.wet);
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    this.mix(k[0], at);
    this.setRate(k[1], at);
    glide(this.depth.gain, phaserCents(k[2]), at);
  }
}

class Flanger extends Sweep {
  private readonly delay: DelayNode;
  private readonly fb: GainNode;
  private readonly depth: GainNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("flanger", clock, k);
    const ctx = raw();
    // A delay inside a feedback loop is at least one render quantum (2.9 ms at 44.1 kHz): the sweep stays above it.
    this.delay = this.own(ctx.createDelay(0.05));
    this.delay.delayTime.value = 0.0068;
    this.fb = this.own(ctx.createGain());
    this.depth = this.own(ctx.createGain());
    this.input.connect(this.delay);
    this.delay.connect(this.fb);
    this.fb.connect(this.delay);
    this.delay.connect(this.wet);
    this.lfo.bi.connect(this.depth);
    this.depth.connect(this.delay.delayTime);
    this.depth.gain.value = 0.0035;
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    const fb = feedback(k[2]);
    // The loop's gain rises with feedback: the wet path is lowered to match.
    this.mix(k[0], at, 1 - 0.5 * fb);
    this.setRate(k[1], at);
    glide(this.fb.gain, fb, at);
  }
}

class Fuzz extends Blend {
  private readonly pre: GainNode;
  private readonly tone: BiquadFilterNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("fuzz", clock, k, false);
    const ctx = raw();
    this.pre = this.own(ctx.createGain());
    const shaper = this.own(ctx.createWaveShaper());
    const c = new Float32Array(2049);
    for (let i = 0; i < c.length; i++) c[i] = Math.tanh(2.5 * ((i / 2048) * 2 - 1)) / Math.tanh(2.5);
    shaper.curve = c;
    shaper.oversample = "2x";
    this.tone = this.own(ctx.createBiquadFilter());
    this.tone.type = "lowpass";
    this.tone.Q.value = 0.5;
    const post = this.own(ctx.createGain());
    post.gain.value = 0.15;
    this.input.connect(this.pre);
    this.pre.connect(shaper);
    shaper.connect(this.tone);
    this.tone.connect(post);
    post.connect(this.wet);
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    glide(this.pre.gain, fuzzDrive(k[0]), at);
    glide(this.tone.frequency, fuzzToneHz(k[1]), at);
    this.mix(k[2], at);
  }
}

class Crush extends Blend {
  private readonly node: AudioNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("crush", clock, k, false);
    this.node = this.own(worklet("gb-crush", { bits: crushBits(k[0]), rate: crushRate(k[1]) }));
    this.input.connect(this.node);
    this.node.connect(this.wet);
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    const b = wparam(this.node, "bits");
    const r = wparam(this.node, "rate");
    if (b) glide(b, crushBits(k[0]), at);
    if (r) glide(r, crushRate(k[1]), at);
    this.mix(k[2], at);
  }
}

/** Tremolo and Pan: a shaped, tempo-synced LFO on a gain or a pan position. */
abstract class Mover extends Effect {
  protected readonly lfo = new ShapedLfo();
  protected readonly depth: GainNode;
  private beats: number;
  constructor(id: EffectId, clock: FxClock, k: FxKnobs) {
    super(id, clock, k);
    this.depth = this.own(raw().createGain());
    this.lfo.out.connect(this.depth);
    for (const n of this.lfo.nodes()) this.own(n);
    this.beats = SYNC_RATES[stepIndex(k[1], SYNC_RATES.length)];
  }
  protected setRate(v: number, at?: number): void {
    const b = SYNC_RATES[stepIndex(v, SYNC_RATES.length)];
    if (b === this.beats) return;
    this.beats = b;
    if (this.running) this.lfo.lfo.rate(this.clock.bpm() / 60 / b, at);
  }
  override start(at: number): void {
    super.start(at);
    startLfo(this.lfo.lfo, this.clock, at, { beats: this.beats });
  }
  override restart(at: number): void {
    if (this.running) startLfo(this.lfo.lfo, this.clock, at, { beats: this.beats });
  }
  override tempo(bpm: number, at?: number): void {
    if (this.running) this.lfo.lfo.rate(bpm / 60 / this.beats, at);
  }
  override stop(): void {
    super.stop();
    this.lfo.lfo.stop();
  }
}

class Tremolo extends Mover {
  private readonly vca: GainNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("tremolo", clock, k);
    this.vca = this.own(raw().createGain());
    this.input.connect(this.vca);
    this.vca.connect(this.output);
    this.depth.connect(this.vca.gain);
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    // The gain swings between 1 - depth and 1.
    glide(this.vca.gain, 1 - k[0] / 2, at);
    glide(this.depth.gain, k[0] / 2, at);
    this.setRate(k[1], at);
    this.lfo.shape(k[2], at);
  }
}

class Pan extends Mover {
  private readonly pan: StereoPannerNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("pan", clock, k);
    this.pan = this.own(raw().createStereoPanner());
    this.input.connect(this.pan);
    this.pan.connect(this.output);
    this.depth.connect(this.pan.pan);
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    glide(this.depth.gain, k[0], at);
    this.setRate(k[1], at);
    this.lfo.shape(k[2], at);
  }
}

/** Gate: a gain opened and closed on the sequencer's sixteenths, by a pattern. */
class Gate extends Effect {
  private readonly vca: GainNode;
  private last = -1;
  constructor(clock: FxClock, k: FxKnobs) {
    super("gate", clock, k);
    this.vca = this.own(raw().createGain());
    this.input.connect(this.vca);
    this.vca.connect(this.output);
    this.set(k);
  }
  set(k: FxKnobs): void {
    // Pattern, depth and smoothness act from the next sixteenth.
    this.k = [...k];
  }
  override start(at: number): void {
    super.start(at);
    this.last = -1;
  }
  override step(time: number, step: number): void {
    if (!this.running) return;
    const v = gateOpen(gatePattern(this.k[0]), step) ? 1 : 1 - this.k[1];
    if (v === this.last) return;
    this.last = v;
    const p = this.vca.gain;
    const t = Math.max(time, now());
    p.cancelScheduledValues(t);
    p.setTargetAtTime(v, t, gateTau(this.k[2]));
  }
}

class Ring extends Blend {
  private readonly ring: GainNode;
  private osc: OscillatorNode | null = null;
  private noteHz: number | null = null;
  constructor(clock: FxClock, k: FxKnobs) {
    super("ring", clock, k, false);
    this.ring = this.own(raw().createGain());
    this.ring.gain.value = 0;
    this.input.connect(this.ring);
    this.ring.connect(this.wet);
    this.set(k);
  }
  private carrier(): number {
    return ringCarrier(this.k[1], this.k[2], this.noteHz);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    this.mix(k[0], at);
    if (this.osc) glide(this.osc.frequency, this.carrier(), at);
  }
  override start(at: number): void {
    super.start(at);
    const osc = raw().createOscillator();
    osc.frequency.value = this.carrier();
    osc.connect(this.ring.gain);
    osc.start(at);
    this.osc = osc;
    Lfo.sources++;
  }
  override stop(): void {
    super.stop();
    const o = this.osc;
    if (!o) return;
    this.osc = null;
    Lfo.sources--;
    o.stop(now());
    o.onended = () => o.disconnect();
  }
  override note(hz: number, time: number): void {
    this.noteHz = hz;
    if (this.osc && this.k[2] > 0) glide(this.osc.frequency, this.carrier(), time, 0.004);
  }
}

class Vowel extends Blend {
  private readonly lfo = new Lfo();
  private readonly bands: BiquadFilterNode[] = [];
  private readonly routes: ModRoute[];
  private beats = 0;
  constructor(clock: FxClock, k: FxKnobs) {
    super("vowel", clock, k, false);
    const ctx = raw();
    const sum = this.own(ctx.createGain());
    sum.gain.value = 3.5;
    for (let i = 0; i < 3; i++) {
      const b = this.own(ctx.createBiquadFilter());
      b.type = "bandpass";
      b.Q.value = [5, 9, 12][i];
      const g = this.own(ctx.createGain());
      g.gain.value = FORMANT_GAINS[i];
      this.input.connect(b);
      b.connect(g);
      g.connect(sum);
      this.bands.push(b);
    }
    sum.connect(this.wet);
    this.own(this.lfo.uni);
    this.routes = this.bands.map((b) => new ModRoute(this.lfo.uni, b.detune));
    for (const r of this.routes) this.own(r.gain);
    const f = formantsAt(k[1]);
    this.bands.forEach((b, i) => (b.frequency.value = f[i]));
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    this.mix(k[0], at);
    const f = formantsAt(k[1]);
    this.bands.forEach((b, i) => glide(b.frequency, f[i], at));
    const beats = vowelBeats(k[2]);
    if (this.running) {
      if (beats > 0 && beats !== this.beats) {
        if (this.beats > 0 && this.lfo.running) this.lfo.rate(this.clock.bpm() / 60 / beats, at);
        else startLfo(this.lfo, this.clock, Math.max(at ?? 0, now()), { beats });
      }
      if (beats === 0 && this.lfo.running) afterFade(() => this.k[2] === k[2] && this.lfo.stop(), RAMP, at);
    }
    this.beats = beats;
    this.swing(at);
  }
  private swing(at?: number): void {
    const cents = formantCents(formantsAt(this.k[1]), formantsAt(vowelSwing(this.k[1])));
    this.routes.forEach((r, i) => r.set(this.running && this.beats > 0 ? cents[i] : 0, at));
  }
  override start(at: number): void {
    super.start(at);
    if (this.beats > 0) startLfo(this.lfo, this.clock, at, { beats: this.beats });
    this.swing(at);
  }
  override restart(at: number): void {
    if (this.running && this.beats > 0) startLfo(this.lfo, this.clock, at, { beats: this.beats });
  }
  override tempo(bpm: number, at?: number): void {
    if (this.running && this.beats > 0) this.lfo.rate(bpm / 60 / this.beats, at);
  }
  override stop(): void {
    super.stop();
    this.lfo.stop();
    for (const r of this.routes) r.set(0);
  }
}

class Shifter extends Blend {
  private readonly node: AudioNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("shifter", clock, k, false);
    this.node = this.own(worklet("gb-shift", { shift: shiftHz(k[1]), feedback: shiftFeedback(k[2]) }, true));
    this.input.connect(this.node);
    this.node.connect(this.wet);
    this.set(k);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    this.mix(k[0], at);
    const s = wparam(this.node, "shift");
    const f = wparam(this.node, "feedback");
    if (s) glide(s, shiftHz(k[1]), at);
    if (f) glide(f, shiftFeedback(k[2]), at);
  }
}

class Echo extends Effect {
  private readonly dl: DelayNode;
  private readonly dr: DelayNode;
  private readonly fb: GainNode;
  private readonly wet: GainNode;
  constructor(clock: FxClock, k: FxKnobs) {
    super("echo", clock, k);
    const ctx = raw();
    // Ping-pong: left, then right, then back through the feedback to the left.
    this.dl = this.own(ctx.createDelay(4.1));
    this.dr = this.own(ctx.createDelay(4.1));
    this.fb = this.own(ctx.createGain());
    this.wet = this.own(ctx.createGain());
    const merge = this.own(ctx.createChannelMerger(2));
    this.input.connect(this.output);
    this.input.connect(this.dl);
    this.dl.connect(this.dr);
    this.dr.connect(this.fb);
    this.fb.connect(this.dl);
    this.dl.connect(merge, 0, 0);
    this.dr.connect(merge, 0, 1);
    merge.connect(this.wet);
    this.wet.connect(this.output);
    const s = this.seconds(clock.bpm());
    this.dl.delayTime.value = s;
    this.dr.delayTime.value = s;
    this.set(k);
  }
  private seconds(bpm: number): number {
    return (echoBeats(this.k[1]) * 60) / Math.max(30, bpm);
  }
  set(k: FxKnobs, at?: number): void {
    this.k = [...k];
    glide(this.wet.gain, 0.8 * k[0], at);
    glide(this.fb.gain, feedback(k[2]), at);
    this.time(this.clock.bpm(), at);
  }
  private time(bpm: number, at?: number): void {
    const s = this.seconds(bpm);
    glide(this.dl.delayTime, s, at, 0.02);
    glide(this.dr.delayTime, s, at, 0.02);
  }
  override tempo(bpm: number, at?: number): void {
    this.time(bpm, at);
  }
}

const MAKERS: Record<EffectId, new (clock: FxClock, k: FxKnobs) => Effect> = {
  chorus: Chorus,
  phaser: Phaser,
  flanger: Flanger,
  fuzz: Fuzz,
  crush: Crush,
  tremolo: Tremolo,
  pan: Pan,
  gate: Gate,
  ring: Ring,
  vowel: Vowel,
  shifter: Shifter,
  echo: Echo,
};

// ---- A slot and an instrument's two ------------------------------------------------------------

interface Live {
  fx: Effect;
  wet: GainNode;
  wired: boolean;
}

/** Effects built so far (for the smoke test: switching on builds none). */
export const fxCounts = { built: 0 };

export class FxSlotNode {
  readonly input: GainNode;
  readonly output: GainNode;
  private readonly dry: GainNode;
  private cur: Live;
  private on = false;
  private gen = 0;
  /** Effects still fading out after a change, freed once silent. */
  private leaving = 0;

  constructor(
    private readonly clock: FxClock,
    effect: EffectId,
    knobs: FxKnobs,
  ) {
    const ctx = raw();
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    // Always two channels out, so nothing after the slot changes its channel count when an effect switches (a
    // filter that sees its input go from one channel to two rebuilds its state: a click).
    this.output.channelCount = 2;
    this.output.channelCountMode = "explicit";
    this.dry = ctx.createGain();
    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.cur = this.build(effect, knobs);
  }

  private build(effect: EffectId, knobs: FxKnobs): Live {
    const fx = new MAKERS[effect](this.clock, knobs);
    fxCounts.built++;
    const wet = raw().createGain();
    wet.gain.value = 0;
    wet.connect(this.output);
    return { fx, wet, wired: false };
  }

  private wire(v: Live): void {
    if (v.wired) return;
    this.input.connect(v.fx.input);
    v.fx.output.connect(v.wet);
    v.wired = true;
  }

  private free(v: Live): void {
    if (v.wired) {
      try {
        this.input.disconnect(v.fx.input);
      } catch {
        // already gone
      }
      v.wired = false;
    }
    v.fx.dispose();
    v.wet.disconnect();
  }

  get effect(): EffectId {
    return this.cur.fx.id;
  }
  get active(): boolean {
    return this.on;
  }
  /** The effect is connected (on, or fading out). */
  get wired(): boolean {
    return this.cur.wired || this.leaving > 0;
  }

  /** Bring the slot to `s`: effect, knobs and on or off, from `at` (else now). */
  configure(s: FxSlot, at?: number): void {
    if (s.effect !== this.cur.fx.id) this.setEffect(s.effect, s.knobs, at);
    else this.cur.fx.set(s.knobs, at);
    this.setOn(s.on, at);
  }

  setOn(on: boolean, at?: number): void {
    if (on === this.on) return;
    this.on = on;
    const gen = ++this.gen;
    const v = this.cur;
    const t = Math.max(at ?? 0, now());
    if (on) {
      this.wire(v);
      if (!v.fx.isRunning) v.fx.start(t);
      fade(v.wet.gain, 1, at);
      fade(this.dry.gain, 0, at);
      return;
    }
    fade(v.wet.gain, 0, at);
    fade(this.dry.gain, 1, at);
    afterFade(
      () => {
        if (gen !== this.gen || this.on || this.cur !== v) return;
        // Disconnected: the effect leaves the graph and a fresh one waits, unconnected, for the next switch on.
        const { id } = v.fx;
        const k = v.fx.knobs;
        this.free(v);
        this.cur = this.build(id, k);
      },
      RAMP * 3,
      at,
    );
  }

  setEffect(effect: EffectId, knobs: FxKnobs, at?: number): void {
    if (effect === this.cur.fx.id) return this.cur.fx.set(knobs, at);
    const old = this.cur;
    const next = this.build(effect, knobs);
    this.cur = next;
    if (!this.on) return this.free(old);
    // A crossfade from the old effect to the new one; the old one is freed once silent.
    const t = Math.max(at ?? 0, now());
    this.wire(next);
    next.fx.start(t);
    fade(next.wet.gain, 1, at);
    fade(old.wet.gain, 0, at);
    this.leaving++;
    afterFade(
      () => {
        this.leaving--;
        this.free(old);
      },
      RAMP * 3,
      at,
    );
  }

  setKnobs(k: FxKnobs, at?: number): void {
    this.cur.fx.set(k, at);
  }

  restart(at: number): void {
    if (this.on) this.cur.fx.restart(at);
  }
  tempo(bpm: number, at?: number): void {
    this.cur.fx.tempo(bpm, at);
  }
  note(hz: number, time: number): void {
    if (this.on) this.cur.fx.note(hz, time);
  }
  step(time: number, step: number): void {
    if (this.on) this.cur.fx.step(time, step);
  }
}

/** An instrument's two slots, in series. */
export class FxRackNode {
  readonly slots: [FxSlotNode, FxSlotNode];
  constructor(clock: FxClock, effects: [EffectId, EffectId], knobs: [FxKnobs, FxKnobs]) {
    this.slots = [new FxSlotNode(clock, effects[0], knobs[0]), new FxSlotNode(clock, effects[1], knobs[1])];
    this.slots[0].output.connect(this.slots[1].input);
  }
  get input(): GainNode {
    return this.slots[0].input;
  }
  get output(): GainNode {
    return this.slots[1].output;
  }
  configure(rack: readonly FxSlot[], at?: number): void {
    rack.forEach((s, i) => this.slots[i]?.configure(s, at));
  }
  restart(at: number): void {
    for (const s of this.slots) s.restart(at);
  }
  tempo(bpm: number, at?: number): void {
    for (const s of this.slots) s.tempo(bpm, at);
  }
  note(hz: number, time: number): void {
    for (const s of this.slots) s.note(hz, time);
  }
  step(time: number, step: number): void {
    for (const s of this.slots) s.step(time, step);
  }
}
