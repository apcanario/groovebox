import type { BassRhythmDef } from "../../music/data.ts";

/** Walking: a note on every beat, stepping root, third, fifth and back to the third. */
export default {
  order: 14,
  name: "Walking",
  simple: "Walking",
  hits: [
    { step: 0, len: 3.5, vel: 0.9 },
    { step: 4, len: 3.5, vel: 0.75, tone: 1 },
    { step: 8, len: 3.5, vel: 0.85, tone: 2 },
    { step: 12, len: 3.5, vel: 0.75, tone: 1 },
  ],
} satisfies BassRhythmDef;
