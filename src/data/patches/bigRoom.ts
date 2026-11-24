import type { PatchDef } from "../../music/data.ts";

/** Big room: a driven kick, a long clap in the reverb and bright open hats, for EDM and trance. */
export default { order: 8, name: "Big room", instrument: "drums", values: { pitch: 0.45, kickDecay: 0.5, drive: 0.6, clapDecay: 0.7, openDecay: 0.6, reverb: 0.3 } } satisfies PatchDef;
