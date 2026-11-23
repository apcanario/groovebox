import { row, type BeatDef } from "../../music/data.ts";

/** Afro: four on the floor under a conga-like Perc pattern and a running Shaker (P7: the two new voices). */
export default {
  order: 12,
  name: "Afro",
  swing: 0.08,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 4: 0.5, 12: 0.5 }),
    hat: row({ 2: 0.25, 6: 0.25, 10: 0.25, 14: 0.25 }),
    open: row({}),
    perc: row({ 3: 0.7, 6: 0.55, 7: 0.8, 10: 0.6, 13: 0.75, 15: 0.5 }),
    shaker: row({ 0: 0.5, 1: 0.3, 2: 0.6, 3: 0.3, 4: 0.5, 5: 0.3, 6: 0.6, 7: 0.3, 8: 0.5, 9: 0.3, 10: 0.6, 11: 0.3, 12: 0.5, 13: 0.3, 14: 0.6, 15: 0.3 }),
  },
} satisfies BeatDef;
