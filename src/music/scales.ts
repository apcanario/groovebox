/** Keys, scales and moods (spec section 3). No audio dependency. */

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type KeyName = (typeof NOTE_NAMES)[number];

export const MOODS = ["major", "minor", "house", "deep", "dark"] as const;
export type Mood = (typeof MOODS)[number];

export type Voicing = "triads" | "extended" | "low";

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
} as const;
export type ScaleName = keyof typeof SCALES;

export const MOOD_TABLE: Record<Mood, { scale: ScaleName; voicing: Voicing; label: string }> = {
  major: { scale: "major", voicing: "triads", label: "Major" },
  minor: { scale: "minor", voicing: "triads", label: "Minor" },
  house: { scale: "minor", voicing: "extended", label: "House" },
  deep: { scale: "dorian", voicing: "extended", label: "Deep" },
  dark: { scale: "phrygian", voicing: "low", label: "Dark" },
};

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
