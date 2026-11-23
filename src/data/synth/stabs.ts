import { type SynthRhythmDef } from "../../music/data.ts";

export default {
  order: 1,
  name: "Stabs",
  hits: [
    { step: 0, len: 1.4, vel: 0.9 },
    { step: 3, len: 1.4, vel: 0.65 },
    { step: 6, len: 1.4, vel: 0.65 },
    { step: 11, len: 1.4, vel: 0.65 },
    { step: 14, len: 1.4, vel: 0.65 },
  ],
} satisfies SynthRhythmDef;
