import type { PatchDef } from "../../music/data.ts";

/** Machine: a dry, clicky drum machine, short kick and tight hats, for electro and minimal. */
export default { order: 7, name: "Machine", instrument: "drums", values: { pitch: 0.6, kickDecay: 0.3, clapDecay: 0.35, hatDecay: 0.25, openDecay: 0.35, drive: 0.35, percPitch: 0.75, percDecay: 0.3 } } satisfies PatchDef;
