import { row, steps, type BeatDef } from "../../data.ts";

/** A test fixture (P3): a beat file like any in `src/data/beats/`, kept out of that folder. */
export default {
  order: 50,
  name: "Test beat",
  swing: 0,
  grid: { kick: steps([0, 6, 8], 1), clap: row({ 12: 0.8 }), hat: steps([2, 6, 10, 14], 0.4), open: row({}) },
} satisfies BeatDef;
