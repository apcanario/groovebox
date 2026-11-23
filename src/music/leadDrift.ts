/**
 * Drift (spec 8.5): sparse long notes, half a bar to two bars, moving by step, with long rests. No note is
 * shorter than two beats (eight steps), whatever Note length says. Rests run from about one to three bars at
 * Busy 0 down to half a bar to a bar and a quarter at Busy 1; Busy shortens notes and rests. Each move is one
 * scale degree of the window (now and then two); Shape leans the moves up or down. A phrase's last note ends
 * half a bar before the phrase does. Lock rewrites notes at each bar line. Pure and seeded.
 */
import { leadWindow, lengthFactor, velocity, type LeadKnobs, type Plan, type PlanNote, type Rand } from "./leadKit.ts";

/** Shortest Drift note, in steps: two beats. */
export const DRIFT_MIN = 8;
/** Longest, in steps: three bars (two bars, stretched by Note length). */
export const DRIFT_MAX = 48;

/** Scale notes in the pitch window, near enough (every mood's scale has seven notes in twelve semitones). */
function degreesIn(k: LeadKnobs): number {
  const w = leadWindow(k.range, k.register);
  return Math.max(2, Math.round(((w.hi - w.lo) * 7) / 12) + 1);
}

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

/** Rest kept at the end of every phrase, in steps: half a bar, so the phrase's last note never runs on. */
export const DRIFT_END_REST = 8;

export function driftPlan(k: LeadKnobs, rand: Rand): Plan {
  const steps = 16 * k.phrase;
  const factor = lengthFactor(k.noteLength);
  const last = steps - DRIFT_END_REST;
  // First the rhythm. A note starts only where it can last its two beats before the phrase's closing rest.
  const timing: { at: number; len: number }[] = [];
  let at = last - 4 >= DRIFT_MIN && rand(0, 1) < 0.5 - 0.4 * k.busy ? 4 : 0;
  for (let i = 0; at <= last - DRIFT_MIN && i < 64; i++) {
    const natural = DRIFT_MIN + Math.round(rand(i + 1, 3) * 24 * (1 - 0.6 * k.busy));
    // Long rests (P5 review E1): 16..48 steps at Busy 0, 8..24 at the default song's 0.85, 8..20 at Busy 1.
    const rest = 4 * Math.max(2, Math.round((4 + rand(i + 1, 4) * 8) * (1 - 0.6 * k.busy)));
    // The phrase's last note ends half a bar before the phrase does, so it never runs into the next phrase
    // (P5 review M1); one that slides is held on to the next note by decorate().
    const len = Math.min(last - at, Math.max(DRIFT_MIN, Math.min(DRIFT_MAX, natural * factor)));
    timing.push({ at, len });
    // The rest runs from the note's end, so notes never overlap.
    at += len + rest;
  }
  // Then the pitches, in scale degrees of the window (P5 review S1): each move is one degree, now and then
  // two. Unless Shape rises or falls through the phrase, the walk stays close enough to its first note to
  // step back to it when the phrase repeats.
  const top = degreesIn(k) - 1;
  const bridge = k.shape !== "rise" && k.shape !== "fall";
  // Rise starts near the bottom, Fall near the top; any other Shape starts off the window's centre and its
  // ends (0.2..0.4 or 0.6..0.8), so Range moves it.
  const r0 = rand(0, 2);
  const start = Math.round(top * (k.shape === "rise" ? 0.1 : k.shape === "fall" ? 0.9 : r0 < 0.5 ? 0.2 + 0.4 * r0 : 0.4 + 0.4 * r0));
  let d = start;
  const notes: PlanNote[] = timing.map((t, i) => {
    if (i > 0) {
      const l = lean(k.shape, t.at / steps);
      const r = rand(i + 1, 5);
      let dir = l === -2 ? (r < 0.8 ? 0 : r < 0.9 ? 1 : -1) : l === -1 ? (i % 2 ? 1 : -1) : r < l ? 1 : -1;
      let size = rand(i + 1, 6) < 0.1 ? 2 : 1;
      const left = timing.length - i; // moves still to come, the step back to the first note included
      if (bridge && Math.abs(d + dir * size - start) > left) {
        dir = Math.sign(start - d);
        size = 1;
      }
      d += dir * size;
      if (d > top) d = 2 * top - d;
      if (d < 0) d = -d;
    }
    return { id: i + 1, at: t.at, len: t.len, h: d / top, pool: rand(i + 1, 7), vel: velocity(0.42, rand(i + 1, 8), t.at), near: true };
  });
  // Variation: notes in the phrase's second half, its last note always among them, move by a step.
  for (const n of notes) {
    if ((n === notes[notes.length - 1] || n.at >= steps / 2) && rand(100 + n.id, 9) < k.variation) {
      n.h = Math.max(0, Math.min(1, n.h + (rand(100 + n.id, 10) < 0.5 ? -1 : 1) / top));
      n.id += 100;
    }
  }
  return { steps, notes };
}
