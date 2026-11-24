import type { BassRhythmDef } from "../../music/data.ts";

/** Reese hold: one long note for most of the bar and a short push back into the next. */
export default {
  order: 10,
  name: "Reese hold",
  simple: "Long growl",
  hits: [
    { step: 0, len: 12, vel: 0.9 },
    { step: 13, len: 3, vel: 0.7 },
  ],
} satisfies BassRhythmDef;
