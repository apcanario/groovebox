import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient and Drone. */
export default {
  order: 924,
  name: "Slow eclipse",
  feels: ["dark", "tense"],
  vibes: ["ambient", "drone"],
  mood: "dark",
  voicing: "low",
  chords: [[0, 4], [5, 4], [1, 8]],
} satisfies ProgressionDef;
