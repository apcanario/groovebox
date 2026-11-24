import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Drone. */
export default {
  order: 928,
  name: "Noon haze",
  feels: ["bright", "warm"],
  vibes: ["drone"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 8], [1, 8]],
} satisfies ProgressionDef;
