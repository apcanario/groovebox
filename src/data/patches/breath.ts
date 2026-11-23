import type { PatchDef } from "../../music/data.ts";

/** Breath: an airy pad from the noise wave (P7), drifting slowly in tone and space. */
export default { order: 9, name: "Breath", instrument: "layer", values: { wave: "noise", cutoff: 0.75, resonance: 0.1, delay: 0.25, reverb: 0.8, drift: 0.5, driftRate: 0.3 } } satisfies PatchDef;
