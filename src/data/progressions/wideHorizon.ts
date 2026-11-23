import type { ProgressionDef } from "../../music/data.ts";

/** P7 (spec 8.10): chords of four and eight bars, for Ambient and Drone. */
export default {
  order: 902,
  name: "Wide horizon",
  feels: ["dreamy", "uplifting"],
  vibes: ["ambient", "drone"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 4], [3, 4], [5, 4], [4, 4]],
} satisfies ProgressionDef;
