import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 319,
  name: "Static",
  feels: ["dark"],
  vibes: ["drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage", "idm", "edm", "trance", "electro", "trap", "deepTechno", "melodicTechno", "minimalTechno", "dubTechno"],
  mood: "minor",
  voicing: "triads",
  chords: [[0, 0.5], [0, 0.5], [6, 1], [5, 1]],
} satisfies ProgressionDef;
