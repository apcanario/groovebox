import type { PatchDef } from "../../music/data.ts";

/** Strings: slow detuned saws, softened, a string section. */
export default { order: 14, name: "Strings", instrument: "layer", values: { wave: "sawtooth", attack: 0.8, decay: 1, sustain: 0.8, release: 1.6, cutoff: 0.4, resonance: 0.05, reverb: 0.65, drift: 0.25, driftRate: 0.3 } } satisfies PatchDef;
