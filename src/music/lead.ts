/**
 * The generative lead of spec section 3. Pure: given a seed, its knobs and the chords it is played
 * over, it gives the same notes every time.
 *
 * A loop of `length` slots runs against the 16-step bar. Each slot holds a pitch choice, a pool
 * choice and a density roll. A Euclidean rhythm (hits, rotate) says which steps may sound; the slot
 * under the current step says what plays. Lock sets how often a slot is rewritten.
 */
import { createRng, deriveSeed, type Rng } from "./random.ts";
import { euclid } from "./rhythm.ts";

/** The lead styles of spec 8.5. Pulse is this file's generator; the others are in `lead*.ts` beside it. */
export const LEAD_STYLES = ["hook", "phrase", "roll", "drift", "pulse"] as const;
export type LeadStyle = (typeof LEAD_STYLES)[number];

/** The Shape selector (spec 8.5): the contour the line follows. */
export const LEAD_SHAPES = ["rise", "fall", "arch", "valley", "zigzag", "flat", "free"] as const;
export type LeadShape = (typeof LEAD_SHAPES)[number];

/** The Phrase knob: bars before the line repeats or answers itself. */
export const PHRASE_BARS = [1, 2, 4, 8] as const;
export type PhraseBars = (typeof PHRASE_BARS)[number];

/**
 * A layer's lead settings. The six G4 knobs are required; the P5 knobs (spec 8.5) are optional, so songs
 * saved before P5 load unchanged: a missing value takes its style's default (`leadKnobs` in leadKit.ts),
 * and a missing style is Pulse, which at its defaults plays exactly what G4 played. Busy is `density`.
 */
export interface LeadParams {
  lock: number; // 0..1: 1 frozen, 0 new notes all the time
  hits: number; // 1..16 (Pulse)
  rotate: number; // 0..15 (Pulse)
  length: number; // 2..16 (Pulse)
  tension: number; // 0..1: 0 chord tones, 0.5 scale tones, 1 passing (non-chord scale) tones
  density: number; // 0..1: Busy, how many notes play (Pulse: chance each hit plays)
  seed: number;
  style?: LeadStyle;
  shape?: LeadShape;
  range?: number; // 0..1: half an octave to three octaves
  register?: number; // 0..1: low, middle, high
  noteLength?: number; // 0..1: short and clipped to long and overlapping
  phrase?: PhraseBars;
  variation?: number; // 0..1
  repeats?: number; // 0..1
  slide?: number; // 0..1
  accent?: number; // 0..1
}

/** Where Pulse may bend its pitch choice: the window and, with a Shape other than Free, the contour height. */
export interface PulseShape {
  lo: number;
  hi: number;
  /** 0..1: where the shape puts the line at this step; undefined for Free. */
  contour?: number;
}

export interface LeadContext {
  chordTones: number[]; // pitch classes of the current chord
  scale: number[]; // pitch classes of the song's scale
}

export interface LeadNote {
  midi: number;
  vel: number;
}

interface Slot {
  pitch: number; // 0..1
  pool: number; // 0..1
  roll: number; // 0..1
}

export const LEAD_RANGE = { lo: 69, hi: 88 } as const; // A4..E6

/** Lock at or above this is frozen: the dial shows 100 from here. */
export const LOCK_FROZEN = 0.995;

/** A new seed from the current one: the new-seed button. Seeded, never Math.random(). */
export function nextSeed(seed: number): number {
  return deriveSeed(seed, 11) + 1;
}

/** One step of the bar as the lead would play it: a rhythm hit, and whether its slot plays (density). */
export interface LeadStepView {
  hit: boolean;
  plays: boolean;
}

/** Chance that a hit rewrites its slot, by lock position. */
export function mutationChance(lock: number): number {
  const l = Math.max(0, Math.min(1, lock));
  if (l >= LOCK_FROZEN) return 0;
  return Math.pow(1 - l, 3);
}

export class GenerativeLead {
  private slots: Slot[] = [];
  private mutate: Rng;
  private seed: number;
  private counter = 0;
  /** The counter at the last bar line: where the loop stood when this bar began. */
  private barStart = 0;
  /** The bar before: the UI shows it until its own step wraps, a lookahead after the scheduler (G4 review M2). */
  private prevBarStart = 0;
  /** The last bar step computed (-1 before the first). */
  private lastStep = -1;

