import type { PatchDef } from "../../music/data.ts";

/** Tape pad: a warm triangle pad that wobbles in pitch like an old tape. */
export default { order: 18, name: "Tape pad", instrument: "layer", values: { wave: "triangle", attack: 0.6, decay: 1, sustain: 0.7, release: 1.5, cutoff: 0.4, reverb: 0.55, drift: 0.6, driftRate: 0.5 } } satisfies PatchDef;
