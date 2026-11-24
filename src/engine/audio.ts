/**
 * The Tone.js side of the engine: the five instruments, the shared sends and the master chain.
 * Only files in src/engine/ import Tone.
 *
 * C1 (treble crackle) fixes live here: every waveshaper is 4x oversampled, filter resonance is
 * capped and the synth filters stop below 10 kHz, hats and clap sit lower, the master bus is
 * lower, the limiter's release is slow enough not to modulate the bass, and the pump ramps
 * instead of stepping.
 *
 * Phone CPU (G1 review S7): the kick drive and the master saturation stay 4x oversampled; the
 * per-channel drives run at 2x and are disconnected from the chain while their amount is 0.
 * Resonance (G1 review M5): Q is capped at 6 and the channel level drops as Q rises, so a
 * resonance sweep does not jump about 10 dB.
 * Waves (G1 review S2): a wave change goes to a fresh voice set; notes already sounding keep the
 * old wave and ring out, so no oscillator is swapped mid-note.
 */
import * as Tone from "tone";
import { midiToHz } from "../music/scales.ts";
import { DRUM_VOICES, type DrumVoice } from "../music/presets.ts";
import {
  DRIFT_MAX,
  DRUM_RELEASE,
  PAD_TOP_HZ,
  padBrightnessHz,
  padMotionCents,
  detuneCents,
  driftPeriod,
  drumDecay,
  drumLevel,
  envDepthHz,
  fmIndex,
  fmRatio,
  glideSeconds,
  kickHz,
  lfoBeats,
  lfoDepthCents,
  percHz,
  subGain,
} from "../music/sound.ts";
import { MIX_DEFAULTS, MIX_RANGES, PATCH_KEYS, type InstrumentId, type MixKey, type NumericPatchKey, type Patch, type Wave } from "./song.ts";
import { Air, Breath, LoFi, Lfo, ModRoute, ReverbBank, afterFade } from "./mods.ts";

// Tone 15.1.22 leak (G5 review E1): Oscillator._start connects its frequency and detune signals to each new
// native oscillator and never disconnects them, so every ended oscillator stays reachable from the
// instrument's signals. Disconnect them when the oscillator ends. Drop this patch once Tone fixes it.
{
  const proto = Tone.Oscillator.prototype as unknown as {
    _start(t: unknown): void;
    _oscillator: { onended: (n: unknown) => void; frequency: unknown; detune: unknown };
    frequency: Tone.Signal<"frequency">;
    detune: Tone.Signal<"cents">;
  };
  const start = proto._start;
  proto._start = function (this: typeof proto, t: unknown): void {
    start.call(this, t);
    const node = this._oscillator;
    const end = node.onended;
    node.onended = (n: unknown): void => {
      try {
        this.frequency.disconnect(node.frequency as Tone.InputNode);
        this.detune.disconnect(node.detune as Tone.InputNode);
      } catch {
        // already disconnected (the oscillator was disposed first)
      } finally {
        end(n);
      }
    };
  };
}

const RAMP = 0.03; // seconds; every continuous parameter change is ramped this long
const MAX_Q = 6; // resonance cap (the spike went to 14, G1 shipped 8)
/** Level compensation as Q rises: about -5 dB at the cap. */
const qComp = (q: number): number => 1 / (1 + 0.15 * (q - 0.7));
/** Equal-power dry/wet pair for an amount 0..1. */
const dryWet = (v: number): [number, number] => [Math.cos((v * Math.PI) / 2), Math.sin((v * Math.PI) / 2)];
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** The native AudioParam under a Tone Param or Signal (a Signal wraps a Param, a Param an AudioParam). */
function nativeParam(p: unknown): AudioParam {
  let q = p as { _param?: unknown };
  while (q._param) q = q._param as { _param?: unknown };
  return q as unknown as AudioParam;
}

/**
 * Move a parameter to `value` over about RAMP, from wherever it is now (G3 review E1). Tone's
 * rampTo goes through its own cancelAndHoldAtTime, and two moves in one render quantum (a dial
 * drag) can leave Chrome's native value stuck short of the target while Tone's timeline says it
 * arrived. A setTargetAtTime from the current time needs no hold point: it always starts from the
 * parameter's present value and always lands (99% after 37 ms). Every parameter ramped here is
 * only ever moved here, so Tone's timeline for it is never consulted.
 */
function ramp(param: unknown, value: number, at?: number): void {
  if (at !== undefined) return rampAt(param, value, at);
  const p = nativeParam(param);
  const t = Tone.getContext().currentTime;
  p.cancelScheduledValues(t);
  p.setTargetAtTime(value, t, RAMP / 4);
}

/**
 * Move a parameter to `value` from audio time `time` (a step's time, ahead of now), with time
 * constant `tau` (G4 review S1). Like `ramp`, a setTargetAtTime that starts from whatever value the
 * parameter has at `time`, so it needs no hold point; anything scheduled from `time` on is dropped.
 */
function rampAt(param: unknown, value: number, time: number, tau = RAMP / 4): void {
  const p = nativeParam(param);
  const t = Math.max(time, Tone.getContext().currentTime);
  p.cancelScheduledValues(t);
  p.setTargetAtTime(value, t, tau);
}

/** Ramp a native GainNode's gain (P7's drift pitch depth). */
function rampGain(g: GainNode, value: number, at?: number): void {
  const t = Math.max(at ?? 0, Tone.getContext().currentTime);
  g.gain.cancelScheduledValues(t);
  g.gain.setTargetAtTime(value, t, RAMP / 4);
}

/** Current native value of a parameter ramped with `ramp`, for the smoke test. */
function nativeValue(param: unknown): number {
  return nativeParam(param).value;
}

/**
 * Run `fn` once a ramp from audio time `at` (else now) is done, past the lookahead (Tone.now() runs ahead).
 * P7 review S5: timed from `at`, so a node is never cut before a fade scheduled past the lookahead starts.
 */
function afterRamp(fn: () => void, at?: number): void {
  afterFade(fn, RAMP, at);
}

interface Buses {
  duck: Tone.Gain; // music bus, ducked by the kick
  drums: Tone.Gain; // drum bus, not ducked
  delay: Tone.FeedbackDelay;
  /** The reverb bank's input (P7: its decay can change while playing). */
  reverb: Tone.Gain;
}

/** The transport as the tempo-synced LFOs read it (P7): beats at an audio time (0 while stopped) and the tempo. */
const clock = {
  beatsAt(t: number): number {
    const tr = Tone.getTransport();
    return tr.state === "started" ? tr.getTicksAtTime(t) / tr.PPQ : 0;
  },
  bpm(): number {
    return Tone.getTransport().bpm.value;
  },
};

/** The free-running drift of one channel (P7, spec 8.10): one slow LFO on filter, pitch, pan and both sends. */
interface Drift {
  lfo: Lfo;
  filter: ModRoute;
  pan: ModRoute | null;
  delay: ModRoute;
  reverb: ModRoute;
  /** Cents of pitch drift (-8 x depth at most), which the instrument wires into its voices' detune. */
  pitch: GainNode;
  /**
   * The pitch is fed and wired to the voices only while the drift is on (P7 review M5: off costs nothing). Off, it
   * is cut from the LFO and from every voice, and `epoch` moves on, so the instrument wires its voices afresh.
   */
  wired: boolean;
  epoch: number;
}

