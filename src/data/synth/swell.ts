import type { SynthRhythmDef } from "../../music/data.ts";

/** Swell: one long chord each half bar, the second louder, for a slow attack to rise into. */
export default {
  order: 9,
  name: "Swell",
  simple: "Rising",
  hits: [
    { step: 0, len: 7.5, vel: 0.55 },
    { step: 8, len: 7.5, vel: 0.8 },
  ],
} satisfies SynthRhythmDef;
