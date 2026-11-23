/** Song document (spec section 6): types, default song, validation. No audio dependency. */
import { ARP_DIRECTIONS, type ArpParams } from "../music/arp.ts";
import type { LeadParams } from "../music/lead.ts";
import {
  BASS_PRESETS,
  DRUM_PATTERNS,
  DRUM_PRESETS,
  DRUM_VOICES,
  SYNTH_PRESETS,
  type BassPreset,
  type DrumGrid,
  type DrumPreset,
  type SynthPreset,
} from "../music/presets.ts";
import { MOODS, NOTE_NAMES, type KeyName, type Mood } from "../music/scales.ts";
import { checkEvents, type LogEvent } from "./eventlog.ts";

export const INSTRUMENTS = ["drums", "bass", "synth", "layer1", "layer2"] as const;
export type InstrumentId = (typeof INSTRUMENTS)[number];
export const LAYER_IDS = ["layer1", "layer2"] as const;
export type LayerInstrument = (typeof LAYER_IDS)[number];

export const WAVES = ["sawtooth", "square", "triangle", "sine"] as const;
export type Wave = (typeof WAVES)[number];

/** Every knob of an instrument. Numbers are 0..1 unless noted. Shared by all sections. */
export interface Patch {
  wave: Wave;
  attack: number; // seconds
  decay: number; // seconds
  sustain: number;
  release: number; // seconds
  cutoff: number; // XY x
  resonance: number; // XY y
  drive: number;
  delay: number; // send
  reverb: number; // send
  level: number;
  /** Filter envelope amount (bass, synth). */
  envAmount: number;
  /** Oscillator detune spread (synth). */
  detune: number;
  /** Sub oscillator level (bass). */
  sub: number;
  /** Glide between notes (bass). */
  glide: number;
  /** Kick pitch (drums). */
  pitch: number;
  /** Per drum voice level and decay (drums). Levels default to 1 (the C1 trim; the dial only lowers it), decays to 0.5. */
  kickLevel: number;
  kickDecay: number;
  clapLevel: number;
  clapDecay: number;
  hatLevel: number;
  hatDecay: number;
  openLevel: number;
  openDecay: number;
}
export type NumericPatchKey = Exclude<keyof Patch, "wave">;
export const PATCH_KEYS: readonly NumericPatchKey[] = [
  "attack",
  "decay",
  "sustain",
  "release",
  "cutoff",
  "resonance",
  "drive",
  "delay",
  "reverb",
  "level",
  "envAmount",
  "detune",
  "sub",
  "glide",
  "pitch",
  "kickLevel",
  "kickDecay",
  "clapLevel",
  "clapDecay",
  "hatLevel",
  "hatDecay",
  "openLevel",
  "openDecay",
];
/** Allowed range per numeric patch key. */
export const PATCH_RANGES: Record<NumericPatchKey, [number, number]> = {
  attack: [0.001, 4],
  decay: [0.01, 4],
  sustain: [0, 1],
  release: [0.01, 8],
  cutoff: [0, 1],
  resonance: [0, 1],
  drive: [0, 1],
  delay: [0, 1],
  reverb: [0, 1],
  level: [0, 1],
  envAmount: [0, 1],
  detune: [0, 1],
  sub: [0, 1],
  glide: [0, 1],
  pitch: [0, 1],
  kickLevel: [0, 1],
  kickDecay: [0, 1],
  clapLevel: [0, 1],
  clapDecay: [0, 1],
  hatLevel: [0, 1],
  hatDecay: [0, 1],
  openLevel: [0, 1],
  openDecay: [0, 1],
};

/** A patch value forced into its allowed range; null for an unknown wave or a non-number. */
export function clampPatchValue<K extends keyof Patch>(key: K, value: Patch[K]): Patch[K] | null {
  if (key === "wave") return (WAVES as readonly unknown[]).includes(value) ? value : null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const [lo, hi] = PATCH_RANGES[key as NumericPatchKey];
  return Math.max(lo, Math.min(hi, value)) as Patch[K];
}

