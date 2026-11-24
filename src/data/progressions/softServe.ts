import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 19,
  name: "Soft serve",
  feels: ["bright"],
  vibes: ["tropicalHouse", "minimalTechno", "drumAndBass", "twoStep", "futureGarage", "loFi", "ambient", "synthwave", "trance"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [5, 1], [1, 1], [4, 1]],
} satisfies ProgressionDef;
