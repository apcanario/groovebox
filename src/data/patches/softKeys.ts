import type { PatchDef } from "../../music/data.ts";

/** Soft keys: a rounded chord that rings, for held chords. */
export default { order: 4, name: "Soft keys", instrument: "synth", values: { wave: "triangle", attack: 0.01, decay: 0.7, sustain: 0.4, release: 0.8, cutoff: 0.45, envAmount: 0.15, reverb: 0.4 } } satisfies PatchDef;
