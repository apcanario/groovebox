import type { ProgressionDef } from "../../music/data.ts";

/** P8 review E1 (spec 8.10): chords of four or eight bars, chosen for Ambient and Drone. */
export default {
  order: 918,
  name: "Warm hands",
  feels: ["warm", "dreamy"],
  vibes: ["ambient", "drone"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 8], [5, 8]],
} satisfies ProgressionDef;
