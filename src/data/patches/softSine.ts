import type { PatchDef } from "../../music/data.ts";

/** Soft sine: a round note with room around it. */
export default { order: 2, name: "Soft sine", instrument: "layer", values: { wave: "sine", attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.4, cutoff: 0.8, delay: 0.4, reverb: 0.5 } } satisfies PatchDef;
