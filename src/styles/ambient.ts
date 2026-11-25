import type { StyleDef } from "../music/data.ts";

/**
 * Ambient (P7 rework, spec 8.10): slow and major, chords of four and eight bars, a drone on Layer 2 that glides
 * from chord to chord, a pad on Layer 1 that swoops between them, long attacks and releases, slow drift on the
 * pads, a 12-second reverb and the air layer. A sparse halftime pulse only in the groove. P8: Layer 1 is the new
 * Shimmer pad (FM, long and wet) beside the airy pad on Layer 2.
 */
export default {
  order: 2,
  name: "Ambient",
  family: "slow",
  bpm: 64,
  key: "E",
  mood: "major",
  patches: {
    drums: "soft",
    bass: "sub",
    synth: { patch: "padSwell", set: { attack: 3, release: 8, drift: 0.35, driftRate: 0.2 } },
    layer1: { patch: "shimmer", set: { level: 0.5 } },
    layer2: { patch: "airyPad", set: { reverb: 0.85, drift: 0.5, driftRate: 0.1 } },
  },
  mix: { sweep: 0, pump: 0.1, saturation: 0, air: 0.5, reverbDecay: 12 },
  // P6: both layers drift in long, sparse notes (the pad layer high, the drone layer low), when switched to Lead.
  leads: {
    layer1: { style: "drift", register: 0.7, range: 0.6, noteLength: 0.9, density: 0.4, slide: 0.25 },
    layer2: { style: "drift", register: 0.45, range: 0.4, noteLength: 1, density: 0.3 },
  },
  // P9: long echoes on the keys and the lead, the pad chorused and slowly talking.
  fx: {
    drums: [{ effect: "echo" }, { effect: "gate" }],
    bass: [{ effect: "chorus" }, { effect: "ring" }],
    synth: [{ effect: "echo", on: true, knobs: [0.45, 1, 0.6] }, { effect: "shifter" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.4, 0.8, 0.55] }, { effect: "phaser" }],
    layer2: [{ effect: "chorus", on: true }, { effect: "vowel", on: true, knobs: [0.4, 0.75, 0.17] }],
  },
  // P10 (spec 8.9): a bloom: no roll, no impact, the pads open and widen over eight bars.
  drop: {
    build: 8,
    parts: { sweep: "none", roll: false, riser: false, reverb: true, climb: false, hatsOut: false, kickOut: false },
    cliff: "none",
    cliffLength: "beat",
    impact: { sweep: false, sub: false, burst: false },
    layers: { synth: 1.0, bass: 0.0, drums: 0.0, leads: 1.0 },
    width: 1.0,
    pump: 0,
    wind: 4,
    bloom: true,
  },
  // P11 (spec 8.11): Morph arrives on. The pads and sends drift wide and wet; the pads and the drone change voicing
  // two inversions each way; the beat, the bass, the keys and the shimmer pad may drop out for a phrase; never the drone.
  morph: {
    on: true,
    bright: [0.25, 0.75],
    space: [0.45, 0.95],
    lock: 0.4,
    voicing: [1 / 6, 5 / 6],
    drop: ["drums", "bass", "synth", "layer1"],
    sections: 32,
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[0, 8], [3, 8]],
      beat: "none",
      bass: "pedal",
      synth: "sustained",
      layer1: { mode: "pad", pad: { attack: 8, release: 12, motion: 0.4, swoop: 0.6 } },
      layer2: { mode: "drone", drone: { fifth: true }, pad: { attack: 10, release: 14, motion: 0.5, swoop: 0.7 } },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 4], [3, 4], [5, 4], [4, 4]],
      beat: "halftime",
      bass: "pedal",
      synth: "sustained",
      layer1: { mode: "pad", pad: { attack: 3, release: 10, motion: 0.4, swoop: 0.5 } },
      layer2: { mode: "drone", drone: { fifth: true }, pad: { attack: 4, release: 12, motion: 0.5, swoop: 0.6 } },
    },
    {
      name: "Break",
      on: ["layer1", "layer2"],
      chords: [[5, 8], [3, 8]],
      beat: "none",
      bass: "pedal",
      synth: "sustained",
      layer1: { mode: "arp", arp: { direction: "random", rate: 4, octaves: 3, gate: 1 } },
      layer2: { mode: "drone", drone: { fifth: false }, pad: { attack: 10, release: 16, motion: 0.7, swoop: 0.8 } },
    },
    {
      name: "Outro",
      on: ["synth", "layer2"],
      chords: [[0, 8], [3, 8]],
      beat: "none",
      bass: "pedal",
      synth: "sustained",
      layer1: { mode: "pad", pad: { attack: 8, release: 16, swoop: 0.6 } },
      layer2: { mode: "drone", drone: { fifth: true }, pad: { attack: 10, release: 20, swoop: 0.7 } },
    },
  ],
} satisfies StyleDef;
