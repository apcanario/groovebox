import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 921,
  name: "Sky opening",
  feels: ["uplifting"],
  vibes: ["ambient"],
  mood: "major",
  voicing: "triads",
  chords: [[5, 4], [4, 4], [0, 8]],
} satisfies ProgressionDef;
