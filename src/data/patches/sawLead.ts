import type { PatchDef } from "../../music/data.ts";

/** Saw lead: a buzzy note through a resonant filter. */
export default { order: 3, name: "Saw lead", instrument: "layer", values: { wave: "sawtooth", attack: 0.005, decay: 0.25, sustain: 0.3, release: 0.25, cutoff: 0.5, resonance: 0.3, delay: 0.35, reverb: 0.3 } } satisfies PatchDef;
