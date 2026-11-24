import type { PatchDef } from "../../music/data.ts";

/** Choir: a soft breathy pad, noise over a sine, like voices far off. */
export default { order: 16, name: "Choir", instrument: "layer", values: { wave: "noise", attack: 1, decay: 1, sustain: 0.8, release: 2.5, cutoff: 0.5, resonance: 0.25, reverb: 0.8, drift: 0.35, driftRate: 0.25 } } satisfies PatchDef;
