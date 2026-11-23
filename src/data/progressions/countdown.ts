import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 403,
  name: "Countdown",
  feels: ["tense"],
  vibes: ["drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage", "idm", "edm", "trance", "electro", "trap", "deepHouse", "tropicalHouse", "progressive", "acidHouse", "afroHouse"],
  mood: "minor",
  voicing: "triads",
  chords: [[5, 1], [6, 1], [0, 1], [0, 1]],
} satisfies ProgressionDef;
