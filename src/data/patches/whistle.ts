import type { PatchDef } from "../../music/data.ts";

/** Whistle: a pure bright note with delay, for tropical leads. */
export default { order: 4, name: "Whistle", instrument: "layer", values: { wave: "sine", attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.2, cutoff: 0.9, delay: 0.45, reverb: 0.35 } } satisfies PatchDef;
