import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 101,
  name: "Low lamp",
  feels: ["warm"],
  vibes: ["tropicalHouse", "progressive", "melodicTechno", "twoStep", "breakbeat", "dubstep", "downtempo", "edm"],
  mood: "house",
  voicing: "extended",
  chords: [[0, 1], [5, 1], [3, 1], [4, 1]],
} satisfies ProgressionDef;
