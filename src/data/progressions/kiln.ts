import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Drone. */
export default {
  order: 934,
  name: "Kiln",
  feels: ["warm", "dreamy"],
  vibes: ["drone"],
  mood: "deep",
  voicing: "extended",
  chords: [[0, 8], [5, 8]],
} satisfies ProgressionDef;
