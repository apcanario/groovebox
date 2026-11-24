import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 915,
  name: "Silver hour",
  feels: ["bright", "dreamy"],
  vibes: ["ambient"],
  mood: "deep",
  voicing: "extended",
  chords: [[0, 4], [3, 4], [4, 4], [3, 4]],
} satisfies ProgressionDef;
