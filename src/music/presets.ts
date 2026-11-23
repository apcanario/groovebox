/**
 * Bass rhythms, synth rhythms and drum beats (P3: data files, one per entry, under `src/data/bass/`,
 * `src/data/synth/` and `src/data/beats/`). A new file is a new entry in every picker; nothing else changes.
 * 16 steps per bar. No audio dependency.
 */
import {
  CORE_DRUM_VOICES,
  DRUM_VOICES,
  checkGrid,
  checkRolls,
  checkHits,
  checkNamed,
  readData,
  type BassRhythmDef,
  type BeatDef,
  type DrumGrid,
  type DrumVoice,
  type Named,
  type RhythmHit,
  type SynthRhythmDef,
} from "./data.ts";

export { CORE_DRUM_VOICES, DRUM_VOICES, type DrumGrid, type DrumVoice, type RhythmHit };

const bass = readData<BassRhythmDef>(import.meta.glob("../data/bass/*.ts", { eager: true }), (e) => {
  const out = checkNamed(e);
  checkHits(e.hits, out);
  return out;
});
const synth = readData<SynthRhythmDef>(import.meta.glob("../data/synth/*.ts", { eager: true }), (e) => {
  const out = checkNamed(e);
  checkHits(e.hits, out);
  return out;
});
const beats = readData<BeatDef>(import.meta.glob("../data/beats/*.ts", { eager: true }), (e) => {
  const out = checkNamed(e);
  if (!(e.swing >= 0 && e.swing <= 0.5)) out.push("swing: must be 0..0.5");
  checkGrid(e.grid, out);
  if (!out.length) checkRolls(e.rolls, e.grid, out);
  return out;
});

/** A bass rhythm's id: its file name. */
export type BassPreset = string;
/** A synth rhythm's id: its file name. */
export type SynthPreset = string;
/** A drum beat's id: its file name. */
export type DrumPreset = string;

/** Every bass rhythm, in picker order. */
export const BASS_PRESETS: readonly BassPreset[] = bass.ids;
export const BASS_RHYTHMS: Record<BassPreset, RhythmHit[]> = Object.fromEntries(bass.ids.map((id) => [id, bass.byId[id].hits]));

/** Every synth rhythm, in picker order. */
export const SYNTH_PRESETS: readonly SynthPreset[] = synth.ids;
export const SYNTH_RHYTHMS: Record<SynthPreset, RhythmHit[]> = Object.fromEntries(synth.ids.map((id) => [id, synth.byId[id].hits]));
/** Synth rhythms that hold the chord for its whole length. */
export const SYNTH_HOLD: ReadonlySet<SynthPreset> = new Set(synth.ids.filter((id) => synth.byId[id].hold));

export interface DrumPattern {
  grid: DrumGrid;
  /** Delay of odd sixteenths, as a fraction of a step (0 = straight). */
  swing: number;
  /** P7: hits per sixteenth by voice, 16 per row (1 = a single hit); only voices that roll have a row. */
  rolls: Partial<Record<DrumVoice, number[]>>;
}

/** A beat file's grid with every voice: Perc and Shaker silent where the file has no row for them. */
export function fullGrid(g: Partial<DrumGrid>): DrumGrid {
  return Object.fromEntries(DRUM_VOICES.map((v) => [v, g[v] ? [...g[v]!] : new Array(16).fill(0)])) as DrumGrid;
}

function rollRows(r: BeatDef["rolls"]): Partial<Record<DrumVoice, number[]>> {
  const out: Partial<Record<DrumVoice, number[]>> = {};
  for (const v of DRUM_VOICES) {
    const steps = r?.[v];
    if (steps) out[v] = Array.from({ length: 16 }, (_, i) => steps[i] ?? 1);
  }
  return out;
}

