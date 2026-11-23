import type { PatchDef } from "../../music/data.ts";

/** Sub: a sine, almost no filter movement, all weight. */
export default { order: 2, name: "Sub", instrument: "bass", values: { wave: "sine", cutoff: 0.2, envAmount: 0.1, decay: 0.4, sustain: 0.6 } } satisfies PatchDef;
