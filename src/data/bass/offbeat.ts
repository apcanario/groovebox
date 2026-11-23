import { hits, type BassRhythmDef } from "../../music/data.ts";

export default { order: 1, name: "Offbeat", hits: hits([2, 6, 10, 14], 1.6, 0.9) } satisfies BassRhythmDef;
