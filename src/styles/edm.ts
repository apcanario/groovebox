import type { StyleDef } from "../music/data.ts";

/** EDM: a big-room four on the floor with a clap roll, an octave bass, supersaw stabs, a saw hook and strings. */
export default {
  order: 2,
  name: "EDM",
  family: "other",
  bpm: 128,
  key: "F",
  mood: "minor",
  patches: { drums: "bigRoom", bass: "rubber", synth: "supersaw", layer1: "sawLead", layer2: "strings" },
  mix: { sweep: 0, pump: 0.75, saturation: 0.25 },
  leads: {
    layer1: { style: "hook", phrase: 2, density: 0.7, shape: "rise", range: 0.5, register: 0.65, noteLength: 0.4, slide: 0.1, accent: 0.5 },
    layer2: { style: "drift", register: 0.5, noteLength: 0.85, density: 0.4 },
  },
  // Fuzz on the bass, echo on the supersaw and the hook.
  fx: {
    drums: [{ effect: "crush" }, { effect: "echo" }],
    bass: [{ effect: "fuzz", on: true, knobs: [0.3, 0.5, 0.4] }, { effect: "chorus" }],
    synth: [{ effect: "echo", on: true, knobs: [0.3, 0.6, 0.4] }, { effect: "phaser" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.3, 0.4, 0.4] }, { effect: "flanger" }],
    layer2: [{ effect: "chorus" }, { effect: "phaser" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "layer2"],
      chords: [[0, 2], [5, 2]],
      beat: "edm",
      bass: "octave",
      synth: "offbeat",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [5, 1], [6, 1], [6, 1]],
      beat: "edm",
      bass: "octave",
      synth: "offbeat",
      layer1: { mode: "generative", gen: { density: 0.75 } },
      layer2: { mode: "pad", pad: { brightness: 0.55 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 1], [6, 1], [0, 1], [2, 1]],
      beat: "edm",
      bass: "long",
      synth: "swell",
      layer1: { mode: "generative", gen: { density: 0.45 } },
      layer2: { mode: "pad", pad: { attack: 1.5, release: 3 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "synth"],
      chords: [[0, 2], [5, 2]],
      beat: "edm",
      bass: "octave",
      synth: "offbeat",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