/** Filter (XY pad), optional drive, mute point, level and the two sends of one instrument. */
class Channel {
  readonly input = new Tone.Gain(1);
  readonly filter: Tone.Filter;
  /** Fully wet; the mix is the dry and wet gains around it. Out of the chain while its amount is 0. */
  readonly drive: Tone.Distortion | null;
  private readonly dry = new Tone.Gain(1);
  private readonly wet = new Tone.Gain(0);
  private driveOn = false;
  private driveGen = 0;
  /** Mute point used by the smoke test's solo. Musical on/off is the sequencer's job. */
  readonly gate = new Tone.Gain(1);
  readonly level: Tone.Gain;
  readonly delaySend: Tone.Gain;
  readonly reverbSend: Tone.Gain;
  private levelValue = 1;
  private comp = 1;
  /** Filter envelope (bass, synth): frequency = base (the XY cutoff) + envelope x depth, both ramped. */
  private env: Tone.Envelope | null = null;
  private envDepth: Tone.Multiply | null = null;
  private envBase: Tone.Add | null = null;
  private cutoffValue = 0.6;
  private envAmount = 0;
  /** P7: the pan point the drift swings (layers and the Synth); null elsewhere. */
  readonly panner: Tone.Panner | null;
  /** P7: the tempo-synced filter LFO (made on first use) and its settings. */
  private sync: { lfo: Lfo; route: ModRoute; beats: number } | null = null;
  private lfoRate = 0.5;
  private lfoDepth = 0;
  private lfoGen = 0;
  /** P7: the free-running drift (made on first use) and its settings. */
  drift: Drift | null = null;
  private driftDepth = 0;
  private driftRate = 0.5;
  private driftGen = 0;

  constructor(
    out: Tone.Gain,
    buses: Buses,
    private readonly hz: [number, number],
    withDrive: boolean,
    private readonly trim: number,
    pan = false,
  ) {
    this.filter = new Tone.Filter({ frequency: hz[1], type: "lowpass", rolloff: -24, Q: 0.7 });
    this.drive = withDrive ? new Tone.Distortion({ distortion: 0.4, oversample: "2x", wet: 1 }) : null;
    this.level = new Tone.Gain(trim);
    this.delaySend = new Tone.Gain(0).connect(buses.delay);
    this.reverbSend = new Tone.Gain(0).connect(buses.reverb);
    this.panner = pan ? new Tone.Panner(0) : null;
    this.input.chain(this.filter, this.dry, this.gate);
    if (this.drive) this.drive.chain(this.wet, this.gate);
    if (this.panner) this.gate.chain(this.level, this.panner, out);
    else this.gate.chain(this.level, out);
    this.level.connect(this.delaySend);
    this.level.connect(this.reverbSend);
  }

  // ---- P7: the tempo-synced filter LFO (spec 8.7) -------------------------------------------

  /** Whether the synced LFO moves the filter now (for the smoke test). */
  get lfoActive(): boolean {
    return this.sync !== null && this.sync.lfo.running && this.lfoDepth > 0;
  }

  /** The synced LFO's phase for a start at `at`: the top of its cycle on every multiple of its length from bar 1. */
  private syncStart(at: number): void {
    const s = this.sync!;
    s.beats = lfoBeats(this.lfoRate);
    const beats = clock.beatsAt(at);
    const phase = 2 * Math.PI * ((beats / s.beats) % 1);
    s.lfo.start(at, clock.bpm() / 60 / s.beats, phase);
  }

  private setLfo(at?: number): void {
    const depth = this.lfoDepth;
    const gen = ++this.lfoGen;
    if (depth > 0 && !this.sync) {
      const lfo = new Lfo();
      this.sync = { lfo, route: new ModRoute(lfo.neg, nativeParam(this.filter.detune)), beats: lfoBeats(this.lfoRate) };
    }
    const s = this.sync;
    if (!s) return;
    if (depth > 0 && (!s.lfo.running || s.beats !== lfoBeats(this.lfoRate))) {
      if (!s.lfo.running) {
        this.syncStart(Math.max(at ?? 0, Tone.getContext().currentTime));
        s.route.set(lfoDepthCents(depth), at);
        return;
      }
      // A new rate while it moves the filter: fade out, restart in phase at the new rate, fade back in. No step.
      s.route.set(0, at);
      afterRamp(() => {
        if (gen !== this.lfoGen) return;
        this.syncStart(Tone.getContext().currentTime + 0.01);
        s.route.set(lfoDepthCents(this.lfoDepth));
      }, at);
      return;
    }
    s.route.set(lfoDepthCents(depth), at);
    if (depth === 0)
      afterRamp(() => {
        if (gen === this.lfoGen && this.lfoDepth === 0) s.lfo.stop();
      }, at);
  }

  /** Play starts at audio time `at` (bar 1, beat 1): the synced LFO restarts there, at the top of its cycle. */
  startClock(at: number): void {
    if (this.sync && this.lfoDepth > 0) this.syncStart(at);
  }

  /** A new tempo from `at`: the synced LFO keeps its length in beats. */
  setTempo(bpm: number, at?: number): void {
    if (this.sync?.lfo.running) this.sync.lfo.rate(bpm / 60 / this.sync.beats, at);
  }

  // ---- P7: the free-running drift (spec 8.10) -------------------------------------------------

  get driftActive(): boolean {
    return this.drift !== null && this.drift.lfo.running && this.driftDepth > 0;
  }

  private setDrift(at?: number): void {
    const d = this.driftDepth;
    const gen = ++this.driftGen;
    if (d > 0 && !this.drift) {
      const lfo = new Lfo();
      const pitch = (Tone.getContext().rawContext as unknown as BaseAudioContext).createGain();
      pitch.gain.value = 0;
      this.drift = {
        lfo,
        filter: new ModRoute(lfo.neg, nativeParam(this.filter.detune)),
        pan: this.panner ? new ModRoute(lfo.bi, nativeParam(this.panner.pan)) : null,
        delay: new ModRoute(lfo.uni, nativeParam(this.delaySend.gain)),
        reverb: new ModRoute(lfo.uni, nativeParam(this.reverbSend.gain)),
        pitch,
        wired: false,
        epoch: 0,
      };
    }
    const dr = this.drift;
    if (!dr) return;
    if (d > 0 && !dr.wired) {
      dr.lfo.neg.connect(dr.pitch);
      dr.wired = true;
    }
    const hz = 1 / driftPeriod(this.driftRate);
    if (d > 0 && !dr.lfo.running) dr.lfo.start(Tone.getContext().currentTime, hz, 0);
    else if (dr.lfo.running && dr.lfo.frequency !== hz) dr.lfo.rate(hz);
    dr.filter.set(DRIFT_MAX.filterCents * d, at);
    dr.pan?.set(DRIFT_MAX.pan * d, at);
    dr.delay.set(DRIFT_MAX.send * d, at);
    dr.reverb.set(DRIFT_MAX.send * d, at);
    rampGain(dr.pitch, DRIFT_MAX.pitchCents * d, at);
    if (d === 0)
      afterRamp(() => {
        if (gen !== this.driftGen || this.driftDepth !== 0) return;
        dr.lfo.stop();
        if (!dr.wired) return;
        dr.lfo.neg.disconnect(dr.pitch);
        dr.pitch.disconnect();
        dr.wired = false;
        dr.epoch++;
      }, at);
  }

  /** Drive the filter from an envelope from now on. Its depth follows the envAmount key. */
  enableEnv(): void {
    if (this.env) return;
    this.env = new Tone.Envelope({ attack: 0.005, decay: 0.2, sustain: 0.15, release: 0.1 });
    this.envDepth = new Tone.Multiply(0);
    this.envBase = new Tone.Add(this.cutoffHz(this.cutoffValue));
    this.env.chain(this.envDepth, this.envBase, this.filter.frequency);
  }

  /** Open the filter envelope at `time` for `dur` seconds. No-op without an envelope. */
  triggerEnv(time: number, dur: number, shape: { attack: number; decay: number; release: number }): void {
    const env = this.env;
    if (!env) return;
    env.attack = Math.max(0.002, shape.attack);
    env.decay = Math.max(0.01, shape.decay);
    env.release = Math.max(0.01, shape.release);
    env.triggerAttackRelease(Math.max(0.005, dur), time);
  }

