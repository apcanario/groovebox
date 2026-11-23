import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 2,
  name: "Open window",
  feels: ["bright"],
  vibes: ["deepHouse", "tropicalHouse", "progressive", "acidHouse", "afroHouse", "drumAndBass", "twoStep", "breakbeat", "dubstep", "futureGarage", "loFi", "ambient", "drone", "downtempo", "synthwave"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [3, 1], [4, 1], [3, 1]],
} satisfies ProgressionDef;
