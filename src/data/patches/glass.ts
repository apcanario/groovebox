import type { PatchDef } from "../../music/data.ts";

/** Glass: glassy keys from the two-operator FM wave (P7), a bright ratio that dies away with the note. */
export default { order: 9, name: "Glass", instrument: "synth", values: { wave: "fm", fmRatio: 0.625, fmIndex: 0.35, attack: 0.004, decay: 0.8, sustain: 0.15, release: 1.2, cutoff: 0.75, envAmount: 0.15, delay: 0.3, reverb: 0.45 } } satisfies PatchDef;
