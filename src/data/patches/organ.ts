import type { PatchDef } from "../../music/data.ts";

/** Organ: a square chord that sustains while it plays and stops at once. */
export default { order: 6, name: "Organ", instrument: "synth", values: { wave: "square", attack: 0.005, decay: 0.2, sustain: 0.5, release: 0.1, cutoff: 0.5, envAmount: 0.2 } } satisfies PatchDef;
