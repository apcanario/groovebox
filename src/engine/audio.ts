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
import { DRUM_RELEASE, PAD_TOP_HZ, padBrightnessHz, padMotionCents, detuneCents, drumDecay, drumLevel, envDepthHz, glideSeconds, kickHz, subGain } from "../music/sound.ts";
import { PATCH_KEYS, type InstrumentId, type MixState, type NumericPatchKey, type Patch, type Wave } from "./song.ts";

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

/** Current native value of a parameter ramped with `ramp`, for the smoke test. */
function nativeValue(param: unknown): number {
  return nativeParam(param).value;
}

/** Run `fn` once the audio clock's lookahead and a ramp have passed (Tone.now() runs ahead). */
function afterRamp(fn: () => void): void {
  const ctx = Tone.getContext();
  ctx.setTimeout(fn, ctx.lookAhead + RAMP + 0.05);
}

interface Buses {
  duck: Tone.Gain; // music bus, ducked by the kick
  drums: Tone.Gain; // drum bus, not ducked
  delay: Tone.FeedbackDelay;
  reverb: Tone.Reverb;
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

  constructor(
    out: Tone.Gain,
    buses: Buses,
    private readonly hz: [number, number],
    withDrive: boolean,
    private readonly trim: number,
  ) {
    this.filter = new Tone.Filter({ frequency: hz[1], type: "lowpass", rolloff: -24, Q: 0.7 });
    this.drive = withDrive ? new Tone.Distortion({ distortion: 0.4, oversample: "2x", wet: 1 }) : null;
    this.level = new Tone.Gain(trim);
    this.delaySend = new Tone.Gain(0).connect(buses.delay);
    this.reverbSend = new Tone.Gain(0).connect(buses.reverb);
    this.input.chain(this.filter, this.dry, this.gate);
    if (this.drive) this.drive.chain(this.wet, this.gate);
    this.gate.chain(this.level, out);
    this.level.connect(this.delaySend);
    this.level.connect(this.reverbSend);
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
      });
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

  constructor(private readonly dest: Tone.Gain) {}

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
    });
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
}

