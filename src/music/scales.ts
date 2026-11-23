/** Keys, scales and moods (spec section 3). Moods are data files (P3). No audio dependency. */
import { checkNamed, readData, type MoodDef } from "./data.ts";

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type KeyName = (typeof NOTE_NAMES)[number];

export type Voicing = "triads" | "extended" | "low";

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
} as const;
export type ScaleName = keyof typeof SCALES;

/** A mood's id: the name of its file in `src/data/moods/` (P3: moods are data). */
export type Mood = string;

const moods = readData<MoodDef>(import.meta.glob("../data/moods/*.ts", { eager: true }), (m) => {
  const out = checkNamed(m);
  if (!(m.scale in SCALES)) out.push("scale: unknown");
  if (!["triads", "extended", "low"].includes(m.voicing)) out.push("voicing: unknown");
  return out;
});

/** Every mood, in picker order. */
export const MOODS: readonly Mood[] = moods.ids;

export const MOOD_TABLE: Record<Mood, { scale: ScaleName; voicing: Voicing; label: string; simple: string }> = Object.fromEntries(
  moods.ids.map((id) => {
    const m = moods.byId[id];
    return [id, { scale: m.scale, voicing: m.voicing, label: m.name, simple: m.simple ?? m.name }];
  }),
);

export function keyIndex(key: KeyName): number {
  return NOTE_NAMES.indexOf(key);
}

/** Pitch classes (0..11) of the song's scale, tonic first. */
export function scalePitchClasses(key: KeyName, mood: Mood): number[] {
  const k = keyIndex(key);
  return SCALES[MOOD_TABLE[mood].scale].map((i) => (k + i) % 12);
}

export function inScale(midi: number, key: KeyName, mood: Mood): boolean {
  return scalePitchClasses(key, mood).includes(((midi % 12) + 12) % 12);
}

/** All scale notes between lo and hi (inclusive), ascending. */
export function scaleNotesInRange(key: KeyName, mood: Mood, lo: number, hi: number): number[] {
  const pcs = scalePitchClasses(key, mood);
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) out.push(m);
  return out;
}

export function midiToName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
