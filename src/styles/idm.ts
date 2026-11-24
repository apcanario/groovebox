import type { StyleDef } from "../music/data.ts";

/** IDM: a stuttering glitch beat with rolls, a climbing bass, glassy chords broken into notes, a ring-modulated bell. */
export default {
  order: 1,
  name: "IDM",
  family: "other",
  bpm: 110,
  key: "C",
  mood: "deep",
  patches: { drums: "machine", bass: "rubber", synth: "glass", layer1: "bell", layer2: "glassPad" },
  mix: { sweep: 0, pump: 0.2, saturation: 0.15 },
  leads: {
    layer1: { style: "pulse", hits: 7, length: 12, rotate: 3, density: 0.75, register: 0.65, range: 0.55, noteLength: 0.3 },
    layer2: { style: "drift", register: 0.5, noteLength: 0.9, density: 0.35 },
  },
  // Crushed drums, the glassy chord shifted, the bell ring-modulated, the pad talking slowly.
  fx: {
    drums: [{ effect: "crush", on: true, knobs: [0.6, 0.5, 0.5] }, { effect: "gate" }],
    bass: [{ effect: "phaser" }, { effect: "fuzz" }],
    synth: [{ effect: "shifter", on: true, knobs: [0.3, 0.58, 0.3] }, { effect: "echo" }],
    layer1: [{ effect: "ring", on: true, knobs: [0.4, 0.6, 0.5] }, { effect: "echo" }],
    layer2: [{ effect: "vowel", on: true, knobs: [0.4, 0.5, 0.5] }, { effect: "chorus" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer1"],
      chords: [[0, 1], [6, 1], [2, 1], [3, 1]],
      beat: "glitch",
      bass: "arpBass",
      synth: "broken",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[6, 1], [3, 1], [2, 1], [0, 1]],
      beat: "glitch",
      bass: "arpBass",
      synth: "broken",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { motion: 0.6 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[0, 1], [1, 1], [2, 1], [1, 1]],
      beat: "glitch",
      bass: "long",
      synth: "gate",
      layer1: { mode: "arp", arp: { direction: "random", rate: 4, octaves: 3, gate: 0.4 } },
      layer2: { mode: "pad", pad: { attack: 1.5, release: 3 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer2"],
      chords: [[0, 1], [6, 1], [2, 1], [3, 1]],
      beat: "glitch",
      bass: "arpBass",
      synth: "broken",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
