/** Pure UI logic: no DOM, no audio. Unit-tested in logic.test.ts. */
import type { ChordStep, InstrumentId, NumericPatchKey, Song } from "../engine/song.ts";
import { BASS_NAMES, BEAT_NAMES, SYNTH_NAMES, type PresetNames } from "../music/presets.ts";
import { LEAD_SHAPES, PHRASE_BARS, type LeadParams, type LeadShape, type LeadStyle } from "../music/lead.ts";
import { leadKnobs } from "../music/leadKit.ts";

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

/**
 * Holding a section and choosing "Edit without playing" (spec 8.6, Advanced only): the held section is
 * edited while the playing one keeps playing. Holding the playing section, or Simple, means following.
 */
export function editWithoutPlaying(held: number, playing: number, advanced: boolean): number | null {
  return advanced && held !== playing ? held : null;
}

/** A chosen section that no longer exists, or that is now the playing one, goes back to following (null). */
export function keepChosen(chosen: number | null, playing: number, count: number): number | null {
  return chosen !== null && (chosen >= count || chosen === playing) ? null : chosen;
}

export interface StripInput {
  /** Section chosen with "Edit without playing", or null when following. */
  chosen: number | null;
  /** Section heard now (or the one Play starts from). */
  playing: number;
  /** Whether the transport runs. */
  running: boolean;
  /** The section queued to start on the next bar line, or null. */
  queued: number | null;
  /** The section's name. */
  name: string;
}

export interface StripView {
  isPlaying: boolean;
  isNext: boolean;
  isEdit: boolean;
  /** The word under the letter. */
  sub: string;
}

/**
 * One tile of the section strip (spec 8.6): three states, each with its word under the letter.
 * Next bar wins over Editing (a queued section is about to play); Playing shows only while running.
 */
export function stripState(i: number, s: StripInput): StripView {
  const isPlaying = i === s.playing;
  const isNext = s.running && s.queued === i && !isPlaying;
  const isEdit = s.chosen === i && !isPlaying;
  const sub = isNext ? "Next bar" : isPlaying && s.running ? "Playing" : isEdit ? "Editing" : stripWord(s.name);
  return { isPlaying, isNext, isEdit, sub };
}

/**
 * Width of each printable ASCII character (space to "~") in DM Sans at 10 px with the strip's letter
 * spacing, in px: measured in Chrome, rounded up, plus 0.1. Anything else counts as WIDE_PX.
 */
const GLYPH_PX = [
  3.0, 2.8, 3.3, 8.4, 6.1, 8.2, 7.7, 1.9, 4.1, 4.1, 5.1, 5.8, 2.2, 5.8, 2.3, 3.2, 7.2, 3.5, 6.1, 6.3, 6.4, 6.4, 6.6, 5.7,
  6.4, 6.6, 2.4, 2.6, 5.8, 5.8, 5.8, 5.6, 10.4, 7.0, 6.4, 7.5, 7.2, 6.0, 5.7, 7.9, 7.2, 2.7, 5.4, 6.2, 5.6, 8.8, 7.3, 8.1,
  6.1, 8.1, 6.3, 6.1, 6.0, 6.9, 7.0, 10.0, 6.4, 6.1, 5.8, 3.5, 3.0, 3.5, 6.6, 6.9, 2.5, 5.8, 6.6, 6.1, 6.6, 6.0, 3.7, 5.9,
  6.1, 2.7, 2.8, 5.4, 2.6, 9.3, 6.1, 6.3, 6.6, 6.6, 4.0, 5.4, 4.3, 6.1, 5.6, 8.0, 5.3, 5.9, 4.9, 4.6, 2.7, 4.6, 5.8,
];
const WIDE_PX = 13;
const ELLIPSIS = "…";
const ELLIPSIS_PX = 6;

