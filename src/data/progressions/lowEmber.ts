import type { ProgressionDef } from "../../music/data.ts";

/** P7 (spec 8.10): chords of four and eight bars, for Ambient and Drone. */
export default {
  order: 903,
  name: "Low ember",
  feels: ["dreamy", "dark"],
  vibes: ["ambient", "drone"],
  mood: "major",
  voicing: "triads",
  chords: [[5, 8], [3, 8]],
} satisfies ProgressionDef;
