/**
 * T3 (spec 9.4): when each punch pad starts and ends, on the audio clock. Pure timing, no audio: the engine's
 * punch rack (`src/engine/punch.ts`) asks this for the grid lines and schedules its ramps so that the effect is
 * fully in on its start line and fully out on its end line.
 *
 * | Pad     | Starts on            | Ends on                                                 |
 * |---------|----------------------|---------------------------------------------------------|
 * | Cut     | the next sixteenth   | the next bar line after release                         |
 * | Filter  | the next sixteenth   | the next beat after release (the filter is open again)  |
 * | Stutter | the next half beat   | the next beat after release                             |
 * | Echo    | the next beat        | one bar after its start (a tap; the echoes ring on)     |
 * | Wash    | the next beat        | one bar after its start (a tap; the reverb rings on)    |
 * | Riser   | the next sixteenth   | falls away from the next sixteenth after release, gone one beat later |
 *
 * Choices (spec 9.4 names only the ends of Cut, Filter and Stutter and Echo's and Wash's length): every start lands
 * on a grid line, the finest one that keeps the effect in time (a sixteenth, as the notes play); Stutter starts on
 * a half beat so the half beat it repeats is the one on the grid just before; Echo and Wash start on the next beat.
 */

export const PUNCH_PADS = ["cut", "filter", "stutter", "echo", "wash", "riser"] as const;
export type PunchPad = (typeof PUNCH_PADS)[number];

/** Grid lines, in beats: a sixteenth, a half beat, a beat, a bar (four beats). */
export type PunchUnit = "step" | "half" | "beat" | "bar";
export const UNIT_BEATS: Record<PunchUnit, number> = { step: 0.25, half: 0.5, beat: 1, bar: 4 };

export interface PunchRule {
  /** A hold pad acts while held; a tap pad runs for `length` beats from its start. */
  kind: "hold" | "tap";
  start: PunchUnit;
  /** Hold pads: the line after release it ends on. */
  end: PunchUnit;
  /** Tap pads: beats from start to end. */
  length?: number;
}

export const PUNCH_RULES: Record<PunchPad, PunchRule> = {
  cut: { kind: "hold", start: "step", end: "bar" },
  filter: { kind: "hold", start: "step", end: "beat" },
  stutter: { kind: "hold", start: "half", end: "beat" },
  echo: { kind: "tap", start: "beat", end: "beat", length: 4 },
  wash: { kind: "tap", start: "beat", end: "beat", length: 4 },
  riser: { kind: "hold", start: "step", end: "step" },
};

/** Riser: beats from the start of its fall to silence. */
export const RISER_FALL_BEATS = 1;

/**
 * Seconds ahead of now that a line must be, so its ramps (at most RAMP_MAX before the line) are scheduled in the
 * future. A press closer than this to a line lands on the one after.
 */
export const PUNCH_GUARD = 0.025;
/** The longest ramp a pad schedules before its line. */
export const RAMP_MAX = 0.02;

/** The transport against the audio clock: at audio time `at` it stood at `beats`, playing at `bpm`. */
export interface PunchGrid {
  at: number;
  beats: number;
  bpm: number;
}

/** The transport's beat at audio time `t`. */
export function beatAt(g: PunchGrid, t: number): number {
  return g.beats + ((t - g.at) * g.bpm) / 60;
}

/** The audio time of transport beat `b`. */
export function timeOfBeat(g: PunchGrid, b: number): number {
  return g.at + ((b - g.beats) * 60) / g.bpm;
}

/** The first `unit` line at or after audio time `t` (a line within a microsecond of `t` counts as at it). */
export function lineAt(g: PunchGrid, t: number, unit: PunchUnit): number {
  const u = UNIT_BEATS[unit];
  const b = beatAt(g, t);
  const n = Math.ceil(b / u - 1e-6);
  return timeOfBeat(g, n * u);
}

/** Where a pad pressed at audio time `now` starts. */
export function punchStart(pad: PunchPad, g: PunchGrid, now: number): number {
  return lineAt(g, now + PUNCH_GUARD, PUNCH_RULES[pad].start);
}

/**
 * Where a pad that started at `start` ends: a tap pad `length` beats on; a hold pad released at audio time `now`
 * on the first line of its end unit after both the release (plus the guard) and its start.
 */
export function punchEnd(pad: PunchPad, g: PunchGrid, start: number, now: number): number {
  const r = PUNCH_RULES[pad];
  if (r.kind === "tap") return timeOfBeat(g, beatAt(g, start) + (r.length ?? 4));
  const from = Math.max(now + PUNCH_GUARD, start + 1e-4);
  return lineAt(g, from, r.end);
}
