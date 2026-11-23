import type { ProgressionDef } from "../../music/data.ts";

/** P7 (spec 8.10): chords of four and eight bars, for Ambient and Drone. */
export default {
  order: 901,
  name: "Ebb and flow",
  feels: ["dreamy", "warm"],
  vibes: ["ambient", "drone"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 8], [3, 8]],
} satisfies ProgressionDef;
