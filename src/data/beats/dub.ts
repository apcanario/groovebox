import { row, type BeatDef } from "../../music/data.ts";

/** Dub: a steady kick, closed hats on the offbeat, a soft clap on the fourth beat. */
export default {
  order: 5,
  name: "Dub",
  swing: 0.06,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 12: 0.45 }),
    hat: row({ 2: 0.5, 6: 0.5, 10: 0.5, 14: 0.5, 15: 0.15 }),
    open: row({ 7: 0.25 }),
  },
} satisfies BeatDef;
