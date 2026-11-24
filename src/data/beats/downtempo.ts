import { row, type BeatDef } from "../../music/data.ts";

/** Downtempo: a lazy swung kick and snare, soft hats, a shaker and a low tom: a slow head-nod. */
export default {
  order: 23,
  name: "Downtempo",
  simple: "Head nod",
  swing: 0.2,
  grid: {
    kick: row({ 0: 1, 6: 0.55, 9: 0.75 }),
    clap: row({ 4: 0.8, 12: 0.8 }),
    hat: row({ 0: 0.25, 2: 0.3, 4: 0.25, 6: 0.3, 8: 0.25, 10: 0.3, 12: 0.25, 14: 0.3 }),
    open: row({}),
    perc: row({ 11: 0.4, 15: 0.35 }),
    shaker: row({ 3: 0.2, 7: 0.25, 11: 0.2, 15: 0.25 }),
  },
} satisfies BeatDef;
