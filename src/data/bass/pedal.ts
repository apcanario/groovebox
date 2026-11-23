import { type BassRhythmDef } from "../../music/data.ts";

/** Pedal: one note held through the whole bar. */
export default { order: 7, name: "Pedal", hits: [{ step: 0, len: 16, vel: 0.8 }] } satisfies BassRhythmDef;
