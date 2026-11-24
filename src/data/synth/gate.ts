import type { SynthRhythmDef } from "../../music/data.ts";

/** Gate: the chord chopped into sixteenths, a trance gate, with gaps that make the pattern. */
export default {
  order: 7,
  name: "Gate",
  simple: "Chopped",
  hits: [0, 1, 3, 4, 6, 8, 9, 11, 12, 14].map((step) => ({ step, len: 0.6, vel: step % 4 === 0 ? 0.8 : 0.6 })),
} satisfies SynthRhythmDef;
