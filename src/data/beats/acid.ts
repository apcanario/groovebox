import { row, type BeatDef } from "../../music/data.ts";

/** Acid: a plain four on the floor, claps on two and four, open hats between kicks and a sixteenth hat with accents. */
export default {
  order: 15,
  name: "Acid",
  swing: 0.04,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 4: 0.8, 12: 0.8 }),
    hat: Array.from({ length: 16 }, (_, i) => (i % 4 === 2 ? 0 : i % 4 === 0 ? 0.22 : 0.38)),
    open: row({ 2: 0.6, 6: 0.6, 10: 0.6, 14: 0.6 }),
  },
} satisfies BeatDef;
