/** Song document (spec section 6): types, default song, validation. No audio dependency. */
import { checkDropSettings, type DropSettings } from "../music/drop.ts";
import { ARP_DIRECTIONS, type ArpParams } from "../music/arp.ts";
import { LEAD_SHAPES, LEAD_STYLES, PHRASE_BARS, type LeadParams } from "../music/lead.ts";
import {
  BASS_PRESETS,
  DRUM_PATTERNS,
  DRUM_PRESETS,
  CORE_DRUM_VOICES,
  DRUM_VOICES,
  SYNTH_PRESETS,
  type BassPreset,
  fullGrid,
  type DrumGrid,
  type DrumPreset,
  type DrumVoice,
  type SynthPreset,
} from "../music/presets.ts";
import { MOODS, NOTE_NAMES, type KeyName, type Mood } from "../music/scales.ts";
import { checkEvents, type LogEvent } from "./eventlog.ts";
import { MACRO_KEYS } from "../music/macros.ts";
import { FX_SLOTS, checkFxSlot, defaultRack, type FxRack } from "../music/effects.ts";

export const INSTRUMENTS = ["drums", "bass", "synth", "layer1", "layer2"] as const;
export type InstrumentId = (typeof INSTRUMENTS)[number];
export const LAYER_IDS = ["layer1", "layer2"] as const;
export type LayerInstrument = (typeof LAYER_IDS)[number];

/** P7 (spec 8.7): `fm`, a two-operator FM voice (bells, glassy keys); `noise`, a sine body with a band of breathy noise. */
export const WAVES = ["sawtooth", "square", "triangle", "sine", "fm", "noise"] as const;
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
  // ---- P7 (spec 8.7, 8.10). Optional in a saved song (validation), filled from P7_PATCH_DEFAULTS by migrateSong. ----
  /** FM wave: the modulator's ratio (a step of FM_RATIOS) and its index, 0..1. */
  fmRatio: number;
  fmIndex: number;
  /** The tempo-synced filter LFO: its rate (a step of LFO_RATES) and depth (0 = off). It only closes the filter. */
  lfoRate: number;
  lfoDepth: number;
  /** The free-running slow LFO (spec 8.10) on filter, pitch, pan and sends: depth (0 = off) and rate. */
  drift: number;
  driftRate: number;
  /** Perc (a tuned tom or conga-like hit) and Shaker (drums). */
  percLevel: number;
  percDecay: number;
  percPitch: number;
  shakerLevel: number;
  shakerDecay: number;
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
  "fmRatio",
  "fmIndex",
  "lfoRate",
  "lfoDepth",
  "drift",
  "driftRate",
  "percLevel",
  "percDecay",
  "percPitch",
  "shakerLevel",
  "shakerDecay",
];
/** The keys P7 added: a song saved before may lack them; migrateSong fills them from these values. */
export const P7_PATCH_DEFAULTS = {
  fmRatio: 0.25,
  fmIndex: 0.3,
  lfoRate: 0.5,
  lfoDepth: 0,
  drift: 0,
  driftRate: 0.5,
  percLevel: 1,
  percDecay: 0.5,
  percPitch: 0.5,
  shakerLevel: 1,
  shakerDecay: 0.5,
} as const satisfies Partial<Record<NumericPatchKey, number>>;
export type P7PatchKey = keyof typeof P7_PATCH_DEFAULTS;
const P7_KEYS = Object.keys(P7_PATCH_DEFAULTS) as P7PatchKey[];
/** Allowed range per numeric patch key. */
export const PATCH_RANGES: Record<NumericPatchKey, [number, number]> = {
  // P7 (spec 8.10): attack and release up to 20 seconds, for pads and drones.
  attack: [0.001, 20],
  decay: [0.01, 4],
  sustain: [0, 1],
  release: [0.01, 20],
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
  fmRatio: [0, 1],
  fmIndex: [0, 1],
  lfoRate: [0, 1],
  lfoDepth: [0, 1],
  drift: [0, 1],
  driftRate: [0, 1],
  percLevel: [0, 1],
  percDecay: [0, 1],
  percPitch: [0, 1],
  shakerLevel: [0, 1],
  shakerDecay: [0, 1],
};