export class Drums extends Instrument {
  private kick: Tone.MembraneSynth;
  private kickDrive: Tone.Distortion;
  private hat: Tone.NoiseSynth;
  private open: Tone.NoiseSynth;
  private clap: Tone.NoiseSynth;
  private trims: Record<DrumVoice, number> = { kick: 0.95, clap: 0.6, hat: 0.22, open: 0.18 };
  /** One ramped gain per voice: its trim times its level knob. */
  private gains = {} as Record<DrumVoice, Tone.Gain>;
  private decays: Record<DrumVoice, number> = { kick: 0.5, clap: 0.5, hat: 0.5, open: 0.5 };
  private pitch = 0.4;

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
  }

  override set(key: keyof Patch, v: number | Wave, patch: Patch, at?: number): void {
    const n = v as number;
    if (key === "drive") return void ramp(this.kickDrive.wet, clamp01(n), at);
    if (key === "pitch") return void (this.pitch = clamp01(n)); // from the next kick
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
 */
export class Bass extends Instrument {
  private monos: VoiceSets<Tone.Synth>;
  private sub: Tone.Synth;
  private subGain: Tone.Gain;
  private wave: Wave | null = null;
  private env = { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.08 };
  private glide = 0;
  private lastHz: number | null = null;

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
    super.set(key, v, patch, at);
  }

  /** The new wave plays from the next note; the sounding note keeps the old one. */
  protected setWave(w: Wave, at?: number): void {
    if (w === this.wave) return;
    this.wave = w;
    this.monos.swap(() => new Tone.Synth({ oscillator: { type: w }, envelope: this.env } as Partial<Tone.SynthOptions>), at);
  }

  protected setEnvelope(p: Patch): void {
    this.env = { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release };
    this.monos.each((m) => m.set({ envelope: this.env }));
    this.sub.set({ envelope: { ...this.env, sustain: Math.max(p.sustain, 0.6) } });
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
    super(new Channel(buses.duck, buses, [100, 10000], true, trim));
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
    super.set(key, v, patch, at);
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
    poly.options.oscillator.spread = spread;
    for (const voice of poly._voices) {
      const fat = (voice.oscillator as unknown as { _oscillator: Partial<Fat> })._oscillator;
      const subs = fat._oscillators;
      if (!subs || subs.length < 2) continue;
      fat._spread = spread;
      subs.forEach((o, i) => ramp(o.detune, -spread / 2 + (spread * i) / (subs.length - 1), at));
    }
  }

  /** Native sub-oscillator detunes of the live set's sounding voices, for the smoke test. */
  detunes(): number[] {
    const poly = this.polys.live?.synth as unknown as { _activeVoices: { voice: Tone.Synth }[] } | undefined;
    const out: number[] = [];
    for (const { voice } of poly?._activeVoices ?? []) {
      const subs = (voice.oscillator as unknown as { _oscillator: { _oscillators?: { detune: unknown }[] } })._oscillator._oscillators;
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

  /** The new wave plays from the next note; sounding notes keep the old one and ring out. */
  protected setWave(w: Wave, at?: number): void {
    if (w === this.wave) return;
    this.wave = w;
    this.polys.swap(() => {
      const p = new Tone.PolySynth(Tone.Synth, {
        oscillator: oscFor(w, this.fat, this.spreadFor(w), this.opts.fatAll),
        envelope: this.env,
      } as unknown as Partial<Tone.SynthOptions>);
      p.maxPolyphony = this.maxPolyphony;
      return p;
    }, at);
  }

  private setEnv(env: { attack: number; decay: number; sustain: number; release: number }): void {
    this.env = env;
    this.polys.each((p) => p.set({ envelope: env }));
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

  trigger(notes: number[], dur: number, time: number, vel: number): void {
    this.atTime(time, () => {
      this.polys.retireIf((p) => p.activeVoices === 0);
      this.polys.live!.synth.triggerAttackRelease(notes.map(midiToHz), dur, time, vel);
      this.channel.triggerEnv(time, dur, this.env);
    });
  }

  releaseAll(time: number): void {
    this.polys.each((p) => p.releaseAll(time));
  }
}

export type { MixState } from "./song.ts";

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

  private constructor(
    buses: Buses,
    meter: Tone.Meter,
    scope: Tone.Analyser,
    lp: Tone.Filter,
    hp: Tone.Filter,
    sat: Tone.Distortion,
    out: Tone.Compressor,
  ) {
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
    master.chain(lp, hp, sat, limiter);
    sat.connect(meter);
    const scope = new Tone.Analyser({ type: "waveform", size: 16384 });
    limiter.connect(scope);

    const duck = new Tone.Gain(1).connect(master);
    const drums = new Tone.Gain(1).connect(master);
    const reverb = new Tone.Reverb({ decay: 3.2, wet: 1 });
    await reverb.ready;
    reverb.connect(duck);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.36, wet: 1 });
    delay.connect(duck);
    return new Graph({ duck, drums, delay, reverb }, meter, scope, lp, hp, sat, limiter);
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
  setMix(key: keyof MixState, v: number, at?: number): void {
    if (key === "pump") this.pumpDepth = Math.max(0, Math.min(0.95, v));
    else if (key === "saturation") ramp(this.sat.wet, Math.max(0, Math.min(1, v)), at);
    else {
      const s = Math.max(-1, Math.min(1, v));
      ramp(this.lp.frequency, s < 0 ? 20000 * Math.pow(150 / 20000, -s) : 20000, at);
      ramp(this.hp.frequency, s > 0 ? 10 * Math.pow(4000 / 10, s) : 10, at);
    }
  }

  /** A mix value from audio time `time`, on the audio clock (P3 review E1). */
  setMixAt(key: keyof MixState, v: number, time: number): void {
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
