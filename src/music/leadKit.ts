/**
 * What the lead styles of spec 8.5 share: the twelve knobs resolved with each style's defaults, the pitch
 * window (Range, Register), the contour (Shape), note length, the per-slot random numbers and the note plan
 * the planned styles (Hook, Phrase, Roll, Drift) build. Pure, seeded, no audio dependency.
 *
 * A planned style builds one phrase as a list of notes from its knobs and a `Rand`: a random number per
 * plan slot that stays the same until Lock rewrites that slot. A note's pitch is chosen when it plays, from
 * its height in the window and the chord sounding then, so every note is in key and follows the chords.
 */
import { createRng, deriveSeed } from "./random.ts";
import { LEAD_SHAPES, LEAD_STYLES, PHRASE_BARS, type LeadContext, type LeadParams, type LeadShape, type LeadStyle, type PhraseBars } from "./lead.ts";

/** Every knob of a lead, resolved. Busy is the stored `density`. */
export interface LeadKnobs {
  style: LeadStyle;
  busy: number;
  lock: number;
  shape: LeadShape;
  range: number;
  register: number;
  tension: number;
  noteLength: number;
  phrase: PhraseBars;
  variation: number;
  repeats: number;
  slide: number;
  accent: number;
  hits: number;
  rotate: number;
  length: number;
}

type StyleDefaults = Pick<LeadKnobs, "shape" | "range" | "register" | "noteLength" | "phrase" | "variation" | "repeats" | "slide" | "accent">;

/**
 * Each style's values for the knobs a song does not set. Pulse's put it where G4 left it: the window A4..E6
 * (LEAD_RANGE), Free shape, note length 0.8 of a sixteenth, nothing varied, repeated, slid or accented.
 */
export const STYLE_DEFAULTS: Record<LeadStyle, StyleDefaults> = {
  hook: { shape: "arch", range: 0.35, register: 0.6, noteLength: 0.5, phrase: 4, variation: 0.35, repeats: 0, slide: 0.1, accent: 0.25 },
  phrase: { shape: "arch", range: 0.45, register: 0.55, noteLength: 0.55, phrase: 4, variation: 0.5, repeats: 0, slide: 0.1, accent: 0.15 },
  roll: { shape: "zigzag", range: 0.4, register: 0.45, noteLength: 0.45, phrase: 2, variation: 0.3, repeats: 0.12, slide: 0.3, accent: 0.3 },
  drift: { shape: "free", range: 0.35, register: 0.5, noteLength: 0.5, phrase: 4, variation: 0.3, repeats: 0, slide: 0.15, accent: 0.05 },
  pulse: { shape: "free", range: 13 / 30, register: 0.77, noteLength: 0.5, phrase: 4, variation: 0, repeats: 0, slide: 0, accent: 0 },
};

const unit = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);

export function leadKnobs(p: LeadParams): LeadKnobs {
  const style: LeadStyle = p.style && (LEAD_STYLES as readonly string[]).includes(p.style) ? p.style : "pulse";
  const d = STYLE_DEFAULTS[style];
  return {
    style,
    busy: unit(p.density, 0.85),
    lock: unit(p.lock, 0.75),
    shape: p.shape && (LEAD_SHAPES as readonly string[]).includes(p.shape) ? p.shape : d.shape,
    range: unit(p.range, d.range),
    register: unit(p.register, d.register),
    tension: unit(p.tension, 0.35),
    noteLength: unit(p.noteLength, d.noteLength),
    phrase: p.phrase !== undefined && (PHRASE_BARS as readonly number[]).includes(p.phrase) ? p.phrase : d.phrase,
    variation: unit(p.variation, d.variation),
    repeats: unit(p.repeats, d.repeats),
    slide: unit(p.slide, d.slide),
    accent: unit(p.accent, d.accent),
    hits: p.hits,
    rotate: p.rotate,
    length: p.length,
  };
}

/** Lowest and highest MIDI note any lead plays from (C2..C7). */
export const WINDOW_LIMITS = { lo: 36, hi: 96 } as const;