  private rampEnvDepth(at?: number): void {
    if (this.envDepth) ramp(this.envDepth.factor, envDepthHz(this.cutoffHz(this.cutoffValue), this.envAmount, this.hz[1]), at);
  }

  cutoffHz(x: number): number {
    const [lo, hi] = this.hz;
    return lo * Math.pow(hi / lo, Math.max(0, Math.min(1, x)));
  }

  /** Audio time of the last accent's filter boost (-1 before the first), for the smoke test. */
  accentAt = -1;

  /**
   * An accented note (P5, spec 8.5): the filter opens by up to an octave at `time` and settles back over about
   * 0.15 s, through the filter's detune, so the cutoff (the XY pad) is never touched. Never past the channel's
   * top (10 kHz, C1). Both moves are setTargetAtTime curves from whatever value the detune has: no step.
   * The filter is the layer channel's, so a note still sounding under the accented one brightens with it
   * (P5 review M3): spec 8.5's per-note boost is approximated, as the lead plays mostly one note at a time.
   */
  accent(time: number): void {
    // From the cutoff sounding now, not the XY pad's target: while a drag from bright to dark ramps the cutoff
    // down, the target is lower than the filter, and an octave above it could pass 10 kHz (P5 review S3).
    const base = Math.max(this.cutoffHz(this.cutoffValue), nativeValue(this.filter.frequency));
    const cents = Math.max(0, Math.min(1200, 1200 * Math.log2(this.hz[1] / base)));
    if (cents <= 0) return;
    const p = nativeParam(this.filter.detune);
    const t = Math.max(time, Tone.getContext().currentTime);
    p.cancelScheduledValues(t);
    p.setTargetAtTime(cents, t, 0.004);
    p.setTargetAtTime(0, t + 0.025, 0.05);
    this.accentAt = t;
  }

  /** Native resting cutoff in Hz (the envelope's base where there is one), for the smoke test (P3 review E1). */
  cutoffNative(): number {
    return nativeValue(this.envBase ? this.envBase.addend : this.filter.frequency);
  }

  /** Set one value: ramped from now, or with `at` from that audio time (a vibe landing on its bar line). */
  set(key: NumericPatchKey, v: number, at?: number): void {
    switch (key) {
      case "cutoff":
        this.cutoffValue = v;
        if (this.envBase) {
          ramp(this.envBase.addend, this.cutoffHz(v), at);
          return this.rampEnvDepth(at);
        }
        return void ramp(this.filter.frequency, this.cutoffHz(v), at);
      case "envAmount":
        this.envAmount = clamp01(v);
        return this.rampEnvDepth(at);
      case "resonance": {
        const q = 0.7 + clamp01(v) * (MAX_Q - 0.7);
        ramp(this.filter.Q, q, at);
        this.comp = qComp(q);
        return void ramp(this.level.gain, this.levelValue * this.trim * this.comp, at);
      }
      case "drive":
        return this.setDrive(clamp01(v), at);
      case "delay":
        return void ramp(this.delaySend.gain, v, at);
      case "reverb":
        return void ramp(this.reverbSend.gain, v, at);
      case "level":
        this.levelValue = v;
        return void ramp(this.level.gain, v * this.trim * this.comp, at);
      case "lfoRate":
        if (clamp01(v) === this.lfoRate) return;
        this.lfoRate = clamp01(v);
        return this.lfoDepth > 0 ? this.setLfo(at) : undefined;
      case "lfoDepth":
        if (clamp01(v) === this.lfoDepth) return;
        this.lfoDepth = clamp01(v);
        return this.setLfo(at);
      case "drift":
        if (clamp01(v) === this.driftDepth) return;
        this.driftDepth = clamp01(v);
        return this.setDrift(at);
      case "driftRate":
        if (clamp01(v) === this.driftRate) return;
        this.driftRate = clamp01(v);
        return this.driftDepth > 0 ? this.setDrift(at) : undefined;
      default:
        return;
    }
  }

  /** Crossfade dry and driven over RAMP; at 0 the drive leaves the chain once the fade is done. */
  private setDrive(v: number, at?: number): void {
    const drive = this.drive;
    if (!drive) return;
    const gen = ++this.driveGen;
    if (v > 0 && !this.driveOn) {
      this.filter.connect(drive);
      this.driveOn = true;
    }
    const [d, w] = dryWet(v);
    ramp(this.dry.gain, d, at);
    ramp(this.wet.gain, w, at);
    if (v === 0 && this.driveOn)
      afterRamp(() => {
        if (gen !== this.driveGen || !this.driveOn) return;
        this.filter.disconnect(drive);
        this.driveOn = false;
      }, at);
  }
}

/** Saw and square are doubled and detuned when `fat` > 1; with `fatAll`, triangle and sine too. */
function oscFor(wave: Wave, fat: number, spread: number, fatAll = false): Record<string, unknown> {
  if (fat > 1 && (fatAll || wave === "sawtooth" || wave === "square")) return { type: `fat${wave}`, count: fat, spread };
  return { type: wave };
}

/**
 * Two voice sets of one instrument. A wave change makes a fresh set the live one; the previous set
 * keeps its sounding notes (old wave) until they are silent, then it is faded and freed.
 */
class VoiceSets<T extends Tone.ToneAudioNode> {
  live: { synth: T; gain: Tone.Gain } | null = null;
  old: { synth: T; gain: Tone.Gain } | null = null;

  constructor(private readonly dest: Tone.InputNode) {}

  /** `at`: the audio time from which the new set is used (the previous one's fade starts no earlier). */
  swap(make: () => T, at?: number): void {
    if (this.old) this.drop(this.old, at);
    this.old = this.live;
    const synth = make();
    const gain = new Tone.Gain(1).connect(this.dest);
    synth.connect(gain);
    this.live = { synth, gain };
  }

  each(fn: (s: T) => void): void {
    if (this.live) fn(this.live.synth);
    if (this.old) fn(this.old.synth);
  }

  /** Free the previous set once `silent` says it has stopped sounding. */
  retireIf(silent: (s: T) => boolean): void {
    if (this.old && silent(this.old.synth)) {
      this.drop(this.old);
      this.old = null;
    }
  }

  private drop(v: { synth: T; gain: Tone.Gain }, at?: number): void {
    ramp(v.gain.gain, 0, at);
    afterRamp(() => {
      v.synth.dispose();
      v.gain.dispose();
    }, at);
  }
}

const ENV_KEYS: readonly (keyof Patch)[] = ["attack", "decay", "sustain", "release"];

export abstract class Instrument {
  readonly channel: Channel;
  /** Bumped by `cancel()` (Stop): attacks scheduled before it never start. */
  private epoch = 0;
  /** Attacks actually started; read by the smoke test to prove Stop leaves nothing scheduled. */
  attacks = 0;
  constructor(channel: Channel) {
    this.channel = channel;
  }

  /**
   * Start an attack at audio time `time`. One in the future (a swung step) waits on the context's
   * clock, like Tone's own PolySynth, and is dropped if Stop comes first.
   */
  protected atTime(time: number, fn: () => void): void {
    const ctx = Tone.getContext();
    const epoch = this.epoch;
    const run = (): void => {
      if (epoch !== this.epoch) return;
      this.attacks++;
      fn();
    };
    const wait = time - ctx.now();
    if (wait <= 0) run();
    else ctx.setTimeout(run, wait);
  }

