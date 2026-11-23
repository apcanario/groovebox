import type { StyleDef } from "../music/data.ts";

/** Lo-fi: slow and swung, jazzy sevenths, a crunchy boom bap, long bass notes, soft keys and a quiet sine lead. */
export default {
  order: 1,
  name: "Lo-fi",
  family: "slow",
  bpm: 80,
  key: "D",
  mood: "deep",
  patches: {
    drums: "crunchy",
    bass: "warmBass",
    synth: "softKeys",
    layer1: "softSine",
    layer2: { patch: "warmPad", set: { cutoff: 0.35 } },
  },
  mix: { sweep: -0.2, pump: 0.2, saturation: 0.35 },
  // P6: a lazy, sliding line over four bars that rests between phrases; Drift in the break; the pad layer drifts.
  leads: {
    layer1: { style: "phrase", phrase: 4, density: 0.45, shape: "valley", range: 0.4, register: 0.5, noteLength: 0.6, slide: 0.3, accent: 0.1 },
    layer2: { style: "drift", register: 0.4, noteLength: 0.85, density: 0.4 },
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[3, 1], [4, 1], [0, 2]],
      beat: "boomBap",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[3, 1], [4, 1], [0, 2]],
      beat: "boomBap",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative", gen: { density: 0.55, tension: 0.5 } },
      layer2: { mode: "pad", pad: { brightness: 0.3 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1"],
      chords: [[5, 2], [4, 2]],
      beat: "boomBap",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative", gen: { style: "drift", density: 0.4 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Outro",
      on: ["drums", "synth"],
      chords: [[3, 1], [4, 1], [0, 2]],
      beat: "boomBap",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