export const LAYER_MODES = ["arp", "pad", "generative"] as const;
export type LayerMode = (typeof LAYER_MODES)[number];

export interface PadParams {
  attack: number; // seconds
  release: number; // seconds
  brightness: number; // 0..1 (used from G4)
  motion: number; // 0..1 (used from G4)
}

export interface LayerPattern {
  mode: LayerMode;
  arp: ArpParams;
  pad: PadParams;
  gen: LeadParams;
}

export interface ChordStep {
  degree: number; // 0..6
  bars: 0.5 | 1 | 2;
}

export interface DrumsPattern {
  preset: DrumPreset;
  /**
   * Set when the preset was opened in the sequencer and edited. Stored at 16 steps (sixteenths) so
   * the presets' sixteenth hats survive an edit. The 8-step editor shows a step as lit when either of
   * its two sixteenths plays (see `toggleEighth`).
   */
  grid?: DrumGrid;
}

export interface Section {
  name: string;
  on: Record<InstrumentId, boolean>;
  chords: ChordStep[];
  drums: DrumsPattern;
  bass: { rhythm: BassPreset };
  synth: { rhythm: SynthPreset };
  layer1: LayerPattern;
  layer2: LayerPattern;
}

/** The Mix tab's master knobs. Saved with the song (G5) so a reload keeps them. */
export interface MixState {
  sweep: number; // -1..1: left low-pass, right high-pass, 0 open
  pump: number; // 0..0.95
  saturation: number; // 0..1
}
export const DEFAULT_MIX: MixState = { sweep: 0, pump: 0.6, saturation: 0 };

/** The last take's event log (spec section 6): the song as it stood at the start, then every edit. */
export interface EventLog {
  /** When the take started (ISO time). */
  recorded: string;
  /** Length of the take in seconds. */
  seconds: number;
  /** The section playing when the take started. */
  section: number;
  /** The song and mix at the start of the take (without a log of its own). */
  start: Song;
  events: LogEvent[];
}

export interface Song {
  version: 1;
  name: string;
  key: KeyName;
  mood: Mood;
  bpm: number;
  patches: Record<InstrumentId, Patch>;
  sections: Section[];
  /** Optional (G5): the master knobs. Missing means the defaults. */
  mix?: MixState;
  /** Optional (G5): the event log of the last take. */
  log?: EventLog;
}

export const LIMITS = { bpm: [80, 180], sections: [1, 4], chords: [1, 8] } as const;
export const CHORD_LENGTHS = [0.5, 1, 2] as const;
export const MAX_SECTION_NAME = 12;

/** A chord sequence the engine accepts: 1..8 chords, degrees 0..6, lengths of half, one or two bars. */
export function validChords(chords: unknown): chords is ChordStep[] {
  return (
    Array.isArray(chords) &&
    chords.length >= LIMITS.chords[0] &&
    chords.length <= LIMITS.chords[1] &&
    chords.every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        Number.isInteger(c.degree) &&
        c.degree >= 0 &&
        c.degree <= 6 &&
        (CHORD_LENGTHS as readonly unknown[]).includes(c.bars),
    )
  );
}

// ---- Defaults ----------------------------------------------------------------

