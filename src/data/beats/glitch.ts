import { row, type BeatDef } from "../../music/data.ts";

/** Glitch: a broken, stuttering beat: kicks off the grid, rolled hats and claps, ticks of Perc and Shaker. */
export default {
  order: 25,
  name: "Glitch",
  simple: "Stutter",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 5: 0.7, 11: 0.8 }),
    clap: row({ 4: 0.9, 13: 0.7 }),
    hat: row({ 1: 0.3, 2: 0.35, 7: 0.3, 9: 0.4, 14: 0.35 }),
    open: row({ 10: 0.4 }),
    perc: row({ 3: 0.45, 8: 0.35, 15: 0.5 }),
    shaker: row({ 6: 0.3, 12: 0.3 }),
  },
  rolls: { hat: { 2: 3, 9: 4 }, clap: { 13: 2 }, perc: { 15: 3 } },
} satisfies BeatDef;
