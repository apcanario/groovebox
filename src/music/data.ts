/**
 * The data formats (P3, spec 8.2): moods, drum beats, bass and synth rhythms, patches and styles each live
 * as one data file per entry under `src/data/` and `src/styles/`. A file's name is its id. This module holds
 * only the formats and the reader that turns a folder of files into a list; it imports nothing that reads a
 * folder, so a data file can import its types from here without a cycle. No audio dependency.
 */
import type { DroneParams, InstrumentId, LayerMode, MixState, PadParams, Patch } from "../engine/song.ts";
import type { ArpParams } from "./arp.ts";
import type { LeadParams, LeadStyle } from "./lead.ts";
import type { KeyName, ScaleName, Voicing } from "./scales.ts";
import type { EffectId, FxKnobs } from "./effects.ts";

/**
 * One hit of a bass or synth rhythm. P8 (spec 8.7: Octave bounce, Acid line, 808 glide, Arp bass, Walking, Broken
 * chord): `tone` plays one tone of the chord (0 the root, 1 the next chord tone up, and so on, wrapping), the bass
 * inside an octave above its root and the synth a single note of its voicing; `oct` moves the hit up or down octaves.
 * Without either, the bass plays the root and the synth the whole chord, as before.
 */
export interface RhythmHit {
  step: number; // 0..15
  len: number; // in steps
  vel: number; // 0..1
  tone?: number; // 0..7
  oct?: number; // -1..2
}

/** The four drum voices of G1; every beat file has a row for each. */
export const CORE_DRUM_VOICES = ["kick", "clap", "hat", "open"] as const;
/** Every drum voice the engine has: P7 adds Perc (a tuned tom or conga-like hit) and Shaker (spec 8.7). */
export const DRUM_VOICES = [...CORE_DRUM_VOICES, "perc", "shaker"] as const;
export type DrumVoice = (typeof DRUM_VOICES)[number];

/** Velocity per step (0 = off), 16 steps per voice. */
export type DrumGrid = Record<DrumVoice, number[]>;

/** A beat file's grid: the four core rows, Perc and Shaker where it plays them. */
export type BeatGrid = Record<(typeof CORE_DRUM_VOICES)[number], number[]> & Partial<Record<"perc" | "shaker", number[]>>;

/** Most hits a roll puts in one sixteenth (P7: hat rolls). */
export const MAX_ROLL = 4;

/** Shared by every picker entry: its name in Advanced, its name in Simple (plain words) and its place in the list. */
export interface Named {
  /** Place in the picker, lowest first; ties go by id. */
  order: number;
  /** The chip's word in Advanced. At most 14 characters. */
  name: string;
  /** The chip's word in Simple when it differs (no abbreviations, no jargon). */
  simple?: string;
}

/** A mood (spec section 3): a scale and a voicing. `feel`: the feel Simple Chords opens on for a song in this mood (P4). */
export interface MoodDef extends Named {
  scale: ScaleName;
  voicing: Voicing;
  feel?: Feel;
}

/** The six feels of Simple Chords (spec 8.4), in picker order. */
export const FEELS = ["bright", "warm", "dreamy", "dark", "tense", "uplifting"] as const;
export type Feel = (typeof FEELS)[number];

/**
 * A chord progression of the library (P4, spec 8.4): degrees of its mood's scale with their lengths in bars, the
 * mood (which sets the scale) and the voicing it is written for, the feels it has and the vibes (style ids) it
 * suits. Stored as degrees, so it transposes to any key and stays in it. `name` is plain and neutral: no artist,
 * song or label. Until row L1 adds per-chord voicings, a mood sets the voicing (spec section 3), so `voicing` must
 * be its mood's. Every chord is in the mood's scale because only degrees 0..6 are stored; when L1 adds borrowed
 * chords, it adds a `borrowed` mark here and the library test's "or marked as borrowing" branch.
 */
export interface ProgressionDef {
  order: number;
  name: string;
  feels: Feel[];
  vibes: string[];
  mood: string;
  voicing: Voicing;
  chords: [number, 0.5 | 1 | 2 | 4 | 8][];
}

