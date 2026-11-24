import type { StyleDef } from "../music/data.ts";

/** Melodic techno: minor chords two bars each, rolling bass, a held pad chord, a running arp and a saw lead. */
export default {
  order: 2,
  name: "Melodic techno",
  family: "techno",
  bpm: 123,
  key: "A",
  mood: "minor",
  patches: { drums: "punchy", bass: "pluckBass", synth: "padSwell", layer1: "bell", layer2: "sawLead" },
  mix: { sweep: 0, pump: 0.55, saturation: 0.1 },
  // P6: the saw lead rolls in sixteenths with slides and accents; the arp layer, switched to Lead, plays a high hook.
  leads: {
    layer1: { style: "hook", phrase: 2, register: 0.7, range: 0.3, noteLength: 0.35 },
    layer2: { style: "roll", phrase: 2, density: 0.7, shape: "zigzag", range: 0.35, register: 0.5, noteLength: 0.4, slide: 0.2, accent: 0.35, repeats: 0.08 },
  },
  // P9: the chords phased and echoed, the lead in dotted eighths, the pad chorused.
  fx: {
    drums: [{ effect: "gate" }, { effect: "echo" }],
    bass: [{ effect: "fuzz" }, { effect: "chorus" }],
    synth: [{ effect: "phaser", on: true, knobs: [0.6, 0.85, 0.6] }, { effect: "echo", on: true, knobs: [0.35, 0.4, 0.45] }],
    layer1: [{ effect: "echo", on: true, knobs: [0.35, 0.4, 0.5] }, { effect: "flanger" }],
    layer2: [{ effect: "chorus", on: true }, { effect: "pan" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 2], [5, 2], [3, 2], [4, 2]],
      beat: "progressive",
      bass: "rolling",
      synth: "sustained",
      layer1: { mode: "arp", arp: { direction: "up", rate: 1, octaves: 2, gate: 0.5 } },
      layer2: { mode: "generative" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 2], [5, 2], [3, 2], [4, 2]],
      beat: "progressive",
      bass: "rolling",
      synth: "sustained",
      layer1: { mode: "arp", arp: { direction: "up", rate: 1, octaves: 2, gate: 0.5 } },
      layer2: { mode: "generative", gen: { lock: 0.9, tension: 0.4, density: 0.8 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1"],
      chords: [[5, 2], [3, 2], [0, 2], [4, 2]],
      beat: "progressive",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "arp", arp: { direction: "updown", rate: 2, octaves: 3, gate: 0.7 } },
      layer2: { mode: "generative" },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 2], [5, 2]],
      beat: "techno",
      bass: "rolling",
      synth: "sustained",
      layer1: { mode: "arp", arp: { direction: "up", rate: 1, octaves: 1, gate: 0.5 } },
      layer2: { mode: "generative" },
    },
  ],
} satisfies StyleDef;
