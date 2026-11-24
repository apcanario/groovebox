import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Drone. */
export default {
  order: 935,
  name: "Peat smoke",
  feels: ["warm", "dark"],
  vibes: ["drone"],
  mood: "house",
  voicing: "extended",
  chords: [[5, 8], [0, 8]],
} satisfies ProgressionDef;
