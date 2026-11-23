/**
 * Step sequencer: turns the song into note events one sixteenth at a time and applies queued
 * switches on the bar line. Pure: no audio dependency, so it is unit-tested. The Tone layer only
 * renders what this returns, at audio-clock times computed ahead.
 */
import { ARP_DIRECTIONS, arpNote, type ArpParams } from "../music/arp.ts";
import { buildChord, type Chord } from "../music/chords.ts";
import { GenerativeLead, nextSeed, type LeadParams, type LeadStepView } from "../music/lead.ts";
import {
  BASS_PRESETS,
  BASS_RHYTHMS,
  DRUM_PATTERNS,
  DRUM_PRESETS,
  DRUM_VOICES,
  SEQ_STEPS,
  SEQ_VELOCITY,
  SYNTH_PRESETS,
  SYNTH_RHYTHMS,
  copyGrid,
  toggleEighth,
  nextHitGap,
  type BassPreset,
  type DrumPreset,
  type DrumVoice,
  type SynthPreset,
} from "../music/presets.ts";
import { createRng, deriveSeed, type Rng } from "../music/random.ts";
import { PAD_TRIM } from "../music/sound.ts";
import { scalePitchClasses, type KeyName, type Mood } from "../music/scales.ts";
import { SwitchQueue, type Pending } from "./queue.ts";
import {
  cloneSong,
  INSTRUMENTS,
  LAYER_IDS,
  LAYER_MODES,
  LIMITS,
  MAX_SECTION_NAME,
  newSection,
  sectionDrumGrid,
  sectionSwing,
  MAX_SWING,
  SEED_HISTORY,
  validChords,
  type ChordStep,
  type InstrumentId,
  type LayerInstrument,
  type LayerMode,
  type PadParams,
  type Section,
  type Song,
} from "./song.ts";

export const STEPS_PER_BAR = 16;

/**
 * One note or hit. `shift` is the swing delay in sixteenths: on odd steps of a swung section every
 * instrument carries the drum pattern's swing, so bass and synth stay with the hats.
 */
export type NoteEvent =
  | { inst: "drums"; voice: DrumVoice; vel: number; shift: number; gap: number }
  | { inst: "bass"; midi: number; len: number; vel: number; shift: number }
  | { inst: "synth"; notes: number[]; len: number; vel: number; shift: number }
  | {
      inst: LayerInstrument;
      mode: LayerMode;
      notes: number[];
      len: number;
      vel: number;
      shift: number;
    };

export interface StepResult {
  /** Bars since play, counting from 0. */
  bar: number;
  /** Position in the bar, 0..15. */
  step: number;
  /** Section playing at this step. */
  section: number;
  events: NoteEvent[];
  /** Switches that landed on this step (only ever on step 0). */
  applied: Pending | null;
  /** Instruments that stopped sounding at this step: their notes should be released. */
  stopped: InstrumentId[];
  /**
   * The key, mood or chord sequence of the playing section changed since the last step: held
   * chords and pads should let go, and this step restarts them on the new chord.
   */
  retrigger: boolean;
  /**
   * Bass or synth whose rhythm preset changed in the playing section since the last step: held
   * notes should let go, and this step restarts any note the new rhythm holds now.
   */
  restarted: InstrumentId[];
  /**
   * Per layer, the pad settings when the playing section has it in Pad mode, else null: the engine
   * sets the layer's envelope and pad filter from this on every step, so pad dials act at once.
   */
  pads: Record<LayerInstrument, PadParams | null>;
}

/**
 * One note of an instrument's lane (spec 8.12): where it starts in the bar (`step`, 0..15, plus the swing
 * `shift`), how long it sounds in sixteenths (cut at the bar's end only when drawn), and what it is: a
 * pitch (MIDI) or a drum voice. A note held over from the bar before starts at step 0 with `held` set.
 */
export interface LaneNote {
  step: number;
  len: number;
  shift: number;
  vel: number;
  pitch?: number;
  voice?: DrumVoice;
  held?: boolean;
}

export type LaneNotes = Record<InstrumentId, LaneNote[]>;

