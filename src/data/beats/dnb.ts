import { row, type BeatDef } from "../../music/data.ts";

export default {
  order: 9,
  name: "DnB",
  simple: "Breakbeat",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 10: 0.95 }),
    clap: row({ 4: 1, 12: 1, 15: 0.3 }),
    hat: row({ 0: 0.3, 2: 0.5, 4: 0.3, 6: 0.5, 8: 0.3, 10: 0.5, 12: 0.3 }),
    open: row({ 14: 0.6 }),
  },
} satisfies BeatDef;
