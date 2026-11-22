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

export interface LeadParams {
  lock: number; // 0..1: 1 frozen, 0 new notes all the time
  hits: number; // 1..16
  rotate: number; // 0..15
  length: number; // 2..16
  tension: number; // 0..1: 0 chord tones, 0.5 scale tones, 1 passing (non-chord scale) tones
  density: number; // 0..1: chance each hit plays
  seed: number;
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

/** Chance that a hit rewrites its slot, by lock position. */
export function mutationChance(lock: number): number {
  const l = Math.max(0, Math.min(1, lock));
  if (l >= 0.999) return 0;
  return Math.pow(1 - l, 3);
}

export class GenerativeLead {
  private slots: Slot[] = [];
  private mutate: Rng;
  private seed: number;
  private counter = 0;

  constructor(seed: number) {
    this.seed = seed;
    const init = createRng(deriveSeed(seed, 1));
    for (let i = 0; i < 16; i++) this.slots.push({ pitch: init.next(), pool: init.next(), roll: init.next() });
    this.mutate = createRng(deriveSeed(seed, 2));
  }

  get seedValue(): number {
    return this.seed;
  }

  /** Back to the state right after construction. */
  reset(): void {
    const fresh = new GenerativeLead(this.seed);
    this.slots = fresh.slots;
    this.mutate = fresh.mutate;
    this.counter = 0;
  }

  /** Advance one sixteenth. `barStep` is the position in the bar (0..15). */
  step(barStep: number, p: LeadParams, ctx: LeadContext): LeadNote | null {
    const length = Math.max(2, Math.min(16, Math.round(p.length)));
    const index = this.counter % length;
    this.counter++;
    if (!euclid(p.hits, 16, p.rotate)[barStep]) return null;

    if (this.mutate.chance(mutationChance(p.lock))) {
      this.slots[index] = { pitch: this.mutate.next(), pool: this.mutate.next(), roll: this.mutate.next() };
    }
    const slot = this.slots[index];
    if (slot.roll >= p.density) return null;
    return { midi: pickPitch(slot, p.tension, ctx), vel: 0.6 + 0.3 * slot.roll };
  }
}

function pickPitch(slot: Slot, tension: number, ctx: LeadContext): number {
  const t = Math.max(0, Math.min(1, tension));
  const chordSet = new Set(ctx.chordTones);
  const passing = ctx.scale.filter((pc) => !chordSet.has(pc));
  let pcs: number[];
  if (slot.pool >= t || passing.length === 0) pcs = ctx.chordTones.filter((pc) => ctx.scale.includes(pc));
  else pcs = passing;
  if (pcs.length === 0) pcs = ctx.scale;
  const pool: number[] = [];
  for (let m = LEAD_RANGE.lo; m <= LEAD_RANGE.hi; m++) if (pcs.includes(m % 12)) pool.push(m);
  return pool[Math.min(pool.length - 1, Math.floor(slot.pitch * pool.length))];
}
