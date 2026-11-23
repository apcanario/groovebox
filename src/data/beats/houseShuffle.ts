import { row, type BeatDef } from "../../music/data.ts";

export default {
  order: 2,
  name: "Shuffle",
  swing: 0.18,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 4: 0.9, 12: 0.9, 15: 0.3 }),
    hat: row({ 1: 0.4, 3: 0.5, 5: 0.4, 7: 0.5, 9: 0.4, 11: 0.5, 13: 0.4, 15: 0.5 }),
    open: row({ 2: 0.7, 6: 0.7, 10: 0.7, 14: 0.7 }),
  },
} satisfies BeatDef;
