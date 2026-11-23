import type { PatchDef } from "../../music/data.ts";

/** Tight drums: a higher, shorter kick and short snare and hats, for fast tempos. */
export default { order: 5, name: "Tight", instrument: "drums", values: { pitch: 0.55, kickDecay: 0.35, clapDecay: 0.4, hatDecay: 0.4, drive: 0.45 } } satisfies PatchDef;
