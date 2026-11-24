import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 10,
  name: "Easy street",
  feels: ["bright"],
  vibes: ["tropicalHouse", "progressive", "afroHouse", "minimalTechno", "twoStep", "loFi", "idm", "edm", "electro"],
  mood: "major",
  voicing: "triads",
  chords: [[5, 1], [3, 1], [0, 1], [4, 1]],
} satisfies ProgressionDef;