/** A patch value forced into its allowed range; null for an unknown wave or a non-number. */
export function clampPatchValue<K extends keyof Patch>(key: K, value: Patch[K]): Patch[K] | null {
  if (key === "wave") return (WAVES as readonly unknown[]).includes(value) ? value : null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const [lo, hi] = PATCH_RANGES[key as NumericPatchKey];
  return Math.max(lo, Math.min(hi, value)) as Patch[K];
}

export const LAYER_MODES = ["arp", "pad", "generative", "drone"] as const;
export type LayerMode = (typeof LAYER_MODES)[number];

export interface PadParams {
  attack: number; // seconds
  release: number; // seconds
  brightness: number; // 0..1 (used from G4)
  motion: number; // 0..1 (used from G4)
  /** Optional (P7, spec 8.10's Swoop): 0 or missing, a pad lets go and restarts on each chord; above 0 it holds and glides. */
  swoop?: number;
}

/** Longest attack and release of a pad or drone, in seconds (spec 8.10). */
export const MAX_PAD_TIME = 20;

/** A layer in Drone mode (P7, spec 8.10): the root alone, or the root and its fifth. */
export interface DroneParams {
  fifth: boolean;
}

export interface LayerPattern {
  mode: LayerMode;
  arp: ArpParams;
  pad: PadParams;
  gen: LeadParams;
  /** Optional (P7): Drone mode's settings; missing means root and fifth. */
  drone?: DroneParams;
  /** Optional (P2): earlier seeds of the lead, newest last, at most SEED_HISTORY. Back returns to the last one. */
  seeds?: number[];
}

/** Seeds kept per layer per section for Back (spec 8.3). */
export const SEED_HISTORY = 8;

export interface ChordStep {
  degree: number; // 0..6
  bars: ChordBars;
}
/** P7 (spec 8.10): 4 and 8 bars, for Ambient and Drone. */
export type ChordBars = 0.5 | 1 | 2 | 4 | 8;

export interface DrumsPattern {
  preset: DrumPreset;
  /**
   * Set when the preset was opened in the sequencer and edited. Stored at 16 steps (sixteenths) so
   * the presets' sixteenth hats survive an edit. The 8-step editor shows a step as lit when either of
   * its two sixteenths plays (see `toggleEighth`).
   */
  grid?: DrumGrid;
  /** Optional (P2): swing set by hand (the Swing dial), 0..MAX_SWING sixteenths; missing means the preset's. */
  swing?: number;
}

/** Most swing the Swing dial gives, in sixteenths (the presets use up to 0.22). */
export const MAX_SWING = 0.5;

export interface Section {
  name: string;
  on: Record<InstrumentId, boolean>;
  chords: ChordStep[];
  drums: DrumsPattern;
  bass: { rhythm: BassPreset };
  synth: { rhythm: SynthPreset };
  layer1: LayerPattern;
  layer2: LayerPattern;
  /** Optional (P2): positions 0..1 of the macro dials that act on this section ("drums.swing", "layer1.busy"). */
  macros?: Record<string, number>;
}

