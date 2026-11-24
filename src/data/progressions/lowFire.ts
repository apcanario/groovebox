import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 917,
  name: "Low fire",
  feels: ["warm", "uplifting"],
  vibes: ["ambient"],
  mood: "house",
  voicing: "extended",
  chords: [[0, 4], [5, 4], [3, 4], [4, 4]],
} satisfies ProgressionDef;
