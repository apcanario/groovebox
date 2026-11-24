import type { PatchDef } from "../../music/data.ts";

/** Pluck: a short plucked FM note with a long echo. */
export default { order: 13, name: "Pluck", instrument: "layer", values: { wave: "fm", fmRatio: 0.375, fmIndex: 0.3, attack: 0.002, decay: 0.2, sustain: 0, release: 0.25, cutoff: 0.7, delay: 0.45, reverb: 0.35 } } satisfies PatchDef;
