/**
 * Roll (spec 8.5): driving sixteenths with slides, accents and octave jumps. A pattern of one bar (two from
 * Phrase 2 on) repeats through the phrase; Busy sets how many of its steps play (all of them at the top);
 * the last bar of the phrase differs by Variation. Lock rewrites steps at each bar line. Pure and seeded.
 */
import { height, lengthFactor, velocity, type LeadKnobs, type Plan, type PlanNote, type Rand } from "./leadKit.ts";

export function rollPlan(k: LeadKnobs, rand: Rand): Plan {
  const steps = 16 * k.phrase;
  const span = 16 * Math.min(k.phrase, 2);
  const factor = lengthFactor(k.noteLength);
  const play = 0.5 + 0.5 * k.busy;
  const pattern: (PlanNote | null)[] = [];
  for (let s = 0; s < span; s++) {
    if (s > 0 && rand(s, 1) >= play) {
      pattern.push(null);
      continue;
    }
    // A pedal on the lowest note now and then, an octave up now and then, the contour the rest of the time.
    const pedal = rand(s, 4) < 0.25;
    pattern.push({
      id: s,
      at: s,
      len: Math.max(0.25, 0.9 * factor),
      h: pedal ? 0 : height(k.shape, s / (span - 1), rand(s, 2)),
      pool: rand(s, 5),
      vel: velocity(0.45, rand(s, 6), s),
      oct: rand(s, 3) < 0.18 ? 1 : 0,
    });
  }
  const notes: PlanNote[] = [];
  for (let s = 0; s < steps; s++) {
    let n = pattern[s % span];
    const inLast = s >= steps - 16;
    if (inLast && rand(1000 + (s % 16), 7) < k.variation) {
      // Varied: a rest becomes a note and a note gets a new pitch (and, under full Busy, may drop out).
      const id = 1000 + (s % 16);
      n = rand(id, 8) < 0.2 * (1 - k.busy) ? null : { id, at: s, len: Math.max(0.25, 0.9 * factor), h: rand(id, 9), pool: rand(id, 10), vel: velocity(0.45, rand(id, 11), s), oct: rand(id, 12) < 0.3 ? 1 : 0 };
    }
    if (n) notes.push({ ...n, at: s });
  }
  return { steps, notes };
}