/** A drum beat: 16 steps per voice and its swing. */
export interface BeatDef extends Named {
  /** Delay of odd sixteenths, as a fraction of a step (0 = straight). */
  swing: number;
  grid: BeatGrid;
  /** P7 (spec 8.7): repeats inside a sixteenth, by voice and step: 2, 3 or 4 quick hits (hat rolls). */
  rolls?: Partial<Record<DrumVoice, Record<number, number>>>;
}

/** A bass rhythm: when the root plays. */
export interface BassRhythmDef extends Named {
  hits: RhythmHit[];
}

/** A synth rhythm: when the chord plays. `hold`: the chord is held for its whole length (the hits are ignored). */
export interface SynthRhythmDef extends Named {
  hits: RhythmHit[];
  hold?: boolean;
}

/** A 16-step row from `{ step: velocity }`. */
export function row(hits: Record<number, number>): number[] {
  return Array.from({ length: 16 }, (_, i) => hits[i] ?? 0);
}

/** A row with the same velocity on each listed step. */
export function steps(list: readonly number[], vel: number): number[] {
  return row(Object.fromEntries(list.map((s) => [s, vel])));
}

/** Hits with the same length and velocity on each listed step. */
export function hits(list: readonly number[], len: number, vel: number): RhythmHit[] {
  return list.map((step) => ({ step, len, vel }));
}

/** A folder of data files, as `import.meta.glob(..., { eager: true })` gives it: path to module. */
export type DataFiles = Record<string, unknown>;

