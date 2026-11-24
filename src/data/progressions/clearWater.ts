import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 914,
  name: "Clear water",
  feels: ["bright", "warm"],
  vibes: ["ambient"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 4], [3, 4]],
} satisfies ProgressionDef;
