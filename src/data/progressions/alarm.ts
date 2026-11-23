import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 402,
  name: "Alarm",
  feels: ["tense"],
  vibes: ["drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage", "idm", "edm", "trance", "electro", "trap", "deepTechno", "melodicTechno", "minimalTechno", "dubTechno"],
  mood: "minor",
  voicing: "triads",
  chords: [[0, 1], [4, 1], [0, 1], [4, 1]],
} satisfies ProgressionDef;
