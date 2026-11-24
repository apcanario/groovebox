import type { StyleDef } from "../music/data.ts";

/** Electro: a syncopated machine beat, a bouncing rubber bass, organ pushes, a talking square lead and a dark pad. */
export default {
  order: 4,
  name: "Electro",
  family: "other",
  bpm: 126,
  key: "E",
  mood: "dark",
  patches: { drums: "machine", bass: "rubber", synth: "organ", layer1: "squareLead", layer2: "darkPad" },
  mix: { sweep: 0, pump: 0.35, saturation: 0.3 },
  leads: {
    layer1: { style: "pulse", hits: 6, length: 16, rotate: 2, density: 0.85, register: 0.55, range: 0.4, noteLength: 0.35 },
    layer2: { style: "drift", register: 0.35, noteLength: 0.85, density: 0.35 },
  },
  // The robot voice: Vowel on the lead, Ring on the organ, crushed drums.
  fx: {
    drums: [{ effect: "crush", on: true, knobs: [0.65, 0.55, 0.4] }, { effect: "echo" }],
    bass: [{ effect: "fuzz" }, { effect: "phaser" }],
    synth: [{ effect: "ring", on: true, knobs: [0.35, 0.4, 0.5] }, { effect: "echo" }],
    layer1: [{ effect: "vowel", on: true, knobs: [0.6, 0.25, 0.83] }, { effect: "echo" }],
    layer2: [{ effect: "phaser" }, { effect: "chorus" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "bass"],
      chords: [[0, 1], [3, 1], [0, 1], [1, 1]],
      beat: "electro",
      bass: "octave",
      synth: "push",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [6, 1], [5, 1], [1, 1]],
      beat: "electro",
      bass: "octave",
      synth: "push",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { brightness: 0.25 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[0, 1], [1, 1], [3, 1], [1, 1]],
      beat: "electro",
      bass: "long",
      synth: "stabs",
      layer1: { mode: "generative", gen: { density: 0.5 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 1], [3, 1], [0, 1], [1, 1]],
      beat: "electro",
      bass: "octave",
      synth: "push",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
