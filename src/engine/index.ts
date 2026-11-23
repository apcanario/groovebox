/**
 * Engine API (spec section 7). The UI calls only this: load song, play, stop, set parameter,
 * switch section, toggle instrument, and reads pending switches and the playing position.
 * Notes are scheduled ahead on the audio clock by the transport; the UI's timers never schedule.
 */
import * as Tone from "tone";
import { Graph } from "./audio.ts";
import { LogWriter, type LogOp } from "./eventlog.ts";
import { prepareTap, Recorder, type Take } from "./recorder.ts";
import { InFlight, type Pending } from "./queue.ts";
import { Sequencer, STEPS_PER_BAR, type StepResult } from "./sequencer.ts";
import {
  clampPatchValue,
  cleanName,
  cloneSong,
  defaultSong,
  DEFAULT_MIX,
  type EventLog,
  type MixState,
  INSTRUMENTS,
  LAYER_IDS,
  validateSong,
  type InstrumentId,
  type LayerInstrument,
  type LayerMode,
  type PadParams,
  type Patch,
  type Song,
  type Wave,
  type ChordStep,
} from "./song.ts";
import type { KeyName, Mood } from "../music/scales.ts";
import type { BassPreset, DrumPreset, DrumVoice, SynthPreset } from "../music/presets.ts";
import type { ArpParams } from "../music/arp.ts";
import type { LeadParams, LeadStepView } from "../music/lead.ts";

export * from "./song.ts";
export { MOODS, MOOD_TABLE, NOTE_NAMES, type KeyName, type Mood } from "../music/scales.ts";
export { degreeChords, type Chord } from "../music/chords.ts";
export {
  BASS_PRESETS,
  DRUM_PATTERNS,
  DRUM_PRESETS,
  DRUM_VOICES,
  SEQ_STEPS,
  SYNTH_PRESETS,
  eighthOn,
  type BassPreset,
  type DrumPreset,
  type DrumVoice,
  type SynthPreset,
} from "../music/presets.ts";
export { ARP_DIRECTIONS, type ArpDirection, type ArpParams } from "../music/arp.ts";
export { LOCK_FROZEN, type LeadParams, type LeadStepView } from "../music/lead.ts";
export type { Pending, PendingToggle } from "./queue.ts";
export { LOG_OPS, type LogEvent, type LogOp } from "./eventlog.ts";
export { MP3_KBPS, type Take } from "./recorder.ts";

/** off; armed (starts with Play); recording; finishing (the tail after Stop, then the encoder's last frames). */
export type RecordState = "off" | "armed" | "recording" | "finishing";

export interface RecordInfo {
  state: RecordState;
  /** Why the last take failed or recording is unavailable (G5 review S1, M8); null when all is well. */
  error: string | null;
  /** Seconds recorded so far (0 unless recording or finishing). */
  seconds: number;
  /** MP3 bytes written so far. */
  bytes: number;
}

/** Seconds of tail recorded after Stop, so releases and the reverb are not cut off. */
export const RECORD_TAIL = 1.5;

/** A copy of a song document without its mix and log: what the sequencer holds. */
function bareSong(song: Song): Song {
  const { mix: _mix, log: _log, ...core } = song;
  return cloneSong(core);
}

