import type { PatchDef } from "../../music/data.ts";

/** Warm bass: a soft triangle with a long note. */
export default { order: 4, name: "Warm", instrument: "bass", values: { wave: "triangle", cutoff: 0.35, envAmount: 0.2, sustain: 0.5, release: 0.15 } } satisfies PatchDef;
