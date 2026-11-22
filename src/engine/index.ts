/**
 * Engine API (spec section 7). The UI calls only this: load song, play, stop, set parameter,
 * switch section, toggle instrument, and reads pending switches and the playing position.
 * Notes are scheduled ahead on the audio clock by the transport; the UI's timers never schedule.
 */
import * as Tone from "tone";
import { Graph, type MixState } from "./audio.ts";
import type { Pending } from "./queue.ts";
import { Sequencer, STEPS_PER_BAR, type StepResult } from "./sequencer.ts";
import { cloneSong, defaultSong, INSTRUMENTS, type InstrumentId, type Patch, type Song, type Wave } from "./song.ts";

export * from "./song.ts";
export type { Pending, PendingToggle } from "./queue.ts";
export type { MixState } from "./audio.ts";

/** `balanced` is the default since C1: a larger buffer, and touch latency is not a design constraint. */
export type LatencyHint = "interactive" | "balanced" | "playback";

export interface Position {
  playing: boolean;
  section: number;
  bar: number;
  step: number;
}

export interface LandedSwitch {
  bar: number;
  pending: Pending;
}

export class Engine {
  private graph: Graph | null = null;
  private seq: Sequencer;
  private listeners = new Set<(p: Position) => void>();
  private pos: Position = { playing: false, section: 0, bar: 0, step: 0 };
  private mix: MixState = { sweep: 0, pump: 0.6, saturation: 0 };
  /** Every bar line at which queued switches landed, newest last (kept short). */
  readonly landed: LandedSwitch[] = [];

  constructor(song: Song = defaultSong()) {
    this.seq = new Sequencer(cloneSong(song));
  }

  /** Must be called from a tap: browsers only start audio after a user gesture. */
  async init(hint: LatencyHint = "balanced"): Promise<void> {
    if (this.graph) return;
    Tone.setContext(new Tone.Context({ latencyHint: hint }));
    await Tone.start();
    this.graph = await Graph.build();
    this.applyAll();
    const transport = Tone.getTransport();
    transport.bpm.value = this.seq.song.bpm;
    transport.scheduleRepeat((time) => this.tick(time), "16n");
  }

  get ready(): boolean {
    return this.graph !== null;
  }

  get playing(): boolean {
    return this.graph !== null && Tone.getTransport().state === "started";
  }

  /** A copy of the song as the engine holds it now. */
  getSong(): Song {
    return cloneSong(this.seq.song);
  }

  loadSong(song: Song): void {
    this.seq.load(cloneSong(song));
    if (this.graph) {
      this.applyAll();
      Tone.getTransport().bpm.rampTo(song.bpm, 0.1);
    }
    this.emit({ ...this.pos, section: this.seq.section });
  }

  play(): void {
    if (!this.graph || this.playing) return;
    this.seq.start();
    this.landed.length = 0;
    Tone.getTransport().start("+0.05");
  }

  stop(): void {
    if (!this.graph) return;
    const transport = Tone.getTransport();
    transport.stop();
    this.seq.stop();
    const now = Tone.now();
    for (const id of INSTRUMENTS) this.graph.instruments[id].releaseAll(now);
    this.graph.resetPump();
    this.emit({ playing: false, section: this.seq.section, bar: 0, step: 0 });
  }

  /** Change one knob of an instrument's patch. Continuous values ramp. */
  setParam<K extends keyof Patch>(inst: InstrumentId, key: K, value: Patch[K]): void {
    const patch = this.seq.song.patches[inst];
    patch[key] = value;
    this.graph?.instruments[inst].set(key, value as number | Wave, patch);
  }

  setMix(key: keyof MixState, value: number): void {
    this.mix[key] = value;
    this.graph?.setMix(key, value);
  }

  /** Lands on the next bar line while playing; tapping it again before then cancels it. */
  switchSection(index: number): void {
    this.seq.switchSection(index);
    if (!this.seq.isRunning) this.emit({ ...this.pos, section: this.seq.section });
  }

  /** For the playing section, lands on the next bar line; other sections change at once. */
  toggleInstrument(section: number, inst: InstrumentId): void {
    this.seq.toggleInstrument(section, inst);
  }

  /** Switches waiting for the next bar line. */
  pending(): Pending {
    return this.seq.pending();
  }

  /** What is audible now (updated in step with the sound, not with the scheduler). */
  position(): Position {
    return { ...this.pos };
  }

  onPosition(fn: (p: Position) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get bpm(): number {
    return this.seq.song.bpm;
  }

  set bpm(v: number) {
    const bpm = Math.max(80, Math.min(180, Math.round(v)));
    this.seq.song.bpm = bpm;
    if (this.graph) Tone.getTransport().bpm.rampTo(bpm, 0.05);
  }

  // ---- Diagnostics and test hooks ------------------------------------------------

  /** Mute or unmute an instrument at once, outside the bar-line queue. Used by the smoke test's solo. */
  setLayer(id: InstrumentId, on: boolean): void {
    this.graph?.setGate(id, on);
  }

  /** Master level before the limiter, in dB. */
  level(): number {
    return this.graph ? this.graph.level() : -Infinity;
  }

  info(): { sampleRate: number; baseLatencyMs: number; outputLatencyMs: number; hint: string } {
    const raw = Tone.getContext().rawContext as unknown as AudioContext;
    return {
      sampleRate: raw.sampleRate,
      baseLatencyMs: Math.round((raw.baseLatency ?? 0) * 1000),
      outputLatencyMs: Math.round((raw.outputLatency ?? 0) * 1000),
      hint: String(Tone.getContext().latencyHint),
    };
  }

  // ---- Internals --------------------------------------------------------------------

  private applyAll(): void {
    const g = this.graph!;
    for (const id of INSTRUMENTS) g.instruments[id].apply(this.seq.song.patches[id]);
    for (const k of ["sweep", "pump", "saturation"] as const) g.setMix(k, this.mix[k]);
  }

  private tick(time: number): void {
    const g = this.graph!;
    const r: StepResult = this.seq.next();
    const sixteenth = 60 / Tone.getTransport().bpm.value / 4;
    for (const id of r.stopped) g.instruments[id].releaseAll(time);
    // A new section starts its own chords: held chords and pads of the old one let go (with their release).
    if (r.applied && r.applied.section !== null) {
      for (const id of ["synth", "layer1", "layer2"] as const) g.instruments[id].releaseAll(time);
    }
    for (const e of r.events) {
      switch (e.inst) {
        case "drums": {
          const t = time + e.shift * sixteenth;
          g.instruments.drums.trigger(e.voice, t, e.vel);
          if (e.voice === "kick") g.pump(t);
          break;
        }
        case "bass":
          g.instruments.bass.trigger(e.midi, e.len * sixteenth, time, e.vel);
          break;
        case "synth":
          g.instruments.synth.trigger(e.notes, e.len * sixteenth, time, e.vel);
          break;
        default: {
          const layer = g.instruments[e.inst];
          layer.useEnvelope(e.env);
          layer.trigger(e.notes, e.len * sixteenth, time, e.vel);
        }
      }
    }
    if (r.applied) {
      this.landed.push({ bar: r.bar, pending: r.applied });
      if (this.landed.length > 16) this.landed.shift();
    }
    const p: Position = { playing: true, section: r.section, bar: r.bar, step: r.step };
    Tone.getDraw().schedule(() => this.emit(p), time);
  }

  private emit(p: Position): void {
    this.pos = p;
    for (const fn of this.listeners) fn(p);
  }
}

export { STEPS_PER_BAR };
