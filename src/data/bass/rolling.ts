import { type BassRhythmDef } from "../../music/data.ts";

export default {
  order: 2,
  name: "Rolling",
  hits: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((step) => ({ step, len: 0.8, vel: step % 2 === 0 ? 0.9 : 0.7 })),
} satisfies BassRhythmDef;
