import type { ProgressionDef } from "../../music/data.ts";

export default {
  order: 1,
  name: "Sunny side",
  feels: ["bright"],
  vibes: ["tropicalHouse", "breakbeat", "loFi", "downtempo", "synthwave", "idm", "edm", "trance"],
  mood: "major",
  voicing: "triads",
  chords: [[0, 1], [4, 1], [5, 1], [3, 1]],
} satisfies ProgressionDef;
