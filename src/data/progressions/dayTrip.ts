import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 20,
  name: "Day trip",
  feels: ["bright"],
  vibes: ["loFi", "ambient", "drone", "downtempo", "synthwave", "deepTechno", "melodicTechno", "minimalTechno", "dubTechno", "drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [3, 1], [0, 1], [4, 1]],
} satisfies ProgressionDef;
