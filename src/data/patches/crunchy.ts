import type { PatchDef } from "../../music/data.ts";

/** Crunchy drums: driven hard and dulled, for lo-fi. */
export default { order: 4, name: "Crunchy", instrument: "drums", values: { drive: 0.7, cutoff: 0.55, hatLevel: 0.7, clapDecay: 0.6, reverb: 0.1 } } satisfies PatchDef;
