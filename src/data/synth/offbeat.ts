import { hits, type SynthRhythmDef } from "../../music/data.ts";

export default { order: 2, name: "Offbeat", hits: hits([2, 6, 10, 14], 1.2, 0.75) } satisfies SynthRhythmDef;
