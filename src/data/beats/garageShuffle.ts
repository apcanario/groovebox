import { row, type BeatDef } from "../../music/data.ts";

/** Garage shuffle: a swung 2-step with ghost kicks, a shaker running under it and a rim answering the snare. */
export default {
  order: 16,
  name: "Garage",
  simple: "Swing step",
  swing: 0.22,
  grid: {
    kick: row({ 0: 1, 7: 0.5, 10: 0.9 }),
    clap: row({ 4: 0.9, 12: 0.9 }),
    hat: row({ 2: 0.4, 6: 0.4, 9: 0.25, 14: 0.4 }),
    open: row({ 10: 0.35 }),
    perc: row({ 13: 0.45, 15: 0.3 }),
    shaker: row({ 1: 0.25, 3: 0.3, 5: 0.25, 7: 0.3, 9: 0.25, 11: 0.3, 13: 0.25, 15: 0.3 }),
  },
} satisfies BeatDef;
