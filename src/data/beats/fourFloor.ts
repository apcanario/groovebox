import { row, type BeatDef } from "../../music/data.ts";

export default {
  order: 1,
  name: "Four floor",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 4: 0.9, 12: 0.9 }),
    hat: row({ 1: 0.3, 3: 0.3, 5: 0.3, 7: 0.3, 9: 0.3, 11: 0.3, 13: 0.3, 15: 0.3 }),
    open: row({ 2: 0.8, 6: 0.8, 10: 0.8, 14: 0.8 }),
  },
} satisfies BeatDef;
