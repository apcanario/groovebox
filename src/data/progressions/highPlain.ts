import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Drone. */
export default {
  order: 930,
  name: "High plain",
  feels: ["bright", "uplifting"],
  vibes: ["drone"],
  mood: "major",
  voicing: "triads",
  chords: [[3, 8], [0, 8]],
} satisfies ProgressionDef;
