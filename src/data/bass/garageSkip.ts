import { type BassRhythmDef } from "../../music/data.ts";

/** Garage skip: short notes that skip around the 2-step kick. */
export default {
  order: 5,
  name: "Garage skip",
  hits: [
    { step: 0, len: 2, vel: 0.95 },
    { step: 3, len: 1, vel: 0.6 },
    { step: 7, len: 1.5, vel: 0.8 },
    { step: 10, len: 2, vel: 0.9 },
    { step: 14, len: 1, vel: 0.6 },
  ],
} satisfies BassRhythmDef;
