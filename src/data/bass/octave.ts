import type { BassRhythmDef } from "../../music/data.ts";

/** Octave bounce: eighths that jump between the root and the octave above, the high ones on the offbeat. */
export default {
  order: 8,
  name: "Octaves",
  simple: "Bounce",
  hits: [0, 2, 4, 6, 8, 10, 12, 14].map((step) => ({ step, len: 1.4, vel: step % 4 === 0 ? 0.95 : 0.75, oct: step % 4 === 0 ? 0 : 1 })),
} satisfies BassRhythmDef;
