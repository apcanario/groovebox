import type { StyleDef } from "../music/data.ts";

/** Future garage: a swung shuffle, a skipping sub, rainy chords in a long reverb, a talking choir and a shimmer pad. */
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
    layer1: "choir",
    layer2: "shimmer",
  },
  mix: { sweep: 0, pump: 0.3, saturation: 0.1, reverbDecay: 5 },
  leads: {
    layer1: { style: "drift", register: 0.65, range: 0.5, noteLength: 0.8, density: 0.45, slide: 0.3 },
    layer2: { style: "drift", register: 0.55, noteLength: 0.95, density: 0.3 },
  },
  // Crushed drums, echoed chords, the choir through a moving vowel, the shimmer chorused.
  fx: {
    drums: [{ effect: "crush", on: true, knobs: [0.55, 0.6, 0.4] }, { effect: "echo" }],
    bass: [{ effect: "chorus" }, { effect: "phaser" }],
    synth: [{ effect: "echo", on: true, knobs: [0.35, 0.6, 0.5] }, { effect: "tremolo" }],
    layer1: [{ effect: "vowel", on: true, knobs: [0.5, 0.5, 0.33] }, { effect: "echo" }],
    layer2: [{ effect: "chorus", on: true }, { effect: "shifter" }],
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
      synth: "swell",
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
