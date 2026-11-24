import type { PatchDef } from "../../music/data.ts";

/** Boom: a long, low kick that rings like an 808, soft hats, for trap and halftime. */
export default { order: 6, name: "Boom", instrument: "drums", values: { pitch: 0.15, kickDecay: 0.9, drive: 0.3, hatDecay: 0.3, clapDecay: 0.45, reverb: 0.15 } } satisfies PatchDef;
