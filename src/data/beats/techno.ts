import { row, type BeatDef } from "../../music/data.ts";

export default {
  order: 4,
  name: "Techno",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
    clap: row({ 12: 0.6 }),
    hat: Array.from({ length: 16 }, (_, i) => (i % 4 === 2 ? 0 : i % 2 ? 0.35 : 0.2)),
    open: row({ 2: 0.7, 6: 0.7, 10: 0.7, 14: 0.7 }),
  },
} satisfies BeatDef;