/** The Mix tab's master knobs. Saved with the song (G5) so a reload keeps them. */
export interface MixState {
  sweep: number; // -1..1: left low-pass, right high-pass, 0 open
  pump: number; // 0..0.95
  saturation: number; // 0..1
  /** Optional (P7): the lo-fi master, 0 off or 1 on (spec 8.7). */
  lofi?: number;
  /** Optional (P7): the air layer's level, 0 off (spec 8.10). */
  air?: number;
  /** Optional (P7): the shared reverb's decay in seconds, 1..20 (spec 8.10). */
  reverbDecay?: number;
}
export const DEFAULT_MIX: MixState = { sweep: 0, pump: 0.6, saturation: 0 };
/** Every mix key, its range and its value when a song does not set it. */
export const MIX_KEYS = ["sweep", "pump", "saturation", "lofi", "air", "reverbDecay"] as const;
export type MixKey = (typeof MIX_KEYS)[number];
export const MIX_RANGES: Record<MixKey, [number, number]> = { sweep: [-1, 1], pump: [0, 0.95], saturation: [0, 1], lofi: [0, 1], air: [0, 1], reverbDecay: [1, 20] };
/**
 * reverbDecay 1.9 s (P7 review S1): G1's Tone.Reverb({decay: 3.2}) shaped its impulse with a 0.27 s time constant,
 * so it fell 60 dB in about 1.9 s; the P7 reverb falls 60 dB over exactly its decay, so 1.9 keeps the old tail.
 */
export const MIX_DEFAULTS: Record<MixKey, number> = { sweep: 0, pump: 0.6, saturation: 0, lofi: 0, air: 0, reverbDecay: 1.9 };
/** A mix value, its default where the song does not set it. */
export function mixValue(m: MixState, k: MixKey): number {
  return m[k] ?? MIX_DEFAULTS[k];
}

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
  /** Optional (P2): positions 0..1 of the macro dials that act on the patches ("bass.bright"). */
  macros?: Record<string, number>;
  /** Optional (P3): the vibe (style id, a file in `src/styles/`) the song was started from. */
  style?: string;
  /** Optional (P9, spec 8.8): each instrument's two effect slots. Missing means every slot at its default, off. */
  fx?: Record<InstrumentId, FxRack>;
  /** Optional (P10, spec 8.9): the Drop page's settings over the vibe's recipe. Missing means the recipe as it is. */
  drop?: DropSettings;
}

/** The effect slots a song plays: its own, else each instrument's defaults (all off). A copy. */
export function songFx(song: Pick<Song, "fx">): Record<InstrumentId, FxRack> {
  return Object.fromEntries(
    INSTRUMENTS.map((id) => [id, (song.fx?.[id] ?? defaultRack(id)).map((s) => ({ ...s, knobs: [...s.knobs] })) as FxRack]),
  ) as Record<InstrumentId, FxRack>;
}

export const LIMITS = { bpm: [60, 180], sections: [1, 4], chords: [1, 8] } as const;
export const CHORD_LENGTHS = [0.5, 1, 2, 4, 8] as const;
export const MAX_SECTION_NAME = 12;

/** A chord sequence the engine accepts: 1..8 chords, degrees 0..6, lengths of half, one, two, four or eight bars. */
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
    ...P7_PATCH_DEFAULTS,
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
      // C4 (P2): level 0.7 (was 0.22), so its pad, trimmed 12 dB (PAD_TRIM), sits about 2 dB under where it
      // did; a short envelope (was attack 0.7 s, a pad's) so its lead and arp sit level with Layer 1's. Pad mode
      // takes its attack and release from the pad settings, so the pad does not hear the envelope change.
      return { ...base, attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.4, cutoff: 0.45, resonance: 0.1, reverb: 0.6, level: 0.7 };
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

