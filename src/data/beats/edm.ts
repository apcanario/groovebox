import { row, type BeatDef } from "../../music/data.ts";

/** EDM: a big four on the floor, a loud clap on two and four, offbeat open hats and a snare roll into the bar line. */
export default {
  order: 22,
  name: "EDM",
  simple: "Big room",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 4: 1, 12: 1, 15: 0.5 }),
    hat: row({ 0: 0.2, 4: 0.2, 8: 0.2, 12: 0.2 }),
    open: row({ 2: 0.75, 6: 0.75, 10: 0.75, 14: 0.75 }),
  },
  rolls: { clap: { 15: 4 } },
} satisfies BeatDef;
