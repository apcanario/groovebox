import type { PatchDef } from "../../music/data.ts";

/** Reese: a driven saw that moves slowly (the free LFO on its filter and pitch), for drum and bass and dubstep. */
export default { order: 11, name: "Reese", instrument: "bass", values: { wave: "sawtooth", cutoff: 0.4, resonance: 0.25, envAmount: 0.15, decay: 0.6, sustain: 0.85, release: 0.2, drive: 0.5, drift: 0.55, driftRate: 0.35 } } satisfies PatchDef;