/** Every problem with a patch (wave and every value in range), pushed onto `errors`. */
export function checkPatch(p: unknown, at: string, errors: string[]): void {
  if (!isObj(p)) return void errors.push(`${at}: not an object`);
  if (!oneOf(p.wave, WAVES)) errors.push(`${at}.wave: unknown wave`);
  for (const k of PATCH_KEYS) {
    if (p[k] === undefined && (P7_KEYS as string[]).includes(k)) continue; // a song saved before P7
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
    if (!inRange(pad.attack, 0.001, MAX_PAD_TIME)) errors.push(`${at}.pad.attack: must be 0.001..${MAX_PAD_TIME}`);
    if (!inRange(pad.release, 0.01, MAX_PAD_TIME)) errors.push(`${at}.pad.release: must be 0.01..${MAX_PAD_TIME}`);
    if (!inRange(pad.brightness, 0, 1)) errors.push(`${at}.pad.brightness: must be 0..1`);
    if (!inRange(pad.motion, 0, 1)) errors.push(`${at}.pad.motion: must be 0..1`);
    if (pad.swoop !== undefined && !inRange(pad.swoop, 0, 1)) errors.push(`${at}.pad.swoop: must be 0..1`);
  }
  const g = l.gen;
  if (!isObj(g)) errors.push(`${at}.gen: not an object`);
  else {
    for (const k of ["lock", "tension", "density"]) if (!inRange(g[k], 0, 1)) errors.push(`${at}.gen.${k}: must be 0..1`);
    if (!inRange(g.hits, 1, 16)) errors.push(`${at}.gen.hits: must be 1..16`);
    if (!inRange(g.rotate, 0, 15)) errors.push(`${at}.gen.rotate: must be 0..15`);
    if (!inRange(g.length, 2, 16)) errors.push(`${at}.gen.length: must be 2..16`);
    if (!isNum(g.seed) || !Number.isInteger(g.seed)) errors.push(`${at}.gen.seed: must be an integer`);
    // P5: optional, so songs saved before it load as Pulse at its defaults.
    if (g.style !== undefined && !(LEAD_STYLES as readonly unknown[]).includes(g.style)) errors.push(`${at}.gen.style: unknown`);
    if (g.shape !== undefined && !(LEAD_SHAPES as readonly unknown[]).includes(g.shape)) errors.push(`${at}.gen.shape: unknown`);
    if (g.phrase !== undefined && !(PHRASE_BARS as readonly unknown[]).includes(g.phrase)) errors.push(`${at}.gen.phrase: must be 1, 2, 4 or 8`);
    for (const k of ["range", "register", "noteLength", "variation", "repeats", "slide", "accent"])
      if (g[k] !== undefined && !inRange(g[k], 0, 1)) errors.push(`${at}.gen.${k}: must be 0..1`);
  }
  if (l.drone !== undefined && (!isObj(l.drone) || typeof l.drone.fifth !== "boolean")) errors.push(`${at}.drone.fifth: must be true or false`);
  if (l.seeds !== undefined) {
    const h = l.seeds;
    if (!Array.isArray(h) || h.length > SEED_HISTORY || !h.every((x) => isNum(x) && Number.isInteger(x)))
      errors.push(`${at}.seeds: must be at most ${SEED_HISTORY} integers`);
  }
}

function checkMacros(m: unknown, at: string, errors: string[]): void {
  if (!isObj(m)) return void errors.push(`${at}: not an object`);
  for (const [k, v] of Object.entries(m)) {
    if (!MACRO_KEYS.includes(k)) errors.push(`${at}.${k}: unknown macro`);
    else if (!inRange(v, 0, 1)) errors.push(`${at}.${k}: must be 0..1`);
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
      if (!isObj(c) || !oneOf(c.bars, CHORD_LENGTHS)) errors.push(`${at}.chords[${i}].bars: must be 0.5, 1, 2, 4 or 8`);
    });
  if (!isObj(s.drums) || !oneOf(s.drums.preset, DRUM_PRESETS)) errors.push(`${at}.drums.preset: unknown preset`);
  else if (s.drums.grid !== undefined) {
    const g = s.drums.grid;
    if (!isObj(g)) errors.push(`${at}.drums.grid: not an object`);
    else
      for (const v of DRUM_VOICES) {
        const r = g[v];
        if (r === undefined && !(CORE_DRUM_VOICES as readonly string[]).includes(v)) continue; // saved before P7
        if (!Array.isArray(r) || r.length !== 16 || !r.every((x) => inRange(x, 0, 1)))
          errors.push(`${at}.drums.grid.${v}: must be 16 values 0..1`);
      }
  }
  if (isObj(s.drums) && s.drums.swing !== undefined && !inRange(s.drums.swing, 0, MAX_SWING))
    errors.push(`${at}.drums.swing: must be 0..${MAX_SWING}`);
  if (s.macros !== undefined) checkMacros(s.macros, `${at}.macros`, errors);
  if (!isObj(s.bass) || !oneOf(s.bass.rhythm, BASS_PRESETS)) errors.push(`${at}.bass.rhythm: unknown preset`);
  if (!isObj(s.synth) || !oneOf(s.synth.rhythm, SYNTH_PRESETS)) errors.push(`${at}.synth.rhythm: unknown preset`);
  checkLayer(s.layer1, `${at}.layer1`, errors);
  checkLayer(s.layer2, `${at}.layer2`, errors);
}

