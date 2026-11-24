import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 910,
  name: "Sunlit room",
  feels: ["bright", "uplifting"],
  vibes: ["ambient"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 4], [4, 4], [5, 4], [3, 4]],
} satisfies ProgressionDef;