/** Estimated width of `text` at 10 px (an upper bound for DM Sans). */
export function textPx(text: string): number {
  let w = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    w += c >= 32 && c <= 126 ? GLYPH_PX[c - 32] : WIDE_PX;
  }
  return w;
}

/**
 * Room for the word under a strip tile's letter at 10 px in the narrowest tile (Advanced Play at
 * 360 px: a 59 px tile less 4 px padding a side), with 1 px to spare.
 */
export const STRIP_WORD_PX = 50;

/**
 * The word under a strip tile's letter (spec 8.6: text never overflows): a section name as typed when it
 * fits the narrowest tile at 10 px, else cut to the longest start that fits with "…". The full name
 * stays in the section sheet's title and the tile's label.
 */
export function stripWord(name: string, budget = STRIP_WORD_PX): string {
  if (textPx(name) <= budget) return name;
  const chars = [...name];
  let w = ELLIPSIS_PX;
  let n = 0;
  while (n < chars.length && w + textPx(chars[n]) <= budget) w += textPx(chars[n++]);
  return chars.slice(0, Math.max(1, n)).join("").trimEnd() + ELLIPSIS;
}

/** The four beat lights of the transport bar: lit up to the beat now playing; all dark when stopped. */
export function beatLights(playing: boolean, step: number): boolean[] {
  const beat = playing ? Math.floor((((step % 16) + 16) % 16) / 4) : -1;
  return [0, 1, 2, 3].map((b) => b <= beat);
}

/**
 * Text fit (spec 8.6): the largest font size from `start` down to `min`, in steps of `step`, at which
 * `fits` holds; `min` when none does (the label must then be shortened in the source).
 */
export function fitSize(start: number, fits: (px: number) => boolean, min = 10, step = 0.5): number {
  for (let px = start; px > min; px -= step) if (fits(px)) return px;
  return min;
}

// ---- Chord sequence edits (each returns a new array, or the same one when refused) ----

/** Each chord of the key by colour, its place in the key fixing it (Simple draws chords as coloured blocks, spec 8.4). */
export const CHORD_COLOR: readonly string[] = ["var(--coral)", "var(--orange)", "var(--yellow)", "var(--teal)", "var(--blue)", "var(--purple)", "var(--text)"];

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

/**
 * What the dial shows: milliseconds for times, 0..100 for amounts. The unit goes in the dial's name
 * (knobLabel), so the value fits inside the ring's hole on the smallest dial (P1b review S2).
 */
export function knobText(k: KnobCurve, v: number): string {
  return k.seconds ? String(Math.round(v * 1000)) : String(Math.round(v * 100));
}

/** The dial's name: a time carries its unit ("Decay ms"). */
export function knobLabel(k: KnobCurve & { label: string }): string {
  return k.seconds ? `${k.label} ms` : k.label;
}

/** At most six dials per screen (spec section 5): split a list into pages of `size`. */
export function paginate<T>(items: readonly T[], size = 6): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out.length ? out : [[]];
}

/** A page of a tab: its key and the word on its chip. */
export type PageDef<K extends string = string> = readonly [K, string];

/** The page shown: the chosen one while it exists, else the first. */
export function shownPage<K extends string>(pages: readonly PageDef<K>[], page: K): K {
  return pages.some(([k]) => k === page) ? page : pages[0][0];
}

/**
 * Instrument tab pages (no-scroll rule, spec 8.6): the tab's own pages, plus a Filter page holding
 * the XY pad and the sends when the screen is too short to show them under every page.
 */