function takeName(song: string, d: Date): string {
  const p = (n: number): string => String(n).padStart(2, "0");
  const safe = song.replace(/[^\w\- ]+/g, "").trim() || "Groovebox";
  return `${safe} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}-${p(d.getMinutes())}.mp3`;
}

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
  private mix: MixState = { ...DEFAULT_MIX };
  /** The last finished take's event log; saved with the song. */
  private log: EventLog | null = null;
  private rec: {
    state: RecordState;
    recorder: Recorder | null;
    writer: LogWriter | null;
    startTicks: number;
    startTime: number;
    endTime: number;
    start: Song | null;
    section: number;
    at: Date;
    /** finishTake has begun closing this take (the tail timer and Play must not close it twice). */
    closing: boolean;
  } = { state: "off", recorder: null, writer: null, startTicks: 0, startTime: 0, endTime: 0, start: null, section: 0, at: new Date(0), closing: false };
  /** The last recording failure, shown by the transport; cleared when a take starts. */
  private recError: string | null = null;
  private takeListeners = new Set<(t: Take & { name: string }) => void>();
  /** Switches applied by the scheduler but not heard yet (the lookahead before their bar line). */
  private inFlight = new InFlight();
  /** Every bar line at which queued switches landed, newest last (kept short). */
  readonly landed: LandedSwitch[] = [];

  constructor(song: Song = defaultSong()) {
    this.seq = new Sequencer(bareSong(song));
    this.takeDocument(song);
  }

  /** Must be called from a tap: browsers only start audio after a user gesture. */
  async init(hint: LatencyHint = "balanced"): Promise<void> {
    if (this.graph) return;
    Tone.setContext(new Tone.Context({ latencyHint: hint }));
    await Tone.start();
    this.graph = await Graph.build();
    await prepareTap(Tone.getContext()).catch((err: unknown) => {
      this.recError = `Recording unavailable: ${err instanceof Error ? err.message : String(err)}`;
    });
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

  /** A copy of the song as the engine holds it now (without its mix and log: see getDocument). */
  getSong(): Song {
    return cloneSong(this.seq.song);
  }

  /** The whole song document to save: the song, its mix and the last take's event log. */
  getDocument(): Song {
    const doc: Song = { ...this.getSong(), mix: { ...this.mix } };
    if (this.log) doc.log = this.log;
    return doc;
  }

  /** The last take's event log, if any. */
  getLog(): EventLog | null {
    return this.log;
  }

  /** Throws, listing every problem, if the song is not valid; the playing song is then unchanged. */
  loadSong(song: Song): void {
    const errors = validateSong(song);
    if (errors.length) throw new Error(`invalid song: ${errors.join("; ")}`);
    this.takeDocument(song);
    this.seq.load(bareSong(song));
    if (this.graph) {
      this.applyAll();
      Tone.getTransport().bpm.rampTo(song.bpm, 0.1);
    }
    this.emit({ ...this.pos, section: this.seq.section });
    this.changed(true);
  }

  play(): void {
    if (!this.graph || this.playing) return;
    // Play during the Stop tail: close the old take now, so the new run is not recorded into it (G5 review M3).
    if (this.rec.state === "finishing" && !this.rec.closing) {
      this.rec.endTime = Math.min(this.rec.endTime || Infinity, Tone.getContext().currentTime);
      void this.finishTake();
    }
    this.seq.start();
    this.inFlight.clear();
    this.landed.length = 0;
    Tone.getTransport().start("+0.05");
    if (this.rec.state === "armed") this.startTake();
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
    if (this.rec.state === "recording") {
      // Keep the tail, then close the take.
      this.rec.state = "finishing";
      this.rec.endTime = Tone.getContext().currentTime + RECORD_TAIL;
      const recorder = this.rec.recorder;
      setTimeout(() => {
        if (this.rec.recorder === recorder) void this.finishTake();
      }, RECORD_TAIL * 1000);
    }
    this.emit({ playing: false, section: this.seq.section, bar: 0, step: 0 });
  }

  // ---- Recording (G5) ---------------------------------------------------------------

  /**
   * The record button. Off: arm (while playing the take starts at once, while stopped it starts with
   * Play). Armed: disarm. Recording: end the take (no tail; Stop keeps a tail). Finishing: nothing.
   */
  record(): void {
    const st = this.rec.state;
    if (st === "off") {
      if (this.playing) this.startTake();
      else this.rec.state = "armed";
    } else if (st === "armed") this.rec.state = "off";
    else if (st === "recording") void this.finishTake();
    this.changed();
  }

  recordInfo(): RecordInfo {
    const { state, recorder, startTime, endTime } = this.rec;
    const now = this.graph ? Tone.getContext().currentTime : 0;
    const seconds = state === "recording" ? now - startTime : state === "finishing" ? Math.min(now, endTime) - startTime : 0;
    return { state, error: this.recError, seconds: Math.max(0, seconds), bytes: recorder?.bytes ?? 0 };
  }

  /** Called with each finished take: the MP3 and the name to save it under. */
  onTake(fn: (t: Take & { name: string }) => void): () => void {
    this.takeListeners.add(fn);
    return () => this.takeListeners.delete(fn);
  }

  private startTake(): void {
    if (!this.graph) return;
    const raw = Tone.getContext();
    const at = new Date();
    let recorder: Recorder;
    try {
      recorder = new Recorder(raw, `take-${at.getTime()}.mp3`);
    } catch (err) {
      this.rec.state = "off";
      this.recError ??= `Recording unavailable: ${err instanceof Error ? err.message : String(err)}`;
      this.changed();
      return;
    }
    this.recError = null;
    this.graph.tap(recorder.node);
    const transport = Tone.getTransport();
    this.rec = {
      state: "recording",
      recorder,
      writer: new LogWriter(),
      startTicks: transport.state === "started" ? transport.ticks : 0,
      startTime: raw.currentTime,
      endTime: 0,
      start: { ...this.getSong(), mix: { ...this.mix } },
      section: this.seq.section,
      at,
      closing: false,
    };
  }

  private async finishTake(): Promise<void> {
    const r = this.rec;
    if (!r.recorder || r.closing || (r.state !== "recording" && r.state !== "finishing")) return;
    r.closing = true;
    r.state = "finishing";
    if (!r.endTime) r.endTime = Tone.getContext().currentTime;
    this.changed();
    const recorder = r.recorder;
    let take: Take | null = null;
    try {
      take = await recorder.stop();
    } catch (err) {
      // The encoder failed or timed out (G5 review S1): the log is still saved and the state reset below.
      this.recError = `The take could not be saved: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      this.graph?.untap(recorder.node);
      if (r.writer && r.start) {
        this.log = {
          recorded: r.at.toISOString(),
          seconds: Math.round((take ? take.seconds : r.endTime - r.startTime) * 1000) / 1000,
          section: Math.min(3, r.section),
          start: r.start,
          events: r.writer.events,
        };
      }
      this.rec = { ...r, state: "off", recorder: null, writer: null, start: null, endTime: 0, closing: false };
      this.changed();
    }
    if (!take) return;
    const named = { ...take, name: takeName(this.seq.song.name, r.at) };
    for (const fn of this.takeListeners) fn(named);
  }

  /** Log an edit to the take's event log, if a take is running. */
  private note(op: LogOp, args: unknown[]): void {
    const w = this.rec.writer;
    if (!w || this.rec.state !== "recording") return;
    const transport = Tone.getTransport();
    const ticks = transport.state === "started" ? transport.ticks - this.rec.startTicks : 0;
    w.push(ticks / transport.PPQ, op, args);
  }

  /** Keep a loaded document's mix and log; the sequencer gets the song alone. */
  private takeDocument(song: Song): void {
    this.mix = song.mix ? { ...song.mix } : { ...DEFAULT_MIX };
    this.log = song.log ? (JSON.parse(JSON.stringify(song.log)) as EventLog) : null;
  }

  /** Change one knob of an instrument's patch. Continuous values ramp; values are clamped to PATCH_RANGES, unknown waves ignored. */
  setParam<K extends keyof Patch>(inst: InstrumentId, key: K, value: Patch[K]): void {
    if (!this.applyParam(inst, key, value)) return;
    this.note("setParam", [inst, key, value]);
    this.changed();
  }

  /** Change several knobs of one patch at once (an XY pad move): listeners hear one change. */
  setParams(inst: InstrumentId, values: Partial<Patch>): void {
    let any = false;
    for (const key of Object.keys(values) as (keyof Patch)[]) {
      if (this.applyParam(inst, key, values[key] as Patch[typeof key])) any = true;
    }
    if (!any) return;
    this.note("setParams", [inst, values]);
    this.changed();
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
    const [lo, hi] = key === "sweep" ? [-1, 1] : key === "pump" ? [0, 0.95] : [0, 1];
    if (!Number.isFinite(value)) return;
    this.note("setMix", [key, value]);
    const v = Math.max(lo, Math.min(hi, value));
    this.mix[key] = v;
    this.graph?.setMix(key, v);
    this.changed();
  }

  /** Lands on the next bar line while playing; tapping it again before then cancels it. */
  switchSection(index: number): void {
    this.note("switchSection", [index]);
    this.seq.switchSection(index);
    if (!this.seq.isRunning) this.emit({ ...this.pos, section: this.seq.section });
    this.changed();
  }

  /** For the playing section, lands on the next bar line; other sections change at once. */
  toggleInstrument(section: number, inst: InstrumentId): void {
    this.note("toggleInstrument", [section, inst]);
    this.seq.toggleInstrument(section, inst);
    this.changed();
  }

  /**
   * Toggle an instrument in the section the scheduler is playing. Use this rather than passing
   * `position().section`, which lags the scheduler by the lookahead at a section switch.
   */
  toggleInstrumentInPlaying(inst: InstrumentId): void {
    this.note("toggleInstrument", [this.seq.section, inst]);
    this.seq.toggleInstrument(this.seq.section, inst);
    this.changed();
  }

  /** Change key and mood at once; held chords and pads restart on the new chord. */
  setKeyMood(key: KeyName, mood: Mood): void {
    const same = key === this.seq.song.key && mood === this.seq.song.mood;
    this.seq.setKeyMood(key, mood);
    if (!same) this.note("setKeyMood", [key, mood]);
    this.changed();
  }

  /** Replace a section's chord sequence (1..8 chords). Acts at once. Returns false if refused. */
  setChords(section: number, chords: ChordStep[]): boolean {
    const ok = this.seq.setChords(section, chords);
    if (!ok) return false;
    this.note("setChords", [section, chords]);
    this.changed();
    return ok;
  }

  /** Pick a section's drum preset; drops its sequencer edit. Acts at once. */
  setDrumPreset(section: number, preset: DrumPreset): boolean {
    const ok = this.seq.setDrumPreset(section, preset);
    if (!ok) return false;
    this.note("setDrumPreset", [section, preset]);
    this.changed();
    return ok;
  }

  /** Flip one of the eight sequencer steps of a drum voice; the first edit opens the preset. Acts at once. */
  toggleDrumStep(section: number, voice: DrumVoice, step: number): boolean {
    const ok = this.seq.toggleDrumStep(section, voice, step);
    if (!ok) return false;
    this.note("toggleDrumStep", [section, voice, step]);
    this.changed();
    return ok;
  }

  /** Drop a section's sequencer edit: back to its preset. */
  revertDrums(section: number): boolean {
    const ok = this.seq.revertDrums(section);
    if (!ok) return false;
    this.note("revertDrums", [section]);
    this.changed();
    return ok;
  }

  /** Pick a section's bass rhythm. Acts at once; a held note restarts in the new rhythm. */
  setBassRhythm(section: number, rhythm: BassPreset): boolean {
    const ok = this.seq.setBassRhythm(section, rhythm);
    if (!ok) return false;
    this.note("setBassRhythm", [section, rhythm]);
    this.changed();
    return ok;
  }

  /** Pick a section's synth rhythm. Acts at once; a held chord restarts in the new rhythm. */
  setSynthRhythm(section: number, rhythm: SynthPreset): boolean {
    const ok = this.seq.setSynthRhythm(section, rhythm);
    if (!ok) return false;
    this.note("setSynthRhythm", [section, rhythm]);
    this.changed();
    return ok;
  }

  // ---- Layers (G4): patterns live with the section and act at once ----------------------

  /** Switch a layer's mode (Arp, Pad, Generative) in a section. In the playing section held notes let go. */
  setLayerMode(section: number, layer: LayerInstrument, mode: LayerMode): boolean {
    const ok = this.seq.setLayerMode(section, layer, mode);
    if (!ok) return false;
    this.note("setLayerMode", [section, layer, mode]);
    this.changed();
    return ok;
  }

  /** Arp direction, rate (steps per note: 1, 2, 4), octaves (1..3), gate (0.1..1). */
  setArp(section: number, layer: LayerInstrument, values: Partial<ArpParams>): boolean {
    const ok = this.seq.setArp(section, layer, values);
    if (!ok) return false;
    this.note("setArp", [section, layer, values]);
    this.changed();
    return ok;
  }

  /** Pad attack and release (seconds), brightness and motion (0..1). */
  setPad(section: number, layer: LayerInstrument, values: Partial<PadParams>): boolean {
    const ok = this.seq.setPad(section, layer, values);
    if (!ok) return false;
    this.note("setPad", [section, layer, values]);
    this.changed();
    return ok;
  }

  /** The six generative knobs. The lead keeps its notes; only Lock rewrites them. */
  setGen(section: number, layer: LayerInstrument, values: Partial<Omit<LeadParams, "seed">>): boolean {
    const ok = this.seq.setGen(section, layer, values);
    if (!ok) return false;
    this.note("setGen", [section, layer, values]);
    this.changed();
    return ok;
  }

  /** New notes: the next seed of the layer's lead (from the seeded generator). */
  newSeed(section: number, layer: LayerInstrument): number | null {
    const seed = this.seq.newSeed(section, layer);
    if (seed === null) return null;
    this.note("newSeed", [section, layer]);
    this.changed();
    return seed;
  }

  /**
   * The 16 steps of a section's generative lead in the current bar: hits, and which of them play.
   * `shownStep`: the playing step the UI shows (pass it while the section plays), so the row keeps the
   * bar it shows until that step wraps, not the bar the scheduler has already reached (G4 review M2).
   */
  leadSteps(section: number, layer: LayerInstrument, shownStep?: number): LeadStepView[] {
    return this.seq.leadSteps(section, layer, shownStep);
  }

  /** Rename the song (trimmed, at most 24 characters). Returns false for an empty name. */
  renameSong(name: string): boolean {
    const n = cleanName(name);
    if (!n) return false;
    this.seq.song.name = n;
    this.changed();
    return true;
  }

  renameSection(index: number, name: string): boolean {
    const ok = this.seq.renameSection(index, name);
    if (!ok) return false;
    this.note("renameSection", [index, name]);
    this.changed();
    return ok;
  }

  /** Append a section (at most four). Returns its index, or -1. */
  addSection(): number {
    const i = this.seq.addSection();
    if (i < 0) return i;
    this.note("addSection", []);
    this.changed(true);
    return i;
  }

  /** Insert a copy right after a section (at most four). Returns the copy's index, or -1. */
  copySection(index: number): number {
    const i = this.seq.copySection(index);
    if (i < 0) return i;
    this.note("copySection", [index]);
    this.changed(true);
    return i;
  }

  /** Delete a section; refused for the last one and for the one playing now. */
  deleteSection(index: number): boolean {
    const ok = this.seq.deleteSection(index);
    if (!ok) return false;
    this.note("deleteSection", [index]);
    this.changed(true);
    return true;
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
    if (!Number.isFinite(v)) return;
    const bpm = Math.max(80, Math.min(180, Math.round(v)));
    if (bpm !== this.seq.song.bpm) this.note("bpm", [bpm]);
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

  /** Native value of a drum voice's level gain (its trim times its dial). */
  drumGain(voice: DrumVoice): number | null {
    return this.graph ? this.graph.instruments.drums.levelGain(voice) : null;
  }

  /** Voices sounding on the Synth or a layer. */
  activeVoices(id: "synth" | "layer1" | "layer2"): number {
    return this.graph ? this.graph.instruments[id].activeVoices() : 0;
  }

  /** Native sub-oscillator detunes, in cents, of the Synth's or a layer's sounding voices. */
  detunes(id: "synth" | "layer1" | "layer2"): number[] {
    return this.graph ? this.graph.instruments[id].detunes() : [];
  }

  /** Resting frequency of a layer's pad filter, in Hz (10 kHz outside Pad mode); null before audio starts. */
  padHz(id: LayerInstrument): number | null {
    return this.graph ? this.graph.instruments[id].padHz() : null;
  }

  /**
   * For the smoke test (G4 review S1): the audio time from which a layer's pad filter last moved, and
   * the audio clock now; null before audio starts.
   */
  padMove(id: LayerInstrument): { at: number; now: number } | null {
    return this.graph ? { at: this.graph.instruments[id].padMoveTime(), now: Tone.getContext().currentTime } : null;
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
    const bpm = Tone.getTransport().bpm.value;
    const sixteenth = 60 / bpm / 4;
    for (const id of r.stopped) g.instruments[id].releaseAll(time);
    // A new bass or synth rhythm lets go of what the old one held; the sequencer restarts it.
    for (const id of r.restarted) g.instruments[id].releaseAll(time);
    // A new section starts its own chords, and a key, mood or chord edit restarts them: held chords
    // and pads let go (with their release).
    if (r.retrigger || (r.applied && r.applied.section !== null)) {
      for (const id of ["synth", "layer1", "layer2"] as const) g.instruments[id].releaseAll(time);
    }
    // A held bass note in the old key lets go too; the sequencer restarts it at the new root.
    if (r.retrigger) g.instruments.bass.releaseAll(time);
    // Pad mode's envelope and filter follow the playing section's pad dials, from this step's time.
    for (const id of LAYER_IDS) g.instruments[id].useMode(r.pads[id], time);
    for (const e of r.events) {
      const t = time + e.shift * sixteenth; // swing: every instrument on an odd step moves together
      switch (e.inst) {
        case "drums":
          g.instruments.drums.trigger(e.voice, t, e.vel, bpm, e.gap);
          if (e.voice === "kick") g.pump(t);
          break;
        case "bass":
          g.instruments.bass.trigger(e.midi, e.len * sixteenth, t, e.vel);
          break;
        case "synth":
          g.instruments.synth.trigger(e.notes, e.len * sixteenth, t, e.vel);
          break;
        default:
          g.instruments[e.inst].trigger(e.notes, e.len * sixteenth, t, e.vel);
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
