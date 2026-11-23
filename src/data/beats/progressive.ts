import { row, type BeatDef } from "../../music/data.ts";

/** Progressive: four on the floor, claps on two and four, sixteenth hats with accents, open hats between kicks. */
export default {
  order: 6,
  name: "Progressive",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 4: 0.7, 12: 0.7 }),
    hat: row({ 1: 0.2, 3: 0.3, 5: 0.2, 7: 0.3, 9: 0.2, 11: 0.3, 13: 0.2, 15: 0.3 }),
    open: row({ 2: 0.55, 6: 0.55, 10: 0.55, 14: 0.55 }),
  },
} satisfies BeatDef;
