import type { SynthRhythmDef } from "../../music/data.ts";

/** Broken chord: the chord's notes one at a time on the eighths, up and back down, the top one up an octave. */
export default {
  order: 10,
  name: "Broken chord",
  simple: "One by one",
  hits: [0, 1, 2, 3, 2, 1, 0, 2].map((tone, i) => ({ step: 2 * i, len: 1.8, vel: i % 2 ? 0.6 : 0.8, tone, ...(i === 3 ? { oct: 1 } : {}) })),
} satisfies SynthRhythmDef;