  /** Drop every attack not yet started. */
  cancel(): void {
    this.epoch++;
  }
  /** Apply a whole patch: from now, or from audio time `at` (P3 review E1: a vibe lands on its bar line). */
  apply(p: Patch, at?: number): void {
    for (const k of PATCH_KEYS) if (!ENV_KEYS.includes(k)) this.set(k, p[k], p, at);
    this.setWave(p.wave, at);
    this.setEnvelope(p);
  }
  /** Apply a whole patch from audio time `time`, on the audio clock (P3 review E1). */
  applyAt(p: Patch, time: number): void {
    this.apply(p, time);
  }
  /**
   * Set one value. Continuous values ramp from `at` (else now). Discrete ones (wave, envelope, decays, pitch,
   * glide) act from the next attack started, and every attack before `at` has already started when a vibe's
   * bar line is scheduled, so they also take effect from `at`.
   */
  set(key: keyof Patch, v: number | Wave, patch: Patch, at?: number): void {
    if (key === "wave") return this.setWave(v as Wave, at);
    if (ENV_KEYS.includes(key)) return this.setEnvelope(patch);
    this.channel.set(key, v as number, at);
  }
  protected abstract setWave(w: Wave, at?: number): void;
  protected abstract setEnvelope(p: Patch): void;
  abstract releaseAll(time: number): void;
  /** The transport starts or stops (P7 review M6: the noise wave's breath runs only while it plays). */
  setPlaying(_on: boolean): void {}
}

export class Drums extends Instrument {
  private kick: Tone.MembraneSynth;
  private kickDrive: Tone.Distortion;
  private hat: Tone.NoiseSynth;
  private open: Tone.NoiseSynth;
  private clap: Tone.NoiseSynth;
  /** P7 (spec 8.7): a tuned tom or conga-like hit, and a shaker. */
  private perc: Tone.MembraneSynth;
  private shaker: Tone.NoiseSynth;
  private trims: Record<DrumVoice, number> = { kick: 0.95, clap: 0.6, hat: 0.22, open: 0.18, perc: 0.45, shaker: 0.16 };
  /** One ramped gain per voice: its trim times its level knob. */
  private gains = {} as Record<DrumVoice, Tone.Gain>;
  private decays: Record<DrumVoice, number> = { kick: 0.5, clap: 0.5, hat: 0.5, open: 0.5, perc: 0.5, shaker: 0.5 };
  private pitch = 0.4;
  private percPitch = 0.5;

  constructor(buses: Buses) {
    super(new Channel(buses.drums, buses, [200, 10000], false, 1)); // C2: 10 kHz top like every other filter
    const into = (voice: DrumVoice, node: Tone.ToneAudioNode): void => {
      const g = new Tone.Gain(this.trims[voice]).connect(this.channel.input);
      node.connect(g);
      this.gains[voice] = g;
    };
    // Kick: sine with a fast pitch drop; the drive is 4x oversampled so its harmonics do not alias.
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 4.5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: DRUM_RELEASE.kick },
    });
    this.kickDrive = new Tone.Distortion({ distortion: 0.18, oversample: "4x", wet: 0.5 });
    this.kick.connect(this.kickDrive);
    into("kick", this.kickDrive);

    this.hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0, release: DRUM_RELEASE.hat },
    });
    const hatHp = new Tone.Filter({ frequency: 7500, type: "highpass", rolloff: -12 });
    this.hat.connect(hatHp);
    into("hat", hatHp);

    this.open = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.002, decay: 0.15, sustain: 0, release: DRUM_RELEASE.open },
    });
    const openHp = new Tone.Filter({ frequency: 7000, type: "highpass", rolloff: -12 });
    this.open.connect(openHp);
    into("open", openHp);

    this.clap = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.002, decay: 0.07, sustain: 0, release: DRUM_RELEASE.clap },
    });
    const clapBp = new Tone.Filter({ frequency: 1500, type: "bandpass", Q: 1.1 });
    this.clap.connect(clapBp);
    into("clap", clapBp);

    // Perc: a sine with a short, shallow pitch drop (a tom at low pitch, a conga high). No drive: nothing to alias.
    this.perc = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 1.2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: DRUM_RELEASE.perc },
    });
    into("perc", this.perc);

    // Shaker: white noise with a soft attack, high-passed under the drum channel's 10 kHz top.
    this.shaker = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.006, decay: 0.05, sustain: 0, release: DRUM_RELEASE.shaker },
    });
    const shakerHp = new Tone.Filter({ frequency: 4500, type: "highpass", rolloff: -12 });
    this.shaker.connect(shakerHp);
    into("shaker", shakerHp);
  }

  override set(key: keyof Patch, v: number | Wave, patch: Patch, at?: number): void {
    const n = v as number;
    if (key === "drive") return void ramp(this.kickDrive.wet, clamp01(n), at);
    if (key === "pitch") return void (this.pitch = clamp01(n)); // from the next kick
    if (key === "percPitch") return void (this.percPitch = clamp01(n)); // from the next perc hit
    for (const voice of DRUM_VOICES) {
      if (key === `${voice}Level`) return void ramp(this.gains[voice].gain, this.trims[voice] * drumLevel(n), at);
      if (key === `${voice}Decay`) return void (this.decays[voice] = clamp01(n)); // from the next hit
    }
    super.set(key, v, patch, at);
  }

  protected setWave(): void {}
  protected setEnvelope(): void {}

  /** Native value of a voice's level gain, for the smoke test (G3 review E1). */
  levelGain(voice: DrumVoice): number {
    return nativeValue(this.gains[voice].gain);
  }

  /**
   * One hit; `gap` is sixteenths to the voice's next hit. Pitch and decay are read here, so a knob
   * move acts from the next hit and never cuts one.
   */
  trigger(voice: DrumVoice, time: number, vel: number, bpm: number, gap = Infinity): void {
    const d = drumDecay(voice, this.decays[voice], bpm, gap);
    this.atTime(time, () => {
      switch (voice) {
        case "kick":
          this.kick.envelope.decay = d;
          return void this.kick.triggerAttackRelease(kickHz(this.pitch), d, time, vel);
        case "hat":
          this.open.triggerRelease(time); // closed hat chokes the open one
          this.hat.envelope.decay = d;
          return void this.hat.triggerAttackRelease(d, time, vel);
        case "open":
          this.open.envelope.decay = d;
          return void this.open.triggerAttackRelease(d, time, vel);
        case "clap":
          this.clap.envelope.decay = d;
          return void this.clap.triggerAttackRelease(d, time, vel);
        case "perc":
          this.perc.envelope.decay = d;
          return void this.perc.triggerAttackRelease(percHz(this.percPitch), d, time, vel);
        case "shaker":
          this.shaker.envelope.decay = d;
          return void this.shaker.triggerAttackRelease(d, time, vel);
      }
    });
  }

  releaseAll(time: number): void {
    this.open.triggerRelease(time);
  }
}

/**
 * Mono bass: an oscillator voice and a sine sub, through the channel filter driven by its own
 * envelope (filter envelope amount and decay). Glide slides from the previous note's pitch.
 * P7: the FM wave plays a two-operator FM voice; the noise wave a sine with the breath of noise over it.
 */
/** A bass voice: a Synth, or an FMSynth used through the same calls. */
type Mono = Tone.Synth;

/** The FM voice's modulation envelope: it follows the amp envelope, so a bell's brightness dies with it. */
function modEnv(e: { attack: number; decay: number; sustain: number; release: number }) {
  return { attack: e.attack, decay: Math.max(0.05, e.decay * 1.5), sustain: Math.min(e.sustain, 0.5), release: e.release };
}

/** Ramp the ratio and index of every FM voice of a synth (no step in a held note's timbre). */
function rampFm(voices: readonly unknown[], ratio: number, index: number, at?: number): void {
  for (const v of voices) {
    const f = v as { harmonicity?: unknown; modulationIndex?: unknown };
    if (f.harmonicity) ramp(f.harmonicity, ratio, at);
    if (f.modulationIndex) ramp(f.modulationIndex, index, at);
  }
}

