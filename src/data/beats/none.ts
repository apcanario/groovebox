import { row, type BeatDef } from "../../music/data.ts";

/** None: no beat (spec 8.10). */
export default {
  order: 99,
  name: "None",
  swing: 0,
  grid: { kick: row({}), clap: row({}), hat: row({}), open: row({}) },
} satisfies BeatDef;