export function defaultPatch(id: InstrumentId): Patch {
  const base: Patch = {
    wave: "sawtooth",
    attack: 0.005,
    decay: 0.25,
    sustain: 0.3,
    release: 0.3,
    cutoff: 0.6,
    resonance: 0.2,
    drive: 0,
    delay: 0,
    reverb: 0,
    level: 0.8,
    envAmount: 0.3,
    detune: 0.37,
    sub: 1,
    glide: 0,
    pitch: 0.4,
    kickLevel: 1,
    kickDecay: 0.5,
    clapLevel: 1,
    clapDecay: 0.5,
    hatLevel: 1,
    hatDecay: 0.5,
    openLevel: 1,
    openDecay: 0.5,
  };
  switch (id) {
    case "drums":
      return { ...base, wave: "sine", cutoff: 1, resonance: 0, drive: 0.4, reverb: 0.1, level: 0.9 };
    case "bass":
      return { ...base, decay: 0.2, release: 0.08, cutoff: 0.3, resonance: 0.25, envAmount: 0.45, level: 0.7 };
    case "synth":
      return { ...base, attack: 0.004, decay: 0.24, sustain: 0.1, release: 0.3, delay: 0.3, reverb: 0.3, level: 0.45 };
    case "layer1":
      return { ...base, wave: "triangle", attack: 0.003, decay: 0.16, sustain: 0.05, release: 0.2, cutoff: 0.8, delay: 0.5, reverb: 0.35, level: 0.35 };
    case "layer2":
      return { ...base, attack: 0.7, decay: 0.6, sustain: 0.8, release: 1.8, cutoff: 0.45, resonance: 0.1, reverb: 0.6, level: 0.22 };
  }
}

export function defaultLayerPattern(mode: LayerMode, seed: number): LayerPattern {
  return {
    mode,
    arp: { direction: "up", rate: 2, octaves: 2, gate: 0.6 },
    pad: { attack: 0.7, release: 1.8, brightness: 0.4, motion: 0.2 },
    gen: { lock: 0.75, hits: 7, rotate: 0, length: 5, tension: 0.35, density: 0.85, seed },
  };
}

function section(
  name: string,
  on: [boolean, boolean, boolean, boolean, boolean],
  chords: ChordStep[],
  drums: DrumPreset,
  bass: BassPreset,
  l1: LayerMode,
  seed: number,
): Section {
  return {
    name,
    on: { drums: on[0], bass: on[1], synth: on[2], layer1: on[3], layer2: on[4] },
    chords,
    drums: { preset: drums },
    bass: { rhythm: bass },
    synth: { rhythm: "stabs" },
    layer1: defaultLayerPattern(l1, seed),
    layer2: defaultLayerPattern("pad", seed + 1),
  };
}

/** A new section: one bar of the tonic; drums, bass and synth on; Layer 1 generative, Layer 2 pad. */
export function newSection(name: string, seed: number): Section {
  return section(name, [true, true, true, false, false], [{ degree: 0, bars: 1 }], "fourFloor", "offbeat", "generative", seed);
}

/** The four-section default: A minor, mood House, 122 bpm. i9 VImaj9 iv9 v7. */
export function defaultSong(): Song {
  const c = (degree: number, bars: 0.5 | 1 | 2 = 1): ChordStep => ({ degree, bars });
  return {
    version: 1,
    name: "Default",
    key: "A",
    mood: "house",
    bpm: 122,
    patches: {
      drums: defaultPatch("drums"),
      bass: defaultPatch("bass"),
      synth: defaultPatch("synth"),
      layer1: defaultPatch("layer1"),
      layer2: defaultPatch("layer2"),
    },
    sections: [
      section("Intro", [true, false, false, false, true], [c(0, 2), c(5, 2)], "fourFloor", "offbeat", "generative", 101),
      section("Groove", [true, true, true, true, true], [c(0), c(5), c(3), c(4)], "fourFloor", "offbeat", "generative", 101),
      section("Break", [false, false, true, true, true], [c(5), c(3), c(0, 2)], "houseShuffle", "long", "arp", 202),
      section("Outro", [true, true, false, false, true], [c(0), c(3)], "houseShuffle", "rolling", "generative", 303),
    ],
  };
}

export function cloneSong(song: Song): Song {
  return JSON.parse(JSON.stringify(song)) as Song;
}

// ---- Validation --------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const inRange = (v: unknown, lo: number, hi: number): boolean => isNum(v) && v >= lo && v <= hi;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneOf = (v: unknown, list: readonly unknown[]): boolean => list.includes(v);

