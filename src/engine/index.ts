/**
 * Engine API (spec section 7). The UI calls only this: load song, play, stop, set parameter,
 * switch section, toggle instrument, and reads pending switches and the playing position.
 * Notes are scheduled ahead on the audio clock by the transport; the UI's timers never schedule.
 */
import * as Tone from "tone";
import { Graph } from "./audio.ts";
import { Lfo, modsDebug } from "./mods.ts";
import { LogWriter, type LogOp } from "./eventlog.ts";
import { prepareTap, Recorder, type Take } from "./recorder.ts";
import { DiffWatch, JumpWatch, type Jumps } from "./continuity.ts";
import { LEAD_SHAPES as SHAPES, LEAD_STYLES as STYLES } from "../music/lead.ts";
import { InFlight, type Pending } from "./queue.ts";
import { Sequencer, STEPS_PER_BAR, type GenValues, type LaneBar, type StepResult } from "./sequencer.ts";
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
  LIMITS,
  MIX_KEYS,
  MIX_RANGES,
  P7_PATCH_DEFAULTS,
  mixValue,
  validateSong,
  type DroneParams,
  type MixKey,
  type InstrumentId,
  type LayerInstrument,
  type LayerMode,
  type PadParams,
  migrateSong,
  type NumericPatchKey,
  type Patch,
  type Song,
  type Wave,
  type ChordStep,
} from "./song.ts";
import type { KeyName, Mood } from "../music/scales.ts";
import type { BassPreset, DrumPreset, DrumVoice, SynthPreset } from "../music/presets.ts";
import type { ArpParams } from "../music/arp.ts";
import { MACROS, findMacro, macroKey, sectionScoped, targetValue, type MacroId, type MacroInstrument } from "../music/macros.ts";
import { macroPosition } from "./macro.ts";
import { PATCHES, PATCH_IDS, patchFor, resolvePatch } from "../music/styles.ts";
import { EFFECTS, EFFECT_DEFS, MAX_ACTIVE_FX, activate, deactivate, fxKey, type EffectId, type FxKnobs, type FxSlot } from "../music/effects.ts";
import { fxCounts, fxDebug, fxWorklets, type FxSlotNode } from "./fx.ts";
import { songFx } from "./song.ts";

