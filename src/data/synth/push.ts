import { type SynthRhythmDef } from "../../music/data.ts";

/** Push: three chords, the last ones landing ahead of the beat. */
export default {
  order: 6,
  name: "Push",
  hits: [
    { step: 0, len: 2, vel: 0.85 },
    { step: 6, len: 1.5, vel: 0.65 },
    { step: 11, len: 2, vel: 0.75 },
  ],
} satisfies SynthRhythmDef;
