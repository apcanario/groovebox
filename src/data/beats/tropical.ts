import { row, type BeatDef } from "../../music/data.ts";

/** Tropical house: a soft four on the floor, light claps, busy offbeat hats and a little swing. */
export default {
  order: 3,
  name: "Tropical",
  swing: 0.1,
  grid: {
    kick: row({ 0: 1, 4: 0.9, 8: 1, 12: 0.9 }),
    clap: row({ 4: 0.6, 12: 0.6, 14: 0.25 }),
    hat: row({ 1: 0.25, 3: 0.35, 5: 0.25, 7: 0.35, 9: 0.25, 11: 0.35, 13: 0.25, 15: 0.35 }),
    open: row({ 2: 0.5, 6: 0.35, 10: 0.5, 14: 0.35 }),
  },
} satisfies BeatDef;
