import type { PatchDef } from "../../music/data.ts";

/** Rubber: a square that bounces off a closing filter, short and round. */
export default { order: 13, name: "Rubber", instrument: "bass", values: { wave: "square", cutoff: 0.2, resonance: 0.3, envAmount: 0.6, decay: 0.15, sustain: 0.2, release: 0.08 } } satisfies PatchDef;
