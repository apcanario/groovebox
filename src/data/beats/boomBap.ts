import { row, type BeatDef } from "../../music/data.ts";

/** Boom bap: a lazy kick, a hard snare on two and four, swung eighth hats. */
export default {
  order: 10,
  name: "Boom bap",
  swing: 0.2,
  grid: {
    kick: row({ 0: 1, 7: 0.6, 10: 0.9 }),
    clap: row({ 4: 0.9, 12: 0.9 }),
    hat: row({ 0: 0.35, 2: 0.25, 4: 0.35, 6: 0.25, 8: 0.35, 10: 0.25, 12: 0.35, 14: 0.25 }),
    open: row({}),
  },
} satisfies BeatDef;
