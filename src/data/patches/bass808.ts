import type { PatchDef } from "../../music/data.ts";

/** 808: a long sine boom with a little drive and a slow glide between notes. */
export default { order: 12, name: "808", instrument: "bass", values: { wave: "sine", cutoff: 0.35, envAmount: 0.05, decay: 1.2, sustain: 0.5, release: 0.4, glide: 0.55, drive: 0.35, sub: 0.6 } } satisfies PatchDef;