export function withFilterPage<K extends string>(pages: readonly PageDef<K>[], roomy: boolean): PageDef<K | "filter">[] {
  return roomy ? [...pages] : [...pages, ["filter", "Filter"]];
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
        // P2 review E1: the Simple Punch dial moves the bass attack, so Advanced shows it.
        { key: "attack", label: "Attack", seconds: [0.001, 0.1] },
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

/** A picker entry's word: Advanced shows its name, Simple its plain word (P2 review M6: no abbreviations). */
export type PresetKind = "beat" | "bass" | "synth";
const PRESET_NAMES: Record<PresetKind, Record<string, PresetNames>> = { beat: BEAT_NAMES, bass: BASS_NAMES, synth: SYNTH_NAMES };
export function presetName(kind: PresetKind, id: string, simple = false): string {
  const n = PRESET_NAMES[kind][id];
  return n ? (simple ? n.simple : n.name) : id;
}

export const WAVE_LABEL: Record<string, string> = { sawtooth: "Saw", square: "Square", triangle: "Tri", sine: "Sine" };

// ---- Simple (P2): plain words only (spec 8.1) ------------------------------------------

/** The synth's Sound picker in Simple: the four waves by how they sound. */
export const SIMPLE_WAVE_LABEL: Record<string, string> = { sawtooth: "Buzzy", square: "Hollow", triangle: "Soft", sine: "Pure" };

/** Each macro dial's colour, as in docs/design/look/ (Busy purple, Evolve yellow, Bright orange, Space teal). */
export const MACRO_COLOR: Record<string, string> = {
  busy: "var(--purple)",
  evolve: "var(--yellow)",
  bright: "var(--orange)",
  space: "var(--teal)",
  punch: "var(--coral)",
  hats: "var(--yellow)",
  swing: "var(--purple)",
  weight: "var(--blue)",
  level: "var(--teal)",
};

/** The Simple XY pad's readout: Tone and Edge as 0..100, no hertz. */
export function simpleXYReadout(x: number, y: number): string {
  return `${Math.round(x * 100)} · ${Math.round(y * 100)}`;
}

/** New idea and Back change what a layer plays: a lead, or an arp in random order (a pad and an ordered arp do not use the seed). */
export function seedHeard(layer: { mode: string; arp: { direction: string } }): boolean {
  return layer.mode === "generative" || (layer.mode === "arp" && layer.arp.direction === "random");
}


/** Sweep display in Simple: "Dark 40" left of centre (the highs go), "Thin 40" right (the lows go), "Open" at centre. */
export function simpleSweepLabel(v: number): string {
  const n = Math.round(Math.abs(v) * 100);
  if (n === 0) return "Open";
  return `${v < 0 ? "Dark" : "Thin"} ${n}`;
}

/** Meter fill 0..1 for a level in dB: -60 dB empty, 0 dB full. */
export function meterFraction(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

// ---- Layers (G4) -----------------------------------------------------------------------

/** Mode switch order and names, as in docs/design/look/ (Lead, Arp, Pad; Drone comes later). */
export const LAYER_MODE_ORDER = ["generative", "arp", "pad"] as const;
export const LAYER_MODE_LABEL: Record<(typeof LAYER_MODE_ORDER)[number], "Arp" | "Lead" | "Pad"> = { arp: "Arp", generative: "Lead", pad: "Pad" };
export const LAYER_MODE_TITLE: Record<(typeof LAYER_MODE_ORDER)[number], string> = { arp: "Arp", generative: "Lead", pad: "Pad" };

/** What an instrument plays in a section, in a word or two (the Now tile's second line, a Simple screen). */
export function plays(song: Song, sec: number, id: InstrumentId): string {
  const s = song.sections[sec];
  if (id === "drums") return s.drums.grid ? `${presetName("beat", s.drums.preset, true)}, edited` : presetName("beat", s.drums.preset, true);
  if (id === "bass") return presetName("bass", s.bass.rhythm, true);
  if (id === "synth") return presetName("synth", s.synth.rhythm, true);
  return LAYER_MODE_TITLE[s[id].mode];
}

export interface NowTileView {
  on: boolean;
  /** A toggle of this instrument waits for the next bar line. */
  queued: boolean;
  /** The second line: "Next bar" while queued and playing, else what it plays. */
  sub: string;
}

/**
 * A Now tile (Simple Play tab). `target` is the section a tap toggles (the scheduler's, which leads what
 * is heard by the lookahead at a switch); the tile reads the same section, so a tap right after a switch
 * lands shows its "Next bar" at once.
 */
export function nowTile(song: Song, target: number, pending: { toggles: { section: number; instrument: InstrumentId }[] }, id: InstrumentId, running: boolean): NowTileView {
  const sec = Math.max(0, Math.min(song.sections.length - 1, target));
  const on = song.sections[sec].on[id];
  const queued = pending.toggles.some((t) => t.section === sec && t.instrument === id);
  return { on, queued, sub: queued && running ? "Next bar" : plays(song, sec, id) };
}

/** One generative knob: range, whole steps or not, and its colour token. */
// ---- Lead (P6, spec 8.5) -------------------------------------------------------------

export const LEAD_STYLE_LABEL: Record<LeadStyle, string> = { hook: "Hook", phrase: "Phrase", roll: "Roll", drift: "Drift", pulse: "Pulse" };
/**
 * Shape's choices as the dial shows them. Valley is "Dip" and Zigzag "Zig": the full words do not fit inside a
 * short phone's dial even at 10 px (spec 8.6: a label that still does not fit is shortened in the source).
 */
export const LEAD_SHAPE_LABEL: Record<LeadShape, string> = { rise: "Rise", fall: "Fall", arch: "Arch", valley: "Dip", zigzag: "Zig", flat: "Flat", free: "Free" };

/** The lead's knobs as the song stores them (Busy is `density`). */
export type LeadKnobKey = "density" | "lock" | "shape" | "range" | "register" | "tension" | "noteLength" | "phrase" | "variation" | "repeats" | "slide" | "accent" | "hits" | "rotate" | "length";

/** One lead dial: 0..1 amounts, whole numbers (Pulse's three), or a selector turned through its choices (Shape, Phrase). */
export interface LeadDial {
  key: LeadKnobKey;
  label: string;
  min: number;
  max: number;
  /** 1 for whole numbers and selectors (the dial snaps); 0 for amounts. */
  step: number;
  color: string;
}

const amount = (key: LeadKnobKey, label: string, color: string): LeadDial => ({ key, label, min: 0, max: 1, step: 0, color });

/** The lead's pages in Advanced (spec 8.5): Notes and Feel for every style, six dials each; Pulse's own three. */
export const LEAD_PAGES: { notes: readonly LeadDial[]; feel: readonly LeadDial[]; pulse: readonly LeadDial[] } = {
  notes: [
    amount("density", "Busy", "var(--purple)"),
    amount("lock", "Lock", "var(--coral)"),
    { key: "shape", label: "Shape", min: 0, max: LEAD_SHAPES.length - 1, step: 1, color: "var(--yellow)" },
    amount("range", "Range", "var(--orange)"),
    amount("register", "Register", "var(--blue)"),
    amount("tension", "Tension", "var(--teal)"),
  ],
  feel: [
    amount("noteLength", "Note length", "var(--purple)"),
    { key: "phrase", label: "Phrase", min: 0, max: PHRASE_BARS.length - 1, step: 1, color: "var(--coral)" },
    amount("variation", "Variation", "var(--yellow)"),
    amount("repeats", "Repeats", "var(--orange)"),
    amount("slide", "Slide", "var(--blue)"),
    amount("accent", "Accent", "var(--teal)"),
  ],
  pulse: [
    { key: "hits", label: "Hits", min: 1, max: 16, step: 1, color: "var(--purple)" },
    { key: "rotate", label: "Rotate", min: 0, max: 15, step: 1, color: "var(--blue)" },
    { key: "length", label: "Length", min: 2, max: 16, step: 1, color: "var(--yellow)" },
  ],
};

/** Where a lead dial stands: the knob as the lead plays it, an unset knob at its style's default. */
export function leadDialValue(d: LeadDial, p: LeadParams): number {
  const k = leadKnobs(p);
  if (d.key === "density") return k.busy;
  if (d.key === "shape") return LEAD_SHAPES.indexOf(k.shape);
  if (d.key === "phrase") return PHRASE_BARS.indexOf(k.phrase);
  return k[d.key];
}

/** What a lead dial shows: amounts 0..100, Range in octaves, Register as Low, Mid or High, the selectors' choice. */
export function leadDialText(d: LeadDial, v: number): string {
  switch (d.key) {
    case "shape":
      return LEAD_SHAPE_LABEL[LEAD_SHAPES[Math.round(v)] ?? "free"];
    case "phrase":
      return String(PHRASE_BARS[Math.round(v)] ?? 4);
    case "range":
      return String(Math.round(((6 + 30 * v) / 12) * 10) / 10);
    case "register":
      return v < 1 / 3 ? "Low" : v < 2 / 3 ? "Mid" : "High";
    default:
      return d.step ? String(Math.round(v)) : String(Math.round(v * 100));
  }
}

/** The setGen values a lead dial at `v` writes. */
export function leadDialSet(d: LeadDial, v: number): Partial<Omit<LeadParams, "seed">> {
  if (d.key === "shape") return { shape: LEAD_SHAPES[Math.max(0, Math.min(LEAD_SHAPES.length - 1, Math.round(v)))] };
  if (d.key === "phrase") return { phrase: PHRASE_BARS[Math.max(0, Math.min(PHRASE_BARS.length - 1, Math.round(v)))] };
  return { [d.key]: v };
}

/** A lead's phrase as a row of bar segments under its lane: the bar playing lit (null: not in Lead, or another section). */
export function phraseSegments(phrase: { bar: number; of: number } | null): boolean[] | null {
  if (!phrase || phrase.of < 1) return null;
  return Array.from({ length: phrase.of }, (_, i) => i === phrase.bar);
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

// ---- Recording and songs (G5) ------------------------------------------------------

/** Elapsed time of a take: "0:07", "12:34", "1:02:03" from an hour. */
export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** A file size: "820 KB", "9.6 MB". */
export function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the record button says to a screen reader. */
export function recordLabel(state: "off" | "armed" | "recording" | "finishing"): string {
  return {
    off: "Record: arm",
    armed: "Record armed, starts with Play; tap to disarm",
    recording: "Recording; tap to stop the take",
    finishing: "Finishing the take",
  }[state];
}

// ---- Lanes and motion (P1b) --------------------------------------------------------

/** One note of a lane as drawn: left, width, top and height in % of the lane; start and end in steps. */
export interface LaneRect {
  x: number;
  w: number;
  y: number;
  h: number;
  /** Start and end in sixteenths (the note brightens while the playhead is between them). */
  s: number;
  e: number;
  /** The note's pitch (MIDI) or drum voice, so a test can compare the lane with the engine's notes. */
  k: string;
}

/** Drum voices top to bottom: hats over clap over kick. */
const DRUM_ROW: Record<string, number> = { hat: 0, open: 0, clap: 1, kick: 2 };

/**
 * Where each note of a lane sits (spec 8.12): x by step on the 16-step grid, width by length (cut at the
 * bar's end), y by pitch (high on top, the bar's own range) or by drum voice (hats, clap, kick).
 */
export function laneRects(
  notes: readonly { step: number; len: number; shift: number; pitch?: number; voice?: string }[],
  steps = 16,
): LaneRect[] {
  const unit = 100 / steps;
  const pitches = notes.filter((n) => n.pitch !== undefined).map((n) => n.pitch!);
  const hi = pitches.length ? Math.max(...pitches) : 60;
  const lo = pitches.length ? Math.min(...pitches) : 60;
  // A bar that holds one pitch draws it in the middle; wider bars spread over 10..82 % of the height.
  const span = Math.max(hi - lo, 1);
  // Chords and pads (more than one pitch at once) draw each note at most 10 % tall, so the notes of a chord stay
  // apart with a gap (bundle 4 review M1); single-line instruments keep a fifth of the lane.
  const at = new Map<number, number>();
  for (const n of notes) if (n.pitch !== undefined) at.set(n.step + n.shift, (at.get(n.step + n.shift) ?? 0) + 1);
  const poly = Math.max(0, ...at.values()) > 1;
  const distinct = [...new Set(pitches)].sort((a, b) => a - b);
  let gap = Infinity;
  for (let i = 1; i < distinct.length; i++) gap = Math.min(gap, ((distinct[i] - distinct[i - 1]) / span) * 70);
  const pitchH = poly ? Math.max(3, Math.min(10, 70 / distinct.length - 2, gap - 1.5)) : 20;
  const out: LaneRect[] = [];
  for (const n of notes) {
    const s = n.step + n.shift;
    if (s >= steps) continue;
    const e = Math.min(steps, s + Math.max(n.len, 0.05));
    let y: number;
    let h: number;
    let w = (e - s) * unit;
    if (n.voice !== undefined) {
      const row = DRUM_ROW[n.voice] ?? 2;
      h = row === 0 ? 14 : 20;
      y = 12 + row * 28 + (row === 0 ? 3 : 0);
      w = Math.min(unit * 0.32, w);
    } else {
      // A fifth of the lane tall (P1b review M8), less for chords; tops spread over 10..80 %.
      h = pitchH;
      y = hi === lo ? 40 : 10 + ((hi - n.pitch!) / span) * 70;
      w = Math.max(unit * 0.5, w - unit * 0.12);
    }
    out.push({ x: s * unit + unit * 0.06, w, y, h, s, e: n.voice !== undefined ? s + 1 : e, k: String(n.voice ?? n.pitch) });
  }
  return out;
}

/**
 * Where the playhead is, in sixteenths of the bar (0..16): the step last heard plus the time since it,
 * so it sweeps between steps and never runs past the next one. With motion off it jumps step to step.
 */
export function playhead(step: number, sinceMs: number, stepMs: number, still: boolean): number {
  if (still || stepMs <= 0) return step;
  return step + Math.max(0, Math.min(1, sinceMs / stepMs));
}

/**
 * How bright an instrument's label flashes (0..1) at playhead `p` (in steps): full on a note's start,
 * fading over 1.5 steps. Only notes that start in this bar count (not those held over).
 */
export function flashLevel(notes: readonly { step: number; shift: number; held?: boolean }[], p: number): number {
  let best = Infinity;
  for (const n of notes) {
    if (n.held) continue;
    const since = p - (n.step + n.shift);
    if (since >= 0 && since < best) best = since;
  }
  return best === Infinity ? 0 : Math.max(0, 1 - best / 1.5);
}

/**
 * A paged chip row (P3 review M8): with more than `perRow` options, each page holds `perRow - 1` of them and a
 * last chip, More, turns to the next page (wrapping). `page`: the page asked for, or null to open on the page
 * holding `value` (the first if none). Returns the page count, the page shown, its options and the empty
 * cells that pad the last page so More keeps its place.
 */
export function chipPage<T>(
  options: readonly T[],
  value: T | null,
  perRow: number,
  page: number | null = null,
): { pages: number; page: number; shown: T[]; pad: number } {
  if (options.length <= perRow) return { pages: 1, page: 0, shown: [...options], pad: 0 };
  const per = perRow - 1;
  const pages = Math.ceil(options.length / per);
  const at = value === null ? -1 : options.indexOf(value);
  const p = page === null ? (at < 0 ? 0 : Math.floor(at / per)) : ((page % pages) + pages) % pages;
  const shown = options.slice(p * per, p * per + per);
  return { pages, page: p, shown, pad: per - shown.length };
}
