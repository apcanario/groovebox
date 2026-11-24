import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 925,
  name: "Under ice",
  feels: ["dark", "tense"],
  vibes: ["ambient"],
  mood: "minor",
  voicing: "triads",
  chords: [[0, 4], [3, 4], [0, 4], [4, 4]],
} satisfies ProgressionDef;
