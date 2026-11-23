import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 405,
  name: "Pressure",
  feels: ["tense"],
  vibes: ["idm", "edm", "trance", "electro", "trap", "drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage", "deepTechno", "melodicTechno", "minimalTechno", "dubTechno"],
  mood: "minor",
  voicing: "triads",
  chords: [[0, 1], [3, 1], [4, 1], [4, 1]],
} satisfies ProgressionDef;
