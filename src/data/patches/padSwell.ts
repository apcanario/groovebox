import type { PatchDef } from "../../music/data.ts";

/** Pad swell: a slow, wide saw chord that fades in and out. */
export default { order: 5, name: "Pad swell", instrument: "synth", values: { wave: "sawtooth", attack: 1.2, decay: 1, sustain: 0.8, release: 2.5, cutoff: 0.35, envAmount: 0.1, detune: 0.5, delay: 0.2, reverb: 0.7 } } satisfies PatchDef;