function checkMix(m: unknown, at: string, errors: string[]): void {
  if (!isObj(m)) return void errors.push(`${at}: not an object`);
  for (const k of MIX_KEYS) {
    if (m[k] === undefined && (k === "lofi" || k === "air" || k === "reverbDecay")) continue; // optional (P7)
    const [lo, hi] = MIX_RANGES[k];
    if (!inRange(m[k], lo, hi)) errors.push(`${at}.${k}: must be ${lo}..${hi}`);
  }
}

function checkFx(fx: unknown, at: string, errors: string[]): void {
  if (!isObj(fx)) return void errors.push(`${at}: not an object`);
  for (const id of INSTRUMENTS) {
    const r = fx[id];
    if (!Array.isArray(r) || r.length !== FX_SLOTS) errors.push(`${at}.${id}: must be ${FX_SLOTS} slots`);
    else r.forEach((s, i) => checkFxSlot(s, `${at}.${id}[${i}]`, errors));
  }
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
  if (doc.macros !== undefined) checkMacros(doc.macros, "macros", errors);
  if (doc.style !== undefined && (typeof doc.style !== "string" || !doc.style)) errors.push("style: must be a style id");
  if (doc.fx !== undefined) checkFx(doc.fx, "fx", errors);
  if (doc.drop !== undefined) checkDropSettings(doc.drop, "drop", errors);
  if (doc.version !== 1) errors.push("version: must be 1");
  if (typeof doc.name !== "string") errors.push("name: must be a string");
  if (!oneOf(doc.key, NOTE_NAMES)) errors.push("key: unknown key");
  if (!oneOf(doc.mood, MOODS)) errors.push("mood: unknown mood");
  if (!isNum(doc.bpm) || !inRange(doc.bpm, LIMITS.bpm[0], LIMITS.bpm[1])) errors.push(`bpm: must be ${LIMITS.bpm[0]}..${LIMITS.bpm[1]}`);
  if (!isObj(doc.patches)) errors.push("patches: not an object");
  else for (const id of INSTRUMENTS) checkPatch(doc.patches[id], `patches.${id}`, errors);
  if (!Array.isArray(doc.sections) || doc.sections.length < LIMITS.sections[0] || doc.sections.length > LIMITS.sections[1])
    errors.push("sections: must hold 1..4 sections");
  else doc.sections.forEach((s, i) => checkSection(s, `sections[${i}]`, errors));
  return errors;
}

/** Layer 2's envelope before P2: a pad's (C4 changed it with its level; see defaultPatch). */
export const OLD_LAYER2_ENVELOPE = { attack: 0.7, decay: 0.6, sustain: 0.8, release: 1.8 } as const;
/** Layer 2's level before P2. */
export const OLD_LAYER2_LEVEL = 0.22;

