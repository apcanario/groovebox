import { row, type BeatDef } from "../../music/data.ts";

/** Halftime: a kick on one, a snare on three, a few quiet hats; sparse enough for slow vibes. */
export default {
  order: 11,
  name: "Halftime",
  swing: 0,
  grid: {
    kick: row({ 0: 0.8, 11: 0.4 }),
    clap: row({ 8: 0.5 }),
    hat: row({ 4: 0.15, 12: 0.15 }),
    open: row({}),
  },
} satisfies BeatDef;
