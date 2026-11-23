import type { PatchDef } from "../../music/data.ts";

/** Drift pad: a warm triangle that wanders slowly in filter, pitch, pan and space (P7: the free-running LFO). */
export default { order: 10, name: "Drift pad", instrument: "layer", values: { wave: "triangle", cutoff: 0.6, resonance: 0.1, delay: 0.3, reverb: 0.75, drift: 0.7, driftRate: 0.15 } } satisfies PatchDef;
