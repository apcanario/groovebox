import type { BassRhythmDef } from "../../music/data.ts";

/** Acid line: a busy sixteenth line with octave jumps, a fifth and accents, slid by the patch's glide. */
export default {
  order: 9,
  name: "Acid line",
  simple: "Squelch",
  hits: [
    { step: 0, len: 1, vel: 1 },
    { step: 2, len: 1, vel: 0.7, oct: 1 },
    { step: 3, len: 1, vel: 0.6 },
    { step: 5, len: 1, vel: 0.9, tone: 2 },
    { step: 6, len: 2, vel: 0.65, oct: 1 },
    { step: 8, len: 1, vel: 0.95 },
    { step: 10, len: 1, vel: 0.7, tone: 2, oct: 1 },
    { step: 11, len: 1, vel: 0.6 },
    { step: 13, len: 1, vel: 0.9, oct: 1 },
    { step: 14, len: 1.5, vel: 0.65, tone: 1 },
  ],
} satisfies BassRhythmDef;
