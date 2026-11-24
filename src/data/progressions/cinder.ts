import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Drone. */
export default {
  order: 937,
  name: "Cinder",
  feels: ["warm", "tense"],
  vibes: ["drone"],
  mood: "house",
  voicing: "extended",
  chords: [[0, 8], [6, 8]],
} satisfies ProgressionDef;
