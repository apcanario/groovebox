import { type BassRhythmDef } from "../../music/data.ts";

/** Dub: a long note on one, a push before three, a short answer late in the bar. */
export default {
  order: 4,
  name: "Dub",
  hits: [
    { step: 0, len: 3.5, vel: 0.95 },
    { step: 6, len: 2, vel: 0.75 },
    { step: 10, len: 3, vel: 0.85 },
  ],
} satisfies BassRhythmDef;
