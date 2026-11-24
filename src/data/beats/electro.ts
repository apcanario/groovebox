import { row, type BeatDef } from "../../music/data.ts";

/** Electro: a syncopated machine kick, a hard clap on two and four, straight sixteenth hats and a high tom answer. */
export default {
  order: 20,
  name: "Electro",
  simple: "Robot",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 6: 0.85, 10: 0.9 }),
    clap: row({ 4: 1, 12: 1 }),
    hat: Array.from({ length: 16 }, (_, i) => (i % 2 ? 0.25 : 0.38)),
    open: row({}),
    perc: row({ 7: 0.55, 15: 0.5 }),
  },
} satisfies BeatDef;
