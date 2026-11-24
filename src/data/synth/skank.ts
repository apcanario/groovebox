import type { SynthRhythmDef } from "../../music/data.ts";

/** Skank: short, clipped chords on two and four, with a quiet double on the last one (a dub and reggae upstroke). */
export default {
  order: 8,
  name: "Skank",
  simple: "Upstroke",
  hits: [
    { step: 4, len: 0.7, vel: 0.85 },
    { step: 12, len: 0.7, vel: 0.85 },
    { step: 13, len: 0.5, vel: 0.45 },
  ],
} satisfies SynthRhythmDef;
