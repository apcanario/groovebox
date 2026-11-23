import { type BassRhythmDef } from "../../music/data.ts";

export default {
  order: 6,
  name: "DnB sub",
  simple: "Deep",
  hits: [
    { step: 0, len: 6, vel: 0.95 },
    { step: 10, len: 5.5, vel: 0.9 },
  ],
} satisfies BassRhythmDef;
