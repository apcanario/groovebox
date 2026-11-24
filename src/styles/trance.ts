import type { StyleDef } from "../music/data.ts";

/** Trance: 138 bpm, a rolling bass, a gated supersaw, a plucked arp and strings over uplifting minor chords. */
export default {
  order: 3,
  name: "Trance",
  family: "other",
  bpm: 138,
  key: "A",
  mood: "minor",
  patches: { drums: "bigRoom", bass: "pluckBass", synth: "supersaw", layer1: "pluckLead", layer2: "strings" },
  mix: { sweep: 0, pump: 0.6, saturation: 0.15, reverbDecay: 3 },
  leads: {
    layer1: { style: "roll", density: 0.7, range: 0.5, register: 0.65, noteLength: 0.35, accent: 0.3 },
    layer2: { style: "drift", register: 0.55, noteLength: 0.9, density: 0.4 },
  },
  // Echo on the gated chords and the arp, a slow phaser on the strings.
  fx: {
    drums: [{ effect: "pan" }, { effect: "echo" }],
    bass: [{ effect: "chorus" }, { effect: "fuzz" }],
    synth: [{ effect: "echo", on: true, knobs: [0.3, 0.6, 0.45] }, { effect: "chorus" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.35, 0.4, 0.45] }, { effect: "flanger" }],
    layer2: [{ effect: "phaser", on: true, knobs: [0.4, 0.2, 0.5] }, { effect: "chorus" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "bass"],
      chords: [[0, 2], [5, 2], [3, 2], [4, 2]],
      beat: "trance",
      bass: "rolling",
      synth: "gate",
      layer1: { mode: "arp", arp: { direction: "up", rate: 4, octaves: 2 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [2, 1], [6, 1], [5, 1]],
      beat: "trance",
      bass: "rolling",
      synth: "gate",
      layer1: { mode: "arp", arp: { direction: "updown", rate: 4, octaves: 3, gate: 0.6 } },
      layer2: { mode: "pad", pad: { brightness: 0.5 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 2], [6, 2], [0, 2], [2, 2]],
      beat: "trance",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative", gen: { style: "phrase", phrase: 4, density: 0.5, shape: "rise" } },
      layer2: { mode: "pad", pad: { attack: 2, release: 4 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 2], [5, 2], [3, 2], [4, 2]],
      beat: "trance",
      bass: "rolling",
      synth: "gate",
      layer1: { mode: "arp", arp: { direction: "up", rate: 4, octaves: 2 } },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
