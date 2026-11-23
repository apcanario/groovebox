import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 3,
  name: "Morning run",
  feels: ["bright"],
  vibes: ["deepHouse", "tropicalHouse", "progressive", "acidHouse", "afroHouse", "idm", "edm", "trance", "electro", "trap", "drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [5, 1], [3, 1], [4, 1]],
} satisfies ProgressionDef;
