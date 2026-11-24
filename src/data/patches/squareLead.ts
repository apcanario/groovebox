import type { PatchDef } from "../../music/data.ts";

/** Square: a hollow square lead, short and dry with an echo. */
export default { order: 11, name: "Square", instrument: "layer", values: { wave: "square", attack: 0.005, decay: 0.2, sustain: 0.35, release: 0.2, cutoff: 0.55, resonance: 0.15, delay: 0.35, reverb: 0.25 } } satisfies PatchDef;
