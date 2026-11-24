import type { PatchDef } from "../../music/data.ts";

/** Acid: a squelchy saw lead through a high resonance. */
export default { order: 12, name: "Acid", instrument: "layer", values: { wave: "sawtooth", attack: 0.003, decay: 0.18, sustain: 0.2, release: 0.12, cutoff: 0.4, resonance: 0.7, drive: 0.3, delay: 0.25, reverb: 0.2 } } satisfies PatchDef;
