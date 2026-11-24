import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Drone. */
export default {
  order: 929,
  name: "Salt flat",
  feels: ["bright", "dreamy"],
  vibes: ["drone"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 8], [2, 8]],
} satisfies ProgressionDef;