export * from "./song.ts";
export { MOODS, MOOD_TABLE, NOTE_NAMES, type KeyName, type Mood } from "../music/scales.ts";
export { degreeChords, type Chord } from "../music/chords.ts";
export {
  BASS_PRESETS,
  CORE_DRUM_VOICES,
  DRUM_PATTERNS,
  DRUM_PRESETS,
  DRUM_VOICES,
  SEQ_STEPS,
  SEQ_STEPS_16,
  SYNTH_PRESETS,
  eighthOn,
  type BassPreset,
  type DrumPreset,
  type DrumVoice,
  type SynthPreset,
} from "../music/presets.ts";
export { ARP_DIRECTIONS, type ArpDirection, type ArpParams } from "../music/arp.ts";
export { MACROS, type MacroDef, type MacroId, type MacroInstrument } from "../music/macros.ts";
export { macroPosition } from "./macro.ts";
export { LEAD_SHAPES, LEAD_STYLES, LOCK_FROZEN, PHRASE_BARS, type LeadParams, type LeadShape, type LeadStyle, type PhraseBars } from "../music/lead.ts";
export type { Pending, PendingChords, PendingToggle } from "./queue.ts";
export type { LaneBar, LaneNote, LaneNotes, LanePhrase } from "./sequencer.ts";
export { LOG_OPS, type LogEvent, type LogOp } from "./eventlog.ts";
export { MP3_KBPS, type Take } from "./recorder.ts";
export {
  EFFECTS,
  EFFECT_DEFS,
  FX_SLOTS,
  MAX_ACTIVE_FX,
  type EffectDef,
  type EffectId,
  type FxKnobDef,
  type FxKnobs,
  type FxRack,
  type FxSlot,
} from "../music/effects.ts";

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

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

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
  /** A whole song (a vibe) landed on this bar line: its name, style and the bar line's audio time. */
  loaded?: { name: string; style?: string; at: number };
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
  /** A song waiting for the next bar line (loadAtBar), with its mix; null when none. */
  private queued: Song | null = null;
  private queuedSection = 0;
  private landedLoad: { name: string; style?: string; at: number } | null = null;
  /** Switches applied by the scheduler but not heard yet (the lookahead before their bar line). */
  private inFlight = new InFlight();
  /** Every bar line at which queued switches landed, newest last (kept short). */
  readonly landed: LandedSwitch[] = [];

  constructor(given: Song = defaultSong()) {
    // A song saved before P2 plays at P2's balance (P2 review S1).
    const song = migrateSong(given);
    this.seq = new Sequencer(bareSong(song));
    this.takeDocument(song);
    this.takeFx();
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

  /**
   * The whole song document to save: the song, its mix and the last take's event log. While a song waits for
   * the bar line (loadAtBar), that song: it is the one now kept under the open song's place in the library.
   */
  getDocument(): Song {
    if (this.queued) return cloneSong(this.queued);
    const doc: Song = { ...this.getSong(), mix: { ...this.mix } };
    if (this.log) doc.log = this.log;
    return doc;
  }

  /** The last take's event log, if any. */
  getLog(): EventLog | null {
    return this.log;
  }

  /**
   * Throws, listing every problem, if the song is not valid; the playing song is then unchanged. `section`: the
   * section to play from (else the current one, if the song has it).
   */
  loadSong(given: Song, section?: number): void {
    const errors = validateSong(given);
    if (errors.length) throw new Error(`invalid song: ${errors.join("; ")}`);
    // A song saved before P2 plays at P2's balance (P2 review S1).
    const song = migrateSong(given);
    this.queued = null;
    this.takeDocument(song);
    this.seq.load(bareSong(song), section);
    this.takeFx();
    if (this.graph) {
      this.applyAll();
      Tone.getTransport().bpm.rampTo(song.bpm, 0.1);
    }
    this.emit({ ...this.pos, section: this.seq.section });
    this.changed(true);
  }

  /**
   * Load a whole song on the next bar line (P3: a vibe), starting in `section`. While playing, the old song plays
   * to the bar line and the new one, with its patches, mix and tempo, starts exactly on it; until then
   * `pendingLoad()` names it. While stopped it loads at once. Throws on an invalid song, changing nothing.
   */
  loadAtBar(given: Song, section = 0): void {
    if (!this.playing) return this.loadSong(given, section);
    const errors = validateSong(given);
    if (errors.length) throw new Error(`invalid song: ${errors.join("; ")}`);
    const song = migrateSong(given);
    this.queued = cloneSong(song);
    this.queuedSection = section;
    this.seq.queueSong(bareSong(song), section);
    this.changed();
  }

  /** The song waiting for the next bar line (its name and style), or null. */
  pendingLoad(): { name: string; style?: string } | null {
    return this.queued ? { name: this.queued.name, style: this.queued.style } : null;
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
    const at = Tone.now() + 0.05;
    Tone.getTransport().start(at);
    // P7: the synced LFOs start on bar 1 with the transport; the hiss and the air play while it runs.
    this.graph.startClock(at);
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
    this.graph.setPlaying(false);
    this.inFlight.clear();
    // A song still waiting for its bar line loads now.
    const queued = this.queued;
    if (queued) this.loadSong(queued, this.queuedSection);
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

  setMix(key: MixKey, value: number): void {
    if (!(MIX_KEYS as readonly string[]).includes(key)) return;
    const [lo, hi] = MIX_RANGES[key];
    if (!Number.isFinite(value)) return;
    this.note("setMix", [key, value]);
    const v = Math.max(lo, Math.min(hi, value));
    this.mix[key] = v;
    this.graph?.setMix(key, v);
    this.changed();
  }

  /**
   * Load a patch (C8, spec 8.2's pickers list whatever exists): every value of the patch file `id` for this
   * instrument, its level kept (the Level dial is the mix). One change, logged as setParams. False for an unknown id
   * or a patch for another instrument.
   */
  setPatch(inst: InstrumentId, id: string): boolean {
    const def = PATCHES[id];
    if (!def || def.instrument !== patchFor(inst)) return false;
    const { level: _level, ...values } = { ...P7_PATCH_DEFAULTS, ...resolvePatch(inst, id) };
    this.setParams(inst, values);
    return true;
  }

  /** The patch files an instrument can load, in picker order (C8). */
  patchIds(inst: InstrumentId): string[] {
    return PATCH_IDS.filter((id) => PATCHES[id].instrument === patchFor(inst));
  }

  // ---- Effects (P9, spec 8.8) ----------------------------------------------------------------

  /** Slots switched on, in the order they were switched on (the oldest first): the cap turns the oldest off. */
  private fxOrder: string[] = [];
  /** The cap (spec 8.8); only `fxCapForCost` changes it, so tools/cost.py can measure all ten slots on. */
  private fxCap = MAX_ACTIVE_FX;

  /** For tools/cost.py (P9): lift or restore the cap on active slots, to measure the cost of all ten. Never used by the app. */
  fxCapForCost(n: number): void {
    this.fxCap = Math.max(1, Math.min(10, Math.round(n)));
  }

  /** The effect slots as the song holds them (a copy; defaults, all off, for a song that sets none). */
  getFx(): Record<InstrumentId, [FxSlot, FxSlot]> {
    return songFx(this.seq.song);
  }

  /**
   * Change one effect slot: its effect (the knobs go to the new effect's starting values unless `knobs` is given),
   * its knobs, or on and off. Acts at once, crossfaded, so it never clicks. Switching on a slot past the cap of
   * MAX_ACTIVE_FX active slots turns off the slot switched on longest ago. Returns false for a bad slot or value.
   */
  setFx(inst: InstrumentId, slot: number, values: { effect?: EffectId; on?: boolean; knobs?: readonly number[] }, at?: number): boolean {
    if (!INSTRUMENTS.includes(inst) || (slot !== 0 && slot !== 1) || !values || typeof values !== "object") return false;
    if (values.effect !== undefined && !EFFECTS.includes(values.effect)) return false;
    if (values.on !== undefined && typeof values.on !== "boolean") return false;
    const k = values.knobs;
    if (k !== undefined && !(Array.isArray(k) && k.length === 3 && k.every((x) => typeof x === "number" && Number.isFinite(x)))) return false;
    const fx = songFx(this.seq.song);
    const cur = fx[inst][slot];
    const next: FxSlot = {
      effect: values.effect ?? cur.effect,
      on: values.on ?? cur.on,
      knobs: (k ? k.map((x) => Math.max(0, Math.min(1, x))) : values.effect && values.effect !== cur.effect ? [...EFFECT_DEFS[values.effect].defaults] : cur.knobs) as FxKnobs,
    };
    fx[inst][slot] = next;
    const key = fxKey(inst, slot);
    if (next.on && !cur.on) {
      const { order, off } = activate(this.fxOrder, key, this.fxCap);
      this.fxOrder = order;
      for (const o of off) {
        const [oi, os] = o.split(":");
        fx[oi as InstrumentId][Number(os)] = { ...fx[oi as InstrumentId][Number(os)], on: false };
        this.graph?.setFx(oi as InstrumentId, fx[oi as InstrumentId], at);
      }
    } else if (!next.on && cur.on) this.fxOrder = deactivate(this.fxOrder, key);
    this.seq.song.fx = fx;
    // `at` (an audio time) is for the smoke test's timed switches only; the app acts at once.
    this.graph?.setFx(inst, fx[inst], at);
    this.note("setFx", [inst, slot, values]);
    this.changed();
    return true;
  }

  /** The activation order from a loaded song: its slots that are on, in instrument order, at most the cap. */
  private takeFx(): void {
    const fx = songFx(this.seq.song);
    this.fxOrder = [];
    let over = false;
    for (const id of INSTRUMENTS)
      fx[id].forEach((s, i) => {
        if (!s.on) return;
        if (this.fxOrder.length >= this.fxCap) {
          s.on = false;
          over = true;
        } else this.fxOrder.push(fxKey(id, i));
      });
    if (over) this.seq.song.fx = fx;
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

  /**
   * The section the scheduler plays: the one `toggleInstrumentInPlaying` changes. At a section switch it
   * runs ahead of `position().section` by the lookahead. The Now tiles read this, so what a tile shows
   * and what its tap toggles are the same section.
   */
  schedulerSection(): number {
    return this.seq.section;
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

  /**
   * Play a progression (P4, a Simple Chords card): the song's mood and a section's chords together, from the next
   * bar line while playing (from its first chord in the playing section), at once when stopped. The same one
   * tapped again before the bar line cancels it. `pending().chords` shows it waiting. Returns false if refused.
   */
  setProgression(section: number, mood: Mood, chords: ChordStep[]): boolean {
    const ok = this.seq.setProgression(section, mood, chords);
    if (!ok) return false;
    this.note("setProgression", [section, mood, chords]);
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
  toggleDrumStep(section: number, voice: DrumVoice, step: number, sixteen = false): boolean {
    const ok = this.seq.toggleDrumStep(section, voice, step, sixteen);
    if (!ok) return false;
    this.note("toggleDrumStep", sixteen ? [section, voice, step, true] : [section, voice, step]);
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

  /** Drone mode (P7): the root alone (`fifth: false`) or root and fifth. In the playing section the drone glides there. */
  setDrone(section: number, layer: LayerInstrument, values: Partial<DroneParams>): boolean {
    const ok = this.seq.setDrone(section, layer, values);
    if (!ok) return false;
    this.note("setDrone", [section, layer, values]);
    this.changed();
    return ok;
  }

  /** The lead's knobs (P5: style, Shape, Phrase and the 0..1 knobs of spec 8.5 too). Only Lock draws new notes. */
  setGen(section: number, layer: LayerInstrument, values: GenValues): boolean {
    const ok = this.seq.setGen(section, layer, values);
    if (!ok) return false;
    // A cleared knob is logged as null: the saved log is JSON, which drops undefined.
    const logged = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === undefined ? null : v]));
    this.note("setGen", [section, layer, logged]);
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
   * Back (spec 8.3): the layer's previous seed, from the last eight kept per layer per section. The lead
   * plays again what it played under that seed. Returns the seed, or null when there is no earlier one.
   */
  prevSeed(section: number, layer: LayerInstrument): number | null {
    const seed = this.seq.prevSeed(section, layer);
    if (seed === null) return null;
    this.note("prevSeed", [section, layer]);
    this.changed();
    return seed;
  }

  /** A section's swing set by hand, 0..0.5 sixteenths (the Swing dial). Acts at once. */
  setSwing(section: number, swing: number): boolean {
    const ok = this.seq.setSwing(section, swing);
    if (!ok) return false;
    this.note("setSwing", [section, swing]);
    this.changed();
    return true;
  }

  /**
   * Turn a Simple macro dial (spec 8.3) to `pos` (0..1): it writes the ordinary patch and section values
   * its mapping names (src/music/macros.ts), so Advanced shows the result, and stores its position in the
   * song (per section when it acts on section values). `section` is the edited section.
   */
  setMacro(section: number, inst: InstrumentId, id: MacroId, pos: number): boolean {
    const def = findMacro(inst, id);
    const s = this.seq.song.sections[section];
    if (!def || !s || typeof pos !== "number" || !Number.isFinite(pos)) return false;
    const p = Math.max(0, Math.min(1, pos));
    const layer = inst as LayerInstrument;
    for (const t of def.targets) {
      const v = targetValue(t, p);
      if (t.kind === "patch") this.applyParam(inst, t.key, v);
      else if (t.kind === "swing") this.seq.setSwing(section, v);
      else if (t.kind === "gen") this.seq.setGen(section, layer, { [t.key]: v });
      else if (t.kind === "arp") this.seq.setArp(section, layer, { [t.key]: v });
      else this.seq.setPad(section, layer, { [t.key]: v });
    }
    const key = macroKey(inst, id);
    if (sectionScoped(def)) s.macros = { ...s.macros, [key]: p };
    else this.seq.song.macros = { ...this.seq.song.macros, [key]: p };
    this.note("setMacro", [section, inst, id, p]);
    this.changed();
    return true;
  }

  /**
   * Forget the stored position of every song-wide macro of `inst` whose first value is the patch key `key`, so
   * those dials read the value again (P2 review S2: the Simple XY pad moves the cutoff a Bright dial shows).
   * Returns whether any position was forgotten.
   */
  releaseMacros(inst: InstrumentId, key: NumericPatchKey): boolean {
    const stored = this.seq.song.macros;
    if (!stored) return false;
    const drop = (MACROS[inst as MacroInstrument] ?? [])
      .filter((m) => !sectionScoped(m) && m.targets[0].kind === "patch" && m.targets[0].key === key)
      .map((m) => macroKey(inst, m.id))
      .filter((k) => k in stored);
    if (!drop.length) return false;
    const rest = Object.fromEntries(Object.entries(stored).filter(([k]) => !drop.includes(k)));
    if (Object.keys(rest).length) this.seq.song.macros = rest;
    else delete this.seq.song.macros;
    this.note("releaseMacros", [inst, key]);
    this.changed();
    return true;
  }

  /** Where a macro dial stands in a section (stored, or read from its first value). */
  macroPos(section: number, inst: InstrumentId, id: MacroId): number {
    return macroPosition(this.seq.song, section, inst, id);
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

  /**
   * Every instrument's bar as notes, for the lanes (spec 8.12): `bar` is the bar shown (position().bar).
   * Read by the screen when the bar or the song changes; the audio callback only appends to a list.
   */
  lanes(bar?: number): LaneBar {
    return this.seq.lanes(bar);
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
    const bpm = Math.max(LIMITS.bpm[0], Math.min(LIMITS.bpm[1], Math.round(v)));
    if (bpm !== this.seq.song.bpm) this.note("bpm", [bpm]);
    this.seq.song.bpm = bpm;
    if (this.graph) {
      Tone.getTransport().bpm.rampTo(bpm, 0.05);
      this.graph.setTempo(bpm);
    }
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

  /**
   * For the smoke test (P5): a layer's lead glides started, glides not started because the layer ran out of
   * voices and dropped the note, and the audio time of its last accent (-1: none).
   */
  leadMarks(id: LayerInstrument): { glides: number; glideDrops: number; accentAt: number } | null {
    if (!this.graph) return null;
    const l = this.graph.instruments[id];
    return { glides: l.glides, glideDrops: l.glideDrops, accentAt: l.channel.accentAt };
  }

  /** The P7 additions are in this build (the smoke test's cost scene reads this). */
  readonly p7 = true;

  /**
   * For the smoke test (P7): what of P7 is running now: per instrument the synced LFO, the drift, the voices held by a
   * drone or a swooping pad, the chord glides so far, the voices allotted and the cap; the lo-fi master, the air
   * layer and the reverb's decay. Null before audio starts.
   */
  p7State(): {
    lfo: Record<InstrumentId, boolean>;
    drift: Record<InstrumentId, boolean>;
    held: Record<LayerInstrument | "synth", number>;
    swoops: Record<LayerInstrument | "synth", number>;
    voices: Record<LayerInstrument | "synth", number>;
    cap: Record<LayerInstrument | "synth", number>;
    lofi: boolean;
    air: boolean;
    reverbDecay: number;
    /** P7 review: the noise wave's breath running, held notes moved by a wave change, reverbs alive (now, most at once), LFO sources running, drift pitch wired. */
    breath: Record<"bass" | LayerInstrument | "synth", boolean>;
    reholds: Record<LayerInstrument | "synth", number>;
    reverbSlots: number;
    reverbMaxSlots: number;
    lfoSources: number;
    driftWired: Record<LayerInstrument | "synth", boolean>;
  } | null {
    const g = this.graph;
    if (!g) return null;
    const per = <T>(ids: readonly InstrumentId[], f: (id: InstrumentId) => T): Record<string, T> => Object.fromEntries(ids.map((id) => [id, f(id)]));
    const polys = ["synth", "layer1", "layer2"] as const;
    return {
      lfo: per(INSTRUMENTS, (id) => g.instruments[id].channel.lfoActive) as Record<InstrumentId, boolean>,
      drift: per(INSTRUMENTS, (id) => g.instruments[id].channel.driftActive) as Record<InstrumentId, boolean>,
      held: per(polys, (id) => g.instruments[id as "synth"].heldNotes()) as Record<LayerInstrument | "synth", number>,
      swoops: per(polys, (id) => g.instruments[id as "synth"].swoops) as Record<LayerInstrument | "synth", number>,
      voices: per(polys, (id) => g.instruments[id as "synth"].allottedVoices()) as Record<LayerInstrument | "synth", number>,
      cap: per(polys, (id) => g.instruments[id as "synth"].cap) as Record<LayerInstrument | "synth", number>,
      lofi: g.lofi.active,
      air: g.air.active,
      reverbDecay: g.reverb.decay,
      breath: per(["bass", ...polys], (id) => g.instruments[id as "bass"].breathing) as Record<"bass" | LayerInstrument | "synth", boolean>,
      reholds: per(polys, (id) => g.instruments[id as "synth"].reholds) as Record<LayerInstrument | "synth", number>,
      reverbSlots: g.reverb.slots,
      reverbMaxSlots: g.reverb.maxSlots,
      lfoSources: Lfo.sources,
      driftWired: per(polys, (id) => g.instruments[id as "synth"].channel.drift?.wired ?? false) as Record<LayerInstrument | "synth", boolean>,
    };
  }

  /**
   * For the smoke test (P9): per instrument and slot, its effect, whether it is on and whether its effect is
   * connected, and its LFO rate and Echo time (review S2); the slots active now, in the order they were switched on;
   * the cap; effects built so far; worklet nodes alive (review E1: only running Crush and Shifter hold one).
   */
  fxState(): {
    slots: Record<InstrumentId, ({ effect: EffectId; on: boolean; wired: boolean } & ReturnType<FxSlotNode["rates"]>)[]>;
    order: string[];
    cap: number;
    built: number;
    worklets: number;
  } | null {
    const g = this.graph;
    if (!g) return null;
    const slots = Object.fromEntries(
      INSTRUMENTS.map((id) => [id, g.instruments[id].channel.fx.slots.map((s) => ({ effect: s.effect, on: s.active, wired: s.wired, ...s.rates() }))]),
    ) as Record<InstrumentId, ({ effect: EffectId; on: boolean; wired: boolean } & ReturnType<FxSlotNode["rates"]>)[]>;
    return { slots, order: [...this.fxOrder], cap: this.fxCap, built: fxCounts.built, worklets: fxWorklets.alive };
  }

  private probe: { osc: OscillatorNode; gain: GainNode } | null = null;

  /**
   * For the smoke test (P9 review E2, E3): a steady sine of `hz` (peak `amp`) fed into the effect slots of `into`, with
   * every instrument's own sound cut from its slots, so a click check has a clean reference on any instrument;
   * null ends it. Returns the audio time the sine starts (its phase is 0 there), the clock and the tempo.
   */
  fxProbe(hz: number | null, into: InstrumentId[] = [], amp = 0.25): { t0: number; now: number; beats: number; bpm: number } | null {
    const g = this.graph;
    if (!g) return null;
    const raw = Tone.getContext().rawContext as unknown as AudioContext;
    if (this.probe) {
      const p = this.probe;
      this.probe = null;
      p.osc.stop();
      p.gain.disconnect();
      g.fxProbe(null, []);
    }
    const now = raw.currentTime;
    const clock = { now, beats: this.fxBeats(now), bpm: Tone.getTransport().bpm.value };
    if (hz === null) return { t0: 0, ...clock };
    const osc = raw.createOscillator();
    const gain = raw.createGain();
    osc.frequency.value = hz;
    gain.gain.value = Math.max(0, Math.min(1, amp));
    osc.connect(gain);
    const t0 = now + 0.05;
    osc.start(t0);
    this.probe = { osc, gain };
    g.fxProbe(gain, into);
    return { t0, ...clock };
  }

  /** For the smoke test: the audio clock now, the transport's beats then (0 while stopped) and the tempo. */
  fxClock(): { now: number; beats: number; bpm: number } {
    const now = (Tone.getContext().rawContext as unknown as AudioContext).currentTime;
    return { now, beats: this.fxBeats(now), bpm: Tone.getTransport().bpm.value };
  }

  private fxBeats(t: number): number {
    const tr = Tone.getTransport();
    return tr.state === "started" ? tr.getTicksAtTime(t) / tr.PPQ : 0;
  }

  /**
   * For the smoke test (P9): every slot switch steps instead of ramping, and so does every master switch (lo-fi,
   * air, reverb; review E3), to prove the click checks can fail.
   */
  fxHardSwitch(on: boolean): void {
    fxDebug.hard = on;
    modsDebug.hard = on;
  }

  private diffWatches = new Map<InstrumentId, DiffWatch>();

  /**
   * For the smoke test (P9): how far an instrument's sound after its two effect slots differs from the sound going
   * in, since the last call (the first call starts the watch): the RMS of the difference and of the input, on the
   * left channel. An effect is audible when the difference is large; every slot off gives none.
   */
  async fxDiff(id: InstrumentId): Promise<{ diff: number; ref: number } | null> {
    if (!this.graph) return null;
    let w = this.diffWatches.get(id);
    if (!w) {
      w = await DiffWatch.make(Tone.getContext());
      const fx = this.graph.instruments[id].channel.fx;
      fx.input.connect(w.node, 0, 0);
      fx.output.connect(w.node, 0, 1);
      this.diffWatches.set(id, w);
    }
    return w.read();
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

  /**
   * For the smoke test (P3 review E1): an instrument's native resting cutoff in Hz, and the audio clock now;
   * null before audio starts.
   */
  cutoffNow(id: InstrumentId): { hz: number; now: number } | null {
    return this.graph ? { hz: this.graph.instruments[id].channel.cutoffNative(), now: Tone.getContext().currentTime } : null;
  }

  /** One instrument's own level in dB, without the shared sends (P3 review S2); -Infinity before audio starts. */
  instrumentLevel(id: InstrumentId): number {
    return this.graph ? this.graph.instrumentLevel(id) : -Infinity;
  }

  /** The lead's shapes and styles in their order, so the test tools read them instead of copying them (P6 review M6). */
  leadLists(): { shapes: readonly string[]; styles: readonly string[] } {
    return { shapes: SHAPES, styles: STYLES };
  }

  private jumpWatches = new Map<InstrumentId | "master", JumpWatch>();

  /**
   * For the smoke test (P6 review S2): the largest sample-to-sample jump and the largest sample of one
   * instrument's own output since the last call (the first call starts the watch); null before audio starts.
   */
  async jumps(id: InstrumentId | "master"): Promise<Jumps | null> {
    if (!this.graph) return null;
    let w = this.jumpWatches.get(id);
    if (!w) {
      w = await JumpWatch.make(Tone.getContext());
      // P7: "master" watches the output after the limiter (the lo-fi master, the air and the reverb sit there).
      if (id === "master") this.graph.tap(w.node);
      else this.graph.instruments[id].channel.level.connect(w.node);
      this.jumpWatches.set(id, w);
    }
    return w.read();
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

  /** Apply every patch and the mix: from now, or from audio time `at` (a vibe's bar line, P3 review E1). */
  private applyAll(at?: number): void {
    const g = this.graph!;
    for (const id of INSTRUMENTS) {
      const p = this.seq.song.patches[id];
      if (at === undefined) g.instruments[id].apply(p);
      else g.instruments[id].applyAt(p, at);
    }
    for (const k of MIX_KEYS) {
      if (at === undefined) g.setMix(k, mixValue(this.mix, k));
      else g.setMixAt(k, mixValue(this.mix, k), at);
    }
    // P9: every instrument's effect slots, from the same moment.
    const fx = songFx(this.seq.song);
    for (const id of INSTRUMENTS) g.setFx(id, fx[id], at);
  }

  private tick(time: number): void {
    // transport.stop() takes effect a lookahead later; the clock keeps calling until then.
    if (!this.seq.isRunning) return;
    const g = this.graph!;
    const r: StepResult = this.seq.next();
    const bpm = Tone.getTransport().bpm.value;
    let sixteenth = 60 / bpm / 4;
    let tempo = bpm;
    if (r.loaded && this.queued) {
      // A vibe lands on this bar line (P3): every held note lets go, and its patches, mix and tempo are
      // scheduled from `time` on the audio clock (P3 review E1). This tick runs a lookahead early, so every
      // continuous value ramps from `time`, not from now; the old bar's last notes keep the old sound.
      const doc = this.queued;
      this.queued = null;
      this.takeDocument(doc);
      this.takeFx();
      for (const id of INSTRUMENTS) g.instruments[id].releaseAll(time);
      this.applyAll(time);
      // A tempo ramp started just before the bar line (a tempo change, a song load) can end after it, and Tone
      // refuses an event before the last one it holds: what is scheduled from the bar line on gives way first.
      Tone.getTransport().bpm.cancelScheduledValues(time);
      Tone.getTransport().bpm.setValueAtTime(doc.bpm, time);
      g.setTempo(doc.bpm, time);
      tempo = doc.bpm;
      sixteenth = 60 / tempo / 4;
      this.landedLoad = { name: doc.name, style: doc.style, at: time };
      Tone.getDraw().schedule(() => this.changed(true), time);
    }
    for (const id of r.stopped) g.instruments[id].releaseAll(time);
    // A new bass or synth rhythm lets go of what the old one held; the sequencer restarts it.
    for (const id of r.restarted) g.instruments[id].releaseAll(time);
    // A new section starts its own chords, and a key, mood or chord edit restarts them: held chords
    // and pads let go (with their release). P7: a drone or a swooping pad that keeps holding glides instead.
    if (r.retrigger || (r.applied && r.applied.section !== null)) {
      for (const id of ["synth", "layer1", "layer2"] as const) if (!(r.kept as string[]).includes(id)) g.instruments[id].releaseAll(time);
    }
    // P7: held notes of a layer that stopped holding (a new mode, Swoop to 0, another section) let go.
    for (const id of r.letGo) g.instruments[id].releaseAll(time);
    // A held bass note in the old key lets go too; the sequencer restarts it at the new root.
    if (r.retrigger) g.instruments.bass.releaseAll(time);
    // Pad mode's envelope and filter follow the playing section's pad dials, from this step's time.
    for (const id of LAYER_IDS) g.instruments[id].useMode(r.pads[id], time);
    // P9: Gate's pattern moves on the straight sixteenths.
    g.fxStep(time, r.step);
    for (const e of r.events) {
      const t = time + e.shift * sixteenth; // swing: every instrument on an odd step moves together
      switch (e.inst) {
        case "drums": {
          // P7: a roll splits the sixteenth into 2..4 quick hits, each softer than the last and short enough to end before the next.
          const n = e.repeat && e.repeat > 1 ? e.repeat : 1;
          for (let k = 0; k < n; k++)
            g.instruments.drums.trigger(e.voice, t + (k * sixteenth) / n, e.vel * (1 - 0.12 * k), tempo, k < n - 1 ? 1 / n : e.gap - (k * 1) / n);
          if (e.voice === "kick") g.pump(t);
          break;
        }
        case "bass":
          g.instruments.bass.trigger(e.midi, e.len * sixteenth, t, e.vel);
          g.fxNote("bass", midiHz(e.midi), t);
          break;
        case "synth":
          g.instruments.synth.trigger(e.notes, e.len * sixteenth, t, e.vel);
          // P9 review M5: an empty chord has no lowest note.
          if (e.notes.length) g.fxNote("synth", midiHz(Math.min(...e.notes)), t);
          break;
        default: {
          // P9: Ring's Follow hears the layer's lowest note.
          if (e.notes.length) g.fxNote(e.inst, midiHz(Math.min(...e.notes)), t);
          // P7: a drone or a swooping pad starts its held notes, or glides them to the new chord's.
          if (e.hold) {
            g.instruments[e.inst].hold(e.notes, t, e.vel);
            break;
          }
          if (e.glide !== undefined) {
            g.instruments[e.inst].glideTo(e.notes, t, e.glide, e.vel);
            break;
          }
          // Lead notes (P5): a slide glides over most of a sixteenth (at most 90 ms); a repeat splits the
          // first sixteenth into two or three quick hits, the last of which holds the rest of the note. A slid
          // note that repeats glides over most of its first hit, so the next hit, on a new voice at the
          // note's own pitch, does not cut the slide short (P5 review M2).
          const n = e.repeat && e.repeat > 1 ? e.repeat : 1;
          const sub = sixteenth / n;
          const glide = Math.min(0.09, 0.8 * sub);
          const lead = e.glideFrom !== undefined || e.accent ? { glideFrom: e.glideFrom, glide, accent: e.accent } : undefined;
          for (let r = 0; r < n; r++) {
            const dur = r < n - 1 ? 0.6 * sub : Math.max(0.6 * sub, e.len * sixteenth - r * sub);
            g.instruments[e.inst].trigger(e.notes, dur, t + r * sub, r === 0 ? e.vel : 0.85 * e.vel, r === 0 ? lead : undefined);
          }
        }
      }
    }
    if (r.applied) {
      // A progression changes the song document when it lands (P4): listeners (the screen, autosave) hear it then.
      if (r.applied.chords && !r.loaded) Tone.getDraw().schedule(() => this.changed(), time);
      this.inFlight.land(r.bar, r.applied);
      this.landed.push(this.landedLoad ? { bar: r.bar, pending: r.applied, loaded: this.landedLoad } : { bar: r.bar, pending: r.applied });
      this.landedLoad = null;
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
