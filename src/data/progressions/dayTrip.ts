import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 20,
  name: "Day trip",
  feels: ["bright"],
  vibes: ["deepHouse", "tropicalHouse", "deepTechno", "breakbeat", "synthwave", "trance", "trap"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [3, 1], [0, 1], [4, 1]],
} satisfies ProgressionDef;
