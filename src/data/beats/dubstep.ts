import { row, type BeatDef } from "../../music/data.ts";

/** Dubstep: halftime at 140, the kick on one, the snare on three, triplet-feel hats and a tom fill at the end. */
export default {
  order: 19,
  name: "Dubstep",
  simple: "Heavy half",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 14: 0.55 }),
    clap: row({ 8: 1 }),
    hat: row({ 0: 0.3, 3: 0.35, 6: 0.3, 8: 0.3, 11: 0.35, 14: 0.3 }),
    open: row({}),
    perc: row({ 13: 0.5, 15: 0.6 }),
  },
  rolls: { hat: { 11: 2 } },
} satisfies BeatDef;
