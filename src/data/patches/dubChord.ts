import type { PatchDef } from "../../music/data.ts";

/** Dub chord: a dark square chord sent long into the delay and reverb. */
export default { order: 2, name: "Dub chord", instrument: "synth", values: { wave: "square", cutoff: 0.35, resonance: 0.3, decay: 0.3, envAmount: 0.35, delay: 0.55, reverb: 0.45 } } satisfies PatchDef;
