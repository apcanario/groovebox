import type { StyleDef } from "../music/data.ts";

/** Dubstep: halftime at 140, a wobble bass on a synced filter, a dark held chord, a ring-modulated square lead. */
export default {
  order: 4,
  name: "Dubstep",
  family: "breaks",
  bpm: 140,
  key: "F",
  mood: "dark",
  patches: {
    drums: "boom",
    bass: "wobble",
    synth: { patch: "padSwell", set: { attack: 0.6, release: 1.5, cutoff: 0.3 } },
    layer1: "squareLead",
    layer2: "darkPad",
  },
  mix: { sweep: 0, pump: 0.3, saturation: 0.3 },
  leads: {
    layer1: { style: "phrase", phrase: 2, density: 0.45, shape: "valley", range: 0.4, register: 0.55, noteLength: 0.4, slide: 0.2, accent: 0.4 },
    layer2: { style: "drift", register: 0.35, noteLength: 0.9, density: 0.3 },
  },
  // The wobble through fuzz, the lead ring-modulated, the held chord echoed.
  fx: {
    drums: [{ effect: "crush" }, { effect: "echo" }],
    bass: [{ effect: "fuzz", on: true, knobs: [0.4, 0.55, 0.5] }, { effect: "phaser" }],
    synth: [{ effect: "echo", on: true, knobs: [0.35, 0.8, 0.5] }, { effect: "vowel" }],
    layer1: [{ effect: "ring", on: true, knobs: [0.35, 0.5, 0.5] }, { effect: "echo" }],
    layer2: [{ effect: "phaser" }, { effect: "chorus" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[0, 2], [1, 2]],
      beat: "dubstep",
      bass: "wobbleRhythm",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { attack: 2, release: 4 } },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [0, 1], [1, 1], [0, 1]],
      beat: "dubstep",
      bass: "wobbleRhythm",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Break",
      on: ["drums", "synth", "layer1"],
      chords: [[0, 2], [5, 2]],
      beat: "dubstep",
      bass: "long",
      synth: "swell",
      layer1: { mode: "generative", gen: { density: 0.35 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer2"],
      chords: [[0, 2], [1, 2]],
      beat: "dubstep",
      bass: "wobbleRhythm",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
