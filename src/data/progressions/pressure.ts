import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 405,
  name: "Pressure",
  feels: ["tense"],
  vibes: ["deepHouse", "tropicalHouse", "progressive", "melodicTechno", "drumAndBass", "twoStep", "breakbeat", "futureGarage", "ambient", "downtempo", "synthwave", "edm", "trance"],
  mood: "minor",
  voicing: "triads",
  chords: [[0, 1], [3, 1], [4, 1], [4, 1]],
} satisfies ProgressionDef;
