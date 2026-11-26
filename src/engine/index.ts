/**
 * Engine API (spec section 7). The UI calls only this: load song, play, stop, set parameter,
 * switch section, toggle instrument, and reads pending switches and the playing position.
 * Notes are scheduled ahead on the audio clock by the transport; the UI's timers never schedule.
 */
import * as Tone from "tone";
import { Graph, oscProbe } from "./audio.ts";
import { oscPatchStats } from "./oscPatch.ts";
import { Lfo, modsDebug } from "./mods.ts";
import { LogWriter, type LogOp } from "./eventlog.ts";
import { prepareTap, Recorder, type Take } from "./recorder.ts";
import { DiffWatch, EnergyWatch, JumpWatch, type Energy, type Jumps } from "./continuity.ts";
import { DropConductor, checkDropSettings, dropLevels as recipeLevels, type WindBar, followFallback, followRef, followStep, refSettleBars, trackBound, loopBeats, resolveDrop, rollHits, type DropBar, type DropIntent, type DropPhase, type DropRecipe, type DropSettings } from "../music/drop.ts";
import { COMP_TOP, type OverlayGroup } from "./drop.ts";
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
import { PATCHES, PATCH_IDS, STYLES as VIBES, patchFor, resolvePatch } from "../music/styles.ts";
import { EFFECTS, EFFECT_DEFS, MAX_ACTIVE_FX, activate, deactivate, fxKey, type EffectId, type FxKnobs, type FxSlot } from "../music/effects.ts";
import { fxCounts, fxDebug, fxWorklets, type FxSlotNode } from "./fx.ts";
import { songFx } from "./song.ts";
import { HANDS_BARS, MORPH_MACROS, MorphPlanner, checkMorphSettings, morphStep, resolveMorph, type MorphMove, type MorphPlan, type MorphSettings } from "../music/morph.ts";
import { inScale } from "../music/scales.ts";

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
export { DROP_BUILDS, DROP_CLIFFS, DROP_WINDS, windSteps, type WindBar, type WindState, type DropBuild, type DropCliff, type DropIntent, type DropPhase, type DropRecipe, type DropSettings, type DropWind } from "../music/drop.ts";
export type { Energy } from "./continuity.ts";
export { HANDS_BARS, MORPH_THINGS, VOICING_STEPS, voicingShift, type MorphPlan, type MorphSettings, type MorphThing } from "../music/morph.ts";

/** P11: one move Morph made, for the smoke test and the tests: the journey's bar and the engine call it made. */
export interface MorphMade {
  bar: number;
  op: LogOp;
  a: unknown[];
}

/** P11: one bar as scheduled, while the trace is on (smoke test, tests): what played and the state Morph moves. */
export interface MorphBar {
  /** The journey's bar (bars since the song or Play began). */
  bar: number;
  section: number;
  /** A hash of the bar's notes and of every value Morph moves, as they stood at the bar line. */
  sig: string;
  /** P11 review S2: a hash of the bar's notes alone (what the sequencer played, none of the values Morph moves). */
  tune: string;
  /** Notes scheduled in the bar (bass, synth and layers), and those outside the song's key. */
  notes: number;
  out: number[];
  /** A drop held Morph at this bar line. */
  held: boolean;
}

/** What the DROP button shows (spec 8.9), as heard: the phase, the bar in it, its length, what a press waits for and the section queued behind the drop. */
export interface DropShown {
  phase: DropPhase;
  /** Bar within the build or wind-down (0 otherwise). */
  index: number;
  /** Bars in the build or wind-down; the build's length while armed; 0 otherwise. */
  length: number;
  /** Bars left in the build or wind-down, counting the one playing. */
  barsLeft: number;
  intent: DropIntent;
  /** A section tapped during the drop, waiting for the wind-down (spec 8.9), or null. */
  queued: number | null;
}

/** One bar line of the Drop, for the smoke test: the bar, its audio time and what it is. */
export interface DropMark extends DropBar {
  bar: number;
  at: number;
}


/**
 * P10 review S1, S2: the level follower settles on FOLLOW_BEATS beats of the drop, then holds, so knobs moved during the
 * drop are heard as moved (and a hand on any control holds it at once). It reads only beats whose place in the
 * section's loop was heard before the build (P10 fix: a section heard for less than its loop has places with no
 * level of their own; against the section's mean the follower pulled a loud chord down, or a quiet one up, and held
 * that offset over the rest of the drop). In the drop's first bar it moves at most 3 dB a beat; after it at most
 * FINE_DB a beat on a slow curve, and not at all for an error under DEADBAND_DB.
 */
const FOLLOW_BEATS = 8;
const FINE_DB = 0.5;
const DEADBAND_DB = 0.3;
/** The follower's curve (seconds) for its fine moves: slow, so a correction later in the drop is not heard as a step. */
const FINE_TAU = 0.6;
/** Once settled: at most TRACK_DB a beat on a TRACK_TAU curve, within TRACK_RANGE_DB of the settled gain. */
const TRACK_DB = 0.25;
const TRACK_TAU = 1.2;
const TRACK_RANGE_DB = 3;

/** P11: Morph's moves and the bar trace kept for the smoke test (a little over 40 minutes at 120 bpm). */
const MORPH_KEEP = 1200;

