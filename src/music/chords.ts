/** Easy-mode chords: the triad (or 7th/9th) on each degree of the scale, voiced by mood. */
import { MOOD_TABLE, SCALES, keyIndex, type KeyName, type Mood } from "./scales.ts";

export interface Chord {
  degree: number; // 0..6
  label: string; // roman numeral, e.g. "i", "VI", "ii°"
  bass: number; // midi note of the root for the bass, in octave 1
  notes: number[]; // midi notes of the voicing, ascending
  /** Pitch classes of the chord tones. */
  tones: number[];
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** Semitone offset from the tonic of the scale step `step` (may exceed 6: wraps up an octave). */
function stepOffset(intervals: readonly number[], step: number): number {
  return intervals[step % 7] + 12 * Math.floor(step / 7);
}

export function chordLabel(intervals: readonly number[], degree: number): string {
  const root = stepOffset(intervals, degree);
  const third = stepOffset(intervals, degree + 2) - root;
  const fifth = stepOffset(intervals, degree + 4) - root;
  const numeral = ROMAN[degree];
  if (third === 4) return numeral;
  if (fifth === 6) return `${numeral.toLowerCase()}°`;
  return numeral.toLowerCase();
}

export function buildChord(key: KeyName, mood: Mood, degree: number): Chord {
  const { scale, voicing } = MOOD_TABLE[mood];
  const intervals = SCALES[scale];
  const k = keyIndex(key);
  const steps = voicing === "extended" ? [0, 2, 4, 6, 8] : [0, 2, 4];
  const rel = steps.map((s) => stepOffset(intervals, degree + s));
  const rootPc = (k + rel[0]) % 12;
  // Normal voicings put the root in A3..G#4 (57..68); low ones an octave down.
  const floor = voicing === "low" ? 45 : 57;
  let rootMidi = 12 * Math.floor(floor / 12) + rootPc;
  if (rootMidi < floor) rootMidi += 12;
  const notes = rel.map((r) => rootMidi + r - rel[0]);
  let bass = 24 + rootPc; // C1..B1
  if (bass < 28) bass += 12; // keep the bass between E1 and D#2
  return {
    degree,
    label: chordLabel(intervals, degree),
    bass,
    notes,
    tones: notes.map((n) => n % 12),
  };
}

/** The seven easy-mode buttons for a key and mood. */
export function degreeChords(key: KeyName, mood: Mood): Chord[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => buildChord(key, mood, d));
}
