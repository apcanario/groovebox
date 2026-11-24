import { type SynthRhythmDef } from "../../music/data.ts";

/** Pluck eighths: a short chord on every eighth, the downbeats louder. */
export default {
  order: 5,
  name: "Pluck 8ths",
  simple: "Plucks",
  hits: [0, 2, 4, 6, 8, 10, 12, 14].map((step) => ({ step, len: 0.9, vel: step % 4 === 0 ? 0.8 : 0.55 })),
} satisfies SynthRhythmDef;
