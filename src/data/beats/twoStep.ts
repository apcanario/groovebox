import { row, type BeatDef } from "../../music/data.ts";

export default {
  order: 8,
  name: "2-step",
  swing: 0.22,
  grid: {
    kick: row({ 0: 1, 7: 0.7, 10: 0.9 }),
    clap: row({ 4: 0.9, 12: 0.9 }),
    hat: row({ 1: 0.3, 2: 0.6, 5: 0.3, 6: 0.6, 9: 0.3, 10: 0.6, 13: 0.3, 14: 0.6 }),
    open: row({ 15: 0.5 }),
  },
} satisfies BeatDef;
