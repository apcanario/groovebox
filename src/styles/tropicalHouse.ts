import type { StyleDef } from "../music/data.ts";

/** Tropical house: major chords, a light swung beat, offbeat bass, plucked chords and a whistle lead. */
export default {
  order: 2,
  name: "Tropical house",
  family: "house",
  bpm: 108,
  key: "C",
  mood: "major",
  patches: { drums: "soft", bass: "round", synth: "pluck", layer1: "whistle", layer2: "airyPad" },
  mix: { sweep: 0, pump: 0.5, saturation: 0 },
  // P6: a sliding whistle hook, high and singable; the pad layer drifts.
  leads: {
    layer1: { style: "hook", phrase: 2, density: 0.65, shape: "arch", range: 0.4, register: 0.7, noteLength: 0.45, slide: 0.25, accent: 0.2 },
    layer2: { style: "drift", register: 0.6, noteLength: 0.75, density: 0.45 },
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[0, 1], [4, 1], [5, 1], [3, 1]],
      beat: "tropical",
      bass: "offbeat",
      synth: "pluck",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [4, 1], [5, 1], [3, 1]],
      beat: "tropical",
      bass: "offbeat",
      synth: "pluck",
      layer1: { mode: "generative", gen: { tension: 0.3, lock: 0.85 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 1], [3, 1], [0, 1], [4, 1]],
      beat: "tropical",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative", gen: { density: 0.4, lock: 0.9, noteLength: 0.7 } },
      layer2: { mode: "pad", pad: { brightness: 0.6 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "synth"],
      chords: [[0, 1], [4, 1], [5, 1], [3, 1]],
      beat: "tropical",
      bass: "offbeat",
      synth: "pluck",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