/**
 * The pitch window: Range spans half an octave (6 semitones) to three octaves (36), Register puts its centre
 * between C4 (0) and C6 (1). Pulse's defaults give A4..E6, G4's LEAD_RANGE.
 */
export function leadWindow(range: number, register: number): { lo: number; hi: number } {
  const span = Math.round(6 + 30 * range);
  const centre = 60 + 24 * register;
  const lo = Math.max(WINDOW_LIMITS.lo, Math.min(WINDOW_LIMITS.hi - span, Math.round(centre - span / 2)));
  return { lo, hi: lo + span };
}

/** The contour of a Shape at x (0..1 through the phrase): a height 0..1. Free gives `free`, the note's own. */
export function contour(shape: LeadShape, x: number, free: number): number {
  const t = Math.max(0, Math.min(1, x));
  switch (shape) {
    case "rise":
      return t;
    case "fall":
      return 1 - t;
    case "arch":
      return Math.sin(Math.PI * t);
    case "valley":
      return 1 - Math.sin(Math.PI * t);
    case "zigzag": {
      const z = (t * 4) % 2;
      return z < 1 ? z : 2 - z;
    }
    case "flat":
      return 0.5;
    case "free":
      return free;
  }
}

/** A note's height: on the contour, with a little of its own randomness so a shape is not a scale run. */
export function height(shape: LeadShape, x: number, r: number): number {
  if (shape === "free") return r;
  return Math.max(0, Math.min(1, 0.1 + 0.8 * contour(shape, x, r) + 0.24 * (r - 0.5)));
}

/** Note length's factor on a style's natural length: about a third (short, clipped) to about three times. */
export function lengthFactor(noteLength: number): number {
  return Math.pow(2, (noteLength - 0.5) * 3.2);
}

/** A random number 0..1 per plan slot and use (`k`), fixed until Lock gives the slot a new version. */
export type Rand = (slot: number, k: number) => number;

/** Slots whose versions Lock keeps; a plan's slot ids beyond this share versions. */
export const SLOTS = 256;

export function makeRand(seed: number, versions: ArrayLike<number>): Rand {
  return (slot, k) => {
    const v = versions[((slot % SLOTS) + SLOTS) % SLOTS];
    return createRng((deriveSeed(seed, 4096 + slot * 16 + k) ^ Math.imul(v + 1, 0x85ebca6b)) >>> 0).next();
  };
}

/** One note of a planned phrase. */
export interface PlanNote {
  /** Plan slot: the source of its random numbers, so a note repeated in the phrase repeats exactly. */
  id: number;
  /** Start, in steps from the top of the phrase. */
  at: number;
  /** Length in steps. */
  len: number;
  /** 0..1: where in the pitch window it sits. */
  h: number;
  /** 0..1: compared with Tension, picks chord tones (at or above) or passing tones (below). */
  pool: number;
  vel: number;
  /** Must land on a chord tone (Phrase's ends). */
  chord?: boolean;
  /** Octaves above the picked note (Roll's jumps). */
  oct?: number;
  /** Plays as a quick double (2) or triple (3). */
  repeat?: number;
  /** Glides into the next note: it holds until the next note starts, which slides from its pitch. */
  slide?: boolean;
  accent?: boolean;
  /**
   * Moves by step (Drift): given the note played before it, when its pool note would leap from that one (or
   * stay on it while the scale note its height picks moves), it plays the pool note nearest that scale note
   * within two semitones of the note before, else the scale note itself, which is in key. At Tension 0 it
   * stays on chord tones, as every style does.
   */
  near?: boolean;
}

export interface Plan {
  steps: number;
  notes: PlanNote[];
}

