import { row, type BeatDef } from "../../music/data.ts";

/** Slow pulse (spec 8.10: a sparse pulse for Drone and Ambient): a soft kick on one, a shaker breath on three. */
export default {
  order: 26,
  name: "Slow pulse",
  simple: "Heartbeat",
  swing: 0,
  grid: {
    kick: row({ 0: 0.7 }),
    clap: row({}),
    hat: row({}),
    open: row({}),
    perc: row({ 10: 0.25 }),
    shaker: row({ 8: 0.3 }),
  },
} satisfies BeatDef;
