import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 1,
  name: "Sunny side",
  feels: ["bright"],
  vibes: ["deepHouse", "tropicalHouse", "progressive", "acidHouse", "afroHouse", "loFi", "ambient", "drone", "downtempo", "synthwave", "idm", "edm", "trance", "electro", "trap"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [4, 1], [5, 1], [3, 1]],
} satisfies ProgressionDef;
