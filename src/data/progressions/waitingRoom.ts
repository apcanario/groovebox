import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient and Drone. */
export default {
  order: 926,
  name: "Waiting room",
  feels: ["tense"],
  vibes: ["ambient", "drone"],
  mood: "minor",
  voicing: "triads",
  chords: [[0, 8], [1, 8]],
} satisfies ProgressionDef;
