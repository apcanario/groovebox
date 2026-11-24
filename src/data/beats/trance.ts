import { row, type BeatDef } from "../../music/data.ts";

/** Trance: a driving four on the floor, offbeat open hats, a clap on two and four and a shaker on every sixteenth. */
export default {
  order: 21,
  name: "Trance",
  simple: "Driving",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 4: 0.75, 12: 0.75 }),
    hat: row({ 1: 0.2, 3: 0.2, 5: 0.2, 7: 0.2, 9: 0.2, 11: 0.2, 13: 0.2, 15: 0.2 }),
    open: row({ 2: 0.7, 6: 0.7, 10: 0.7, 14: 0.7 }),
    shaker: Array.from({ length: 16 }, (_, i) => (i % 4 === 0 ? 0 : 0.18)),
  },
} satisfies BeatDef;
