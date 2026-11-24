import { row, type BeatDef } from "../../music/data.ts";

/**
 * Acid: four on the floor and claps on two and four under a sixteenth hat on every step, accented off the beat, open
 * hats on the "and" of one and three only, and a ghost perc. P8 review M1: its own shape, not Techno's plus a clap.
 */
export default {
  order: 15,
  name: "Acid",
  swing: 0.04,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 4: 0.8, 12: 0.8 }),
    hat: Array.from({ length: 16 }, (_, i) => (i % 2 ? 0.42 : 0.16)),
    open: row({ 2: 0.6, 10: 0.6 }),
    perc: row({ 7: 0.25, 13: 0.2 }),
  },
} satisfies BeatDef;
