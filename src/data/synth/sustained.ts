import { type SynthRhythmDef } from "../../music/data.ts";

/** Held: the chord is held for its whole length (the sequencer stretches it). */
export default { order: 3, name: "Held", hold: true, hits: [{ step: 0, len: 16, vel: 0.7 }] } satisfies SynthRhythmDef;
