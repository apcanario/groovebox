import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient and Drone. */
export default {
  order: 927,
  name: "Low static",
  feels: ["tense"],
  vibes: ["ambient", "drone"],
  mood: "dark",
  voicing: "low",
  chords: [[0, 8], [4, 8]],
} satisfies ProgressionDef;
