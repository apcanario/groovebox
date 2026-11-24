import type { PatchDef } from "../../music/data.ts";

/** Shimmer: a bright FM pad high in the reverb that moves slowly. */
export default { order: 15, name: "Shimmer", instrument: "layer", values: { wave: "fm", fmRatio: 0.5, fmIndex: 0.25, attack: 1.5, decay: 2, sustain: 0.7, release: 4, cutoff: 0.8, delay: 0.35, reverb: 0.9, drift: 0.4, driftRate: 0.2 } } satisfies PatchDef;
