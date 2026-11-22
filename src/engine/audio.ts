/**
 * The Tone.js side of the engine: the five instruments, the shared sends and the master chain.
 * Only files in src/engine/ import Tone.
 *
 * C1 (treble crackle) fixes live here: every waveshaper is 4x oversampled, filter resonance is
 * capped and the synth filters stop below 10 kHz, hats and clap sit lower, the master bus is
 * lower, the limiter's release is slow enough not to modulate the bass, and the pump ramps
 * instead of stepping.
 */
import * as Tone from "tone";
import { midiToHz } from "../music/scales.ts";
import type { DrumVoice } from "../music/presets.ts";
import type { InstrumentId, NumericPatchKey, Patch, Wave } from "./song.ts";

const RAMP = 0.03; // seconds; every continuous parameter change is ramped this long
const MAX_Q = 8; // resonance cap (the spike went to 14)

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
  readonly drive: Tone.Distortion | null;
  /** Mute point used by the smoke test's solo. Musical on/off is the sequencer's job. */
  readonly gate = new Tone.Gain(1);
  readonly level: Tone.Gain;
  readonly delaySend: Tone.Gain;
  readonly reverbSend: Tone.Gain;

  constructor(
    out: Tone.Gain,
    buses: Buses,
    private readonly hz: [number, number],
    withDrive: boolean,
    private readonly trim: number,
  ) {
    this.filter = new Tone.Filter({ frequency: hz[1], type: "lowpass", rolloff: -24, Q: 0.7 });
    this.drive = withDrive ? new Tone.Distortion({ distortion: 0.4, oversample: "4x", wet: 0 }) : null;
    this.level = new Tone.Gain(trim);
    this.delaySend = new Tone.Gain(0).connect(buses.delay);
    this.reverbSend = new Tone.Gain(0).connect(buses.reverb);
    if (this.drive) this.input.chain(this.filter, this.drive, this.gate, this.level, out);
    else this.input.chain(this.filter, this.gate, this.level, out);
    this.level.connect(this.delaySend);
    this.level.connect(this.reverbSend);
  }

  cutoffHz(x: number): number {
    const [lo, hi] = this.hz;
    return lo * Math.pow(hi / lo, Math.max(0, Math.min(1, x)));
  }

  set(key: NumericPatchKey, v: number): void {
    switch (key) {
      case "cutoff":
        return void this.filter.frequency.rampTo(this.cutoffHz(v), RAMP);
      case "resonance":
        return void this.filter.Q.rampTo(0.7 + Math.max(0, Math.min(1, v)) * (MAX_Q - 0.7), RAMP);
      case "drive":
        return void this.drive?.wet.rampTo(Math.max(0, Math.min(1, v)), RAMP);
      case "delay":
        return void this.delaySend.gain.rampTo(v, RAMP);
      case "reverb":
        return void this.reverbSend.gain.rampTo(v, RAMP);
      case "level":
        return void this.level.gain.rampTo(v * this.trim, RAMP);
      default:
        return;
    }
  }
}

function oscFor(wave: Wave, fat: number): Record<string, unknown> {
  if (wave === "sawtooth" && fat > 1) return { type: "fatsawtooth", count: fat, spread: 22 };
  if (wave === "square" && fat > 1) return { type: "fatsquare", count: fat, spread: 14 };
  return { type: wave };
}

export abstract class Instrument {
  readonly channel: Channel;
  constructor(channel: Channel) {
    this.channel = channel;
  }
  apply(p: Patch): void {
    for (const k of ["cutoff", "resonance", "drive", "delay", "reverb", "level"] as const) this.channel.set(k, p[k]);
    this.setWave(p.wave);
    this.setEnvelope(p);
  }
  set(key: keyof Patch, v: number | Wave, patch: Patch): void {
    if (key === "wave") return this.setWave(v as Wave);
    if (key === "attack" || key === "decay" || key === "sustain" || key === "release") return this.setEnvelope(patch);
    this.channel.set(key, v as number);
  }
  protected abstract setWave(w: Wave): void;
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

