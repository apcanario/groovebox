import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 16,
  name: "Good news",
  feels: ["bright"],
  vibes: ["progressive", "deepTechno", "dubTechno", "breakbeat", "downtempo", "edm", "trance", "electro", "trap"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [0, 1], [3, 1], [4, 1]],
} satisfies ProgressionDef;