  /**
   * `barStep`: where in the bar the lead starts. A lead made mid-bar (a new seed while playing) starts
   * its loop as if it had begun at the bar line, so slot 0 lands on step 0 from the next bar (G4 review M1).
   */
  constructor(seed: number, barStep = 0) {
    this.seed = seed;
    this.counter = Math.max(0, Math.min(15, Math.round(barStep)));
    const init = createRng(deriveSeed(seed, 1));
    for (let i = 0; i < 16; i++) this.slots.push({ pitch: init.next(), pool: init.next(), roll: init.next() });
    this.mutate = createRng(deriveSeed(seed, 2));
  }

  get seedValue(): number {
    return this.seed;
  }

  /** An independent copy in the same state: it plays the same notes from here (for the lanes' look-ahead). */
  clone(): GenerativeLead {
    const c = Object.create(GenerativeLead.prototype) as GenerativeLead;
    Object.assign(c, this);
    c.slots = [...this.slots];
    c.mutate = this.mutate.clone();
    return c;
  }

  /** Back to the state right after construction. */
  reset(): void {
    const fresh = new GenerativeLead(this.seed);
    this.slots = fresh.slots;
    this.mutate = fresh.mutate;
    this.counter = 0;
    this.barStart = 0;
    this.prevBarStart = 0;
    this.lastStep = -1;
  }

  /**
   * Back to the start of the loop, keeping the notes (slots) as they are now: a section entered
   * again picks up its loop, mutations and all, aligned to the bar.
   */
  rewind(): void {
    this.counter = 0;
    this.barStart = 0;
    this.prevBarStart = 0;
    this.lastStep = -1;
  }

  /**
   * The current bar as it stands: which steps are hits, and which of those play with the slots as
   * they are now. Mutations still to come are not foreseen. `shownStep`: the step the UI shows as
   * playing; past the last step computed, the scheduler has already crossed the bar line and the UI
   * is still in the bar before, so that bar is shown. No UI caller since P1b; kept for P6's step row.
   */
  preview(p: LeadParams, shownStep?: number): LeadStepView[] {
    const length = Math.max(2, Math.min(16, Math.round(p.length)));
    const rhythm = euclid(p.hits, 16, p.rotate);
    const start = shownStep !== undefined && shownStep > this.lastStep ? this.prevBarStart : this.barStart;
    return rhythm.map((hit, s) => ({ hit, plays: hit && this.slots[(start + s) % length].roll < p.density }));
  }

  /** Advance one sixteenth. `barStep` is the position in the bar (0..15). */
  step(barStep: number, p: LeadParams, ctx: LeadContext, shape?: PulseShape): LeadNote | null {
    const length = Math.max(2, Math.min(16, Math.round(p.length)));
    if (barStep === 0) {
      this.prevBarStart = this.barStart;
      this.barStart = this.counter;
    }
    this.lastStep = barStep;
    const index = this.counter % length;
    this.counter++;
    if (!euclid(p.hits, 16, p.rotate)[barStep]) return null;

    if (this.mutate.chance(mutationChance(p.lock))) {
      this.slots[index] = { pitch: this.mutate.next(), pool: this.mutate.next(), roll: this.mutate.next() };
    }
    const slot = this.slots[index];
    if (slot.roll >= p.density) return null;
    return { midi: pickPitch(slot, p.tension, ctx, shape), vel: 0.6 + 0.3 * slot.roll };
  }
}

/** Without `shape` (or at Pulse's defaults) this is G4's pick, note for note. */
function pickPitch(slot: Slot, tension: number, ctx: LeadContext, shape?: PulseShape): number {
  const t = Math.max(0, Math.min(1, tension));
  const chordSet = new Set(ctx.chordTones);
  const passing = ctx.scale.filter((pc) => !chordSet.has(pc));
  let pcs: number[];
  if (slot.pool >= t || passing.length === 0) pcs = ctx.chordTones.filter((pc) => ctx.scale.includes(pc));
  else pcs = passing;
  if (pcs.length === 0) pcs = ctx.scale;
  const pool: number[] = [];
  const lo = shape?.lo ?? LEAD_RANGE.lo;
  const hi = shape?.hi ?? LEAD_RANGE.hi;
  for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) pool.push(m);
  // A narrow window can miss every note of the pool (passing tones of a 9th chord): it widens by fifths.
  for (let w = 7; pool.length === 0; w += 7) for (let m = lo - w; m <= hi + w; m++) if (pcs.includes(((m % 12) + 12) % 12)) pool.push(m);
  // A Shape other than Free pulls the pick toward the contour, keeping a third of the slot's own choice.
  const h = shape?.contour === undefined ? slot.pitch : Math.min(0.999, 0.35 * slot.pitch + 0.65 * shape.contour);
  return pool[Math.min(pool.length - 1, Math.floor(h * pool.length))];
}
