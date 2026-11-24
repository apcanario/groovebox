import type { ProgressionDef } from "../../music/data.ts";

/** P8: Drone's break, eight bars on the root, eight a half step above it. */
export default {
  order: 906,
  name: "Dead calm",
  feels: ["tense", "dark"],
  vibes: ["ambient", "drone"],
  mood: "dark",
  voicing: "low",
  chords: [[0, 8], [1, 8]],
} satisfies ProgressionDef;
