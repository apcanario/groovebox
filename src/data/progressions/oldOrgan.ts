import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Drone. */
export default {
  order: 936,
  name: "Old organ",
  feels: ["warm", "uplifting"],
  vibes: ["drone"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 8], [3, 8], [4, 8], [0, 8]],
} satisfies ProgressionDef;
