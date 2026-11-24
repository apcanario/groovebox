import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 923,
  name: "Still night",
  feels: ["dark", "tense"],
  vibes: ["ambient"],
  mood: "minor",
  voicing: "triads",
  chords: [[0, 4], [6, 4], [5, 4], [6, 4]],
} satisfies ProgressionDef;