  constructor(buses: Buses) {
    super(new Channel(buses.drums, buses, [200, 18000], false, 1));
    const into = (node: Tone.ToneAudioNode, trim: number): Tone.Gain => {
      const g = new Tone.Gain(trim).connect(this.channel.input);
      node.connect(g);
      return g;
    };
    // Kick: sine with a fast pitch drop; the drive is 4x oversampled so its harmonics do not alias.
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 4.5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.36, sustain: 0, release: 0.05 },
    });
    this.kickDrive = new Tone.Distortion({ distortion: 0.18, oversample: "4x", wet: 0.5 });
    this.kick.connect(this.kickDrive);
    into(this.kickDrive, this.trims.kick);

    this.hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
    });
    const hatHp = new Tone.Filter({ frequency: 7500, type: "highpass", rolloff: -12 });
    this.hat.connect(hatHp);
    into(hatHp, this.trims.hat);

    this.open = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.05 },
    });
    const openHp = new Tone.Filter({ frequency: 7000, type: "highpass", rolloff: -12 });
    this.open.connect(openHp);
    into(openHp, this.trims.open);

    this.clap = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.002, decay: 0.17, sustain: 0, release: 0.02 },
    });
    const clapBp = new Tone.Filter({ frequency: 1500, type: "bandpass", Q: 1.1 });
    this.clap.connect(clapBp);
    into(clapBp, this.trims.clap);
  }

  override set(key: keyof Patch, v: number | Wave, patch: Patch): void {
    if (key === "drive") return void this.kickDrive.wet.rampTo(Math.max(0, Math.min(1, v as number)), RAMP);
    super.set(key, v, patch);
  }

  override apply(p: Patch): void {
    super.apply(p);
    this.kickDrive.wet.rampTo(p.drive, RAMP);
  }

  protected setWave(): void {}
  protected setEnvelope(): void {}

  trigger(voice: DrumVoice, time: number, vel: number): void {
    switch (voice) {
      case "kick":
        return void this.kick.triggerAttackRelease(49, 0.12, time, vel);
      case "hat":
        this.open.triggerRelease(time); // closed hat chokes the open one
        return void this.hat.triggerAttackRelease(0.03, time, vel);
      case "open":
        return void this.open.triggerAttackRelease(0.1, time, vel);
      case "clap":
        return void this.clap.triggerAttackRelease(0.05, time, vel);
    }
  }

  releaseAll(time: number): void {
    this.open.triggerRelease(time);
  }
}

export class Bass extends Instrument {
  private mono: Tone.MonoSynth;
  private sub: Tone.Synth;

  constructor(buses: Buses) {
    super(new Channel(buses.duck, buses, [80, 6000], true, 0.75));
    this.mono = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { Q: 2, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.08 },
      filterEnvelope: { attack: 0.005, decay: 0.16, sustain: 0.15, release: 0.1, baseFrequency: 80, octaves: 3.2 },
    });
    this.sub = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.08 },
    });
    this.mono.connect(this.channel.input);
    this.sub.connect(this.channel.input);
  }

  protected setWave(w: Wave): void {
    this.mono.set({ oscillator: { type: w } });
  }

  protected setEnvelope(p: Patch): void {
    const env = { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release };
    this.mono.set({ envelope: env });
    this.sub.set({ envelope: { ...env, sustain: Math.max(p.sustain, 0.6) } });
  }

  trigger(midi: number, dur: number, time: number, vel: number): void {
    const hz = midiToHz(midi);
    this.mono.triggerAttackRelease(hz, dur, time, vel);
    this.sub.triggerAttackRelease(hz, dur, time, vel * 0.9);
  }

  releaseAll(time: number): void {
    this.mono.triggerRelease(time);
    this.sub.triggerRelease(time);
  }
}

/** A polyphonic voice: the Synth instrument and both layers. */
export class Poly extends Instrument {
  private poly: Tone.PolySynth;
  private patchEnv: Patch | null = null;
  private padEnv: { attack: number; release: number } | null = null;

  constructor(
    buses: Buses,
    private readonly fat: number,
    maxPolyphony: number,
    trim: number,
  ) {
    super(new Channel(buses.duck, buses, [100, 10000], true, trim));
    this.poly = new Tone.PolySynth(Tone.Synth, { envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.3 } });
    this.poly.maxPolyphony = maxPolyphony;
    this.poly.connect(this.channel.input);
  }

  protected setWave(w: Wave): void {
    this.poly.set({ oscillator: oscFor(w, this.fat) } as Parameters<Tone.PolySynth["set"]>[0]);
  }

  protected setEnvelope(p: Patch): void {
    this.patchEnv = p;
    if (!this.padEnv) this.poly.set({ envelope: { attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release } });
  }

  /** Pad mode takes its attack and release from the section's pad settings; other modes from the patch. */
  useEnvelope(pad: { attack: number; release: number } | undefined): void {
    if (pad) {
      if (this.padEnv && this.padEnv.attack === pad.attack && this.padEnv.release === pad.release) return;
      this.padEnv = pad;
      this.poly.set({ envelope: { attack: pad.attack, decay: 0.6, sustain: 0.8, release: pad.release } });
    } else if (this.padEnv) {
      this.padEnv = null;
      if (this.patchEnv) this.setEnvelope(this.patchEnv);
    }
  }

  trigger(notes: number[], dur: number, time: number, vel: number): void {
    this.poly.triggerAttackRelease(notes.map(midiToHz), dur, time, vel);
  }

  releaseAll(time: number): void {
    this.poly.releaseAll(time);
  }
}