function checkPatch(p: unknown, at: string, errors: string[]): void {
  if (!isObj(p)) return void errors.push(`${at}: not an object`);
  if (!oneOf(p.wave, WAVES)) errors.push(`${at}.wave: unknown wave`);
  for (const k of PATCH_KEYS) {
    const [lo, hi] = PATCH_RANGES[k];
    if (!inRange(p[k], lo, hi)) errors.push(`${at}.${k}: must be ${lo}..${hi}`);
  }
}

function checkLayer(l: unknown, at: string, errors: string[]): void {
  if (!isObj(l)) return void errors.push(`${at}: not an object`);
  if (!oneOf(l.mode, LAYER_MODES)) errors.push(`${at}.mode: unknown mode`);
  const arp = l.arp;
  if (!isObj(arp)) errors.push(`${at}.arp: not an object`);
  else {
    if (!oneOf(arp.direction, ARP_DIRECTIONS)) errors.push(`${at}.arp.direction: unknown`);
    if (!oneOf(arp.rate, [1, 2, 4])) errors.push(`${at}.arp.rate: must be 1, 2 or 4`);
    if (!oneOf(arp.octaves, [1, 2, 3])) errors.push(`${at}.arp.octaves: must be 1..3`);
    if (!inRange(arp.gate, 0.1, 1)) errors.push(`${at}.arp.gate: must be 0.1..1`);
  }
  const pad = l.pad;
  if (!isObj(pad)) errors.push(`${at}.pad: not an object`);
  else {
    if (!inRange(pad.attack, 0.001, 8)) errors.push(`${at}.pad.attack: must be 0.001..8`);
    if (!inRange(pad.release, 0.01, 8)) errors.push(`${at}.pad.release: must be 0.01..8`);
    if (!inRange(pad.brightness, 0, 1)) errors.push(`${at}.pad.brightness: must be 0..1`);
    if (!inRange(pad.motion, 0, 1)) errors.push(`${at}.pad.motion: must be 0..1`);
  }
  const g = l.gen;
  if (!isObj(g)) errors.push(`${at}.gen: not an object`);
  else {
    for (const k of ["lock", "tension", "density"]) if (!inRange(g[k], 0, 1)) errors.push(`${at}.gen.${k}: must be 0..1`);
    if (!inRange(g.hits, 1, 16)) errors.push(`${at}.gen.hits: must be 1..16`);
    if (!inRange(g.rotate, 0, 15)) errors.push(`${at}.gen.rotate: must be 0..15`);
    if (!inRange(g.length, 2, 16)) errors.push(`${at}.gen.length: must be 2..16`);
    if (!isNum(g.seed) || !Number.isInteger(g.seed)) errors.push(`${at}.gen.seed: must be an integer`);
  }
}

function checkSection(s: unknown, at: string, errors: string[]): void {
  if (!isObj(s)) return void errors.push(`${at}: not an object`);
  if (typeof s.name !== "string" || s.name.length === 0) errors.push(`${at}.name: must be a non-empty string`);
  if (!isObj(s.on)) errors.push(`${at}.on: not an object`);
  else for (const id of INSTRUMENTS) if (typeof s.on[id] !== "boolean") errors.push(`${at}.on.${id}: must be true or false`);
  if (!Array.isArray(s.chords) || s.chords.length < LIMITS.chords[0] || s.chords.length > LIMITS.chords[1])
    errors.push(`${at}.chords: must hold 1..8 chords`);
  else
    s.chords.forEach((c, i) => {
      if (!isObj(c) || !Number.isInteger(c.degree) || !inRange(c.degree, 0, 6)) errors.push(`${at}.chords[${i}].degree: must be 0..6`);
      if (!isObj(c) || !oneOf(c.bars, [0.5, 1, 2])) errors.push(`${at}.chords[${i}].bars: must be 0.5, 1 or 2`);
    });
  if (!isObj(s.drums) || !oneOf(s.drums.preset, DRUM_PRESETS)) errors.push(`${at}.drums.preset: unknown preset`);
  else if (s.drums.grid !== undefined) {
    const g = s.drums.grid;
    if (!isObj(g)) errors.push(`${at}.drums.grid: not an object`);
    else
      for (const v of DRUM_VOICES) {
        const r = g[v];
        if (!Array.isArray(r) || r.length !== 16 || !r.every((x) => inRange(x, 0, 1)))
          errors.push(`${at}.drums.grid.${v}: must be 16 values 0..1`);
      }
  }
  if (!isObj(s.bass) || !oneOf(s.bass.rhythm, BASS_PRESETS)) errors.push(`${at}.bass.rhythm: unknown preset`);
  if (!isObj(s.synth) || !oneOf(s.synth.rhythm, SYNTH_PRESETS)) errors.push(`${at}.synth.rhythm: unknown preset`);
  checkLayer(s.layer1, `${at}.layer1`, errors);
  checkLayer(s.layer2, `${at}.layer2`, errors);
}

