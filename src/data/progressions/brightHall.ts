import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 14,
  name: "Bright hall",
  feels: ["bright"],
  vibes: ["deepTechno", "melodicTechno", "minimalTechno", "dubTechno", "idm", "edm", "trance", "electro", "trap", "loFi", "ambient", "drone", "downtempo", "synthwave"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [4, 1], [1, 1], [3, 1]],
} satisfies ProgressionDef;
