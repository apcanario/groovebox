import { type BassRhythmDef } from "../../music/data.ts";

export default {
  order: 3,
  name: "Long notes",
  hits: [
    { step: 0, len: 7.5, vel: 0.9 },
    { step: 8, len: 7.5, vel: 0.85 },
  ],
} satisfies BassRhythmDef;
