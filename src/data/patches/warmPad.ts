import type { PatchDef } from "../../music/data.ts";

/** Warm pad: a saw through a half-closed filter in a big room (Layer 2 as it comes). */
export default { order: 5, name: "Warm pad", instrument: "layer", values: { wave: "sawtooth", cutoff: 0.45, resonance: 0.1, reverb: 0.6 } } satisfies PatchDef;
