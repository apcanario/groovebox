import type { StyleDef } from "../music/data.ts";

/** Acid house: two chords and a squelchy resonant bass line over a plain four on the floor, organ stabs, an acid lead. */
export default {
  order: 4,
  name: "Acid house",
  family: "house",
  bpm: 125,
  key: "A",
  mood: "house",
  patches: {
    drums: "machine",
    bass: "acidBass",
    synth: "organ",
    layer1: "acidLead",
    layer2: { patch: "darkPad", set: { cutoff: 0.35 } },
  },
  mix: { sweep: 0, pump: 0.45, saturation: 0.25 },
  leads: {
    layer1: { style: "roll", density: 0.7, range: 0.35, register: 0.45, noteLength: 0.3, slide: 0.45, accent: 0.6 },
    layer2: { style: "drift", register: 0.45, noteLength: 0.8, density: 0.35 },
  },
  // The acid line through fuzz, the organ echoed, the lead flanged.
  fx: {
    drums: [{ effect: "crush" }, { effect: "echo" }],
    bass: [{ effect: "fuzz", on: true, knobs: [0.3, 0.55, 0.4] }, { effect: "phaser" }],
    synth: [{ effect: "echo", on: true, knobs: [0.3, 0.6, 0.5] }, { effect: "tremolo" }],
    layer1: [{ effect: "flanger", on: true, knobs: [0.45, 0.7, 0.55] }, { effect: "echo" }],
    layer2: [{ effect: "chorus" }, { effect: "phaser" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "bass"],
      chords: [[0, 2], [5, 2]],
      beat: "acid",
      bass: "acidLine",
      synth: "stabs",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 2], [5, 2]],
      beat: "acid",
      bass: "acidLine",
      synth: "stabs",
      layer1: { mode: "generative", gen: { density: 0.7 } },
      layer2: { mode: "pad", pad: { brightness: 0.3 } },
    },
    {
      name: "Break",
      on: ["bass", "layer1", "layer2"],
      chords: [[3, 2], [4, 2]],
      beat: "acid",
      bass: "acidLine",
      synth: "offbeat",
      layer1: { mode: "generative", gen: { density: 0.5 } },
      layer2: { mode: "pad", pad: { attack: 1.5, release: 3 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "synth"],
      chords: [[0, 2], [5, 2]],
      beat: "acid",
      bass: "acidLine",
      synth: "stabs",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
