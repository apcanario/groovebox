import type { StyleDef } from "../music/data.ts";

/** Deep techno: a dark mode held on two chords, a dub beat and bass, echoing chords and a dark pad. */
export default {
  order: 1,
  name: "Deep techno",
  family: "techno",
  bpm: 124,
  key: "F",
  mood: "dark",
  patches: { drums: "deep", bass: "sub", synth: "dubChord", layer1: "softSine", layer2: "darkPad" },
  mix: { sweep: -0.1, pump: 0.5, saturation: 0.15 },
  // P6: Layer 1 keeps the hypnotic Euclidean pulse, low and clipped, rarely changing; the pad layer drifts dark.
  leads: {
    layer1: { style: "pulse", lock: 0.85, register: 0.45, range: 0.35, noteLength: 0.3, accent: 0.2 },
    layer2: { style: "drift", register: 0.3, range: 0.3, noteLength: 0.75, density: 0.4 },
  },
  // P9: Dub techno's echo on the chords, a little grit on the bass, the lead phased, the hats echoed.
  fx: {
    drums: [{ effect: "echo", on: true, knobs: [0.25, 0.4, 0.4] }, { effect: "crush" }],
    bass: [{ effect: "fuzz", on: true, knobs: [0.25, 0.4, 0.4] }, { effect: "phaser" }],
    synth: [{ effect: "echo", on: true, knobs: [0.5, 0.4, 0.6] }, { effect: "flanger" }],
    layer1: [{ effect: "phaser", on: true }, { effect: "shifter" }],
    layer2: [{ effect: "vowel" }, { effect: "tremolo" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "bass"],
      chords: [[0, 2], [6, 2]],
      beat: "dub",
      bass: "dub",
      synth: "dubChord",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 2], [6, 2]],
      beat: "dub",
      bass: "dub",
      synth: "dubChord",
      layer1: { mode: "generative", gen: { hits: 3, length: 11, density: 0.7, tension: 0.2 } },
      layer2: { mode: "pad", pad: { brightness: 0.3, motion: 0.5 } },
    },
    {
      name: "Break",
      on: ["synth", "layer2"],
      chords: [[0, 2], [1, 2]],
      beat: "dub",
      bass: "long",
      synth: "dubChord",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { brightness: 0.25, motion: 0.7 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "synth"],
      chords: [[0, 2], [6, 2]],
      beat: "techno",
      bass: "dub",
      synth: "dubChord",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
