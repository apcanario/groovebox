import type { PatchDef } from "../../music/data.ts";

/** Pluck: a short bright triangle chord with some delay. */
export default { order: 3, name: "Pluck", instrument: "synth", values: { wave: "triangle", decay: 0.15, sustain: 0, envAmount: 0.5, cutoff: 0.5, delay: 0.35 } } satisfies PatchDef;