export interface MixState {
  sweep: number; // -1..1: left low-pass, right high-pass, 0 open
  pump: number; // 0..0.95
  saturation: number; // 0..1
}

/** Shared sends, the ducked music bus, the drum bus and the master chain. */
export class Graph {
  readonly buses: Buses;
  readonly instruments: { drums: Drums; bass: Bass; synth: Poly; layer1: Poly; layer2: Poly };
  private meter: Tone.Meter;
  private lp: Tone.Filter;
  private hp: Tone.Filter;
  private sat: Tone.Distortion;
  pumpDepth = 0.6;

  private constructor(buses: Buses, meter: Tone.Meter, lp: Tone.Filter, hp: Tone.Filter, sat: Tone.Distortion) {
    this.buses = buses;
    this.meter = meter;
    this.lp = lp;
    this.hp = hp;
    this.sat = sat;
    this.instruments = {
      drums: new Drums(buses),
      bass: new Bass(buses),
      synth: new Poly(buses, 2, 16, 0.5),
      layer1: new Poly(buses, 2, 6, 0.5),
      layer2: new Poly(buses, 2, 12, 0.5),
    };
  }

  static async build(): Promise<Graph> {
    // Limiter: Tone.Limiter has a 10 ms release, fast enough to ride the gain within one cycle of
    // the bass and kick (audible as fuzz and crackle). A compressor at limiter ratio with a 120 ms
    // release holds the gain steady instead.
    const limiter = new Tone.Compressor({ threshold: -2, ratio: 20, attack: 0.003, release: 0.12, knee: 0 }).toDestination();
    const sat = new Tone.Distortion({ distortion: 0.25, oversample: "4x", wet: 0 });
    const meter = new Tone.Meter({ smoothing: 0.6 });
    const lp = new Tone.Filter({ frequency: 20000, type: "lowpass", rolloff: -12 });
    const hp = new Tone.Filter({ frequency: 10, type: "highpass", rolloff: -12 });
    const master = new Tone.Gain(0.5); // was 0.7 in the spike: more headroom into the limiter
    master.chain(lp, hp, sat, limiter);
    sat.connect(meter);

    const duck = new Tone.Gain(1).connect(master);
    const drums = new Tone.Gain(1).connect(master);
    const reverb = new Tone.Reverb({ decay: 3.2, wet: 1 });
    await reverb.ready;
    reverb.connect(duck);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.36, wet: 1 });
    delay.connect(duck);
    return new Graph({ duck, drums, delay, reverb }, meter, lp, hp, sat);
  }

  /** Duck the music bus on a kick: a 4 ms ramp down, then a swell back. Never a step. */
  pump(time: number): void {
    if (this.pumpDepth <= 0) return;
    const g = this.buses.duck.gain;
    g.cancelAndHoldAtTime(time);
    g.linearRampToValueAtTime(1 - this.pumpDepth, time + 0.004);
    g.setTargetAtTime(1, time + 0.02, 0.075);
  }

  resetPump(): void {
    const g = this.buses.duck.gain;
    const now = Tone.now();
    g.cancelAndHoldAtTime(now);
    g.linearRampToValueAtTime(1, now + RAMP);
  }

  setMix(key: keyof MixState, v: number): void {
    if (key === "pump") this.pumpDepth = Math.max(0, Math.min(0.95, v));
    else if (key === "saturation") this.sat.wet.rampTo(Math.max(0, Math.min(1, v)), RAMP);
    else {
      const s = Math.max(-1, Math.min(1, v));
      this.lp.frequency.rampTo(s < 0 ? 20000 * Math.pow(150 / 20000, -s) : 20000, RAMP);
      this.hp.frequency.rampTo(s > 0 ? 10 * Math.pow(4000 / 10, s) : 10, RAMP);
    }
  }

  setGate(id: InstrumentId, on: boolean): void {
    this.instruments[id].channel.gate.gain.rampTo(on ? 1 : 0, RAMP);
  }

  level(): number {
    const v = this.meter.getValue();
    return typeof v === "number" ? v : v[0];
  }
}