/** Every drum beat, in picker order. */
export const DRUM_PRESETS: readonly DrumPreset[] = beats.ids;
export const DRUM_PATTERNS: Record<DrumPreset, DrumPattern> = Object.fromEntries(
  beats.ids.map((id) => [id, { grid: fullGrid(beats.byId[id].grid), swing: beats.byId[id].swing, rolls: rollRows(beats.byId[id].rolls) }]),
);

/** The picker words of every entry: `name` in Advanced, `simple` in Simple. */
export interface PresetNames {
  name: string;
  simple: string;
}
const names = (byId: Record<string, Named>): Record<string, PresetNames> =>
  Object.fromEntries(Object.entries(byId).map(([id, e]) => [id, { name: e.name, simple: e.simple ?? e.name }]));
export const BEAT_NAMES: Record<DrumPreset, PresetNames> = names(beats.byId);
export const BASS_NAMES: Record<BassPreset, PresetNames> = names(bass.byId);
export const SYNTH_NAMES: Record<SynthPreset, PresetNames> = names(synth.byId);

// ---- 8-step sequencer (G3) ------------------------------------------------------

/** Steps of the drum sequencer: eight per bar, each covering two sixteenths of the stored grid. */
export const SEQ_STEPS = 8;

/** Steps of the 16-step view of the sequencer (P7): one per sixteenth of the stored grid. */
export const SEQ_STEPS_16 = 16;

/** Velocity a step gets when it is switched on in the sequencer. */
export const SEQ_VELOCITY: Record<DrumVoice, number> = { kick: 1, clap: 0.9, hat: 0.4, open: 0.7, perc: 0.8, shaker: 0.5 };

/** A sequencer step is lit when either of its two sixteenths plays. */
export function eighthOn(row: readonly number[], i: number): boolean {
  return (row[2 * i] ?? 0) > 0 || (row[2 * i + 1] ?? 0) > 0;
}

/**
 * Flip one sequencer step: a lit step clears both its sixteenths. An unlit one lights the sixteenth
 * the section's preset plays there (the first of the two with a hit, at the preset's velocity), so
 * off then on puts an offbeat hat back on its offbeat (G3 review M5); with no preset hit there, the
 * first sixteenth at `vel`.
 */
export function toggleEighth(row: readonly number[], i: number, vel: number, preset?: readonly number[]): number[] {
  const out = [...row];
  if (i < 0 || i >= SEQ_STEPS) return out;
  if (eighthOn(row, i)) {
    out[2 * i] = 0;
    out[2 * i + 1] = 0;
    return out;
  }
  const j = [2 * i, 2 * i + 1].find((k) => (preset?.[k] ?? 0) > 0);
  if (j === undefined) out[2 * i] = vel;
  else out[j] = preset![j];
  return out;
}

/**
 * Sixteenths from the hit on `step` to the same voice's next hit in a 16-step row, wrapping into
 * the next bar, with swing: odd steps sound `swing` of a sixteenth late. 16 for a lone hit.
 */
export function nextHitGap(row: readonly number[], step: number, swing: number): number {
  const at = (k: number): number => k + (k % 2 === 1 ? swing : 0);
  for (let d = 1; d <= 16; d++) {
    const k = (step + d) % 16;
    if ((row[k] ?? 0) > 0) return at(k) + (step + d >= 16 ? 16 : 0) - at(step);
  }
  return 16;
}

/**
 * Flip one sixteenth (P7's 16-step view): a lit step clears; an unlit one takes the preset's velocity there, or `vel`.
 */
export function toggleSixteenth(row: readonly number[], i: number, vel: number, preset?: readonly number[]): number[] {
  const out = [...row];
  if (!Number.isInteger(i) || i < 0 || i >= SEQ_STEPS_16) return out;
  out[i] = (row[i] ?? 0) > 0 ? 0 : (preset?.[i] ?? 0) > 0 ? preset![i] : vel;
  return out;
}

/** A deep copy of a drum grid with every voice, so an edited section never shares rows with a preset. */
export function copyGrid(g: Partial<DrumGrid>): DrumGrid {
  return fullGrid(g);
}
