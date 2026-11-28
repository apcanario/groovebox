import { row, type BeatDef } from "../../music/data.ts";

/** F2 (spec 10.5): Thump, the kick on every beat and nothing else. It sits beside Four floor. */
export default {
  order: 1.5,
  name: "Thump",
  swing: 0,
  grid: { kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }), clap: row({}), hat: row({}), open: row({}) },
} satisfies BeatDef;
