import type { BassRhythmDef } from "../../music/data.ts";

/** Wobble: long notes at halftime for a patch's tempo-synced filter to swing, an octave drop to answer. */
export default {
  order: 11,
  name: "Wobble",
  hits: [
    { step: 0, len: 6, vel: 0.95 },
    { step: 6, len: 2, vel: 0.8, oct: 1 },
    { step: 8, len: 6, vel: 0.9 },
    { step: 14, len: 2, vel: 0.75, tone: 2 },
  ],
} satisfies BassRhythmDef;
