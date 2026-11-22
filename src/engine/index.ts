/**
 * Engine API (spec section 7). The UI calls only this: load song, play, stop, set parameter,
 * switch section, toggle instrument, and reads pending switches and the playing position.
 * Notes are scheduled ahead on the audio clock by the transport; the UI's timers never schedule.
 */
import * as Tone from "tone";
import { Graph, type MixState } from "./audio.ts";
import { InFlight, type Pending } from "./queue.ts";
import { Sequencer, STEPS_PER_BAR, type StepResult } from "./sequencer.ts";
import {
  clampPatchValue,
  cloneSong,
  defaultSong,
  INSTRUMENTS,
  validateSong,
  type InstrumentId,
  type Patch,
  type Song,
  type Wave,
  type ChordStep,
} from "./song.ts";
import type { KeyName, Mood } from "../music/scales.ts";

export * from "./song.ts";
export { MOODS, MOOD_TABLE, NOTE_NAMES, type KeyName, type Mood } from "../music/scales.ts";
export { degreeChords, type Chord } from "../music/chords.ts";
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
  private changeListeners = new Set<() => void>();
  /** Bumped when sections are inserted or removed: positions scheduled before then carry stale indexes. */
  private layoutGen = 0;
  private pos: Position = { playing: false, section: 0, bar: 0, step: 0 };
  private mix: MixState = { sweep: 0, pump: 0.6, saturation: 0 };
  /** Switches applied by the scheduler but not heard yet (the lookahead before their bar line). */
  private inFlight = new InFlight();
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

  /** Throws, listing every problem, if the song is not valid; the playing song is then unchanged. */
  loadSong(song: Song): void {
    const errors = validateSong(song);
    if (errors.length) throw new Error(`invalid song: ${errors.join("; ")}`);
    this.seq.load(cloneSong(song));
    if (this.graph) {
      this.applyAll();
      Tone.getTransport().bpm.rampTo(song.bpm, 0.1);
    }
    this.emit({ ...this.pos, section: this.seq.section });
    this.changed(true);
  }

  play(): void {
    if (!this.graph || this.playing) return;
    this.seq.start();
    this.inFlight.clear();
    this.landed.length = 0;
    Tone.getTransport().start("+0.05");
  }

  stop(): void {
    if (!this.graph) return;
    const transport = Tone.getTransport();
    transport.stop();
    this.seq.stop();
    const now = Tone.now();
    // Drop attacks still waiting on the clock (swung steps), then release what already started.
    for (const id of INSTRUMENTS) {
      this.graph.instruments[id].cancel();
      this.graph.instruments[id].releaseAll(now);
    }
    this.graph.resetPump();
    this.inFlight.clear();
    this.emit({ playing: false, section: this.seq.section, bar: 0, step: 0 });
  }

  /** Change one knob of an instrument's patch. Continuous values ramp; values are clamped to PATCH_RANGES, unknown waves ignored. */
  setParam<K extends keyof Patch>(inst: InstrumentId, key: K, value: Patch[K]): void {
    if (this.applyParam(inst, key, value)) this.changed();
  }

  /** Change several knobs of one patch at once (an XY pad move): listeners hear one change. */
  setParams(inst: InstrumentId, values: Partial<Patch>): void {
    let any = false;
    for (const key of Object.keys(values) as (keyof Patch)[]) {
      if (this.applyParam(inst, key, values[key] as Patch[typeof key])) any = true;
    }
    if (any) this.changed();
  }

  private applyParam<K extends keyof Patch>(inst: InstrumentId, key: K, value: Patch[K]): boolean {
    const v = clampPatchValue(key, value);
    if (v === null) return false;
    const patch = this.seq.song.patches[inst];
    patch[key] = v;
    this.graph?.instruments[inst].set(key, v as number | Wave, patch);
    return true;
  }

  setMix(key: keyof MixState, value: number): void {
    this.mix[key] = value;
    this.graph?.setMix(key, value);
    this.changed();
  }

  /** Lands on the next bar line while playing; tapping it again before then cancels it. */
  switchSection(index: number): void {
    this.seq.switchSection(index);
    if (!this.seq.isRunning) this.emit({ ...this.pos, section: this.seq.section });
    this.changed();
  }

  /** For the playing section, lands on the next bar line; other sections change at once. */
  toggleInstrument(section: number, inst: InstrumentId): void {
    this.seq.toggleInstrument(section, inst);
    this.changed();
  }

  /**
   * Toggle an instrument in the section the scheduler is playing. Use this rather than passing
   * `position().section`, which lags the scheduler by the lookahead at a section switch.
   */
  toggleInstrumentInPlaying(inst: InstrumentId): void {
    this.seq.toggleInstrument(this.seq.section, inst);
    this.changed();
  }

  /** Change key and mood at once; held chords and pads restart on the new chord. */
  setKeyMood(key: KeyName, mood: Mood): void {
    this.seq.setKeyMood(key, mood);
    this.changed();
  }

  /** Replace a section's chord sequence (1..8 chords). Acts at once. Returns false if refused. */
  setChords(section: number, chords: ChordStep[]): boolean {
    const ok = this.seq.setChords(section, chords);
    if (ok) this.changed();
    return ok;
  }

  renameSection(index: number, name: string): boolean {
    const ok = this.seq.renameSection(index, name);
    if (ok) this.changed();
    return ok;
  }

  /** Append a section (at most four). Returns its index, or -1. */
  addSection(): number {
    const i = this.seq.addSection();
    if (i >= 0) this.changed(true);
    return i;
  }

  /** Insert a copy right after a section (at most four). Returns the copy's index, or -1. */
  copySection(index: number): number {
    const i = this.seq.copySection(index);
    if (i >= 0) this.changed(true);
    return i;
  }

  /** Delete a section; refused for the last one and for the one playing now. */
  deleteSection(index: number): boolean {
    const ok = this.seq.deleteSection(index);
    if (ok) this.changed(true);
    return ok;
  }

  /** The current mix settings (a copy). */
  getMix(): MixState {
    return { ...this.mix };
  }

  /** The filter frequency in Hz that a cutoff value gives on an instrument; null before audio starts. */
  cutoffHz(inst: InstrumentId, x: number): number | null {
    return this.graph ? this.graph.instruments[inst].channel.cutoffHz(x) : null;
  }

  /** Called after the song changed outside the transport (edits from the UI). */
  onChange(fn: () => void): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  /** Which instruments are on in a section (a copy; cheap enough to call per step). */
  sectionOn(index: number): Record<InstrumentId, boolean> | null {
    const s = this.seq.song.sections[index];
    return s ? { ...s.on } : null;
  }

  /** Switches waiting in the queue for the next bar line the scheduler reaches. */
  pending(): Pending {
    return this.seq.pending();
  }

  /**
   * Switches not heard yet: the queue, plus switches the scheduler already applied a lookahead
   * ahead of a bar line the listener has not reached. The UI shows this, so a pending outline stays
   * until the bar it lands on is heard.
   */
  pendingShown(): Pending {
    return this.inFlight.shown(this.seq.pending());
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
    this.changed();
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

  /** Peak sample after the limiter over the last ~0.37 s, in dBFS. */
  peak(): number {
    return this.graph ? this.graph.peak() : -Infinity;
  }

  /** Attacks started so far, over every instrument. */
  attacks(): number {
    return this.graph ? this.graph.attacks() : 0;
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
    // transport.stop() takes effect a lookahead later; the clock keeps calling until then.
    if (!this.seq.isRunning) return;
    const g = this.graph!;
    const r: StepResult = this.seq.next();
    const sixteenth = 60 / Tone.getTransport().bpm.value / 4;
    for (const id of r.stopped) g.instruments[id].releaseAll(time);
    // A new section starts its own chords, and a key, mood or chord edit restarts them: held chords
    // and pads let go (with their release).
    if (r.retrigger || (r.applied && r.applied.section !== null)) {
      for (const id of ["synth", "layer1", "layer2"] as const) g.instruments[id].releaseAll(time);
    }
    // A held bass note in the old key lets go too; the sequencer restarts it at the new root.
    if (r.retrigger) g.instruments.bass.releaseAll(time);
    for (const e of r.events) {
      const t = time + e.shift * sixteenth; // swing: every instrument on an odd step moves together
      switch (e.inst) {
        case "drums":
          g.instruments.drums.trigger(e.voice, t, e.vel);
          if (e.voice === "kick") g.pump(t);
          break;
        case "bass":
          g.instruments.bass.trigger(e.midi, e.len * sixteenth, t, e.vel);
          break;
        case "synth":
          g.instruments.synth.trigger(e.notes, e.len * sixteenth, t, e.vel);
          break;
        default: {
          const layer = g.instruments[e.inst];
          layer.useEnvelope(e.env);
          layer.trigger(e.notes, e.len * sixteenth, t, e.vel);
        }
      }
    }
    if (r.applied) {
      this.inFlight.land(r.bar, r.applied);
      this.landed.push({ bar: r.bar, pending: r.applied });
      if (this.landed.length > 16) this.landed.shift();
    }
    const p: Position = { playing: true, section: r.section, bar: r.bar, step: r.step };
    const gen = this.layoutGen;
    Tone.getDraw().schedule(() => {
      this.inFlight.reach(p.bar);
      this.emit(gen === this.layoutGen ? p : { ...p, section: this.seq.section });
    }, time);
  }

  /** Tell listeners the song changed; when sections moved, the position's index may have too. */
  private changed(reindexed = false): void {
    if (reindexed) {
      // Sections were inserted or removed: the scheduler's section is now the reference index.
      this.layoutGen++;
      this.pos = { ...this.pos, section: this.seq.section };
    }
    for (const fn of this.changeListeners) fn();
  }

  private emit(p: Position): void {
    this.pos = p;
    for (const fn of this.listeners) fn(p);
  }
}

export { STEPS_PER_BAR };