/** Repeats, Slide and Accent, drawn per note from its slot; a slid note holds until the next one starts (legato). */
export function decorate(plan: Plan, k: LeadKnobs, rand: Rand): Plan {
  const notes = [...plan.notes].sort((a, b) => a.at - b.at);
  for (let i = 0; i < notes.length; i++) {
    const n = { ...notes[i] };
    if (rand(n.id, 13) < k.repeats) n.repeat = rand(n.id, 14) < 0.6 ? 2 : 3;
    if (rand(n.id, 15) < k.accent) {
      n.accent = true;
      n.vel = Math.min(1, n.vel * 1.3);
    }
    // A note that must end on a chord tone (Phrase's part ends) keeps its rest: it never slides on.
    if (notes.length > 1 && !n.chord && rand(n.id, 16) < k.slide) {
      const next = i + 1 < notes.length ? notes[i + 1].at : notes[0].at + plan.steps;
      n.slide = true;
      n.len = Math.max(n.len, next - n.at);
    }
    notes[i] = n;
  }
  return { steps: plan.steps, notes };
}

/** Pitch classes a note may take: chord tones (in the scale), or passing tones when its pool is under Tension. */
function pitchClasses(pool: number, tension: number, chord: boolean, ctx: LeadContext): number[] {
  const tones = ctx.chordTones.filter((pc) => ctx.scale.includes(pc));
  const chordSet = new Set(ctx.chordTones);
  const passing = ctx.scale.filter((pc) => !chordSet.has(pc));
  if (chord || pool >= tension || passing.length === 0) return tones.length ? tones : ctx.scale;
  return passing;
}

/** The notes of `pcs` in lo..hi, widened by fifths when the window holds none. */
export function windowNotes(pcs: number[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let w = 0; out.length === 0; w += 7) for (let m = lo - w; m <= hi + w; m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
}

/**
 * The MIDI note a plan note plays over the chord sounding now: its height picks a note of the scale in the
 * window, then it moves to the nearest note of its pool (chord tones, or passing tones), so neighbouring
 * heights stay neighbouring notes whatever the pool.
 */
export function realize(
  n: Pick<PlanNote, "h" | "pool" | "chord" | "oct" | "near">,
  tension: number,
  ctx: LeadContext,
  win: { lo: number; hi: number },
  from?: number,
): number {
  const scale = windowNotes(ctx.scale, win.lo, win.hi);
  const target = scale[Math.min(scale.length - 1, Math.round(Math.max(0, Math.min(1, n.h)) * (scale.length - 1)))];
  const pool = windowNotes(pitchClasses(n.pool, tension, !!n.chord, ctx), win.lo, win.hi);
  let midi = pool[0];
  for (const m of pool) if (Math.abs(m - target) < Math.abs(midi - target) || (Math.abs(m - target) === Math.abs(midi - target) && n.pool >= 0.5 && m > midi)) midi = m;
  if (n.near && from !== undefined && tension > 0 && !n.chord) {
    // A step stays a step: when the pool note would leap from the note before (or sit on it while the scale
    // note moves), the pool note nearest the scale note within two semitones of the note before, else the
    // scale note itself, which is in key.
    const step = (m: number): boolean => Math.abs(m - from) <= 2 && (m !== from || target === from);
    if (!step(midi)) {
      const near = pool.filter(step);
      midi = near.length ? near.reduce((x, m) => (Math.abs(m - target) < Math.abs(x - target) ? m : x)) : target;
    }
  }
  const up = midi + 12 * (n.oct ?? 0);
  return up <= WINDOW_LIMITS.hi ? up : midi;
}

/** Up to `count` of `candidates` (steps), the best scored first, returned in time order. */
export function pickSteps(candidates: number[], count: number, score: (step: number) => number): number[] {
  return [...candidates]
    .sort((a, b) => score(b) - score(a) || a - b)
    .slice(0, Math.max(0, count))
    .sort((a, b) => a - b);
}

/** Varied velocity: a base, a slot's own spread and a lift on the beat. */
export function velocity(base: number, r: number, step: number): number {
  return Math.min(1, base + 0.22 * r + (step % 4 === 0 ? 0.1 : step % 2 === 0 ? 0.04 : 0));
}
