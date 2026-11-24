import type { StyleDef } from "../music/data.ts";

/**
 * Future garage: a swung shuffle, a skipping sub, rainy chords in a long reverb, a talking choir and an airy pad. P8
 * cost: with the Shimmer pad and the swelling chord in the groove it measured 99 to 100% audio load (tools/cost.py
 * vibes), so the groove holds its chord and the pad is the lighter Airy pad.
 */
export default {
  order: 5,
  name: "Future garage",
  family: "breaks",
  bpm: 132,
  key: "D",
  mood: "deep",
  patches: {
    drums: "soft",
    bass: "sub",
    synth: { patch: "padSwell", set: { attack: 0.4, release: 2 } },
    layer1: "softSine",
    layer2: { patch: "airyPad", set: { drift: 0.4, driftRate: 0.2 } },
  },
  mix: { sweep: 0, pump: 0.3, saturation: 0.1, reverbDecay: 5 },
  leads: {
    layer1: { style: "drift", register: 0.65, range: 0.5, noteLength: 0.8, density: 0.45, slide: 0.3 },
    layer2: { style: "drift", register: 0.55, noteLength: 0.95, density: 0.3 },
  },
  // Crushed drums, echoed chords, the choir through a moving vowel, the pad chorused.
  fx: {
    drums: [{ effect: "crush", on: true, knobs: [0.55, 0.6, 0.4] }, { effect: "echo" }],
    bass: [{ effect: "chorus" }, { effect: "phaser" }],
    synth: [{ effect: "echo", on: true, knobs: [0.35, 0.6, 0.5] }, { effect: "tremolo" }],
    layer1: [{ effect: "vowel", on: true, knobs: [0.5, 0.5, 0.33] }, { effect: "echo" }],
    layer2: [{ effect: "chorus", on: true }, { effect: "shifter" }],
  },
  // P10 (spec 8.9): a riser under a closing filter and a held chord, a falling sweep.
  drop: {
    build: 4,
    parts: { sweep: "low", roll: false, riser: true, reverb: true, climb: false, hatsOut: false, kickOut: true },
    cliff: "hold",
    cliffLength: "beat",
    impact: { sweep: true, sub: false, burst: false },
    layers: { synth: 0.8, bass: 0.4, drums: 0.5, leads: 0.8 },
    width: 0.9,
    pump: 0.05,
    wind: 4,
    bloom: false,
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[3, 2], [0, 2]],
      beat: "garageShuffle",
      bass: "garageSkip",
      synth: "swell",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { attack: 2, release: 5 } },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [2, 1], [6, 1], [3, 1]],
      beat: "garageShuffle",
      bass: "garageSkip",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { motion: 0.5 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 2], [4, 2]],
      beat: "garageShuffle",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative", gen: { density: 0.35 } },
      layer2: { mode: "pad", pad: { attack: 3, release: 6, swoop: 0.5 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer2"],
      chords: [[3, 2], [0, 2]],
      beat: "garageShuffle",
      bass: "garageSkip",
      synth: "swell",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
