/**
 * Hook (spec 8.5): a short motif of 3 to 6 notes with a clear shape, one or two bars long, repeated through
 * the phrase. Only the last bar of a phrase may differ (Variation), and Lock rewrites it only at a phrase's
 * end, so with Variation at 0 a whole phrase repeats exactly. Pure and seeded.
 */
import { height, lengthFactor, pickSteps, velocity, type LeadKnobs, type Plan, type PlanNote, type Rand } from "./leadKit.ts";

export function hookPlan(k: LeadKnobs, rand: Rand): Plan {
  const steps = 16 * k.phrase;
  const bars = k.phrase === 1 || rand(0, 0) < 0.5 ? 1 : 2;
  const span = 16 * bars;
  const count = 3 + Math.round(k.busy * 3);
  // Onsets anywhere but the motif's last two steps: the downbeat favoured, then beats and the sixteenth before
  // each beat (the push that gives a hook its snap).
  const candidates = Array.from({ length: span - 2 }, (_, s) => s);
  const onsets = pickSteps(candidates, count, (s) => rand(10 + s, 1) + (s === 0 ? 0.6 : s % 4 === 0 ? 0.3 : s % 4 === 3 ? 0.3 : 0));
  const factor = lengthFactor(k.noteLength);
  const motif: PlanNote[] = onsets.map((at, i) => {
    const gap = (i + 1 < onsets.length ? onsets[i + 1] : span) - at;
    const x = onsets.length > 1 ? i / (onsets.length - 1) : 0;
    return {
      id: i,
      at,
      len: Math.max(0.3, Math.min(6, gap * 0.85) * factor),
      h: height(k.shape, x, rand(20 + i, 2)),
      pool: rand(30 + i, 3),
      vel: velocity(0.55, rand(40 + i, 4), at),
    };
  });
  const notes: PlanNote[] = [];
  for (let start = 0; start < steps; start += span) for (const n of motif) if (start + n.at < steps) notes.push({ ...n, at: start + n.at });
  // Variation: notes of the phrase's last bar get a new pitch; at higher settings one more note is added.
  const last = steps - 16;
  if (k.phrase > 1 || bars === 1) {
    notes.forEach((n, i) => {
      if (n.at >= last && rand(50 + n.id, 5) < k.variation) notes[i] = { ...n, id: 100 + n.id, h: rand(60 + n.id, 6), pool: rand(70 + n.id, 7) };
    });
    if (rand(80, 8) < k.variation - 0.4) {
      const free = [0, 2, 4, 6, 8, 10, 12, 14].map((s) => last + s).filter((s) => !notes.some((n) => Math.abs(n.at - s) < 2));
      if (free.length) {
        const at = free[Math.floor(rand(81, 9) * free.length)];
        notes.push({ id: 120, at, len: Math.max(0.3, 1.7 * factor), h: rand(82, 10), pool: rand(83, 11), vel: velocity(0.5, rand(84, 12), at) });
      }
    }
  }
  return { steps, notes };
}