export class Bass extends Instrument {
  private monos: VoiceSets<Mono>;
  private sub: Tone.Synth;
  private subGain: Tone.Gain;
  private wave: Wave | null = null;
  private env = { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.08 };
  private glide = 0;
  private lastHz: number | null = null;
  private fm = { ratio: 0.25, index: 0.3 };
  private breath: Breath | null = null;
  private playing = false;

  constructor(buses: Buses) {
    super(new Channel(buses.duck, buses, [80, 6000], true, 0.75));
    this.channel.enableEnv();
    this.monos = new VoiceSets(this.channel.input);
    this.subGain = new Tone.Gain(subGain(0.75)).connect(this.channel.input);
    this.sub = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.08 },
    });
    this.sub.connect(this.subGain);
    this.setWave("sawtooth");
  }

  override set(key: keyof Patch, v: number | Wave, patch: Patch, at?: number): void {
    if (key === "sub") return void ramp(this.subGain.gain, subGain(v as number), at);
    if (key === "glide") return void (this.glide = clamp01(v as number)); // from the next note
    if (key === "fmRatio" || key === "fmIndex") {
      this.fm[key === "fmRatio" ? "ratio" : "index"] = clamp01(v as number);
      const voices: Mono[] = [];
      this.monos.each((m) => voices.push(m));
      return rampFm(voices, fmRatio(this.fm.ratio), fmIndex(this.fm.index), at);
    }
    super.set(key, v, patch, at);
  }

  /** The new wave plays from the next note; the sounding note keeps the old one. */
  protected setWave(w: Wave, at?: number): void {
    if (w === this.wave) return;
    this.wave = w;
    this.monos.swap(() => {
      if (w === "fm")
        return new Tone.FMSynth({
          harmonicity: fmRatio(this.fm.ratio),
          modulationIndex: fmIndex(this.fm.index),
          oscillator: { type: "sine" },
          modulation: { type: "sine" },
          envelope: this.env,
          modulationEnvelope: modEnv(this.env),
        } as unknown as Partial<Tone.FMSynthOptions>) as unknown as Mono;
      return new Tone.Synth({ oscillator: { type: w === "noise" ? "sine" : w }, envelope: this.env } as Partial<Tone.SynthOptions>) as unknown as Mono;
    }, at);
    if (w === "noise") (this.breath ??= new Breath(this.channel.input, this.playing)).setOn(true);
    else this.breath?.setOn(false, this.env.release);
    this.breath?.shape(this.env);
  }

  override setPlaying(on: boolean): void {
    this.playing = on;
    this.breath?.setPlaying(on);
  }

  /** The noise wave's breath runs now (for the smoke test). */
  get breathing(): boolean {
    return this.breath?.on ?? false;
  }

  protected setEnvelope(p: Patch): void {
    this.env = { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release };
    this.monos.each((m) => m.set({ envelope: this.env }));
    if (this.wave === "fm") this.monos.live?.synth.set({ modulationEnvelope: modEnv(this.env) } as never);
    this.sub.set({ envelope: { ...this.env, sustain: Math.max(p.sustain, 0.6) } });
    this.breath?.shape(this.env);
  }

  trigger(midi: number, dur: number, time: number, vel: number): void {
    this.atTime(time, () => {
      const hz = midiToHz(midi);
      // A mono bass: the next note ends one still held by the previous voice set.
      this.monos.old?.synth.triggerRelease(time);
      this.monos.retireIf((m) => m.getLevelAtTime(Tone.now()) < 1e-4);
      const live = this.monos.live!.synth;
      live.triggerAttackRelease(hz, dur, time, vel);
      this.sub.triggerAttackRelease(hz, dur, time, vel);
      this.breath?.play(hz * 2, time, dur, vel * 0.6);
      const g = glideSeconds(this.glide, dur);
      if (g > 0.003 && this.lastHz !== null && this.lastHz !== hz) {
        for (const s of [live, this.sub]) {
          s.frequency.cancelScheduledValues(time);
          s.frequency.setValueAtTime(this.lastHz, time);
          s.frequency.exponentialRampToValueAtTime(hz, time + g);
        }
      }
      this.lastHz = hz;
      this.channel.triggerEnv(time, dur, { attack: 0.004, decay: this.env.decay * 0.8, release: 0.1 });
    });
  }

  releaseAll(time: number): void {
    this.monos.each((m) => m.triggerRelease(time));
    this.sub.triggerRelease(time);
    this.breath?.release(time);
    this.lastHz = null;
  }
}

/** A polyphonic voice: the Synth instrument and both layers. */
export class Poly extends Instrument {
  private polys: VoiceSets<Tone.PolySynth>;
  private wave: Wave | null = null;
  private env = { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.3 };
  private patchEnv: Patch | null = null;
  private padEnv: { attack: number; release: number } | null = null;
  private spread = detuneCents(0.37);
  /** P7: the FM wave's ratio and index dials, the voice sets that are FM, and the noise wave's breath. */
  private fm = { ratio: 0.25, index: 0.3 };
  private fmSets = new WeakSet<Tone.PolySynth>();
  private breath: Breath | null = null;
  private playing = false;
  /**
   * P7: the notes a drone or a swooping pad holds (spec 8.10): each voice with the note it was started on (the key
   * PolySynth knows it by) and the note it sounds now (`midi`, after glides). They glide to each new chord and let
   * go only on releaseAll. A wave change moves them to the new voice set (P7 review E1).
   */
  private held: { poly: Tone.PolySynth; vel: number; items: { key: number; midi: number; voice: Tone.Synth }[] } | null = null;
  /** P7: voices wired to the drift's pitch, with the drift's wiring epoch, so each is wired once per drift-on. */
  private drifted = new WeakMap<object, number>();
  /** Voices whose dispose already unwires them from the drift's pitch. */
  private wrapped = new WeakSet<object>();
  /** Held notes moved to a new voice set by a wave change (P7 review E1), for the smoke test. */
  reholds = 0;
  /**
   * Layers only (G4): the pad filter after the voices. Open (10 kHz, the C1 top) outside Pad mode;
   * in Pad mode Brightness sets its top and Motion sweeps it down and back by up to two octaves,
   * one cycle in eight seconds, so it never opens past the brightness point.
   */
  private pad: { filter: Tone.Filter; lfo: Tone.LFO; depth: Tone.Multiply; at: string } | null = null;
  /** Audio time of the last pad filter move, for the smoke test (G4 review S1). */
  private padMoveAt = -1;

  /**
   * `filterEnv`: the channel filter follows an envelope (the Synth's filter envelope dial); `fatAll`:
   * every wave is doubled, so detune acts on triangle and sine too.
   */
  constructor(
    buses: Buses,
    private readonly fat: number,
    private readonly maxPolyphony: number,
    trim: number,
    private readonly opts: { filterEnv?: boolean; fatAll?: boolean; padTone?: boolean } = {},
  ) {
    super(new Channel(buses.duck, buses, [100, 10000], true, trim, true));
    if (opts.filterEnv) this.channel.enableEnv();
    let dest = this.channel.input;
    if (opts.padTone) {
      const filter = new Tone.Filter({ frequency: PAD_TOP_HZ, type: "lowpass", rolloff: -12, Q: 0.5 }).connect(dest);
      const depth = new Tone.Multiply(0);
      const lfo = new Tone.LFO({ frequency: 0.125, min: -1, max: 0, type: "sine" });
      lfo.chain(depth, filter.detune);
      lfo.start();
      this.pad = { filter, lfo, depth, at: "" };
      dest = filter as unknown as Tone.Gain;
    }
    this.polys = new VoiceSets(dest);
    this.setWave("sawtooth");
  }

