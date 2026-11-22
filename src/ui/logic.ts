/** Pure UI logic: no DOM, no audio. Unit-tested in logic.test.ts. */
import type { ChordStep } from "../engine/song.ts";

export const MAX_CHORDS = 8;
const LENGTHS: ChordStep["bars"][] = [1, 2, 0.5];

/** Pixels of vertical drag that sweep a dial over its whole range. */
export const DRAG_SPAN_PX = 220;

/**
 * Value after a vertical drag of `dy` pixels (positive is down) from `start`. Up raises it. The
 * result is clamped to [min, max] and, when `step` is given, rounded to it.
 */
export function dragValue(start: number, dy: number, min: number, max: number, step = 0, span = DRAG_SPAN_PX): number {
  let v = start - (dy / span) * (max - min);
  if (step > 0) v = min + Math.round((v - min) / step) * step;
  return Math.max(min, Math.min(max, v));
}

/** Where a value sits in its range, 0..1. */
export function fraction(v: number, min: number, max: number): number {
  return max === min ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min)));
}

/** Transport counter: bar and beat, both from 1 ("17.3"); a dash when stopped. */
export function barLabel(playing: boolean, bar: number, step: number): string {
  return playing ? `${bar + 1}.${Math.floor(step / 4) + 1}` : "–";
}

export function sectionLetter(i: number): string {
  return String.fromCharCode(65 + i);
}

/** The section being edited: the chosen one, or the playing one when following. */
export function editedSection(chosen: number | null, playing: number, count: number): number {
  const i = chosen ?? playing;
  return Math.max(0, Math.min(count - 1, i));
}

/** Tapping a section in the strip: the playing one goes back to following, any other is edited silently. */
export function chooseSection(tapped: number, playing: number): number | null {
  return tapped === playing ? null : tapped;
}

// ---- Chord sequence edits (each returns a new array, or the same one when refused) ----

export function addChord(seq: ChordStep[], degree: number): ChordStep[] {
  if (seq.length >= MAX_CHORDS) return seq;
  return [...seq, { degree, bars: 1 }];
}

export function replaceChord(seq: ChordStep[], i: number, degree: number): ChordStep[] {
  if (i < 0 || i >= seq.length) return seq;
  return seq.map((c, j) => (j === i ? { ...c, degree } : c));
}

export function removeChord(seq: ChordStep[], i: number): ChordStep[] {
  if (seq.length <= 1 || i < 0 || i >= seq.length) return seq;
  return seq.filter((_, j) => j !== i);
}

/** Move chord `i` one place left (-1) or right (+1). */
export function moveChord(seq: ChordStep[], i: number, dir: -1 | 1): ChordStep[] {
  const j = i + dir;
  if (i < 0 || i >= seq.length || j < 0 || j >= seq.length) return seq;
  const out = [...seq];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** Cycle a chord's length: 1 bar, 2 bars, half a bar. */
export function cycleLength(seq: ChordStep[], i: number): ChordStep[] {
  if (i < 0 || i >= seq.length) return seq;
  const next = LENGTHS[(LENGTHS.indexOf(seq[i].bars) + 1) % LENGTHS.length];
  return seq.map((c, j) => (j === i ? { ...c, bars: next } : c));
}

export function lengthLabel(bars: ChordStep["bars"]): string {
  return bars === 0.5 ? "½ bar" : bars === 1 ? "1 bar" : "2 bars";
}

/** Chord name from its root pitch class and roman label: "A", "Am", "Bdim". */
export function chordName(rootPc: number, label: string, names: readonly string[]): string {
  const root = names[((rootPc % 12) + 12) % 12];
  if (label.endsWith("°")) return `${root}dim`;
  return label === label.toUpperCase() ? root : `${root}m`;
}

/** Filter sweep display: "LP 40" left of centre, "HP 40" right, "Open" at centre. */
export function sweepLabel(v: number): string {
  const n = Math.round(Math.abs(v) * 100);
  if (n === 0) return "Open";
  return `${v < 0 ? "LP" : "HP"} ${n}`;
}

export function hzLabel(hz: number): string {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;
}
