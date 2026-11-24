import type { PatchDef } from "../../music/data.ts";

/** Acid: a saw through a resonant filter that snaps shut, with glide between notes. */
export default { order: 10, name: "Acid", instrument: "bass", values: { wave: "sawtooth", cutoff: 0.3, resonance: 0.75, envAmount: 0.75, decay: 0.18, sustain: 0.15, glide: 0.35, drive: 0.35, sub: 0.4 } } satisfies PatchDef;
