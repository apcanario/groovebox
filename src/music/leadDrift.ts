/**
 * Drift (spec 8.5): sparse long notes, half a bar to two bars, moving by step, with long rests. No note is
 * shorter than two beats (eight steps), whatever Note length says. Busy shortens notes and rests; Shape leans
 * the steps up or down. Lock rewrites notes at each bar line. Pure and seeded.
 */
import { lengthFactor, velocity, type LeadKnobs, type Plan, type PlanNote, type Rand } from "./leadKit.ts";

/** Shortest Drift note, in steps: two beats. */
export const DRIFT_MIN = 8;
/** Longest, in steps: three bars (two bars, stretched by Note length). */
export const DRIFT_MAX = 48;

/** One step in the window: about a note of the chord, more than one of the scale. */
const STEP = 0.14;

function lean(shape: LeadKnobs["shape"], x: number): number {
  switch (shape) {
    case "rise":
      return 0.7;
    case "fall":
      return 0.3;
    case "arch":
      return x < 0.5 ? 0.75 : 0.25;
    case "valley":
      return x < 0.5 ? 0.25 : 0.75;
    case "zigzag":
      return -1; // alternate
    case "flat":
      return -2; // stay
    case "free":
      return 0.5;
  }
}

export function driftPlan(k: LeadKnobs, rand: Rand): Plan {
  const steps = 16 * k.phrase;
  const factor = lengthFactor(k.noteLength);
  const notes: PlanNote[] = [];
  let at = rand(0, 1) < 0.5 - 0.4 * k.busy ? 4 : 0;
  let h = k.shape === "rise" ? 0.2 : k.shape === "fall" ? 0.8 : 0.3 + 0.4 * rand(0, 2);
  for (let i = 0; at < steps - DRIFT_MIN / 2 && i < 64; i++) {
    const natural = DRIFT_MIN + Math.round(rand(i + 1, 3) * 24 * (1 - 0.6 * k.busy));
    const rest = 2 * Math.round(((2 + rand(i + 1, 4) * 10) * (1 - 0.8 * k.busy)) / 2);
    const len = Math.max(DRIFT_MIN, Math.min(DRIFT_MAX, natural * factor));
    if (i > 0) {
      const l = lean(k.shape, at / steps);
      const r = rand(i + 1, 5);
      const dir = l === -2 ? (r < 0.8 ? 0 : r < 0.9 ? 1 : -1) : l === -1 ? (i % 2 ? 1 : -1) : r < l ? 1 : -1;
      h += dir * STEP * (rand(i + 1, 6) < 0.25 ? 2 : 1);
      if (h > 1) h = 2 - h;
      if (h < 0) h = -h;
    }
    notes.push({ id: i + 1, at, len, h, pool: rand(i + 1, 7), vel: velocity(0.42, rand(i + 1, 8), at) });
    at += natural + rest;
  }
  // Variation: notes starting in the phrase's last bar move by a step or two.
  for (const n of notes) {
    if (n.at >= steps - 16 && rand(100 + n.id, 9) < k.variation) {
      n.h = Math.max(0, Math.min(1, n.h + (rand(100 + n.id, 10) < 0.5 ? -2 : 2) * STEP));
      n.id += 100;
    }
  }
  return { steps, notes };
}
