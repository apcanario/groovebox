/** Pure UI logic: no DOM, no audio. Unit-tested in logic.test.ts. */
import type { ChordStep, InstrumentId, NumericPatchKey } from "../engine/song.ts";

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

/** Transport counter: bar and beat, both from 1 ("17.3"); from bar 100 the bar alone ("100"), so it fits; a dash when stopped. */
export function barLabel(playing: boolean, bar: number, step: number): string {
  if (!playing) return "–";
  return bar + 1 >= 100 ? `${bar + 1}` : `${bar + 1}.${Math.floor(step / 4) + 1}`;
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

/** A chosen section that no longer exists, or that is now the playing one, goes back to following (null). */
export function keepChosen(chosen: number | null, playing: number, count: number): number | null {
  return chosen !== null && (chosen >= count || chosen === playing) ? null : chosen;
}

export interface StripInput {
  /** Section chosen for editing, or null when following. */
  chosen: number | null;
  /** Section heard now (or the one Play starts from). */
  playing: number;
  /** Section being edited (from editedSection). */
  edit: number;
  /** Whether the transport runs. */
  running: boolean;
  /** The section's name. */
  name: string;
}

/**
 * One button of the section strip. The edit mark shows only when editing departs from following:
 * a chosen section, or the edited one when it is not the playing one. The label says "Playing" for
 * the section heard while running, "Editing" for the edited one, and the name otherwise.
 */
export function stripState(i: number, s: StripInput): { isPlaying: boolean; isEdit: boolean; sub: string } {
  const isPlaying = i === s.playing;
  const isEdit = i === s.edit && (s.chosen !== null || !isPlaying);
  const sub = isPlaying && s.running ? "Playing" : isEdit ? "Editing" : s.name;
  return { isPlaying, isEdit, sub };
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

// ---- Patch knobs (G3) ----------------------------------------------------------------

/** How a dial's 0..1 position maps to its value: all `knobPos`, `knobValue` and `knobText` need (G4 review M5). */
export interface KnobCurve {
  label: string;
  /** Seconds on an exponential curve from lo to hi; absent for plain 0..1 amounts. */
  seconds?: [number, number];
}

/** One dial on an instrument tab: which patch key, and how its 0..1 dial position maps to the value. */
export interface KnobSpec extends KnobCurve {
  key: NumericPatchKey;
}

/** Dial position 0..1 of a patch value. */
export function knobPos(k: KnobCurve, v: number): number {
  if (!k.seconds) return Math.max(0, Math.min(1, v));
  const [lo, hi] = k.seconds;
  return Math.max(0, Math.min(1, Math.log(Math.max(lo, v) / lo) / Math.log(hi / lo)));
}

/** Patch value at a dial position 0..1. */
export function knobValue(k: KnobCurve, pos: number): number {
  const p = Math.max(0, Math.min(1, pos));
  if (!k.seconds) return p;
  const [lo, hi] = k.seconds;
  return lo * Math.pow(hi / lo, p);
}

/** "4 ms", "120 ms", "1.2 s". */
export function secondsLabel(s: number): string {
  return s < 1 ? `${Math.round(s * 1000)} ms` : `${s.toFixed(1)} s`;
}

/** What the dial shows: seconds for times, 0..100 for amounts. */
export function knobText(k: KnobCurve, v: number): string {
  return k.seconds ? secondsLabel(v) : String(Math.round(v * 100));
}

/** At most six dials per screen (spec section 5): split a list into pages of `size`. */
export function paginate<T>(items: readonly T[], size = 6): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out.length ? out : [[]];
}

export interface KnobPage {
  name: string;
  knobs: KnobSpec[];
}

/** The patch dials of the Drums, Bass and Synth tabs, page by page; no page holds more than six. */
export const KNOB_PAGES: Partial<Record<InstrumentId, KnobPage[]>> = {
  drums: [
    {
      name: "Kick · Clap",
      knobs: [
        { key: "kickLevel", label: "Kick" },
        { key: "kickDecay", label: "K decay" },
        { key: "pitch", label: "K pitch" },
        { key: "drive", label: "K drive" },
        { key: "clapLevel", label: "Clap" },
        { key: "clapDecay", label: "C decay" },
      ],
    },
    {
      name: "Hats",
      knobs: [
        { key: "hatLevel", label: "Hat" },
        { key: "hatDecay", label: "H decay" },
        { key: "openLevel", label: "Open" },
        { key: "openDecay", label: "O decay" },
      ],
    },
  ],
  bass: [
    {
      name: "Patch",
      knobs: [
        { key: "envAmount", label: "Env amt" },
        { key: "decay", label: "Decay", seconds: [0.03, 1.5] },
        { key: "drive", label: "Drive" },
        { key: "sub", label: "Sub" },
        { key: "glide", label: "Glide" },
      ],
    },
  ],
  synth: [
    {
      name: "Patch",
      knobs: [
        { key: "detune", label: "Detune" },
        { key: "attack", label: "Attack", seconds: [0.002, 2] },
        { key: "decay", label: "Decay", seconds: [0.02, 2] },
        { key: "release", label: "Release", seconds: [0.02, 4] },
        { key: "envAmount", label: "Filt env" },
        { key: "drive", label: "Drive" },
      ],
    },
  ],
};

/** Preset names as shown on the chips. */
export const PRESET_LABEL: Record<string, string> = {
  fourFloor: "4/4",
  houseShuffle: "Shuffle",
  techno: "Techno",
  twoStep: "2-step",
  dnb: "DnB",
  offbeat: "Offbeat",
  rolling: "Rolling",
  long: "Long",
  dnbSub: "DnB sub",
  stabs: "Stabs",
  sustained: "Held",
};

export const WAVE_LABEL: Record<string, string> = { sawtooth: "Saw", square: "Square", triangle: "Tri", sine: "Sine" };

/** Meter fill 0..1 for a level in dB: -60 dB empty, 0 dB full. */
export function meterFraction(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

// ---- Layers (G4) -----------------------------------------------------------------------

/** Mode switch order and names, as in docs/design/layer1-tab.jpg; the title names the mode's role. */
export const LAYER_MODE_ORDER = ["arp", "generative", "pad"] as const;
export const LAYER_MODE_LABEL: Record<(typeof LAYER_MODE_ORDER)[number], string> = { arp: "Arp", generative: "Generative", pad: "Pad" };
export const LAYER_MODE_TITLE: Record<(typeof LAYER_MODE_ORDER)[number], string> = { arp: "Arp", generative: "Lead", pad: "Pad" };

/** One generative knob: range, whole steps or not, and its colour token. */
export interface GenKnob {
  key: "lock" | "hits" | "length" | "tension" | "density" | "rotate";
  label: string;
  min: number;
  max: number;
  /** Whole numbers (hits, length, rotate) show as they are; 0..1 amounts show as 0..100. */
  step: number;
  color: string;
}

/** The six generative knobs of spec section 3, in the order and colours of the design. */
export const GEN_KNOBS: readonly GenKnob[] = [
  { key: "lock", label: "Lock", min: 0, max: 1, step: 0, color: "var(--coral)" },
  { key: "hits", label: "Hits", min: 1, max: 16, step: 1, color: "var(--purple)" },
  { key: "length", label: "Length", min: 2, max: 16, step: 1, color: "var(--yellow)" },
  { key: "tension", label: "Tension", min: 0, max: 1, step: 0, color: "var(--orange)" },
  { key: "density", label: "Density", min: 0, max: 1, step: 0, color: "var(--teal)" },
  { key: "rotate", label: "Rotate", min: 0, max: 15, step: 1, color: "var(--blue)" },
];

/** What a generative dial shows: whole numbers as they are, amounts as 0..100. */
export function genText(k: GenKnob, v: number): string {
  return k.step ? String(Math.round(v)) : String(Math.round(v * 100));
}

/** Pad dials: attack and release in seconds on a curve, brightness and motion as amounts. */
export const PAD_KNOBS: readonly { key: "attack" | "release" | "brightness" | "motion"; label: string; seconds?: [number, number] }[] = [
  { key: "attack", label: "Attack", seconds: [0.005, 4] },
  { key: "release", label: "Release", seconds: [0.05, 8] },
  { key: "brightness", label: "Bright" },
  { key: "motion", label: "Motion" },
];

/** Patch dials shared by the three layer modes (the wave is a chip row above them). */
export const LAYER_PATCH_KNOBS: readonly KnobSpec[] = [
  { key: "attack", label: "Attack", seconds: [0.002, 2] },
  { key: "decay", label: "Decay", seconds: [0.02, 2] },
  { key: "sustain", label: "Sustain" },
  { key: "release", label: "Release", seconds: [0.02, 4] },
  { key: "drive", label: "Drive" },
];

export const ARP_DIRECTION_LABEL: Record<string, string> = { up: "Up", down: "Down", updown: "Up-down", random: "Random" };
/** Arp rate: steps per note. */
export const ARP_RATES = [1, 2, 4] as const;
export const ARP_RATE_LABEL: Record<number, string> = { 1: "1/16", 2: "1/8", 4: "1/4" };
export const ARP_OCTAVES = [1, 2, 3] as const;

/** Class of one cell of the 16-step lead row: a hit that plays, a hit its density skips, the playing step. */
export function leadCellClass(hit: boolean, plays: boolean, now: boolean): string {
  return `st${hit ? " h" : ""}${hit && !plays ? " lo" : ""}${now ? " now" : ""}`;
}
