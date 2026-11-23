import type { PatchDef } from "../../music/data.ts";

/** Soft drums: little drive, a shorter kick, quieter hats. */
export default { order: 2, name: "Soft", instrument: "drums", values: { drive: 0.15, kickDecay: 0.45, hatLevel: 0.8, openLevel: 0.7, reverb: 0.15 } } satisfies PatchDef;
