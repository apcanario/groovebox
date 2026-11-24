import { row, type BeatDef } from "../../music/data.ts";

/** Breakbeat: a funky broken kick, the snare on two and four with ghosts, eighth hats and an open hat at the turn. */
export default {
  order: 17,
  name: "Breakbeat",
  simple: "Broken",
  swing: 0.08,
  grid: {
    kick: row({ 0: 1, 3: 0.6, 8: 0.9, 10: 0.8 }),
    clap: row({ 4: 1, 7: 0.25, 12: 1, 15: 0.3 }),
    hat: row({ 0: 0.35, 2: 0.4, 4: 0.35, 6: 0.4, 8: 0.35, 10: 0.4, 12: 0.35 }),
    open: row({ 14: 0.55 }),
  },
} satisfies BeatDef;