  override set(key: keyof Patch, v: number | Wave, patch: Patch, at?: number): void {
    if (key === "detune") {
      // The layers have no Detune dial: they keep G2's fixed spreads (G3 review M4).
      if (!this.opts.fatAll) return;
      this.spread = detuneCents(v as number);
      return this.polys.each((p) => this.rampSpread(p, this.spread, at));
    }
    if (key === "fmRatio" || key === "fmIndex") {
      this.fm[key === "fmRatio" ? "ratio" : "index"] = clamp01(v as number);
      return this.polys.each((p) => {
        if (!this.fmSets.has(p)) return;
        const o = (p as unknown as { options: { harmonicity: number; modulationIndex: number } }).options;
        o.harmonicity = fmRatio(this.fm.ratio);
        o.modulationIndex = fmIndex(this.fm.index);
        rampFm((p as unknown as { _voices: unknown[] })._voices, o.harmonicity, o.modulationIndex, at);
      });
    }
    super.set(key, v, patch, at);
    if (key === "drift") this.wireAll();
  }

  /** Spread of a new voice set: the Detune dial on the Synth; on the layers G2's 22 cents saw, 14 square. */
  private spreadFor(w: Wave): number {
    return this.opts.fatAll ? this.spread : w === "square" ? 14 : 22;
  }

  /**
   * Ramp every voice's sub-oscillators to a new spread (G3 review S1). PolySynth.set would set each
   * fat oscillator's detunes at once, a step in the beating of a held chord. A fat oscillator of
   * `count` voices spreads them evenly from -spread/2 to +spread/2; new voices take the stored spread.
   */
  private rampSpread(p: Tone.PolySynth, spread: number, at?: number): void {
    type Fat = { _spread: number; _oscillators: { detune: Tone.Signal<"cents"> }[] };
    const poly = p as unknown as { _voices: Tone.Synth[]; options: { oscillator: { spread?: number } } };
    if (!poly.options.oscillator) return; // an FM set has no fat oscillator
    poly.options.oscillator.spread = spread;
    for (const voice of poly._voices) {
      const fat = (voice.oscillator as unknown as { _oscillator?: Partial<Fat> } | undefined)?._oscillator;
      const subs = fat?._oscillators;
      if (!fat || !subs || subs.length < 2) continue;
      fat._spread = spread;
      subs.forEach((o, i) => ramp(o.detune, -spread / 2 + (spread * i) / (subs.length - 1), at));
    }
  }

  /** P7: wire every voice of every set to the drift's pitch (once each) while the drift is on. */
  private wireAll(): void {
    const dr = this.channel.drift;
    if (!dr?.wired) return;
    this.polys.each((p) => {
      for (const v of (p as unknown as { _voices: Tone.Synth[] })._voices) this.wire(v, dr.pitch, dr.epoch);
    });
  }

  /** Wire one voice's detune to the drift's pitch; PolySynth may free a voice itself, so unwire on its dispose. */
  private wire(v: Tone.Synth, pitch: GainNode, epoch: number): void {
    if (this.drifted.get(v) === epoch) return;
    this.drifted.set(v, epoch);
    const param = nativeParam(v.detune);
    pitch.connect(param);
    if (this.wrapped.has(v)) return;
    this.wrapped.add(v);
    const dispose = v.dispose.bind(v);
    v.dispose = () => {
      try {
        pitch.disconnect(param);
      } catch {
        // already gone (the drift went off and cut every voice)
      }
      return dispose();
    };
  }

  /** Native sub-oscillator detunes of the live set's sounding voices, for the smoke test. */
  detunes(): number[] {
    const poly = this.polys.live?.synth as unknown as { _activeVoices: { voice: Tone.Synth }[] } | undefined;
    const out: number[] = [];
    for (const { voice } of poly?._activeVoices ?? []) {
      const subs = (voice.oscillator as unknown as { _oscillator?: { _oscillators?: { detune: unknown }[] } } | undefined)?._oscillator?._oscillators;
      for (const o of subs ?? []) out.push(nativeValue(o.detune));
    }
    return out;
  }

  /** Voices sounding in either voice set, for the smoke test (G3 review M8). */
  activeVoices(): number {
    let n = 0;
    this.polys.each((p) => (n += p.activeVoices));
    return n;
  }

  /** Voices allotted in either voice set (PolySynth's own count): never more than twice the cap (the old set rings out). */
  allottedVoices(): number {
    let n = 0;
    this.polys.each((p) => (n += (p as unknown as { _voices: unknown[] })._voices.length));
    return n;
  }

  /** Notes held now by a drone or a swooping pad (P7), for the smoke test. */
  heldNotes(): number {
    return this.held?.items.length ?? 0;
  }

  /** The polyphony cap of one voice set. */
  get cap(): number {
    return this.maxPolyphony;
  }

