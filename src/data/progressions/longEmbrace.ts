import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient. */
export default {
  order: 919,
  name: "Long embrace",
  feels: ["warm", "uplifting"],
  vibes: ["ambient"],
  mood: "deep",
  voicing: "extended",
  chords: [[5, 4], [3, 4], [0, 8]],
} satisfies ProgressionDef;
