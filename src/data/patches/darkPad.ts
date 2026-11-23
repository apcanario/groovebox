import type { PatchDef } from "../../music/data.ts";

/** Dark pad: a saw, filter almost shut. */
export default { order: 7, name: "Dark pad", instrument: "layer", values: { wave: "sawtooth", cutoff: 0.25, resonance: 0.15, reverb: 0.6 } } satisfies PatchDef;
