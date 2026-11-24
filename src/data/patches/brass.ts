import type { PatchDef } from "../../music/data.ts";

/** Brass: a saw that opens slowly into the note, a little detuned, for synthwave and electro. */
export default { order: 11, name: "Brass", instrument: "synth", values: { wave: "sawtooth", attack: 0.06, decay: 0.5, sustain: 0.6, release: 0.3, cutoff: 0.4, resonance: 0.15, envAmount: 0.55, detune: 0.25, reverb: 0.3 } } satisfies PatchDef;