  /** The new wave plays from the next note; sounding notes keep the old one and ring out. */
  protected setWave(w: Wave, at?: number): void {
    if (w === this.wave) return;
    this.wave = w;
    this.polys.swap(() => {
      let p: Tone.PolySynth;
      if (w === "fm") {
        p = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: fmRatio(this.fm.ratio),
          modulationIndex: fmIndex(this.fm.index),
          oscillator: { type: "sine" },
          modulation: { type: "sine" },
          envelope: this.env,
          modulationEnvelope: modEnv(this.env),
        } as unknown as Partial<Tone.FMSynthOptions>) as unknown as Tone.PolySynth;
        this.fmSets.add(p);
      } else {
        p = new Tone.PolySynth(Tone.Synth, {
          oscillator: w === "noise" ? { type: "sine" } : oscFor(w, this.fat, this.spreadFor(w), this.opts.fatAll),
          envelope: this.env,
        } as unknown as Partial<Tone.SynthOptions>);
        // The noise wave's sine body sits under its breath.
        if (w === "noise") p.volume.value = -8;
      }
      p.maxPolyphony = this.maxPolyphony;
      return p;
    }, at);
    if (w === "noise") (this.breath ??= new Breath(this.polysDest(), this.playing)).setOn(true);
    else this.breath?.setOn(false, this.env.release);
    this.breath?.shape(this.env);
    if (this.held?.items.length) this.rehold(at);
  }

  /**
   * P7 review E1: a wave change while a drone or a swooping pad holds notes. The held voices are on the previous set,
   * which the next wave change frees, so the held notes start on the new set at the change (with the envelope's
   * attack) and the old ones let go with their release: a crossfade, and every later glide reaches them.
   */
  private rehold(at?: number): void {
    // From the lookahead on (Tone.now()), not the audio clock's now: building the new voice set can take longer than
    // a render quantum, and an attack scheduled in the past would start part-way up its ramp, a step.
    const t = Math.max(at ?? 0, Tone.now());
    this.atTime(t, () => {
      const h = this.held;
      const live = this.polys.live?.synth;
      if (!h || !h.items.length || !live || h.poly === live) return;
      const notes = h.items.map((i) => i.midi);
      for (const i of h.items) {
        try {
          h.poly.triggerRelease(i.key, t);
        } catch {
          // the set was already freed
        }
      }
      this.held = null;
      this.attackHeld(notes, t, h.vel);
      // To the noise wave: its breath holds with the notes (it is let go when the wave leaves noise).
      if (this.wave === "noise") this.breath?.hold(midiToHz(Math.max(...notes)), t, h.vel);
      this.reholds++;
    });
  }

  override setPlaying(on: boolean): void {
    this.playing = on;
    this.breath?.setPlaying(on);
  }

  /** The noise wave's breath runs now (for the smoke test). */
  get breathing(): boolean {
    return this.breath?.on ?? false;
  }

  /** Where the voices go: the pad filter on the layers, the channel on the Synth. */
  private polysDest(): Tone.InputNode {
    return this.pad ? this.pad.filter : this.channel.input;
  }

  private setEnv(env: { attack: number; decay: number; sustain: number; release: number }): void {
    this.env = env;
    this.polys.each((p) => {
      p.set({ envelope: env });
      if (this.fmSets.has(p)) p.set({ modulationEnvelope: modEnv(env) } as never);
    });
    this.breath?.shape(env);
  }

  protected setEnvelope(p: Patch): void {
    this.patchEnv = p;
    if (!this.padEnv) this.setEnv({ attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release });
  }

  /**
   * Pad mode takes its attack and release from the section's pad settings, and its brightness and
   * motion drive the pad filter; other modes use the patch envelope with the pad filter open.
   * Called on every step with the step's audio time: it does nothing unless something changed, and
   * the filter moves at `time`, on the audio clock, not a lookahead early (G4 review S1). Leaving Pad
   * mode, the filter opens over the pad's release, so the released chord fades at its own brightness.
   * P7: Drone mode uses the pad settings too.
   */
  useMode(pad: { attack: number; release: number; brightness: number; motion: number } | null, time: number): void {
    const leaving = !pad && this.padEnv ? this.padEnv.release : null;
    if (pad) {
      if (!this.padEnv || this.padEnv.attack !== pad.attack || this.padEnv.release !== pad.release) {
        this.padEnv = { attack: pad.attack, release: pad.release };
        this.setEnv({ attack: pad.attack, decay: 0.6, sustain: 0.8, release: pad.release });
      }
    } else if (this.padEnv) {
      this.padEnv = null;
      if (this.patchEnv) this.setEnvelope(this.patchEnv);
    }
    const t = this.pad;
    if (!t) return;
    const at = pad ? `${pad.brightness}:${pad.motion}` : "open";
    if (at === t.at) return;
    t.at = at;
    const tau = leaving !== null ? Math.min(leaving, 1) / 3 : RAMP / 4;
    rampAt(t.filter.frequency, pad ? padBrightnessHz(pad.brightness) : PAD_TOP_HZ, time, tau);
    rampAt(t.depth.factor, pad ? padMotionCents(pad.motion) : 0, time, tau);
    this.padMoveAt = Math.max(time, Tone.getContext().currentTime);
  }

  /** Audio time from which the pad filter last moved (-1 before the first move). */
  padMoveTime(): number {
    return this.padMoveAt;
  }

  /** The pad filter's resting frequency now, in Hz (for the smoke test); null on the Synth. */
  padHz(): number | null {
    return this.pad ? nativeValue(this.pad.filter.frequency) : null;
  }

  /** Glides started (P5), for the smoke test. */
  glides = 0;
  /** Glides not started because the layer had no voice free and the note was dropped (P5 review S2). */
  glideDrops = 0;
  /** Chord glides of a drone or swooping pad (P7), for the smoke test. */
  swoops = 0;

  /**
   * `lead` (P5, layers in Lead mode): `glideFrom` starts the note's pitch at that MIDI note and slides it to its
   * own over `glide` seconds (only this voice: the others keep their pitch); `accent` opens the filter for it.
   */
  trigger(notes: number[], dur: number, time: number, vel: number, lead?: { glideFrom?: number; glide?: number; accent?: boolean }): void {
    this.atTime(time, () => {
      this.polys.retireIf((p) => p.activeVoices === 0);
      const poly = this.polys.live!.synth;
      type Active = { _activeVoices: { midi: number; voice: Tone.Synth }[] };
      const was = (poly as unknown as Active)._activeVoices.length;
      poly.triggerAttackRelease(notes.map(midiToHz), dur, time, vel);
      const active = (poly as unknown as Active)._activeVoices;
      this.channel.triggerEnv(time, dur, this.env);
      this.breath?.play(midiToHz(Math.max(...notes)), time, dur, vel);
      this.wireAll();
      if (lead?.accent) this.channel.accent(time);
      if (lead?.glideFrom !== undefined && notes.length === 1) {
        // The voice just started is the last one PolySynth listed (it starts synchronously at or after now).
        // At maxPolyphony PolySynth drops the note and starts no voice: then the last entry is another note
        // still sounding, which must not bend (P5 review S2).
        const last = active[active.length - 1];
        // PolySynth keys a voice by its note read as Tone.Midi (here the Hz value passed): compare the same way.
        const key = Tone.Midi(midiToHz(notes[0])).toMidi();
        const voice = active.length > was && last && last.midi === key ? last.voice : undefined;
        if (!voice) this.glideDrops++;
        else {
          const f = nativeParam(voice.frequency);
          const t = Math.max(time, Tone.getContext().currentTime);
          const g = Math.max(0.01, lead.glide ?? 0.06);
          f.cancelScheduledValues(t);
          f.setValueAtTime(midiToHz(lead.glideFrom), t);
          f.exponentialRampToValueAtTime(midiToHz(notes[0]), t + g);
          this.glides++;
        }
      }
    });
  }

  /** Start `notes` at `time` and hold them (P7: a drone, a swooping pad) until releaseAll; adds to what is held. */
  private attackHeld(notes: number[], time: number, vel: number): void {
    this.polys.retireIf((p) => p.activeVoices === 0);
    const poly = this.polys.live!.synth;
    type Active = { _activeVoices: { midi: number; voice: Tone.Synth; released: boolean }[] };
    const before = new Set((poly as unknown as Active)._activeVoices.map((e) => e.voice));
    poly.triggerAttack(notes.map(midiToHz), time, vel);
    if (!this.held || this.held.poly !== poly) this.held = { poly, vel, items: [] };
    for (const n of notes) {
      const key = Tone.Midi(midiToHz(n)).toMidi();
      const e = (poly as unknown as Active)._activeVoices.find((x) => !before.has(x.voice) && x.midi === key && !this.held!.items.some((h) => h.voice === x.voice));
      if (e) this.held.items.push({ key: midiToHz(n), midi: n, voice: e.voice });
    }
    this.wireAll();
  }

  /** P7: start notes that are held until the layer lets go (a drone, a pad with Swoop). */
  hold(notes: number[], time: number, vel: number): void {
    this.atTime(time, () => {
      this.attackHeld(notes, time, vel);
      this.breath?.hold(midiToHz(Math.max(...notes)), time, vel);
    });
  }

  /**
   * P7 (spec 8.10, Swoop): the held notes glide to `notes` over `seconds`, voice by voice in order; none restarts.
   * A chord with more notes starts the extra ones; with fewer, the spare voices let go. Nothing held: it starts them.
   */
  glideTo(notes: number[], time: number, seconds: number, vel: number): void {
    this.atTime(time, () => {
      const h = this.held;
      if (!h || !h.items.length) {
        this.attackHeld(notes, time, vel);
        this.breath?.hold(midiToHz(Math.max(...notes)), time, vel);
        return;
      }
      const t = Math.max(time, Tone.getContext().currentTime);
      const n = Math.min(notes.length, h.items.length);
      for (let i = 0; i < n; i++) {
        const f = nativeParam(h.items[i].voice.frequency);
        f.cancelScheduledValues(t);
        f.setTargetAtTime(midiToHz(notes[i]), t, Math.max(0.01, seconds / 3));
        h.items[i].midi = notes[i];
      }
      for (const spare of h.items.splice(n)) h.poly.triggerRelease(spare.key, time);
      if (notes.length > n) {
        const extra = notes.slice(n);
        const poly = this.polys.live!.synth;
        if (poly === h.poly) this.attackHeld(extra, time, vel);
      }
      this.breath?.glide(midiToHz(Math.max(...notes)), time, seconds);
      this.swoops++;
    });
  }

  releaseAll(time: number): void {
    this.polys.each((p) => p.releaseAll(time));
    this.breath?.release(time);
    this.held = null;
  }
}

export type { MixState } from "./song.ts";
const INSTRUMENT_LIST = ["drums", "bass", "synth", "layer1", "layer2"] as const;

