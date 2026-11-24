import type { StyleDef } from "../music/data.ts";

/** Dub techno: a soft four on the floor, a deep sub, minor-seventh dub chords echoing into the reverb, a tape pad. */
export default {
  order: 4,
  name: "Dub techno",
  family: "techno",
  bpm: 118,
  key: "C",
  mood: "house",
  patches: { drums: "deep", bass: "sub", synth: "dubChord", layer1: "driftPad", layer2: "tapePad" },
  mix: { sweep: -0.1, pump: 0.35, saturation: 0.15, reverbDecay: 4 },
  leads: {
    layer1: { style: "drift", register: 0.6, noteLength: 0.9, density: 0.35 },
    layer2: { style: "drift", register: 0.4, noteLength: 0.95, density: 0.3 },
  },
  // Spec 8.8's example: Echo on the chords, here with a slow phaser; the pad chorused, the drift layer echoed.
  fx: {
    drums: [{ effect: "echo" }, { effect: "pan" }],
    bass: [{ effect: "chorus" }, { effect: "phaser" }],
    synth: [{ effect: "echo", on: true, knobs: [0.55, 0.4, 0.7] }, { effect: "phaser", on: true, knobs: [0.35, 0.1, 0.5] }],
    layer1: [{ effect: "echo", on: true, knobs: [0.35, 0.6, 0.5] }, { effect: "vowel" }],
    layer2: [{ effect: "chorus", on: true }, { effect: "tremolo" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "synth"],
      chords: [[0, 2], [5, 2]],
      beat: "fourFloor",
      bass: "long",
      synth: "dubChord",
      layer1: { mode: "pad" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 2], [5, 2], [2, 2], [6, 2]],
      beat: "dub",
      bass: "long",
      synth: "dubChord",
      layer1: { mode: "pad", pad: { attack: 1.5, release: 4, motion: 0.5 } },
      layer2: { mode: "pad", pad: { brightness: 0.3 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 2], [0, 2]],
      beat: "dub",
      bass: "pedal",
      synth: "dubChord",
      layer1: { mode: "pad", pad: { attack: 3, release: 6, motion: 0.6 } },
      layer2: { mode: "pad", pad: { attack: 3, release: 6 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "synth"],
      chords: [[0, 2], [5, 2]],
      beat: "dub",
      bass: "long",
      synth: "dubChord",
      layer1: { mode: "pad" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