const DROP_OFF: DropBar = { phase: "off", index: 0, length: 0, impact: false, cliff: false, end: false, cancelled: false };
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
  private runListeners = new Set<(running: boolean) => void>();
  private isRunning = false;
  /**
   * P10d: bumped by Play and by Stop. What the scheduler's callback hands to the screen on the audio clock (the
   * position, the DROP button's phase) is dropped when it arrives after the run that scheduled it ended: a Stop must
   * not be followed by a position of the run it stopped.
   */
  private run = 0;
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

  // ---- The Drop (P10, spec 8.9) ----
  private dropper = new DropConductor();
  /** The bar the scheduler is in, as the conductor gave it at its bar line. */
  private dropPlan: DropBar = DROP_OFF;
  /** The recipe of the drop running now (fixed when its build starts); null when none runs. */
  private dropRec: DropRecipe | null = null;
  /** A section tapped during the drop: it lands on the bar line the drop ends (spec 8.9). */
  private dropSection: number | null = null;
  /** What the button shows, as heard (set on the audio clock), and what a press waits for. */
  private dropHeard: { phase: DropPhase; index: number; length: number; barsLeft: number } = { phase: "off", index: 0, length: 0, barsLeft: 0 };
  private dropIntent: DropIntent = "none";
  /** The level follower: the master output's energy, read every beat. */
  private dropWatch: EnergyWatch | null = null;
  /** Energy of the last beats at normal size (the reference the drop matches), and of the drop's last beats. */
  private beatEnergy = new Map<number, number>();
  /** The section's beats as the build began (by place in the four-bar phrase), and their mean. */
  private dropRefs = new Map<number, number>();
  /** The drop's last beats: each one's energy and the overlay's gain while it played. */
  private dropWindow: { e: number; c: number; ref: number }[] = [];
  private dropRef = 0;
  private dropSkip = 0;
  /**
   * The follower's settled gain in the last drop of each vibe (P10 review S1: the next drop of the same vibe starts
   * there; any other starts at 1).
   */
  private compSteady = new Map<string, number>();
  /** Readings the follower has acted on in this drop's "on" phase (P10 review S2: it holds after FOLLOW_BEATS). */
  private dropFollowed = 0;
  /** A hand on a control during this drop: the follower holds where it is (P10 review S2). */
  private dropHand = false;
  /** The gain the follower settled on in this drop, and the section's last bar before the build (mean beat energy). */
  private dropSettled = 1;
  private dropLast = 0;
  /** The last beats heard at normal size (the section's last bar). */
  private lastBeats: number[] = [];
  /** Readings of this drop's "on" phase after the impact's bar, heard or not (the first bar's moves may be coarse). */
  private dropOnBeats = 0;
  /** The first bar whose beats count in the follower's reference (the bar after a section or song landed). */
  private refFrom = 0;
  /** The follower's last reading of the drop (mean energy of its last beats, as heard). */
  private dropMeasured = 0;
  /** The drop's mix (deeper pump, filter fully open) is on the master: the knobs' own values wait in `mix`. */
  private dropMixOn = false;
  /** P10b: the wind-down's steps, bar by bar, while one runs; and the instruments whose held notes it still doubles. */
  private windSteps: WindBar[] | null = null;
  private windKeep = new Set<string>();
  /** The share of the recipe's extra pump the drop has now (1 while on; the bar's share in a wind-down). */
  private pumpShare = 1;
  /**
   * What each instrument holds past the bar it started in (a long bass note, a sustained chord, a pad, a drone), until
   * when (audio time; Infinity while a drone holds) and whether it is a pad: the extra layers double it once, for as
   * long as it is held (P10 review S8), so a drop that starts in the middle of an eight-bar chord still has it.
   */
  private sustain: Partial<Record<Exclude<InstrumentId, "drums">, { notes: number[]; vel: number; until: number; pad: boolean }>> = {};
  /** The follower's readings while the drop is on: the bar and step read at, and the beat before it (smoke test). */
  readonly dropBeats: { bar: number; step: number; energy: number }[] = [];
  /** Every bar line of the Drop's phases (kept short), for the smoke test. */
  readonly dropMarks: DropMark[] = [];

  // ---- Morph (P11, spec 8.11) ----
  /** The journey under way; null until the next bar line starts one (Play, a song loaded). */
  private morphPlanner: MorphPlanner | null = null;
  /** Bar lines scheduled while playing, ever: the clock hand moves are held against. */
  private morphClock = 0;
  /** When each control was last moved by hand (morphClock). */
  private morphHands = new Map<string, number>();
  /** Morph is making its moves: they are logged as Morph's and hold nothing. */
  private morphing = false;
  /** Morph's moves of this bar line changed the song (listeners hear it once, on the bar). */
  private morphChanged = false;
  /** Morph's moves, newest last (kept to MORPH_KEEP). */
  readonly morphMoves: MorphMade[] = [];
  /** The bars as scheduled while the trace is on (kept to MORPH_KEEP). */
  readonly morphTrace: MorphBar[] = [];
  private traceOn = false;
  /** A drop held Morph at the last bar line. */
  private morphDropHeld = false;
  private traceBar: { bar: number; section: number; state: string; events: string[]; notes: number; out: number[]; held: boolean } | null = null;

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
    // P10: the Drop's level follower listens to the master output (what is heard, after the limiter). Without it the
    // drop keeps a fixed gain.
    try {
      this.dropWatch = await EnergyWatch.make(Tone.getContext());
      this.graph.tap(this.dropWatch.node);
    } catch {
      this.dropWatch = null;
    }
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

  /**
   * P10d review M1: the last Play or Stop, as onRunning tells it. True from the Play tap on, while `playing` is still
   * false for the transport's 50 ms start; the Play button shows this and its tap decides on it.
   */
  get running(): boolean {
    return this.isRunning;
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
    // P11 review E1: what Morph has out or eased is saved as Morph will give it back, so a jam saved (or closed) in the
    // middle of a drop-out never keeps it.
    for (const m of this.morphPlanner?.owed() ?? []) {
      if (!this.morphOwes(m)) continue;
      if (m.kind === "toggle") doc.sections[m.section].on[m.inst] = true;
      else if (m.kind === "lock") doc.sections[m.section][m.layer].gen.lock = m.lock;
    }
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
    this.dropReset();
    // P11 review E1: stopped, Morph gives back what it took from the old song before its journey ends (playing, the
    // sequencer drops the old song's queue; its document is saved whole either way, see getDocument).
    if (!this.seq.isRunning) this.morphRelease();
    this.morphPlanner = null;
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
    // P11 review E1: anything Morph still owes is given back before a new journey starts (Stop gives it back already).
    this.morphRelease();
    // Play during the Stop tail: close the old take now, so the new run is not recorded into it (G5 review M3).
    if (this.rec.state === "finishing" && !this.rec.closing) {
      this.rec.endTime = Math.min(this.rec.endTime || Infinity, Tone.getContext().currentTime);
      void this.finishTake();
    }
    this.seq.start();
    this.run++;
    this.inFlight.clear();
    this.landed.length = 0;
    // P11: a new journey from where the song stands.
    this.morphPlanner = null;
    const at = Tone.now() + 0.05;
    Tone.getTransport().start(at);
    // P7: the synced LFOs start on bar 1 with the transport; the hiss and the air play while it runs.
    this.graph.startClock(at);
    if (this.rec.state === "armed") this.startTake();
    this.tellRunning(true);
  }

  stop(): void {
    if (!this.graph) return;
    const transport = Tone.getTransport();
    transport.stop();
    this.seq.stop();
    this.run++;
    // P11 review E1: the journey pauses: Morph gives back the instrument it has out and the Locks it has eased, at once.
    this.morphRelease();
    const now = Tone.now();
    // Drop attacks still waiting on the clock (swung steps), then release what already started.
    for (const id of INSTRUMENTS) {
      this.graph.instruments[id].cancel();
      this.graph.instruments[id].releaseAll(now);
    }
    this.graph.resetPump();
    this.graph.setPlaying(false);
    // P10: a drop ends with Stop; a section waiting behind it is chosen now.
    const held = this.dropSection;
    this.dropReset();
    if (held !== null) this.seq.switchSection(held);
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
    this.tellRunning(false);
  }

  /**
   * P10d: the transport's state as Play and Stop set it, told at once (the position follows what is heard, a
   * lookahead later, so the Play button does not read it). Returns a function that stops listening.
   */
  onRunning(fn: (running: boolean) => void): () => void {
    this.runListeners.add(fn);
    return () => this.runListeners.delete(fn);
  }

  private tellRunning(on: boolean): void {
    this.isRunning = on;
    for (const fn of this.runListeners) fn(on);
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
    // P10 review S2: a hand on the controls while the drop sounds stops the level follower where it is.
    // P11: Morph's own moves are not a hand: they hold neither the follower nor Morph.
    if (!this.morphing) {
      if (op !== "drop" && this.doubling()) this.dropHand = true;
      this.markHand(op, args);
    }
    const w = this.rec.writer;
    if (!w || this.rec.state !== "recording") return;
    const transport = Tone.getTransport();
    // P11 review E1: what Morph gives back at Stop (or a load while stopped) is not played music: not in the take.
    if (this.morphing && transport.state !== "started") return;
    const ticks = transport.state === "started" ? transport.ticks - this.rec.startTicks : 0;
    w.push(ticks / transport.PPQ, op, args, this.morphing ? "morph" : undefined);
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
    // P10: the drop arrives with the filter fully open and the pump deeper (spec 8.9); the knobs still work during it
    // (P10 review E1: a Filter move acts on the graph), and on the bar line the drop ends the knobs' values come back.
    // P10b: in a wind-down the pump's extra is the share its bar has left.
    if (this.dropMixOn && key === "pump" && this.dropRec) this.graph?.setMix("pump", v + this.dropRec.pump * this.pumpShare);
    else this.graph?.setMix(key, v);
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
    // P10: during a drop a tapped section waits for the wind-down (the one exception to the next-bar rule); tapping it
    // again, or the playing one, takes it back.
    if (this.dropper.active && this.seq.isRunning) {
      if (index < 0 || index >= this.seq.song.sections.length) return;
      this.dropSection = this.dropSection === index || index === this.seq.section ? null : index;
      this.changed();
      return;
    }
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
    const p = this.seq.pending();
    return this.dropSection === null ? p : { ...p, section: this.dropSection };
  }

  /**
   * Switches not heard yet: the queue, plus switches the scheduler already applied a lookahead
   * ahead of a bar line the listener has not reached. The UI shows this, so a pending outline stays
   * until the bar it lands on is heard.
   */
  pendingShown(): Pending {
    const p = this.inFlight.shown(this.seq.pending());
    return this.dropSection === null ? p : { ...p, section: this.dropSection };
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

  // ---- The Drop (P10, spec 8.9) ---------------------------------------------------

  /**
   * The DROP button. Nothing is immediate: off, it arms the build for the next bar line (a second press before then
   * disarms it); during the build it cancels it, back to normal on the next bar line; while on, it starts the
   * wind-down on the next bar line. During the wind-down it does nothing. Stopped, it does nothing. Recorded.
   */
  drop(): void {
    if (!this.seq.isRunning) return;
    const did = this.dropper.press();
    if (did === "ignored") return;
    this.note("drop", []);
    // Disarmed before the build began: a section held behind it takes the ordinary next-bar queue.
    if (did === "disarmed" && this.dropSection !== null) {
      const s = this.dropSection;
      this.dropSection = null;
      this.seq.switchSection(s);
    }
    this.dropIntent = this.dropper.intent;
    this.changed();
  }

  /** What the DROP button shows, as heard. */
  dropShown(): DropShown {
    const h = this.dropHeard;
    const armed = h.phase === "off" && this.dropIntent === "on";
    const build = this.dropRecipe().build;
    return { ...h, length: armed ? build : h.length, barsLeft: armed ? build : h.barsLeft, intent: this.dropIntent, queued: this.dropSection };
  }

  /** The playing song's drop: its vibe's recipe (spec 8.9) with the Drop page's settings over it. */
  dropRecipe(): DropRecipe {
    const song = this.seq.song;
    return resolveDrop(song.style ? VIBES[song.style]?.drop : undefined, song.drop);
  }

  /** The Drop page's settings as the song holds them (a copy). */
  getDropSettings(): DropSettings {
    return { ...this.seq.song.drop };
  }

  /**
   * The Drop page (Advanced): build length, cliffhanger, wind-down length and Width. Stored in the song; a build or
   * wind-down already running keeps its length; Width acts at once on a drop that is on. Returns false when refused.
   */
  setDrop(values: DropSettings): boolean {
    const errors: string[] = [];
    checkDropSettings(values, "drop", errors);
    if (errors.length) return false;
    const next = { ...this.seq.song.drop, ...values };
    for (const k of Object.keys(next) as (keyof DropSettings)[]) if (next[k] === undefined) delete next[k];
    if (Object.keys(next).length) this.seq.song.drop = next;
    else delete this.seq.song.drop;
    if (values.width !== undefined && this.dropRec && this.graph) {
      this.dropRec = { ...this.dropRec, width: values.width };
      const t = Tone.getContext().currentTime;
      this.graph.drop.width(values.width, t);
      if ((this.dropRec.bloom && this.dropPlan.phase === "build") || this.dropPlan.phase === "on") {
        const lv = this.dropLevels(this.dropRec);
        for (const k of Object.keys(lv) as OverlayGroup[]) this.graph.drop.level(k, lv[k], t);
      }
    }
    this.note("setDrop", [values]);
    this.changed();
    return true;
  }

  /**
   * For the smoke test: the follower's gain, its reference, voices sounding, the most at once, notes over the cap; and
   * (P10b) the last wind-down's schedule (audio time of its first bar line, bar seconds, per-bar targets) and the voices
   * it held back.
   */
  /**
   * C27, for the smoke test: the loop (in bars) the level follower keys the playing section's beats by (`loopBeats`),
   * so the check compares the drop's bars with the section's bars at the same places of it.
   */
  dropLoopBars(): number {
    const sec = this.seq.song.sections[this.pos.section];
    return loopBeats((sec?.chords ?? []).map((c) => c.bars)) / 4;
  }

  dropInfo(): { comp: number; ref: number; measured: number; steady: number; followed: number; live: number; most: number; dropped: number; thinned: number; wind: { at: number; bar: number; steps: WindBar[] } | null; follower: boolean; mix: { lp: number; hp: number; pump: number } } | null {
    const g = this.graph;
    if (!g) return null;
    const d = g.drop;
    const out = {
      comp: d.compValue,
      ref: this.dropRef,
      measured: this.dropMeasured,
      steady: this.compSteady.get(this.seq.song.style ?? "") ?? 1,
      followed: this.dropFollowed,
      live: d.live,
      most: d.most,
      dropped: d.dropped,
      thinned: d.thinned,
      wind: d.windLog,
      follower: !!this.dropWatch,
      mix: g.mixState(),
    };
    d.most = d.live;
    return out;
  }

  /**
   * For the smoke test (P10b, second fix): the most overlay voices sounding at once on the audio clock in each of `n`
   * bars of `bar` seconds from audio time `a`, from start to let-go (`Sounding`).
   */
  dropVoices(a: number, bar: number, n: number): number[] {
    return this.graph ? this.graph.drop.voiceBars(a, bar, n) : [];
  }

  /** For the smoke test (P10b, second fix): the overlay's levels, spread and follower's gain as the audio thread has them, with the audio time. */
  dropParams(): { t: number; levels: number[]; spread: number; comp: number } | null {
    return this.graph ? this.graph.drop.params() : null;
  }

  private stereoWatch: EnergyWatch | null = null;
  private layersWatch: EnergyWatch | null = null;

  /**
   * For the smoke test (P10b): the drop's extra layers' own sound (the overlay's four pairs, before they join the
   * music) since the last call: its energy, width and peak (the first call starts the watch).
   */
  async dropLayers(): Promise<Energy | null> {
    if (!this.graph) return null;
    if (!this.layersWatch) {
      this.layersWatch = await EnergyWatch.make(Tone.getContext());
      this.graph.drop.tapLayers(this.layersWatch.node);
    }
    return this.layersWatch.read();
  }

  /**
   * For the smoke test (P10): the master output's energy, stereo width (side over mid) and peak since the last call
   * (the first call starts the watch).
   */
  async stereo(): Promise<Energy | null> {
    if (!this.graph) return null;
    if (!this.stereoWatch) {
      this.stereoWatch = await EnergyWatch.make(Tone.getContext());
      this.graph.tap(this.stereoWatch.node);
    }
    return this.stereoWatch.read();
  }

  /**
   * The extra layers' levels: the recipe's amounts, a little more with the width, and sized to the section's own level
   * (its energy before the build against a typical groove's, -19 dB), so a loud drone gets layers as large, relative to
   * it, as a quiet groove does. The follower then brings the whole to the section's loudness.
   */
  private dropLevels(r: DropRecipe): Record<OverlayGroup, number> {
    return recipeLevels(r, this.dropRef);
  }

  /** Back to normal at once: Stop, a song loaded, a vibe landing. */
  private dropReset(time?: number): void {
    const was = this.dropper.active || this.dropRec !== null;
    this.dropper.reset();
    this.dropPlan = DROP_OFF;
    this.dropRec = null;
    this.dropSection = null;
    this.dropIntent = "none";
    this.dropHeard = { phase: "off", index: 0, length: 0, barsLeft: 0 };
    this.sustain = {};
    this.dropWindow = [];
    this.windSteps = null;
    this.pumpShare = 1;
    if (!this.graph || !was) return;
    if (time === undefined) this.graph.drop.reset();
    else this.graph.drop.end(time);
    if (this.dropMixOn) {
      this.dropMixOn = false;
      this.graph.setMix("sweep", mixValue(this.mix, "sweep"), time);
      this.graph.setMix("pump", mixValue(this.mix, "pump"), time);
    }
  }

  /** The conductor's bar line at audio time `time`, before the sequencer plays the bar (spec 8.9). */
  private dropBarLine(time: number, bar: number): void {
    const g = this.graph!;
    if (this.seq.songQueued) {
      // A vibe lands on this bar line: the drop ends with the song it was on.
      if (this.dropper.active || this.dropRec) {
        this.dropReset(time);
        this.showDrop(time);
      }
      return;
    }
    if (!this.dropper.active && this.dropPlan.phase === "off") return;
    const rec = this.dropRec ?? this.dropRecipe();
    const plan = this.dropper.bar(rec.build, rec.wind);
    this.dropPlan = plan;
    const barSec = 240 / Tone.getTransport().bpm.value;
    const six = barSec / 16;
    if (plan.phase === "build" && plan.index === 0) {
      this.dropRec = rec;
      this.dropWindow = [];
      g.drop.dropped = 0;
      const e = [...this.beatEnergy.values()];
      this.dropRefs = new Map(this.beatEnergy);
      this.dropRef = e.length ? e.reduce((a, b) => a + b, 0) / e.length : 0;
      this.dropLast = this.lastBeats.length ? this.lastBeats.reduce((a, b) => a + b, 0) / this.lastBeats.length : this.dropRef;
      this.dropHand = false;
      g.drop.begin(time, rec, barSec * plan.length, this.dropLevels(rec));
    }
    if (plan.phase === "build") {
      const cliff = plan.cliff && rec.cliff !== "none";
      const cut = cliff ? (rec.cliffLength === "beat" ? 12 : 8) : 16;
      if (rec.parts.roll) g.drop.roll(time, six, rollHits(plan.index, plan.length, cut));
      // P10 review M5: Hold hangs the section's own chord at the cliffhanger, whether or not the synth plays.
      if (cliff) g.drop.cliff(time + cut * six, time + barSec, rec.cliff as "gap" | "hold", this.seq.chordAhead(cut));
    }
    if (plan.impact) {
      // P10 review S1: the gain starts at the vibe's last settled gain (1 the first time); a bloom has no step at all.
      g.drop.impact(time, rec, barSec, this.dropLevels(rec), rec.bloom ? null : (this.compSteady.get(this.seq.song.style ?? "") ?? 1));
      // The impact bar is an event, not the drop: the follower starts on the bar after it (the reading on its first
      // beat line holds the cliffhanger's last beat, so five readings).
      this.dropSkip = rec.bloom ? 0 : 5;
      this.dropFollowed = 0;
      this.dropOnBeats = 0;
      this.dropSettled = 1;
      if (!rec.bloom) this.dropWindow = [];
      this.dropMixOn = true;
      g.setMix("sweep", 0, time);
      g.setMix("pump", mixValue(this.mix, "pump") + rec.pump);
    }
    if (plan.phase === "wind") this.windBar(time, barSec, plan, rec);
    if (plan.end) {
      this.windSteps = null;
      this.pumpShare = 1;
      g.drop.end(time);
      if (this.dropMixOn) {
        this.dropMixOn = false;
        g.setMix("sweep", mixValue(this.mix, "sweep"), time);
        g.setMix("pump", mixValue(this.mix, "pump"));
      }
      this.dropRec = null;
      this.sustain = {};
      // A section tapped during the drop lands on this bar line, with the music back at its normal size.
      if (this.dropSection !== null) {
        const s = this.dropSection;
        this.dropSection = null;
        this.seq.switchSection(s);
      }
    }
    // What the instruments hold over this bar line is doubled once, from the first bar line the extra layers sound,
    // until it lets go (P10 review S8).
    if (this.dropRec && this.doubling())
      for (const [id, h] of Object.entries(this.sustain))
        if (h.until > time + 0.01 && !g.drop.holding(id) && this.mayHold(id)) this.holdOver(id as Exclude<InstrumentId, "drums">, h.notes, time, h.until - time, h.vel, h.pad);
    this.dropMarks.push({ ...plan, bar, at: time });
    if (this.dropMarks.length > 48) this.dropMarks.shift();
    this.showDrop(time);
  }

  /**
   * P10b (C21, spec 8.9): one bar line of the wind-down. On its first the overlay schedules every bar's steps (levels,
   * spread, the follower's gain, a bloom's reverb, the voices let in); on each the pump steps down and the held notes
   * it doubles leave, the layers first and the bass last, so a share goes every bar. The Filter knob waits for the end.
   */
  private windBar(time: number, barSec: number, plan: DropBar, rec: DropRecipe): void {
    const g = this.graph!;
    const knob = mixValue(this.mix, "pump");
    if (plan.index === 0) {
      const held = g.drop.heldKeys();
      this.windKeep = new Set(held);
      this.windSteps = g.drop.wind(time, barSec, plan.length, { from: this.dropMixOn ? knob + rec.pump : knob, to: knob }, held.length);
    }
    const step = this.windSteps?.[plan.index];
    if (!step) return;
    this.pumpShare = 1 - (plan.index + 0.5) / plan.length;
    if (this.dropMixOn) g.setMix("pump", step.pump);
    const order = ["layer2", "layer1", "synth", "bass"].filter((id) => this.windKeep.has(id));
    while (order.length > step.held) {
      const id = order.shift()!;
      this.windKeep.delete(id);
      g.drop.letGo(id, time);
    }
    // P10b (second fix): from the second bar line, fewer voices than sounded in the bar before (spec 8.9).
    if (plan.index > 0) g.drop.windLine(time, plan.index);
  }

  /** Whether an instrument's held notes may be doubled now: in a wind-down only those it still keeps. */
  private mayHold(id: string): boolean {
    return this.dropPlan.phase !== "wind" || this.windKeep.has(id);
  }

  /** The attacks (seconds) of a section's sounding instruments: a layer in Pad or Drone mode by its pad dials. */
  private sectionAttacks(index: number): number[] {
    const song = this.seq.song;
    const sec = song.sections[index];
    if (!sec) return [];
    return INSTRUMENTS.filter((id) => id !== "drums" && sec.on[id]).map((id) => {
      const l = id === "layer1" || id === "layer2" ? sec[id] : null;
      return l && (l.mode === "pad" || l.mode === "drone") ? l.pad.attack : song.patches[id].attack;
    });
  }

  /** One instrument's notes into its extra layer (`soft`: a slow attack and release, for notes carried over a bar line). */
  private doubleNotes(id: Exclude<InstrumentId, "drums">, notes: number[], t: number, dur: number, vel: number, soft: boolean, pad: boolean): void {
    const ov = this.graph!.drop;
    if (id === "bass") ov.bass(notes[0], t, dur, vel, soft);
    else if (id === "synth") ov.synth(notes, t, dur, vel, soft);
    else ov.lead(notes, t, dur, vel, pad);
  }

  /** An instrument's held notes into its extra layer, one voice set until they let go (P10 review S8). */
  private holdOver(id: Exclude<InstrumentId, "drums">, notes: number[], t: number, dur: number, vel: number, pad: boolean): void {
    this.graph!.drop.holdNotes(id, id === "bass" ? "bass" : id === "synth" ? "synth" : "lead", notes, t, dur, vel, pad);
  }

  /** What an instrument held lets go at `t`: in the song and, while the drop doubles it, in the extra layer. */
  private unsustain(id: Exclude<InstrumentId, "drums">, t: number): void {
    delete this.sustain[id];
    this.graph?.drop.letGo(id, t);
  }

  /** The extra layers sound: the drop is on or winding down, or a bloom is building. */
  private doubling(): boolean {
    const p = this.dropPlan.phase;
    return !!this.dropRec && (p === "on" || p === "wind" || (p === "build" && this.dropRec.bloom));
  }

  /** The button follows what is heard: its phase changes on the bar line, on the audio clock. */
  private showDrop(time: number): void {
    const v = this.dropper.view();
    const heard = { phase: v.phase, index: v.length - v.barsLeft, length: v.length, barsLeft: v.barsLeft };
    const run = this.run;
    Tone.getDraw().schedule(() => {
      if (run !== this.run) return;
      this.dropHeard = heard;
      this.dropIntent = this.dropper.intent;
      this.changed();
    }, time);
  }

  /** The build's changes to the bar's notes (hats out, the kick out for the last bar, the lead climbing). */
  private dropEvents(events: StepResult["events"]): StepResult["events"] {
    const rec = this.dropRec;
    const p = this.dropPlan;
    if (!rec || p.phase !== "build") return events;
    const last = p.index === p.length - 1;
    const climb = rec.parts.climb && p.index >= p.length / 2;
    return events
      .filter((e) => !(e.inst === "drums" && ((rec.parts.hatsOut && (e.voice === "hat" || e.voice === "open")) || (rec.parts.kickOut && last && e.voice === "kick"))))
      .map((e) =>
        climb && (e.inst === "layer1" || e.inst === "layer2") && e.mode === "generative" && !e.hold && e.glide === undefined
          ? { ...e, notes: e.notes.map((n) => n + 12), glideFrom: e.glideFrom === undefined ? undefined : e.glideFrom + 12 }
          : e,
      );
  }

  /**
   * The level follower, every beat. At normal size it keeps the energy (K-weighted, P10 review S7) of each beat by
   * its place in the section's loop (`key`, P10 review S5: its chord cycle repeated to 8 bars or more): the section's
   * own level, beat by beat. While the drop sounds it compares each beat with the same beat of the loop before the
   * build, as it would be at a gain of 1, and sets the overlay's gain to bring the last four beats to the section's
   * level. Read after the limiter, so it settles where what is heard matches the section.
   * P10 review S1, S2: it acts through a bloom's build and the first FOLLOW_BEATS beats after the impact's bar (3 dB a
   * beat at most in the first bar, then FINE_DB with a DEADBAND_DB dead band), then holds: from there a knob, a level or
   * an instrument switched during the drop is heard as moved. The wind-down brings the gain back to 1 with the layers.
   */
  private dropFollow(e: Energy, phase: DropPhase, ready: boolean, key: number): void {
    if (phase === "off" && !this.dropper.active) {
      if (ready) {
        this.beatEnergy.set(key, e.energy);
        this.lastBeats.push(e.energy);
        if (this.lastBeats.length > 4) this.lastBeats.shift();
      }
      return;
    }
    const bloomBuild = phase === "build" && !!this.dropRec?.bloom;
    if (phase !== "on" && !bloomBuild) return;
    // P10b: a reading taken before the wind-down that arrives after it began never moves the gain.
    if (this.dropPlan.phase === "wind" || this.dropPlan.phase === "off") return;
    if (this.dropSkip > 0) return void this.dropSkip--;
    if (this.dropHand || !this.graph || !(this.dropRef > 0)) return;
    if (phase === "on") this.dropOnBeats++;
    const settling = !(phase === "on" && this.dropFollowed >= FOLLOW_BEATS);
    // P10 fix: each beat against the same place of the section's loop; while a punchy drop settles, a place not heard
    // before the build is read against the section's last bar before it; a bloom, and any drop once settled, moves
    // the gain only on heard places (C27, `followFallback`).
    const ref = followRef(this.dropRefs, key, followFallback(!!this.dropRec?.bloom, settling, this.dropLast));
    if (ref === null) return;
    const c = Math.max(0.05, this.graph.drop.compValue);
    this.dropWindow.push({ e: e.energy, c, ref });
    if (this.dropWindow.length > 4) this.dropWindow.shift();
    const w = this.dropWindow;
    this.dropMeasured = w.reduce((a, b) => a + b.e, 0) / w.length;
    const ratio = w.reduce((a, b) => a + b.e / (b.c * b.c * b.ref), 0) / w.length;
    if (!(ratio > 0)) return;
    const aim = 1 / Math.sqrt(ratio);
    if (!settling) {
      // Settled: it keeps the drop with the section as the section's own level moves (a long reverb or attack still
      // building), slowly (TRACK_DB a beat on a TRACK_TAU curve) and within TRACK_RANGE_DB of where it settled.
      const target = followStep(c, trackBound(aim, this.dropSettled, TRACK_RANGE_DB), TRACK_DB, DEADBAND_DB, COMP_TOP);
      if (target !== c) this.graph.drop.setComp(target, undefined, TRACK_TAU);
      return;
    }
    // Coarse only in the drop's first bar (after the impact's bar): later moves are fine and slow.
    const coarse = phase === "on" && this.dropFollowed < 4 && this.dropOnBeats <= 4 && !this.dropRec?.bloom;
    const target = followStep(c, aim, coarse ? 3 : FINE_DB, coarse ? 0 : DEADBAND_DB, COMP_TOP);
    if (phase === "on") this.dropFollowed++;
    if (target !== c) this.graph.drop.setComp(target, undefined, coarse ? 0.15 : FINE_TAU);
    if (phase === "on" && this.dropFollowed >= FOLLOW_BEATS) {
      this.dropSettled = Math.max(0.2, target);
      this.compSteady.set(this.seq.song.style ?? "", this.dropSettled);
    }
  }

  // ---- Morph (P11, spec 8.11) ---------------------------------------------------------

  /** Morph as the song plays it: the vibe's limits with the Morph page's settings over them. */
  morphPlan(): MorphPlan {
    const song = this.seq.song;
    return resolveMorph(song.style ? VIBES[song.style]?.morph : undefined, song.morph, song.style ?? song.name);
  }

  /** The Morph page's settings as the song holds them (a copy). */
  getMorphSettings(): MorphSettings {
    const m = this.seq.song.morph;
    return m ? { ...m, ...(m.moves ? { moves: { ...m.moves } } : {}) } : {};
  }

  /**
   * The Morph button and the Morph page: on or off, Speed, Depth and a switch per thing it may move. Stored in the
   * song, acting from the next bar line. Returns false when refused. Recorded.
   */
  setMorph(values: MorphSettings): boolean {
    const errors: string[] = [];
    checkMorphSettings(values, "morph", errors);
    if (errors.length) return false;
    const cur = this.seq.song.morph ?? {};
    const next: MorphSettings = { ...cur, ...values };
    if (values.moves) next.moves = { ...cur.moves, ...values.moves };
    this.seq.song.morph = next;
    this.note("setMorph", [values]);
    this.changed();
    return true;
  }

  /** The journey's next bar to plan (bars planned so far), for the smoke test; 0 before one starts. */
  morphBar(): number {
    return this.morphPlanner?.bars ?? 0;
  }

  /** Whether a control is left alone: moved by hand within the last HANDS_BARS bars (spec 8.11). */
  morphHeld(control: string): boolean {
    const t = this.morphHands.get(control);
    return t !== undefined && this.morphClock - t <= HANDS_BARS;
  }

  /** P11: a hand moved a control: Morph leaves it alone for HANDS_BARS bars. Names as `controlOf` in music/morph.ts. */
  private markHand(op: LogOp, a: unknown[]): void {
    const mark = (c: string): void => void this.morphHands.set(c, this.morphClock);
    const patchKeys = (inst: unknown, keys: string[]): void => {
      for (const m of MORPH_MACROS)
        if (m.inst === inst && findMacro(m.inst, m.id)?.targets.some((t) => t.kind === "patch" && keys.includes(t.key))) mark(`macro:${m.inst}.${m.id}`);
    };
    const keys = (v: unknown): string[] => (v && typeof v === "object" ? Object.keys(v) : []);
    switch (op) {
      case "setParam":
      case "releaseMacros":
        return patchKeys(a[0], [String(a[1])]);
      case "setParams":
        return patchKeys(a[0], keys(a[1]));
      case "setMacro":
        if (a[2] === "bright" || a[2] === "space") mark(`macro:${String(a[1])}.${a[2]}`);
        if (a[2] === "evolve") mark(`lock:${String(a[1])}`);
        return;
      case "setGen":
        if (keys(a[2]).includes("lock")) mark(`lock:${String(a[1])}`);
        return;
      case "setPad":
        if (keys(a[2]).includes("voicing")) mark(`voicing:${String(a[1])}`);
        return;
      case "setLayerMode":
      case "setDrone":
        mark(`voicing:${String(a[1])}`);
        mark(`lock:${String(a[1])}`);
        return;
      case "toggleInstrument":
        return mark(`on:${String(a[1])}`);
      case "switchSection":
        return mark("section");
    }
  }

  /** P11: what Morph sees of the playing section at a bar line. */
  private morphView(): Parameters<MorphPlanner["bar"]>[1] {
    const song = this.seq.song;
    const si = this.seq.section;
    const sec = song.sections[si];
    const macros: Record<string, number> = {};
    for (const m of MORPH_MACROS) macros[`${m.inst}.${m.id}`] = macroPosition(song, si, m.inst, m.id);
    const layer = (id: LayerInstrument) => ({ mode: sec[id].mode, lock: sec[id].gen.lock, voicing: sec[id].pad.voicing ?? 0.5 });
    return {
      section: si,
      sections: song.sections.length,
      loopBars: Math.max(1, Math.ceil(sec.chords.reduce((a, c) => a + c.bars, 0))),
      sectionBar: this.seq.sectionBar,
      macros,
      on: { ...sec.on },
      layers: { layer1: layer("layer1"), layer2: layer("layer2") },
      sounding: song.sections.map((s) => INSTRUMENTS.filter((id) => s.on[id]).length),
    };
  }

  /**
   * P11: Morph at a bar line, before the sequencer plays the bar: its moves land on this bar line (toggles and a section
   * switch with the queue, values ramped as a hand's). It holds while a drop runs and while a song waits to land.
   */
  private morphBarLine(time?: number): void {
    this.morphClock++;
    this.morphDropHeld = false;
    if (this.seq.songQueued) {
      // A vibe lands on this bar line: its journey starts with it (this is its first bar).
      const q = this.queued;
      // P11 review E1: the old song's journey ends with it. What it owed is not made here (the sequencer drops the old
      // song's queue on this bar line); its document was saved whole, as getDocument gives back what Morph owes.
      const plan = q ? resolveMorph(q.style ? VIBES[q.style]?.morph : undefined, q.morph, q.style ?? q.name) : null;
      this.morphPlanner = plan ? new MorphPlanner(plan.seed) : null;
      this.morphPlanner?.pass();
      // The trace (smoke test) follows the new journey from its first bar.
      if (this.traceOn) {
        this.traceBar = null;
        this.morphTrace.length = 0;
        this.morphMoves.length = 0;
      }
      return;
    }
    const plan = this.morphPlan();
    if (!this.morphPlanner || this.morphPlanner.seed !== plan.seed) {
      // P11 review E1: a new seed is a new journey: the old one gives back what it owes first.
      this.morphRelease(time);
      this.morphPlanner = new MorphPlanner(plan.seed);
    }
    const planner = this.morphPlanner;
    this.morphDropHeld = plan.on && (this.dropper.active || this.dropRec !== null);
    if (!plan.on || this.morphDropHeld) {
      // P11 review E1 and S1: Morph switched off, or a drop starting, gives back what Morph owes on this bar line (the
      // drop plays every instrument of the section), then the journey's clock goes on without moves.
      this.morphRelease(time);
      return void planner.pass();
    }
    const bar = planner.bars;
    this.morphApply(planner.bar(plan, this.morphView(), (c) => this.morphHeld(c)), plan, bar, time);
  }

  /** P11 review E1: whether a move Morph owes back is still owed (no hand has made it moot or holds that control). */
  private morphOwes(m: MorphMove): boolean {
    if (m.kind !== "toggle" && m.kind !== "lock") return false;
    const sec = this.seq.song.sections[m.section];
    if (!sec) return false;
    if (m.kind === "toggle") return !sec.on[m.inst] && !this.morphHeld(`on:${m.inst}`);
    return sec[m.layer].gen.lock !== m.lock && !this.morphHeld(`lock:${m.layer}`);
  }

  /**
   * P11 review E1: Morph gives back at once, through the same calls, what it owes (the instrument it has out, the Locks
   * it has eased) and forgets it. Playing, a toggle of the playing section lands on the next bar line (at a bar line, on
   * this one).
   */
  private morphRelease(time?: number): void {
    const planner = this.morphPlanner;
    if (!planner) return;
    const moves = planner.release().filter((m) => this.morphOwes(m));
    if (moves.length) this.morphApply(moves, this.morphPlan(), planner.bars, time);
  }

  /** Morph's moves of a bar line made, logged as Morph's; listeners hear them once, on the bar (`time`). */
  private morphApply(moves: MorphMove[], plan: MorphPlan, bar: number, time?: number): void {
    if (!moves.length) return;
    this.morphing = true;
    this.morphChanged = false;
    try {
      for (const m of moves) this.morphMove(m, plan, bar);
    } finally {
      this.morphing = false;
    }
    if (!this.morphChanged) return;
    if (time !== undefined && this.graph) Tone.getDraw().schedule(() => this.changed(), time);
    else this.changed();
  }

  private morphMade(bar: number, op: LogOp, a: unknown[]): void {
    this.morphMoves.push({ bar, op, a: JSON.parse(JSON.stringify(a)) as unknown[] });
    if (this.morphMoves.length > MORPH_KEEP) this.morphMoves.shift();
  }

  /** One of Morph's moves, made through the call a hand makes. */
  private morphMove(m: MorphMove, plan: MorphPlan, bar: number): void {
    const si = this.seq.section;
    switch (m.kind) {
      case "macro": {
        // A macro whose values stand away from its dial (a vibe's own sends, an Advanced edit) is brought to it a step a
        // bar, value by value (setParams), never in one jump; then the dial moves them together (setMacro).
        const def = findMacro(m.inst, m.id)!;
        const patch = this.seq.song.patches[m.inst];
        const step = morphStep(plan) * 1.5;
        const values: Partial<Record<NumericPatchKey, number>> = {};
        let there = true;
        for (const t of def.targets) {
          if (t.kind !== "patch") continue;
          const want = targetValue(t, m.pos);
          const cur = patch[t.key];
          const max = step * Math.abs(t.to - t.from);
          const next = Math.abs(want - cur) <= max ? want : cur + Math.sign(want - cur) * max;
          if (Math.abs(next - want) > 1e-6) there = false;
          values[t.key] = Math.round(next * 1e4) / 1e4;
        }
        if (there) {
          this.setMacro(si, m.inst, m.id, m.pos);
          this.morphMade(bar, "setMacro", [si, m.inst, m.id, m.pos]);
        } else {
          this.setParams(m.inst, values);
          this.morphMade(bar, "setParams", [m.inst, values]);
        }
        return;
      }
      case "lock":
        this.setGen(m.section, m.layer, { lock: m.lock });
        return this.morphMade(bar, "setGen", [m.section, m.layer, { lock: m.lock }]);
      case "voicing":
        this.setPad(m.section, m.layer, { voicing: m.voicing });
        return this.morphMade(bar, "setPad", [m.section, m.layer, { voicing: m.voicing }]);
      case "toggle":
        this.toggleInstrument(m.section, m.inst);
        return this.morphMade(bar, "toggleInstrument", [m.section, m.inst]);
      case "section":
        this.switchSection(m.index);
        return this.morphMade(bar, "switchSection", [m.index]);
    }
  }

  /** For the smoke test: start (or stop) keeping each scheduled bar's trace, cleared. */
  morphTraceOn(on: boolean): void {
    this.traceOn = on;
    this.traceBar = null;
    this.morphTrace.length = 0;
    this.morphMoves.length = 0;
  }

  /** P11: the bar's notes into the trace; at a bar line the last bar is closed and the state Morph moves is read. */
  private traceStep(r: StepResult): void {
    if (!this.traceOn) return;
    if (r.step === 0) {
      this.closeTrace();
      const song = this.seq.song;
      const sec = song.sections[r.section];
      const state = sec
        ? JSON.stringify([
            r.section,
            sec.on,
            MORPH_MACROS.map((m) => Math.round(macroPosition(song, r.section, m.inst, m.id) * 1000)),
            (["bass", "synth", "layer1", "layer2"] as const).map((id) => {
              const p = song.patches[id];
              return [p.cutoff, p.envAmount, p.delay, p.reverb].map((x) => Math.round(x * 1e4));
            }),
            LAYER_IDS.map((id) => [sec[id].mode, sec[id].pad.voicing ?? 0.5, sec[id].gen.lock]),
          ])
        : "";
      const bar = this.morphPlanner ? this.morphPlanner.bars - 1 : -1;
      this.traceBar = { bar, section: r.section, state, events: [], notes: 0, out: [], held: this.morphDropHeld };
    }
    const t = this.traceBar;
    if (!t) return;
    const song = this.seq.song;
    for (const e of r.events) {
      if (e.inst === "drums") t.events.push(`${r.step}d${e.voice}`);
      else {
        const notes = e.inst === "bass" ? [e.midi] : e.notes;
        t.events.push(`${r.step}${e.inst}${notes.join(".")}:${Math.round(e.len * 100)}`);
        for (const n of notes) {
          t.notes++;
          if (!inScale(n, song.key, song.mood)) t.out.push(n);
        }
      }
    }
  }

  private closeTrace(): void {
    const t = this.traceBar;
    if (!t) return;
    const hash = (text: string): string => {
      let h = 0x811c9dc5;
      for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
      return h.toString(16);
    };
    const tune = t.events.join(",");
    this.morphTrace.push({ bar: t.bar, section: t.section, sig: hash(t.state + "|" + tune), tune: hash(tune), notes: t.notes, out: t.out, held: t.held });
    if (this.morphTrace.length > MORPH_KEEP) this.morphTrace.shift();
    this.traceBar = null;
  }

  /**
   * For the tests and the smoke test: play `bars` bars of the loaded song without audio, as the scheduler would (Morph
   * at every bar line, then the sequencer's steps), from a fresh journey. Returns Morph's moves and each bar's trace.
   * Refused while audio plays. `atBar` runs at each bar line before Morph (a test's hand).
   */
  morphDry(bars: number, atBar?: (bar: number) => void): { moves: MorphMade[]; trace: MorphBar[] } | null {
    if (this.playing) return null;
    // As Play: what the last journey owes is given back, then a new one starts.
    this.morphRelease();
    this.morphTraceOn(true);
    this.seq.start();
    this.morphPlanner = null;
    for (let i = 0; i < bars * STEPS_PER_BAR; i++) {
      if (this.seq.upcoming.step === 0) {
        atBar?.(this.seq.upcoming.bar);
        this.morphBarLine();
      }
      this.traceStep(this.seq.next());
    }
    this.closeTrace();
    this.seq.stop();
    const out = { moves: [...this.morphMoves], trace: [...this.morphTrace] };
    this.morphTraceOn(false);
    // As Stop: Morph gives back what it owes (after the journey's record above, which stops where the bars stop).
    this.morphRelease();
    return out;
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

  /** P8 review S2: a native analyser on one instrument's sound before its effects, for the smoke test's tone check. */
  instrumentScope(id: InstrumentId): AnalyserNode | null {
    return this.graph ? this.graph.instrumentScope(id) : null;
  }

  /** P8 review S1: the second note's pitch after a short note (the oscillator-leak probe), for the smoke test. */
  oscProbe(hz: number, wave: "sine" | "sawtooth" | "square"): Promise<number> {
    return oscProbe(hz, wave);
  }

  /** P8 review S1: the oscillator patch's disconnects and the throws it counted, for the smoke test. */
  oscPatchStats(): { throws: number; disconnects: number } {
    return { ...oscPatchStats };
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
    // P10: the Drop's conductor decides each bar at its bar line, before the sequencer plays it (a section held
    // behind the drop is queued here, so it lands on this very bar line).
    const up = this.seq.upcoming;
    if (up.step === 0) {
      this.dropBarLine(time, up.bar);
      // P11: Morph's moves for this bar, after the Drop's conductor (a drop holds it) and before the bar is played.
      this.morphBarLine(time);
    }
    const r: StepResult = this.seq.next();
    this.traceStep(r);
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
    // P10: the level follower reads every beat; a new section or song starts its reference afresh.
    if (r.applied?.section != null || r.loaded) {
      this.beatEnergy.clear();
      this.lastBeats = [];
      // The landing bar (a new vibe's patches arriving, the last one's tails) is not the section's level: the
      // reference starts on the bar after it.
      this.refFrom = r.bar + 1 + refSettleBars(this.sectionAttacks(r.section), sixteenth * STEPS_PER_BAR);
    }
    if (this.dropWatch && r.step % 4 === 0) {
      const phase = this.dropPlan.phase;
      const ready = r.bar > this.refFrom || (r.bar === this.refFrom && r.step > 0);
      // The reading holds the beat that just ended: its place in the section's loop (P10 review S5).
      const loop = loopBeats((this.seq.song.sections[r.section]?.chords ?? []).map((c) => c.bars));
      const key = (((r.bar * 4 + r.step / 4 - 1) % loop) + loop) % loop;
      const at = { bar: r.bar, step: r.step };
      void this.dropWatch.read().then((e) => {
        // P10 review S8: each beat of the drop as heard, for the smoke test (the reading at a step holds the beat before it).
        if (phase === "on") {
          this.dropBeats.push({ ...at, energy: e.energy });
          if (this.dropBeats.length > 64) this.dropBeats.shift();
        }
        this.dropFollow(e, phase, ready, key);
      });
    }
    const doubling = this.doubling();
    const ov = g.drop;
    if (doubling && this.seq.song.sections[r.section]?.on.drums) ov.drumStep(time, r.step);
    // What the instruments hold lets go where the engine releases it (below): stopped, let go, a new section or chord.
    for (const id of [...r.letGo, ...r.stopped, ...r.restarted]) if (id !== "drums") this.unsustain(id, time);
    if (r.retrigger || (r.applied && r.applied.section !== null))
      for (const id of ["synth", "layer1", "layer2"] as const) if (!(r.kept as string[]).includes(id)) this.unsustain(id, time);
    if (r.retrigger) this.unsustain("bass", time);
    const barEnd = time + (STEPS_PER_BAR - r.step) * sixteenth;
    for (const e of this.dropEvents(r.events)) {
      const t = time + e.shift * sixteenth; // swing: every instrument on an odd step moves together
      if (e.inst !== "drums") {
        const notes = e.inst === "bass" ? [e.midi] : e.notes;
        const held = e.inst !== "bass" && e.inst !== "synth" && (e.hold || e.glide !== undefined);
        const pad = e.inst !== "bass" && e.inst !== "synth" && (e.mode === "pad" || e.mode === "drone");
        const until = held ? Infinity : t + e.len * sixteenth;
        // A note that outlasts its bar is kept, and doubled once for as long as it sounds (P10 review S8); a new note
        // of the instrument replaces what it held.
        const long = until > barEnd + 0.01 && notes.length > 0;
        if (long) this.sustain[e.inst] = { notes, vel: e.vel, until, pad };
        else if (notes.length) this.unsustain(e.inst, t);
        if (doubling && long) {
          if (this.mayHold(e.inst)) this.holdOver(e.inst, notes, t, until - t, e.vel, pad);
          else this.unsustain(e.inst, t);
        }
        else if (doubling && notes.length) this.doubleNotes(e.inst, notes, t, until - t, e.vel, false, pad);
      }
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
    const run = this.run;
    Tone.getDraw().schedule(() => {
      // P10d: a position of a run already stopped would show the stopped transport as playing.
      if (run !== this.run) return;
      this.inFlight.reach(p.bar);
      this.emit(gen === this.layoutGen ? p : { ...p, section: this.seq.section });
    }, time);
  }

  /** Tell listeners the song changed; when sections moved, the position's index may have too. */
  private changed(reindexed = false): void {
    // P11: Morph's moves are made inside the scheduler's callback: the screen and the autosave hear them once, when
    // the bar they land on is heard (morphBarLine), not from the audio clock's callback.
    if (this.morphing && !reindexed) {
      this.morphChanged = true;
      return;
    }
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
