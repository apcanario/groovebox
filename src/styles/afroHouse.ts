import type { StyleDef } from "../music/data.ts";

/** Afro house: congas and a running shaker over four on the floor, deep chords, a skipping bass, a whistle and a choir. */
export default {
  order: 5,
  name: "Afro house",
  family: "house",
  bpm: 120,
  key: "G",
  mood: "deep",
  patches: { drums: "punchy", bass: "round", synth: "softKeys", layer1: "whistle", layer2: "choir" },
  mix: { sweep: 0, pump: 0.5, saturation: 0.1 },
  leads: {
    layer1: { style: "hook", phrase: 2, density: 0.55, shape: "zigzag", range: 0.4, register: 0.65, noteLength: 0.4, slide: 0.2, accent: 0.3 },
    layer2: { style: "drift", register: 0.5, noteLength: 0.9, density: 0.35 },
  },
  // The keys pulse in a slow tremolo, the whistle echoes, the choir is chorused.
  fx: {
    drums: [{ effect: "pan" }, { effect: "echo" }],
    bass: [{ effect: "chorus" }, { effect: "fuzz" }],
    synth: [{ effect: "tremolo", on: true, knobs: [0.4, 0.43, 0] }, { effect: "echo" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.3, 0.4, 0.4] }, { effect: "vowel" }],
    layer2: [{ effect: "chorus", on: true }, { effect: "phaser" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "layer2"],
      chords: [[0, 2], [6, 2]],
      beat: "afro",
      bass: "garageSkip",
      synth: "skank",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { attack: 1.5, release: 3 } },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [6, 1], [3, 1], [0, 1]],
      beat: "afro",
      bass: "garageSkip",
      synth: "skank",
      layer1: { mode: "generative", gen: { density: 0.6 } },
      layer2: { mode: "pad", pad: { brightness: 0.4 } },
    },
    {
      name: "Break",
      on: ["drums", "synth", "layer2"],
      chords: [[3, 2], [0, 2]],
      beat: "afro",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { attack: 2, release: 4, motion: 0.5 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 2], [6, 2]],
      beat: "afro",
      bass: "garageSkip",
      synth: "skank",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
