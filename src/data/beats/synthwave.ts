import { row, type BeatDef } from "../../music/data.ts";

/** Synthwave: a straight eighties beat, kick on one and three, a big snare on two and four, eighth hats. */
export default {
  order: 24,
  name: "Synthwave",
  simple: "Eighties",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 8: 1, 10: 0.6 }),
    clap: row({ 4: 1, 12: 1 }),
    hat: row({ 0: 0.3, 2: 0.4, 4: 0.3, 6: 0.4, 8: 0.3, 10: 0.4, 12: 0.3, 14: 0.4 }),
    open: row({}),
    perc: row({ 14: 0.45, 15: 0.55 }),
  },
} satisfies BeatDef;