/**
 * One bar of every instrument as notes, for the lanes. `on`: which instruments sound in this bar. For
 * those, `notes` is what the scheduler plays (or will play, as the song stands now); for an instrument
 * that is off, `notes` is what it would play if it were on, drawn greyed.
 */
export interface LaneBar {
  /** Bars since play, from 0 (0 when stopped: the bar Play starts with). */
  bar: number;
  section: number;
  playing: boolean;
  on: Record<InstrumentId, boolean>;
  notes: LaneNotes;
}

interface BarRecord {
  bar: number;
  section: number;
  on: Record<InstrumentId, boolean>;
  notes: LaneNotes;
  /** The sequencer as it stood just before this bar's first step (for the off instruments' preview). */
  snap: Sequencer | null;
}

function emptyNotes(): LaneNotes {
  return { drums: [], bass: [], synth: [], layer1: [], layer2: [] };
}

/** Events of one step as lane notes. */
function laneNotes(step: number, events: NoteEvent[], into: LaneNotes): void {
  for (const e of events) {
    if (e.inst === "drums") into.drums.push({ step, len: 1, shift: e.shift, vel: e.vel, voice: e.voice });
    else if (e.inst === "bass") into.bass.push({ step, len: e.len, shift: e.shift, vel: e.vel, pitch: e.midi });
    else for (const n of e.notes) into[e.inst].push({ step, len: e.len, shift: e.shift, vel: e.vel, pitch: n });
  }
}

function cloneNotes(n: LaneNotes): LaneNotes {
  const out = emptyNotes();
  for (const id of INSTRUMENTS) out[id] = n[id].map((x) => ({ ...x }));
  return out;
}

/** Clamp a number into [lo, hi]; null for anything that is not a finite number. */
function num(v: unknown, lo: number, hi: number, int = false): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const x = Math.max(lo, Math.min(hi, v));
  return int ? Math.round(x) : x;
}

export interface ChordPosition {
  chord: Chord;
  /** True on the first step of this chord. */
  starts: boolean;
  /** Steps left in this chord, this one included. */
  remaining: number;
  /** Steps of this chord already played before this one. */
  elapsed: number;
}

/** Which chord of a section plays `sectionStep` steps after the section started. */
export function chordAt(song: Song, section: Section, sectionStep: number): ChordPosition {
  const lens = section.chords.map((c) => Math.round(c.bars * STEPS_PER_BAR));
  const total = lens.reduce((a, b) => a + b, 0);
  let pos = sectionStep % total;
  for (let i = 0; i < lens.length; i++) {
    if (pos < lens[i]) {
      return { chord: buildChord(song.key, song.mood, section.chords[i].degree), starts: pos === 0, remaining: lens[i] - pos, elapsed: pos };
    }
    pos -= lens[i];
  }
  throw new Error("unreachable");
}

export class Sequencer {
  song: Song;
  private queue = new SwitchQueue();
  private running = false;
  private current = 0;
  private globalStep = 0;
  private sectionStep = 0;
  /**
   * Generative leads by section and layer ("2:layer1"). A section entered again keeps its notes
   * (rewound to the bar); Play, a load and a section insert or delete start every lead from its seed.
   */
  private leads = new Map<string, GenerativeLead>();
  private arpIndex = new Map<LayerInstrument, number>();
  private arpRng = new Map<LayerInstrument, Rng>();
  /** Instruments that were sounding at the previous step. */
  private sounding = new Set<InstrumentId>();
  /** Set by a key, mood or chord change; consumed by the next step. */
  private retrigger = false;
  /** Bass or synth rhythm changed in the playing section; consumed by the next step. */
  private restart = new Set<"bass" | "synth" | LayerInstrument>();
  /** The bar being scheduled and the one before, as notes (spec 8.12, the lanes). */
  private rec: BarRecord | null = null;
  private prevRec: BarRecord | null = null;
  /** Look-ahead copies keep their record but take no snapshots of their own. */
  private snaps = true;

  constructor(song: Song) {
    this.song = song;
  }