/**
 * Bring a song saved before P2 to P2's balance (P2 review S1). P2 trims every pad 12 dB (PAD_TRIM) and moved
 * Layer 2's default level (0.22 to 0.7) and envelope (a pad's 0.7 s attack to a short one) to match. A song saved
 * before keeps Layer 2's old envelope, which no dial sets exactly: where it does, the envelope takes the new
 * default and the level rises by the same ratio (0.7 / 0.22, +10 dB, at most 1), so its pad sits where it did
 * (about 2 dB under) and its lead and arp sit level with Layer 1's, as in a new song. Returns the song itself
 * when nothing needs changing, else a migrated copy. The take's start song in a log migrates the same way.
 */
export function migrateSong<T extends Song>(given: T): T {
  const song = migrateP7(given);
  const p = song.patches.layer2;
  const old = (Object.keys(OLD_LAYER2_ENVELOPE) as (keyof typeof OLD_LAYER2_ENVELOPE)[]).every((k) => p[k] === OLD_LAYER2_ENVELOPE[k]);
  const log = song.log ? migrateSong(song.log.start) : undefined;
  if (!old && log === song.log?.start) return song;
  const out: T = { ...song };
  if (old) {
    const now = defaultPatch("layer2");
    const level = Math.min(1, Math.round(((p.level * now.level) / OLD_LAYER2_LEVEL) * 1e6) / 1e6);
    out.patches = {
      ...song.patches,
      layer2: { ...p, attack: now.attack, decay: now.decay, sustain: now.sustain, release: now.release, level },
    };
  }
  if (song.log && log) out.log = { ...song.log, start: log };
  return out;
}

/**
 * Bring a song saved before P7 to P7's document: the patch keys P7 added take their defaults, and an edited drum
 * grid gains silent Perc and Shaker rows. Returns the song itself when nothing is missing, else a copy.
 */
export function migrateP7<T extends Song>(song: T): T {
  const patchGaps = INSTRUMENTS.some((id) => P7_KEYS.some((k) => song.patches[id][k] === undefined));
  const gridGaps = song.sections.some((s) => s.drums.grid && DRUM_VOICES.some((v) => !Array.isArray(s.drums.grid![v])));
  if (!patchGaps && !gridGaps) return song;
  const out: T = { ...song };
  if (patchGaps)
    out.patches = Object.fromEntries(INSTRUMENTS.map((id) => [id, { ...P7_PATCH_DEFAULTS, ...song.patches[id] }])) as Record<InstrumentId, Patch>;
  if (gridGaps)
    out.sections = song.sections.map((s) => {
      if (!s.drums.grid) return s;
      const grid = { ...s.drums.grid };
      for (const v of DRUM_VOICES) if (!Array.isArray(grid[v])) grid[v] = new Array(16).fill(0);
      return { ...s, drums: { ...s.drums, grid } };
    });
  return out;
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
  const g = s.drums.grid;
  if (!g) return DRUM_PATTERNS[s.drums.preset].grid;
  return DRUM_VOICES.every((v) => Array.isArray(g[v])) ? g : fullGrid(g);
}

/**
 * Hits per sixteenth of one voice in a section (P7, hat rolls): the preset's rolls, on the steps the section's grid
 * still plays (an edit that clears a step clears its roll; an edited grid keeps the preset's rolls elsewhere).
 */
export function sectionRoll(s: Section, voice: DrumVoice, step: number): number {
  return DRUM_PATTERNS[s.drums.preset]?.rolls[voice]?.[step] ?? 1;
}

/** The swing a section plays, in sixteenths: its own (the Swing dial), or its preset's. */
export function sectionSwing(s: Section): number {
  return s.drums.swing ?? DRUM_PATTERNS[s.drums.preset].swing;
}

/** Longest song name, in characters. */
export const MAX_SONG_NAME = 24;

/** A name a song can carry: spaces collapsed, trimmed, at most MAX_SONG_NAME characters; null if empty. */
export function cleanName(name: string): string | null {
  const n = name.replace(/\s+/g, " ").trim().slice(0, MAX_SONG_NAME);
  return n.length ? n : null;
}