/** A file's id: its name without folder and extension ("../data/beats/fourFloor.ts" is "fourFloor"). */
export function fileId(path: string): string {
  return path.replace(/^.*\//, "").replace(/\.[^.]+$/, "");
}

/**
 * Read a folder of data files into ids (in picker order) and entries by id. Each file's default export is
 * one entry. `check` lists what is wrong with an entry; a file that fails throws, naming the file, so a
 * broken data file fails the tests and the build's first load instead of playing wrong.
 */
export function readData<T extends { order: number }>(
  files: DataFiles,
  check: (entry: T, id: string) => string[] = () => [],
): { ids: string[]; byId: Record<string, T> } {
  const byId: Record<string, T> = {};
  for (const [path, mod] of Object.entries(files)) {
    const id = fileId(path);
    const entry = (mod as { default?: T }).default;
    if (!entry || typeof entry !== "object") throw new Error(`${path}: no default export`);
    if (id in byId) throw new Error(`${path}: the id ${id} is taken`);
    const errors = check(entry, id);
    if (errors.length) throw new Error(`${path}: ${errors.join("; ")}`);
    byId[id] = entry;
  }
  const ids = Object.keys(byId).sort((a, b) => byId[a].order - byId[b].order || (a < b ? -1 : 1));
  return { ids, byId };
}

/** Longest name a picker entry or a style may carry (spec 8.2, 8.7). */
export const MAX_DATA_NAME = 14;

/** The checks every picker entry gets. */
export function checkNamed(e: Named): string[] {
  const out: string[] = [];
  if (typeof e.order !== "number" || !Number.isFinite(e.order)) out.push("order: must be a number");
  if (typeof e.name !== "string" || !e.name || e.name.length > MAX_DATA_NAME) out.push(`name: 1..${MAX_DATA_NAME} characters`);
  if (e.simple !== undefined && (typeof e.simple !== "string" || !e.simple || e.simple.length > MAX_DATA_NAME))
    out.push(`simple: 1..${MAX_DATA_NAME} characters`);
  return out;
}

export function checkHits(list: unknown, out: string[]): void {
  if (!Array.isArray(list)) return void out.push("hits: must be a list");
  for (const h of list as RhythmHit[])
    if (
      !(h.step >= 0 && h.step < 16 && Number.isInteger(h.step) && h.len > 0 && h.vel > 0 && h.vel <= 1) ||
      (h.tone !== undefined && !(Number.isInteger(h.tone) && h.tone >= 0 && h.tone <= 7)) ||
      (h.oct !== undefined && !(Number.isInteger(h.oct) && h.oct >= -1 && h.oct <= 2))
    )
      out.push(`hits: bad hit ${JSON.stringify(h)}`);
}

export function checkGrid(grid: unknown, out: string[]): void {
  if (!grid || typeof grid !== "object") return void out.push("grid: not an object");
  for (const v of DRUM_VOICES) {
    const r = (grid as Record<string, unknown>)[v];
    if (r === undefined && !(CORE_DRUM_VOICES as readonly string[]).includes(v)) continue;
    if (!Array.isArray(r) || r.length !== 16 || !r.every((x) => typeof x === "number" && x >= 0 && x <= 1))
      out.push(`grid.${v}: must be 16 values 0..1`);
  }
}

/** A beat's rolls: each must sit on a step the voice plays, with 2..MAX_ROLL hits. */
export function checkRolls(rolls: unknown, grid: BeatGrid, out: string[]): void {
  if (rolls === undefined) return;
  if (!rolls || typeof rolls !== "object") return void out.push("rolls: not an object");
  for (const [v, steps] of Object.entries(rolls as Record<string, Record<string, number>>)) {
    if (!(DRUM_VOICES as readonly string[]).includes(v)) out.push(`rolls.${v}: unknown voice`);
    for (const [k, n] of Object.entries(steps ?? {})) {
      const i = Number(k);
      const row = (grid as Record<string, number[] | undefined>)[v];
      if (!(Number.isInteger(n) && n >= 2 && n <= MAX_ROLL)) out.push(`rolls.${v}.${k}: must be 2..${MAX_ROLL} hits`);
      if (!(Number.isInteger(i) && i >= 0 && i < 16 && (row?.[i] ?? 0) > 0)) out.push(`rolls.${v}.${k}: not a step the voice plays`);
    }
  }
}

// ---- Patches and styles ------------------------------------------------------------------

/** Which instrument a patch is for: one of the three, or either layer. */
export type PatchFor = "drums" | "bass" | "synth" | "layer";

/** A patch: values laid over the instrument's defaults (`defaultPatch`). Unnamed keys keep the default. */
export interface PatchDef extends Named {
  instrument: PatchFor;
  values: Partial<Patch>;
}

/** The five families of spec 8.2; the picker colours a tile by its family. */
export const STYLE_FAMILIES = ["house", "techno", "breaks", "slow", "other"] as const;
export type StyleFamily = (typeof STYLE_FAMILIES)[number];

/** A patch of a style: a patch id, or a patch id with some values changed. */
export type StylePatch = string | { patch: string; set: Partial<Patch> };

/** A layer in one section of a style: its mode and any settings that differ from the defaults. */
export interface StyleLayer {
  mode: LayerMode;
  arp?: Partial<ArpParams>;
  pad?: Partial<PadParams>;
  drone?: DroneParams;
  gen?: Partial<Omit<LeadParams, "seed">>;
}

/**
 * A style's lead on one layer (P6): the lead style and the knobs that suit the vibe, laid under every section's
 * own `gen`, so the layer plays it wherever it is in Lead mode and finds it when switched to Lead.
 */
export type StyleLead = Partial<Omit<LeadParams, "seed">> & { style: LeadStyle };

/** A style's effect slot (P9, spec 8.8): the effect, whether it arrives on, and knobs that differ from the effect's start. */
export interface StyleFx {
  effect: EffectId;
  on?: boolean;
  knobs?: FxKnobs;
}

/** One section of a style. `chords`: [degree, bars] pairs; `on`: the instruments playing in it. */
export interface StyleSection {
  name: string;
  on: InstrumentId[];
  chords: [number, 0.5 | 1 | 2 | 4 | 8][];
  beat: string;
  bass: string;
  synth: string;
  layer1: StyleLayer;
  layer2: StyleLayer;
}

/**
 * A style (spec 8.2): a complete starting point. `name` is at most 14 characters. `swing`, when set, is
 * written into every section (the Swing dial's value). Four sections: intro, groove, break, outro. `start`:
 * the section a load plays first (default 1, the groove, so one tap gives the full groove).
 */
export interface StyleDef {
  order: number;
  name: string;
  family: StyleFamily;
  bpm: number;
  swing?: number;
  key: KeyName;
  mood: string;
  patches: Record<InstrumentId, StylePatch>;
  mix: MixState;
  /** Each layer's lead style and settings (P6). */
  leads: Record<"layer1" | "layer2", StyleLead>;
  /** P9 (spec 8.8): the two effects of every instrument, and which arrive on. */
  fx: Record<InstrumentId, [StyleFx, StyleFx]>;
  sections: [StyleSection, StyleSection, StyleSection, StyleSection];
  start?: number;
}
