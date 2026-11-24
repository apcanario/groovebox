import type { StyleDef } from "../music/data.ts";

/** Drum and bass: 174 bpm, a two-step break, a deep sub, soft keys, a pad and a bell lead. */
export default {
  order: 1,
  name: "Drum and bass",
  family: "breaks",
  bpm: 174,
  key: "F",
  mood: "minor",
  patches: { drums: "tight", bass: "sub", synth: "softKeys", layer1: "airyPad", layer2: "bell" },
  mix: { sweep: 0, pump: 0.35, saturation: 0.1 },
  // P6: a long bell line over four bars in call and response, floating over the breaks; the pad layer drifts.
  leads: {
    layer1: { style: "drift", register: 0.5, noteLength: 0.8, density: 0.45 },
    layer2: { style: "phrase", phrase: 4, density: 0.55, shape: "arch", range: 0.45, register: 0.65, noteLength: 0.65, slide: 0.1 },
  },
  // P9: a growl of fuzz on the bass, echo on the chords, the lead flanged, the pad chorused.
  fx: {
    drums: [{ effect: "crush" }, { effect: "echo" }],
    bass: [{ effect: "fuzz", on: true, knobs: [0.3, 0.45, 0.45] }, { effect: "phaser" }],
    synth: [{ effect: "echo", on: true, knobs: [0.35, 0.6, 0.4] }, { effect: "ring" }],
    layer1: [{ effect: "flanger", on: true, knobs: [0.5, 0.75, 0.5] }, { effect: "echo" }],
    layer2: [{ effect: "chorus", on: true }, { effect: "tremolo" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer1"],
      chords: [[0, 2], [5, 2]],
      beat: "dnb",
      bass: "dnbSub",
      synth: "sustained",
      layer1: { mode: "pad" },
      layer2: { mode: "generative" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 2], [5, 2], [2, 2], [6, 2]],
      beat: "dnbRoller",
      bass: "dnbSub",
      synth: "stabs",
      layer1: { mode: "pad", pad: { brightness: 0.5, motion: 0.4 } },
      layer2: { mode: "generative", gen: { density: 0.65 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 2], [2, 2]],
      beat: "dnb",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "pad", pad: { attack: 1.5, release: 3 } },
      layer2: { mode: "generative", gen: { density: 0.35, noteLength: 0.85 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 2], [5, 2]],
      beat: "dnb",
      bass: "dnbSub",
      synth: "stabs",
      layer1: { mode: "pad" },
      layer2: { mode: "generative" },
    },
  ],
} satisfies StyleDef;
