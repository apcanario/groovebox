import type { PatchDef } from "../../music/data.ts";

/** Wobble: a saw bass whose filter swings in time with the tempo-synced LFO (P7), an eighth note per cycle. */
export default { order: 9, name: "Wobble", instrument: "bass", values: { wave: "sawtooth", cutoff: 0.75, resonance: 0.45, envAmount: 0.1, decay: 0.3, sustain: 0.8, lfoRate: 0.714, lfoDepth: 0.6, drive: 0.25 } } satisfies PatchDef;
