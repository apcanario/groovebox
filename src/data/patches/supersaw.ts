import type { PatchDef } from "../../music/data.ts";

/** Supersaw: wide detuned saws, open and wet, for trance and EDM. */
export default { order: 10, name: "Supersaw", instrument: "synth", values: { wave: "sawtooth", attack: 0.01, decay: 0.4, sustain: 0.6, release: 0.5, cutoff: 0.7, resonance: 0.1, envAmount: 0.2, detune: 0.9, delay: 0.3, reverb: 0.5 } } satisfies PatchDef;
