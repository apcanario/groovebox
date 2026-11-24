import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 15,
  name: "Picnic",
  feels: ["bright"],
  vibes: ["tropicalHouse", "afroHouse", "melodicTechno", "dubTechno", "twoStep", "dubstep", "ambient", "downtempo", "synthwave", "edm", "electro", "trap"],
  mood: "major",
  voicing: "triads",
  chords: [[3, 1], [4, 1], [2, 1], [5, 1]],
} satisfies ProgressionDef;
