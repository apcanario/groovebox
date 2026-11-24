import type { ProgressionDef } from "../../music/data.ts";

/** P8: Drone's intro and outro, eight bars on the root, eight on the flat seventh. */
export default {
  order: 904,
  name: "Long shadow",
  feels: ["dark", "dreamy"],
  vibes: ["deepTechno", "dubstep", "drone"],
  mood: "dark",
  voicing: "low",
  chords: [[0, 8], [6, 8]],
} satisfies ProgressionDef;
