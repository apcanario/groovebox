import type { PatchDef } from "../../music/data.ts";

/** Deep drums: a lower, longer kick and some room. */
export default { order: 3, name: "Deep", instrument: "drums", values: { pitch: 0.25, kickDecay: 0.65, drive: 0.25, hatDecay: 0.4, reverb: 0.25 } } satisfies PatchDef;
