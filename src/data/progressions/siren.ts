import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 409,
  name: "Siren",
  feels: ["tense"],
  vibes: ["deepTechno", "melodicTechno", "minimalTechno", "dubTechno", "idm", "edm", "trance", "electro", "trap", "drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage"],
  mood: "dark",
  voicing: "low",
  chords: [[0, 0.5], [1, 0.5], [0, 0.5], [1, 0.5]],
} satisfies ProgressionDef;
