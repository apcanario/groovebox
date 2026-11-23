import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 10,
  name: "Easy street",
  feels: ["bright"],
  vibes: ["deepHouse", "tropicalHouse", "progressive", "acidHouse", "afroHouse", "drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage", "idm", "edm", "trance", "electro", "trap"],
  mood: "major",
  voicing: "triads",
  chords: [[5, 1], [3, 1], [0, 1], [4, 1]],
} satisfies ProgressionDef;
