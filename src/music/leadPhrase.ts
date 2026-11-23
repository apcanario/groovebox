/**
 * Phrase (spec 8.5): a line in call and response, A, A varied, A, B, each part a quarter of the phrase (a bar
 * at Phrase 4). Every part ends on a chord tone and leaves at least two steps of rest before the next, so the
 * phrase rests between phrases and ends on a chord tone. B, the last part, answers A: Variation sets how much
 * of A it changes; at 0 only its last note answers, lower. Pure and seeded.
 */
import { height, lengthFactor, pickSteps, velocity, type LeadKnobs, type Plan, type PlanNote, type Rand } from "./leadKit.ts";

/** Steps of rest kept at the end of every part. */
export const PHRASE_REST = 2;

export function phrasePlan(k: LeadKnobs, rand: Rand): Plan {
  const steps = 16 * k.phrase;
  const part = steps / 4;
  const active = Math.max(1, Math.floor(part * 0.7));
  const grid = part >= 8 ? 2 : 1;
  const candidates = Array.from({ length: Math.ceil(active / grid) }, (_, i) => i * grid);
  const count = Math.max(1, Math.round(candidates.length * (0.25 + 0.5 * k.busy)));
  const onsets = pickSteps(candidates, count, (s) => rand(10 + s, 1) + (s === 0 ? 0.5 : s % 4 === 0 ? 0.3 : 0));
  const factor = lengthFactor(k.noteLength);
  const fit = (at: number, len: number): number => Math.max(0.3, Math.min(len, part - PHRASE_REST - at));
  const a: PlanNote[] = onsets.map((at, i) => {
    const gap = (i + 1 < onsets.length ? onsets[i + 1] : active + 1) - at;
    const x = onsets.length > 1 ? i / (onsets.length - 1) : 0;
    return {
      id: i,
      at,
      len: fit(at, gap * 0.9 * factor),
      h: height(k.shape, x, rand(20 + i, 2)),
      pool: rand(30 + i, 3),
      vel: velocity(0.5, rand(40 + i, 4), at),
      chord: i === onsets.length - 1,
    };
  });
  const lastId = a.length - 1;
  // A varied: its last note steps away from A's.
  const a2 = a.map((n) => (n.id === lastId ? { ...n, id: 200 + n.id, h: Math.max(0, Math.min(1, n.h + (rand(50, 5) < 0.5 ? -0.2 : 0.2))) } : n));
  // B: Variation's share of A's notes take new pitches; its last note answers, low, on a chord tone.
  const b = a.map((n) => {
    let m = n;
    if (n.id !== lastId && rand(60 + n.id, 6) < k.variation) m = { ...n, id: 300 + n.id, h: rand(70 + n.id, 7), pool: rand(80 + n.id, 8) };
    if (n.id === lastId) m = { ...n, id: 300 + n.id, h: Math.min(n.h, 0.15 + 0.2 * rand(90, 9)), chord: true };
    return m;
  });
  // At high Variation B also moves its rhythm: one more note in its rest-free part.
  if (k.variation > 0.6 && rand(91, 10) < k.variation) {
    const free = candidates.filter((s) => !onsets.includes(s) && s < (onsets[onsets.length - 1] ?? 0));
    if (free.length) {
      const at = free[Math.floor(rand(92, 11) * free.length)];
      b.push({ id: 350, at, len: fit(at, 1.5 * factor), h: rand(93, 12), pool: rand(94, 13), vel: velocity(0.45, rand(95, 14), at) });
    }
  }
  const notes: PlanNote[] = [];
  [a, a2, a, b].forEach((p, i) => {
    for (const n of p) notes.push({ ...n, at: n.at + i * part });
  });
  return { steps, notes };
}
