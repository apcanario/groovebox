import type { PatchDef } from "../../music/data.ts";

/** Pluck bass: a short saw with a snappy filter. */
export default { order: 3, name: "Pluck", instrument: "bass", values: { wave: "sawtooth", decay: 0.12, sustain: 0.1, envAmount: 0.6, cutoff: 0.25, resonance: 0.35 } } satisfies PatchDef;