/** Shared sends, the ducked music bus, the drum bus and the master chain. */
export class Graph {
  readonly buses: Buses;
  readonly instruments: { drums: Drums; bass: Bass; synth: Poly; layer1: Poly; layer2: Poly };
  private meter: Tone.Meter;
  private meters = new Map<InstrumentId, Tone.Meter>();
  /** Raw samples after the limiter, for the peak reading (the last 16384, about 0.37 s at 44.1 kHz). */
  private scope: Tone.Analyser;
  private lp: Tone.Filter;
  private hp: Tone.Filter;
  private sat: Tone.Distortion;
  /** The limiter: the master output, which the recorder taps (G5). */
  private out: Tone.Compressor;
  pumpDepth = 0.6;
  /** P7: the lo-fi master, the air layer and the reverb whose decay can change. */
  readonly lofi: LoFi;
  readonly air: Air;
  readonly reverb: ReverbBank;

  private constructor(
    buses: Buses,
    meter: Tone.Meter,
    scope: Tone.Analyser,
    lp: Tone.Filter,
    hp: Tone.Filter,
    sat: Tone.Distortion,
    out: Tone.Compressor,
    p7: { lofi: LoFi; air: Air; reverb: ReverbBank },
  ) {
    this.lofi = p7.lofi;
    this.air = p7.air;
    this.reverb = p7.reverb;
    this.out = out;
    this.buses = buses;
    this.meter = meter;
    this.scope = scope;
    this.lp = lp;
    this.hp = hp;
    this.sat = sat;
    this.instruments = {
      drums: new Drums(buses),
      bass: new Bass(buses),
      synth: new Poly(buses, 2, 16, 0.5, { filterEnv: true, fatAll: true }),
      // Either layer can be a pad: 4 notes times 2 overlapping chords, plus headroom.
      layer1: new Poly(buses, 2, 10, 0.5, { padTone: true }),
      layer2: new Poly(buses, 2, 10, 0.5, { padTone: true }),
    };
  }

  static async build(): Promise<Graph> {
    // Limiter: Tone.Limiter has a 10 ms release, fast enough to ride the gain within one cycle of
    // the bass and kick (audible as fuzz and crackle). A compressor at limiter ratio with a 120 ms
    // release holds the gain steady instead. Its attack lets kick transients overshoot: with the
    // G1 setting (-2 dB, 3 ms) the peak after it reached +0.2 dBFS, so it is -4 dB with a 1 ms attack.
    const limiter = new Tone.Compressor({ threshold: -4, ratio: 20, attack: 0.001, release: 0.12, knee: 0 }).toDestination();
    const sat = new Tone.Distortion({ distortion: 0.25, oversample: "4x", wet: 0 });
    const meter = new Tone.Meter({ smoothing: 0.6 });
    const lp = new Tone.Filter({ frequency: 20000, type: "lowpass", rolloff: -12 });
    const hp = new Tone.Filter({ frequency: 10, type: "highpass", rolloff: -12 });
    const master = new Tone.Gain(0.5); // was 0.7 in the spike: more headroom into the limiter
    // P7: the lo-fi master sits after the sweep filters and before the saturation; off, it is a dry gain.
    const lofi = new LoFi();
    master.chain(lp, hp, lofi.input);
    lofi.output.chain(sat, limiter);
    sat.connect(meter);
    const scope = new Tone.Analyser({ type: "waveform", size: 16384 });
    limiter.connect(scope);

    const duck = new Tone.Gain(1).connect(master);
    const drums = new Tone.Gain(1).connect(master);
    const bank = new ReverbBank(duck, MIX_DEFAULTS.reverbDecay);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.36, wet: 1 });
    delay.connect(duck);
    // The air layer goes to the drum bus (not ducked by the kick) and into the reverb.
    const air = new Air(drums, bank.input);
    return new Graph({ duck, drums, delay, reverb: bank.input }, meter, scope, lp, hp, sat, limiter, { lofi, air, reverb: bank });
  }

  /** Feed the master output (after the limiter, what the headphones hear) into a native node. */
  tap(node: AudioNode): void {
    this.out.connect(node);
  }

  untap(node: AudioNode): void {
    this.out.disconnect(node);
  }

  /** Duck the music bus on a kick: an 8 ms ramp down, then a swell back. Never a step. */
  pump(time: number): void {
    if (this.pumpDepth <= 0) return;
    const g = this.buses.duck.gain;
    g.cancelAndHoldAtTime(time);
    g.linearRampToValueAtTime(1 - this.pumpDepth, time + 0.008);
    g.setTargetAtTime(1, time + 0.02, 0.075);
  }

  resetPump(): void {
    const g = this.buses.duck.gain;
    const now = Tone.now();
    g.cancelAndHoldAtTime(now);
    g.linearRampToValueAtTime(1, now + RAMP);
  }

  /** Pump depth is read by each kick's pump, so it acts from the next kick; the rest ramps from now. */
  setMix(key: MixKey, given: number, at?: number): void {
    const [lo, hi] = MIX_RANGES[key];
    const v = Math.max(lo, Math.min(hi, given));
    if (key === "lofi") return this.lofi.set(v, at);
    if (key === "air") return this.air.set(v, at);
    if (key === "reverbDecay") return void (Math.abs(v - this.reverb.target) > 0.01 && this.reverb.setDecay(v, at));
    if (key === "pump") this.pumpDepth = Math.max(0, Math.min(0.95, v));
    else if (key === "saturation") ramp(this.sat.wet, Math.max(0, Math.min(1, v)), at);
    else {
      const s = Math.max(-1, Math.min(1, v));
      ramp(this.lp.frequency, s < 0 ? 20000 * Math.pow(150 / 20000, -s) : 20000, at);
      ramp(this.hp.frequency, s > 0 ? 10 * Math.pow(4000 / 10, s) : 10, at);
    }
  }

  /** A mix value from audio time `time`, on the audio clock (P3 review E1). */
  setMixAt(key: MixKey, v: number, time: number): void {
    this.setMix(key, v, time);
  }

  /**
   * One instrument's own level in dB, after its level dial and before the sends and buses (P3 review S2): the
   * shared reverb's tail is not in it. The meter is made on first use (the smoke test).
   */
  instrumentLevel(id: InstrumentId): number {
    let m = this.meters.get(id);
    if (!m) {
      m = new Tone.Meter({ smoothing: 0.6 });
      this.instruments[id].channel.level.connect(m);
      this.meters.set(id, m);
    }
    const v = m.getValue();
    return typeof v === "number" ? v : v[0];
  }

  /** P7: Play starts at `at`: the synced LFOs restart there, on the bar; the hiss and the air play while it runs. */
  startClock(at: number): void {
    for (const id of INSTRUMENT_LIST) this.instruments[id].channel.startClock(at);
    this.setPlaying(true);
  }

  setPlaying(on: boolean): void {
    this.lofi.setPlaying(on);
    this.air.setPlaying(on);
    for (const id of INSTRUMENT_LIST) this.instruments[id].setPlaying(on);
  }

  /** P7: a new tempo from `at`, for the synced LFOs. */
  setTempo(bpm: number, at?: number): void {
    for (const id of INSTRUMENT_LIST) this.instruments[id].channel.setTempo(bpm, at);
  }

  setGate(id: InstrumentId, on: boolean): void {
    ramp(this.instruments[id].channel.gate.gain, on ? 1 : 0);
  }

  level(): number {
    const v = this.meter.getValue();
    return typeof v === "number" ? v : v[0];
  }

  /** Largest absolute sample after the limiter over the last ~0.37 s, in dBFS. */
  peak(): number {
    const v = this.scope.getValue() as Float32Array;
    let m = 0;
    for (let i = 0; i < v.length; i++) m = Math.max(m, Math.abs(v[i]));
    return m > 0 ? 20 * Math.log10(m) : -Infinity;
  }

  /** Attacks started so far, over every instrument. */
  attacks(): number {
    return Object.values(this.instruments).reduce((n, i) => n + i.attacks, 0);
  }
}
