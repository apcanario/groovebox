import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Drone. */
export default {
  order: 938,
  name: "Fault hum",
  feels: ["tense", "dark"],
  vibes: ["drone"],
  mood: "dark",
  voicing: "low",
  chords: [[0, 8], [1, 8], [0, 8], [6, 8]],
} satisfies ProgressionDef;
