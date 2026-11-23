import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 16,
  name: "Good news",
  feels: ["bright"],
  vibes: ["idm", "edm", "trance", "electro", "trap", "deepTechno", "melodicTechno", "minimalTechno", "dubTechno", "drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [0, 1], [3, 1], [4, 1]],
} satisfies ProgressionDef;
