import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient and Drone. */
export default {
  order: 916,
  name: "Spring thaw",
  feels: ["bright", "uplifting"],
  vibes: ["ambient", "drone"],
  mood: "major",
  voicing: "triads",
  chords: [[3, 8], [4, 8], [0, 8]],
} satisfies ProgressionDef;
