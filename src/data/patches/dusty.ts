import type { PatchDef } from "../../music/data.ts";

/** Dusty: a dull, quiet kit with a soft kick and a shaker up front, for downtempo and breaks. */
export default { order: 9, name: "Dusty", instrument: "drums", values: { pitch: 0.35, kickDecay: 0.55, drive: 0.4, cutoff: 0.45, hatLevel: 0.75, shakerLevel: 1, percLevel: 0.9, reverb: 0.2 } } satisfies PatchDef;