  get section(): number {
    return this.current;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Start from bar 0 of the current section. Anything pending lands at once. */
  start(): void {
    this.applyPending(this.queue.flush());
    this.running = true;
    this.globalStep = 0;
    this.leads.clear();
    this.enterSection(this.current);
  }

  stop(): void {
    this.running = false;
    this.rec = null;
    this.prevRec = null;
    this.sounding.clear();
    this.retrigger = false;
    this.restart.clear();
  }

  /** Pick a section's drum preset. Acts at once and drops any sequencer edit of that section. */
  setDrumPreset(section: number, preset: DrumPreset): boolean {
    const s = this.song.sections[section];
    if (!s || !(DRUM_PRESETS as readonly string[]).includes(preset)) return false;
    // A swing set by hand stays with the section (the Swing dial shows it); the beat changes under it.
    s.drums = s.drums.swing === undefined ? { preset } : { preset, swing: s.drums.swing };
    return true;
  }

  /** Set a section's swing by hand, 0..MAX_SWING sixteenths (the Swing dial). Acts at once. */
  setSwing(section: number, swing: number): boolean {
    const s = this.song.sections[section];
    const v = num(swing, 0, MAX_SWING, false);
    if (!s || v === null) return false;
    s.drums = { ...s.drums, swing: v };
    return true;
  }

  /**
   * Flip one of the eight sequencer steps of a drum voice. The first edit opens the section's preset
   * in the sequencer (copies its grid); the preset's swing stays. Acts at once.
   */
  toggleDrumStep(section: number, voice: DrumVoice, step: number): boolean {
    const s = this.song.sections[section];
    if (!s || !(DRUM_VOICES as readonly string[]).includes(voice) || !Number.isInteger(step) || step < 0 || step >= SEQ_STEPS)
      return false;
    const grid = s.drums.grid ?? copyGrid(DRUM_PATTERNS[s.drums.preset].grid);
    grid[voice] = toggleEighth(grid[voice], step, SEQ_VELOCITY[voice], DRUM_PATTERNS[s.drums.preset].grid[voice]);
    s.drums.grid = grid;
    return true;
  }

  /** Drop a section's sequencer edit: it plays its preset again. */
  revertDrums(section: number): boolean {
    const s = this.song.sections[section];
    if (!s || !s.drums.grid) return false;
    const { grid: _edit, ...rest } = s.drums;
    s.drums = rest;
    return true;
  }

  /** Pick a section's bass rhythm. Acts at once; in the playing section held bass notes restart. */
  setBassRhythm(section: number, rhythm: BassPreset): boolean {
    const s = this.song.sections[section];
    if (!s || !(BASS_PRESETS as readonly string[]).includes(rhythm)) return false;
    if (s.bass.rhythm === rhythm) return true;
    s.bass.rhythm = rhythm;
    if (this.running && section === this.current) this.restart.add("bass");
    return true;
  }

  /** Pick a section's synth rhythm. Acts at once; in the playing section held chords restart. */
  setSynthRhythm(section: number, rhythm: SynthPreset): boolean {
    const s = this.song.sections[section];
    if (!s || !(SYNTH_PRESETS as readonly string[]).includes(rhythm)) return false;
    if (s.synth.rhythm === rhythm) return true;
    s.synth.rhythm = rhythm;
    if (this.running && section === this.current) this.restart.add("synth");
    return true;
  }

  // ---- Layers (G4) ------------------------------------------------------------------

  /** Switch a layer's mode in a section. Acts at once; in the playing section held notes let go. */
  setLayerMode(section: number, id: LayerInstrument, mode: LayerMode): boolean {
    const s = this.song.sections[section];
    if (!s || !(LAYER_IDS as readonly string[]).includes(id) || !(LAYER_MODES as readonly string[]).includes(mode)) return false;
    if (s[id].mode === mode) return true;
    s[id].mode = mode;
    if (this.running && section === this.current) this.restart.add(id);
    return true;
  }

  /** Change arp settings. Acts from the next step; unknown or out-of-range values are refused. */
  setArp(section: number, id: LayerInstrument, values: Partial<ArpParams>): boolean {
    const s = this.song.sections[section];
    if (!s || !(LAYER_IDS as readonly string[]).includes(id)) return false;
    const a = { ...s[id].arp };
    if (values.direction !== undefined) {
      if (!(ARP_DIRECTIONS as readonly string[]).includes(values.direction)) return false;
      a.direction = values.direction;
    }
    if (values.rate !== undefined) {
      if (![1, 2, 4].includes(values.rate)) return false;
      a.rate = values.rate;
    }
    if (values.octaves !== undefined) {
      if (![1, 2, 3].includes(values.octaves)) return false;
      a.octaves = values.octaves;
    }
    if (values.gate !== undefined) {
      const g = num(values.gate, 0.1, 1);
      if (g === null) return false;
      a.gate = g;
    }
    s[id].arp = a;
    return true;
  }

  /** Change pad settings. Attack and release reach the held chord at once; brightness and motion ramp. */
  setPad(section: number, id: LayerInstrument, values: Partial<PadParams>): boolean {
    const s = this.song.sections[section];
    if (!s || !(LAYER_IDS as readonly string[]).includes(id)) return false;
    const ranges: Record<keyof PadParams, [number, number]> = { attack: [0.001, 8], release: [0.01, 8], brightness: [0, 1], motion: [0, 1] };
    const pad = { ...s[id].pad };
    for (const k of Object.keys(values) as (keyof PadParams)[]) {
      if (!(k in ranges)) return false;
      const v = num(values[k], ...ranges[k]);
      if (v === null) return false;
      pad[k] = v;
    }
    s[id].pad = pad;
    return true;
  }

  /**
   * Change the generative knobs (not the seed). The lead keeps its notes: only Lock rewrites them,
   * so moving Hits, Rotate, Length, Tension or Density never draws a new melody.
   */
  setGen(section: number, id: LayerInstrument, values: Partial<Omit<LeadParams, "seed">>): boolean {
    const s = this.song.sections[section];
    if (!s || !(LAYER_IDS as readonly string[]).includes(id)) return false;
    const ranges: Record<Exclude<keyof LeadParams, "seed">, [number, number, boolean]> = {
      lock: [0, 1, false],
      hits: [1, 16, true],
      rotate: [0, 15, true],
      length: [2, 16, true],
      tension: [0, 1, false],
      density: [0, 1, false],
    };
    const g = { ...s[id].gen };
    for (const k of Object.keys(values) as (keyof typeof ranges)[]) {
      if (!(k in ranges)) return false;
      const [lo, hi, int] = ranges[k];
      const v = num(values[k], lo, hi, int);
      if (v === null) return false;
      g[k] = v;
    }
    s[id].gen = g;
    return true;
  }

  /** A new seed for a layer's generative lead: new notes from the next step. Returns the seed. */
  newSeed(section: number, id: LayerInstrument): number | null {
    const s = this.song.sections[section];
    if (!s || !(LAYER_IDS as readonly string[]).includes(id)) return null;
    const seeds = [...(s[id].seeds ?? []), s[id].gen.seed].slice(-SEED_HISTORY);
    s[id] = { ...s[id], seeds, gen: { ...s[id].gen, seed: nextSeed(s[id].gen.seed) } };
    this.reseedArp(section, id);
    return s[id].gen.seed;
  }

  /**
   * A random arp draws its notes from the layer's seed: a new seed (New idea, Back) in the playing section
   * reseeds it at once, so the change is heard there too (P2 review S3), not only from the next section entry.
   */
  private reseedArp(section: number, id: LayerInstrument): void {
    if (section === this.current) this.arpRng.set(id, createRng(deriveSeed(this.song.sections[section][id].gen.seed, 7)));
  }

  /**
   * Back (spec 8.3): the layer's previous seed, from the last eight. The lead starts again from that seed,
   * so it plays the notes it played before, note for note. Returns the seed, or null when there is none.
   */
  prevSeed(section: number, id: LayerInstrument): number | null {
    const s = this.song.sections[section];
    if (!s || !(LAYER_IDS as readonly string[]).includes(id)) return null;
    const seeds = s[id].seeds ?? [];
    if (!seeds.length) return null;
    const seed = seeds[seeds.length - 1];
    const rest = seeds.slice(0, -1);
    const next = { ...s[id], gen: { ...s[id].gen, seed } };
    if (rest.length) next.seeds = rest;
    else delete next.seeds;
    s[id] = next;
    // Start the lead from the seed even when the same seed is cached (it may have drifted with Lock).
    this.leads.delete(`${section}:${id}`);
    this.reseedArp(section, id);
    return seed;
  }

  /** The current bar of a section's generative lead as it stands (for P6's step row; no caller since P1b). */
  leadSteps(section: number, id: LayerInstrument, shownStep?: number): LeadStepView[] {
    const s = this.song.sections[section];
    if (!s) return [];
    const lead = this.leads.get(`${section}:${id}`);
    const view = lead && lead.seedValue === s[id].gen.seed ? lead : new GenerativeLead(s[id].gen.seed);
    return view.preview(s[id].gen, shownStep);
  }

  /** Change the song's key and mood. Acts at once: held chords restart on the next step. */
  setKeyMood(key: KeyName, mood: Mood): void {
    this.song.key = key;
    this.song.mood = mood;
    if (this.running) this.retrigger = true;
  }

  /**
   * Replace a section's chord sequence. Acts at once; for the playing section, held chords restart
   * on the next step. Returns false (and changes nothing) for a sequence that is not 1..8 valid chords.
   */
  setChords(section: number, chords: ChordStep[]): boolean {
    const s = this.song.sections[section];
    if (!s || !validChords(chords)) return false;
    s.chords = chords.map((c) => ({ degree: c.degree, bars: c.bars }));
    if (this.running && section === this.current) this.retrigger = true;
    return true;
  }

  /** Rename a section. Empty or blank names are refused. */
  renameSection(index: number, name: string): boolean {
    const s = this.song.sections[index];
    const n = name.trim().slice(0, MAX_SECTION_NAME);
    if (!s || !n) return false;
    s.name = n;
    return true;
  }

  /** Append a new section (up to four): one chord on the tonic, drums, bass and synth on. Returns its index or -1. */
  addSection(): number {
    const sections = this.song.sections;
    if (sections.length >= LIMITS.sections[1]) return -1;
    const seed = 1 + sections.reduce((m, s) => Math.max(m, s.layer1.gen.seed, s.layer2.gen.seed), 0);
    sections.push(newSection(`Section ${String.fromCharCode(65 + sections.length)}`, seed));
    this.leads.clear();
    return sections.length - 1;
  }

  /** Insert a copy of a section right after it (up to four). Returns the copy's index or -1. */
  copySection(index: number): number {
    const sections = this.song.sections;
    const s = sections[index];
    if (!s || sections.length >= LIMITS.sections[1]) return -1;
    const copy = JSON.parse(JSON.stringify(s)) as Section;
    copy.name = `${s.name} 2`.slice(0, MAX_SECTION_NAME);
    sections.splice(index + 1, 0, copy);
    this.remap((i) => (i > index ? i + 1 : i));
    return index + 1;
  }

  /**
   * Delete a section. Refused for the last one left and for the section playing now; a switch
   * queued to it is dropped. Returns whether it was deleted.
   */
  deleteSection(index: number): boolean {
    const sections = this.song.sections;
    if (index < 0 || index >= sections.length || sections.length <= LIMITS.sections[0]) return false;
    if (this.running && index === this.current) return false;
    sections.splice(index, 1);
    if (!this.running && index === this.current) {
      this.current = Math.min(index, sections.length - 1);
      this.leads.clear();
      this.enterSection(this.current);
      this.queue.clear();
      return true;
    }
    this.remap((i) => (i === index ? null : i > index ? i - 1 : i));
    return true;
  }

  /** Move the playing index and every queued switch after sections were inserted or removed. */
  private remap(fn: (i: number) => number | null): void {
    this.leads.clear();
    this.current = fn(this.current) ?? this.current;
    this.queue.remap(fn);
  }

  load(song: Song): void {
    this.song = song;
    this.leads.clear();
    this.queue.clear();
    this.current = Math.min(this.current, song.sections.length - 1);
    this.enterSection(this.current);
  }

  /** Switch section: on the next bar line while running, at once when stopped. */
  switchSection(index: number): void {
    if (index < 0 || index >= this.song.sections.length) return;
    if (!this.running) {
      this.current = index;
      this.enterSection(index);
      return;
    }
    this.queue.queueSection(index, this.current);
  }

  /**
   * Turn an instrument on or off in a section. For the playing section, while running, it lands on
   * the next bar line; tapping again before then cancels. Other sections change at once (silently).
   */
  toggleInstrument(section: number, inst: InstrumentId): void {
    const s = this.song.sections[section];
    if (!s) return;
    if (this.running && section === this.current) this.queue.queueToggle(section, inst);
    else s.on[inst] = !s.on[inst];
  }

  pending(): Pending {
    return this.queue.pending();
  }

  /** Produce the events of the next sixteenth. */
  next(): StepResult {
    const step = this.globalStep % STEPS_PER_BAR;
    const bar = Math.floor(this.globalStep / STEPS_PER_BAR);
    // The state at the bar line, kept for the lanes of the instruments that are off (a few small copies a bar).
    const snap = step === 0 && this.snaps ? this.copy(this.song) : null;
    let applied: Pending | null = null;
    if (step === 0 && !this.queue.empty) {
      applied = this.queue.flush();
      this.applyPending(applied);
    }
    const retrigger = this.retrigger;
    this.retrigger = false;
    // A section switch on this step starts its own rhythms; a restart queued before it is moot.
    const restart = applied?.section != null ? new Set<"bass" | "synth" | LayerInstrument>() : new Set(this.restart);
    this.restart.clear();
    const section = this.song.sections[this.current];
    const events: NoteEvent[] = [];
    const now = new Set<InstrumentId>(INSTRUMENTS.filter((id) => section.on[id]));
    const stopped = [...this.sounding].filter((id) => !now.has(id));
    const entered = new Set([...now].filter((id) => !this.sounding.has(id)));
    this.sounding = now;

    const pos = chordAt(this.song, section, this.sectionStep);
    const chordStart = pos.starts || retrigger;
    const swing = sectionSwing(section);
    const shift = step % 2 === 1 ? swing : 0;

    if (now.has("drums")) {
      const grid = sectionDrumGrid(section);
      for (const voice of DRUM_VOICES) {
        const vel = grid[voice][step];
        // `gap`: sixteenths to this voice's next hit, so its tail can end before it.
        if (vel > 0) events.push({ inst: "drums", voice, vel, shift, gap: nextHitGap(grid[voice], step, swing) });
      }
    }

    if (now.has("bass")) {
      for (const hit of BASS_RHYTHMS[section.bass.rhythm]) {
        if (hit.step === step) events.push({ inst: "bass", midi: pos.chord.bass, len: Math.min(hit.len, pos.remaining), vel: hit.vel, shift });
      }
      // A key, mood or chord edit cuts the held bass note (the engine releases it): a note that
      // started earlier in this chord and is still sounding goes on at the new root for the rest of its hit.
      if (retrigger || restart.has("bass")) {
        const held = BASS_RHYTHMS[section.bass.rhythm].find(
          (h) => h.step < step && step - h.step <= pos.elapsed && h.step + h.len > step,
        );
        if (held) {
          const len = Math.min(held.step + held.len - step, pos.remaining);
          events.push({ inst: "bass", midi: pos.chord.bass, len, vel: held.vel, shift });
        }
      }
    }

    if (now.has("synth")) {
      const rhythm = section.synth.rhythm;
      if (rhythm === "sustained") {
        if (chordStart || entered.has("synth") || restart.has("synth")) events.push({ inst: "synth", notes: pos.chord.notes, len: pos.remaining, vel: 0.7, shift });
      } else {
        for (const hit of SYNTH_RHYTHMS[rhythm]) {
          if (hit.step === step) events.push({ inst: "synth", notes: pos.chord.notes, len: hit.len, vel: hit.vel, shift });
        }
      }
    }

    for (const id of LAYER_IDS) {
      if (!now.has(id)) continue;
      const ev = this.layerEvent(id, section, step, pos, chordStart || entered.has(id) || restart.has(id), shift);
      if (ev) events.push(ev);
    }

    this.globalStep++;
    this.sectionStep++;
    const restarted = [...restart].filter((id) => now.has(id));
    const pads = {} as Record<LayerInstrument, PadParams | null>;
    for (const id of LAYER_IDS) pads[id] = section[id].mode === "pad" ? { ...section[id].pad } : null;
    const result: StepResult = { bar, step, section: this.current, events, applied, stopped, retrigger, restarted, pads };
    this.record(result, now, snap);
    return result;
  }

  // ---- Lanes (P1b) ------------------------------------------------------------------

  /**
   * Keep the bar's notes as they are scheduled. Notes cut short by the engine (an instrument stopping,
   * a rhythm restart, a new chord or section) are cut here too, so the lane shows what is heard.
   */
  private record(r: StepResult, now: Set<InstrumentId>, snap: Sequencer | null): void {
    if (r.step === 0 || !this.rec) {
      const notes = emptyNotes();
      // Notes still sounding over the bar line carry on from step 0.
      if (this.rec) {
        for (const id of INSTRUMENTS) {
          for (const n of this.rec.notes[id]) {
            const end = n.step + n.shift + n.len;
            if (end > STEPS_PER_BAR) notes[id].push({ ...n, step: 0, shift: 0, len: end - STEPS_PER_BAR, held: true });
          }
        }
      }
      const on = {} as Record<InstrumentId, boolean>;
      for (const id of INSTRUMENTS) on[id] = now.has(id);
      this.prevRec = this.rec;
      this.rec = { bar: r.bar, section: r.section, on, notes, snap };
    }
    const cut = new Set<InstrumentId>([...r.stopped, ...r.restarted]);
    if (r.retrigger || (r.applied && r.applied.section !== null)) for (const id of ["synth", "layer1", "layer2"] as const) cut.add(id);
    if (r.retrigger) cut.add("bass");
    for (const id of cut) {
      this.rec.notes[id] = this.rec.notes[id]
        .map((n) => (n.step + n.shift + n.len > r.step ? { ...n, len: r.step - n.step - n.shift } : n))
        .filter((n) => n.len > 0);
    }
    laneNotes(r.step, r.events, this.rec.notes);
  }

  /** A copy of the whole sequencer on `song`, in the same state: it plays the same notes from here. */
  private copy(song: Song, toggles = true): Sequencer {
    const c = new Sequencer(song);
    c.queue = this.queue.clone(toggles);
    c.running = this.running;
    c.current = this.current;
    c.globalStep = this.globalStep;
    c.sectionStep = this.sectionStep;
    c.leads = new Map([...this.leads].map(([k, l]) => [k, l.clone()]));
    c.arpIndex = new Map(this.arpIndex);
    c.arpRng = new Map([...this.arpRng].map(([k, r]) => [k, r.clone()]));
    c.sounding = new Set(this.sounding);
    c.retrigger = this.retrigger;
    c.restart = new Set(this.restart);
    c.rec = this.rec && { ...this.rec, notes: cloneNotes(this.rec.notes), snap: null };
    c.prevRec = null;
    c.snaps = false;
    return c;
  }

  /** Run a copy to the end of its bar and return that bar's record. */
  private static finish(c: Sequencer): BarRecord {
    do c.next();
    while (c.globalStep % STEPS_PER_BAR !== 0);
    return c.rec!;
  }

  /** What every instrument would play from `from` (a copy at a bar line) with all of them switched on. */
  private ghost(from: Sequencer): LaneNotes {
    const c = from.copy(cloneSong(this.song), false);
    for (const s of c.song.sections) for (const id of INSTRUMENTS) s.on[id] = true;
    c.rec = null;
    return Sequencer.finish(c).notes;
  }

  /**
   * One bar of every instrument as notes (spec 8.12). While playing, `bar` is the bar shown (the one heard,
   * which trails the scheduler by the look-ahead): notes already scheduled as they were, the rest as the
   * song stands now. When stopped: the first bar Play would start with.
   */
  lanes(bar?: number): LaneBar {
    let actual: BarRecord;
    let from: Sequencer;
    const entry = this.running ? ([this.rec, this.prevRec].find((r) => r && r.bar === bar) ?? this.rec) : null;
    if (!entry) {
      const c = this.copy(cloneSong(this.song));
      c.rec = null;
      c.start();
      from = c.copy(c.song);
      actual = Sequencer.finish(c);
      actual.bar = 0;
    } else if (entry === this.rec && this.globalStep % STEPS_PER_BAR !== 0) {
      actual = Sequencer.finish(this.copy(cloneSong(this.song)));
      from = entry.snap ?? this.copy(this.song);
    } else {
      actual = entry;
      from = entry.snap ?? this.copy(this.song);
    }
    const ghost = INSTRUMENTS.some((id) => !actual.on[id]) ? this.ghost(from) : null;
    const notes = emptyNotes();
    for (const id of INSTRUMENTS) notes[id] = cloneNotes(actual.on[id] || !ghost ? actual.notes : ghost)[id];
    return { bar: actual.bar, section: actual.section, playing: this.running, on: { ...actual.on }, notes };
  }

  private layerEvent(
    id: LayerInstrument,
    section: Section,
    step: number,
    pos: ChordPosition,
    fresh: boolean,
    shift: number,
  ): NoteEvent | null {
    const p = section[id];
    if (p.mode === "pad") {
      if (!fresh) return null;
      return {
        inst: id,
        mode: "pad",
        notes: pos.chord.notes.slice(0, 4),
        len: pos.remaining,
        vel: 0.7 * PAD_TRIM,
        shift,
      };
    }
    if (p.mode === "arp") {
      if (step % p.arp.rate !== 0) return null;
      const i = this.arpIndex.get(id) ?? 0;
      this.arpIndex.set(id, i + 1);
      const midi = arpNote(pos.chord.notes, p.arp, i, this.arpRng.get(id)!);
      return { inst: id, mode: "arp", notes: [midi], len: p.arp.rate * p.arp.gate, vel: i % 4 === 0 ? 0.8 : 0.6, shift };
    }
    const key = `${this.current}:${id}`;
    let lead = this.leads.get(key);
    const ctx = { chordTones: pos.chord.tones, scale: scalePitchClasses(this.song.key, this.song.mood) };
    if (!lead || lead.seedValue !== p.gen.seed) {
      // Made mid-bar (New idea, Back while playing): it runs silently through the steps before this one, so it
      // stands as if it had begun at the bar line, mutations included (G4 review M1). Back pressed mid-bar then
      // plays the old lead note for note from the next bar line (P2 review M1).
      lead = new GenerativeLead(p.gen.seed);
      for (let s = 0; s < step; s++) lead.step(s, p.gen, ctx);
      this.leads.set(key, lead);
    }
    const note = lead.step(step, p.gen, ctx);
    if (!note) return null;
    return { inst: id, mode: "generative", notes: [note.midi], len: 0.8, vel: note.vel, shift };
  }

  private applyPending(p: Pending): void {
    for (const t of p.toggles) {
      const s = this.song.sections[t.section];
      if (s) s.on[t.instrument] = !s.on[t.instrument];
    }
    if (p.section !== null && p.section < this.song.sections.length) {
      this.current = p.section;
      this.enterSection(p.section);
    }
  }

  /**
   * A section starts from its first chord; its arps restart from their seeds, and its generative
   * leads go back to the top of their loops with the notes they have now (Play starts them from the seed).
   */
  private enterSection(index: number): void {
    this.current = index;
    this.sectionStep = 0;
    const s = this.song.sections[index];
    for (const id of LAYER_IDS) this.leads.get(`${index}:${id}`)?.rewind();
    for (const id of LAYER_IDS) {
      this.arpIndex.set(id, 0);
      this.arpRng.set(id, createRng(deriveSeed(s[id].gen.seed, 7)));
    }
  }
}
