import { row, type BeatDef } from "../../music/data.ts";

/** DnB roller: the two-step at 170-plus with sixteenth shakers and a rolled hat into the last snare. */
export default {
  order: 18,
  name: "DnB roller",
  simple: "Rolling fast",
  swing: 0,
  grid: {
    kick: row({ 0: 1, 10: 0.95, 11: 0.5 }),
    clap: row({ 4: 1, 12: 1 }),
    hat: row({ 2: 0.45, 6: 0.45, 9: 0.3, 14: 0.45 }),
    open: row({}),
    shaker: Array.from({ length: 16 }, (_, i) => (i % 2 ? 0.2 : 0.32)),
  },
  rolls: { hat: { 9: 3 } },
} satisfies BeatDef;
