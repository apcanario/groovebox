import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 9,
  name: "Fresh paint",
  feels: ["bright"],
  vibes: ["deepTechno", "melodicTechno", "minimalTechno", "dubTechno", "drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage", "loFi", "ambient", "drone", "downtempo", "synthwave"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [2, 1], [3, 1], [4, 1]],
} satisfies ProgressionDef;
