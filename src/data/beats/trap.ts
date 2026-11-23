import { row, type BeatDef } from "../../music/data.ts";

/** Trap: a halftime kick and clap with sixteenth hats that roll into doubles, triples and fours (P7: rolls). */
export default {
  order: 13,
  name: "Trap",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 7: 0.7, 10: 0.8 }),
    clap: row({ 8: 0.9 }),
    hat: row({ 0: 0.4, 2: 0.35, 4: 0.4, 6: 0.35, 7: 0.3, 8: 0.4, 10: 0.35, 12: 0.4, 13: 0.3, 14: 0.35, 15: 0.3 }),
    open: row({}),
    shaker: row({ 4: 0.3, 12: 0.3 }),
  },
  rolls: { hat: { 6: 2, 7: 3, 14: 2, 15: 4 } },
} satisfies BeatDef;
