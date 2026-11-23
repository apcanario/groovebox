import type { PatchDef } from "../../music/data.ts";

/** Airy pad: a soft triangle, open and wet. */
export default { order: 6, name: "Airy pad", instrument: "layer", values: { wave: "triangle", cutoff: 0.7, resonance: 0.05, delay: 0.3, reverb: 0.75 } } satisfies PatchDef;
