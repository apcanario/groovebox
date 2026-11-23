import type { PatchDef } from "../../music/data.ts";

/** Bell: a short triangle note with a long delay (Layer 1 as it comes). */
export default { order: 1, name: "Bell", instrument: "layer", values: { wave: "triangle", attack: 0.003, decay: 0.16, sustain: 0.05, release: 0.2, cutoff: 0.8, delay: 0.5, reverb: 0.35 } } satisfies PatchDef;