function checkMix(m: unknown, at: string, errors: string[]): void {
  if (!isObj(m)) return void errors.push(`${at}: not an object`);
  if (!inRange(m.sweep, -1, 1)) errors.push(`${at}.sweep: must be -1..1`);
  if (!inRange(m.pump, 0, 0.95)) errors.push(`${at}.pump: must be 0..0.95`);
  if (!inRange(m.saturation, 0, 1)) errors.push(`${at}.saturation: must be 0..1`);
}

function checkLog(l: unknown, at: string, errors: string[]): void {
  if (!isObj(l)) return void errors.push(`${at}: not an object`);
  if (typeof l.recorded !== "string") errors.push(`${at}.recorded: must be a time`);
  if (!isNum(l.seconds) || l.seconds < 0) errors.push(`${at}.seconds: must be 0 or more`);
  if (!Number.isInteger(l.section) || !inRange(l.section, 0, 3)) errors.push(`${at}.section: must be 0..3`);
  if (isObj(l.start) && l.start.log !== undefined) errors.push(`${at}.start: must not hold a log`);
  else for (const e of validateSong(l.start)) errors.push(`${at}.start.${e}`);
  checkEvents(l.events, `${at}.events`, errors);
}

/** Every problem with a would-be song document; empty when it is valid. */
export function validateSong(doc: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(doc)) return ["song: not an object"];
  if (doc.mix !== undefined) checkMix(doc.mix, "mix", errors);
  if (doc.log !== undefined) checkLog(doc.log, "log", errors);
  if (doc.version !== 1) errors.push("version: must be 1");
  if (typeof doc.name !== "string") errors.push("name: must be a string");
  if (!oneOf(doc.key, NOTE_NAMES)) errors.push("key: unknown key");
  if (!oneOf(doc.mood, MOODS)) errors.push("mood: unknown mood");
  if (!isNum(doc.bpm) || !inRange(doc.bpm, LIMITS.bpm[0], LIMITS.bpm[1])) errors.push("bpm: must be 80..180");
  if (!isObj(doc.patches)) errors.push("patches: not an object");
  else for (const id of INSTRUMENTS) checkPatch(doc.patches[id], `patches.${id}`, errors);
  if (!Array.isArray(doc.sections) || doc.sections.length < LIMITS.sections[0] || doc.sections.length > LIMITS.sections[1])
    errors.push("sections: must hold 1..4 sections");
  else doc.sections.forEach((s, i) => checkSection(s, `sections[${i}]`, errors));
  return errors;
}

/** Parse and validate a song from JSON. Throws with every problem listed. */
export function parseSong(json: string): Song {
  const doc: unknown = JSON.parse(json);
  const errors = validateSong(doc);
  if (errors.length) throw new Error(`invalid song: ${errors.join("; ")}`);
  return doc as Song;
}

export function serializeSong(song: Song): string {
  return JSON.stringify(song);
}

/** The drum grid a section plays: its edited grid, or its preset's. */
export function sectionDrumGrid(s: Section): DrumGrid {
  return s.drums.grid ?? DRUM_PATTERNS[s.drums.preset].grid;
}
