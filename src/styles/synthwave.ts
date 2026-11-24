import type { StyleDef } from "../music/data.ts";

/** Synthwave: an eighties beat with a big snare, an octave bass, slow brass chords, a saw lead and strings. */
export default {
  order: 5,
  name: "Synthwave",
  family: "slow",
  bpm: 100,
  key: "A",
  mood: "minor",
  patches: { drums: "bigRoom", bass: "pluckBass", synth: "brass", layer1: "sawLead", layer2: "strings" },
  mix: { sweep: 0, pump: 0.3, saturation: 0.2, reverbDecay: 3 },
  leads: {
    layer1: { style: "phrase", phrase: 4, density: 0.55, shape: "arch", range: 0.5, register: 0.6, noteLength: 0.6, slide: 0.15, accent: 0.25 },
    layer2: { style: "drift", register: 0.5, noteLength: 0.85, density: 0.4 },
  },
  // Chorused brass, the lead echoed, the strings through a slow flanger.
  fx: {
    drums: [{ effect: "echo" }, { effect: "gate" }],
    bass: [{ effect: "chorus" }, { effect: "phaser" }],
    synth: [{ effect: "chorus", on: true, knobs: [0.55, 0.3, 0.6] }, { effect: "echo" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.35, 0.6, 0.45] }, { effect: "chorus" }],
    layer2: [{ effect: "flanger", on: true, knobs: [0.3, 0.3, 0.3] }, { effect: "phaser" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[0, 2], [5, 2], [3, 2], [4, 2]],
      beat: "synthwave",
      bass: "octave",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [6, 1], [3, 1], [0, 1]],
      beat: "synthwave",
      bass: "octave",
      synth: "push",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { brightness: 0.45 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 1], [6, 1], [2, 1], [0, 1]],
      beat: "synthwave",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "arp", arp: { direction: "up", rate: 4, octaves: 2 } },
      layer2: { mode: "pad", pad: { attack: 1.5, release: 3 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 2], [5, 2], [3, 2], [4, 2]],
      beat: "synthwave",
      bass: "octave",
      synth: "push",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
