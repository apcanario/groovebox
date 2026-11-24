import type { ProgressionDef } from "../../music/data.ts";

/** P8: Drone's groove, four bars a chord, back to the root between the flat second and the flat seventh. */
export default {
  order: 905,
  name: "Low hum",
  feels: ["dark", "tense"],
  vibes: ["ambient", "drone"],
  mood: "dark",
  voicing: "low",
  chords: [[0, 4], [1, 4], [0, 4], [6, 4]],
} satisfies ProgressionDef;
