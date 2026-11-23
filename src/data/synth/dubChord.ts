import { type SynthRhythmDef } from "../../music/data.ts";

/** Dub chord: a short chord after the beat, left to the delay and reverb to repeat. */
export default {
  order: 4,
  name: "Dub chord",
  hits: [
    { step: 3, len: 1.5, vel: 0.85 },
    { step: 10, len: 1.5, vel: 0.6 },
  ],
} satisfies SynthRhythmDef;
