import type { PatchDef } from "../../music/data.ts";

/** Glass pad: a glassy FM pad, slow in and out. */
export default { order: 17, name: "Glass pad", instrument: "layer", values: { wave: "fm", fmRatio: 0.75, fmIndex: 0.2, attack: 1.2, decay: 1.5, sustain: 0.6, release: 3, cutoff: 0.7, reverb: 0.75 } } satisfies PatchDef;
