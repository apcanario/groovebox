import type { BassRhythmDef } from "../../music/data.ts";

/** Arp bass: sixteenths up and down the chord, root, third, fifth and the octave. */
export default {
  order: 13,
  name: "Arp bass",
  simple: "Climbing",
  hits: Array.from({ length: 16 }, (_, step) => {
    const at = [0, 1, 2, 3, 2, 1][step % 6];
    return { step, len: 0.8, vel: step % 4 === 0 ? 0.95 : 0.7, ...(at === 3 ? { oct: 1 } : { tone: at }) };
  }),
} satisfies BassRhythmDef;
