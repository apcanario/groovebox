import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 920,
  name: "Tea at dusk",
  feels: ["warm", "dreamy"],
  vibes: ["ambient"],
  mood: "house",
  voicing: "extended",
  chords: [[3, 4], [0, 4]],
} satisfies ProgressionDef;
