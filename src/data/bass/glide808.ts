import type { BassRhythmDef } from "../../music/data.ts";

/** 808 glide: a long boom on one, a jump up an octave that the patch's glide slides into, and back down. */
export default {
  order: 12,
  name: "808 glide",
  simple: "Slide",
  hits: [
    { step: 0, len: 6, vel: 1 },
    { step: 7, len: 3, vel: 0.85, oct: 1 },
    { step: 10, len: 6, vel: 0.9 },
  ],
} satisfies BassRhythmDef;
