import { row, type BeatDef } from "../../music/data.ts";

/** Minimal: a dry four on the floor, a rim-like Perc ticking off the beat, a quiet clap on four, sparse hats. */
export default {
  order: 14,
  name: "Minimal",
  swing: 0.06,
  grid: {
    kick: row({ 0: 1, 4: 0.95, 8: 1, 12: 0.95 }),
    clap: row({ 12: 0.45 }),
    hat: row({ 2: 0.3, 6: 0.3, 10: 0.3, 14: 0.3 }),
    open: row({}),
    perc: row({ 3: 0.5, 7: 0.35, 11: 0.5, 13: 0.3 }),
    shaker: row({ 1: 0.2, 5: 0.2, 9: 0.2, 15: 0.25 }),
  },
} satisfies BeatDef;
