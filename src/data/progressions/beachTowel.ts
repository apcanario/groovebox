import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 6,
  name: "Beach towel",
  feels: ["bright"],
  vibes: ["deepHouse", "tropicalHouse", "progressive", "acidHouse", "afroHouse", "idm", "edm", "trance", "electro", "trap"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [4, 1], [3, 1], [4, 1]],
} satisfies ProgressionDef;
