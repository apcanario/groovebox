import type { StyleDef } from "../music/data.ts";

/** Progressive: minor chords that build over two bars, a rolling bass, plucked eighths, an arp and slow strings. */
export default {
  order: 3,
  name: "Progressive",
  family: "house",
  bpm: 124,
  top: true,
  key: "A",
  mood: "minor",
  // F2 (spec 10.3's Drums, 10.5): Progressive: a firm kick, a little click; Root tunes the kick to the song's key.
  patches: {
    drums: { patch: "punchy", kick: { kickPunch: 0.55, kickClick: 0.25, kickRoot: 1 } },
    bass: "rubber",
    synth: "pluck",
    layer1: "pluckLead",
    layer2: "strings",
  },
  mix: { sweep: 0, pump: 0.55, saturation: 0.1 },
  leads: {
    layer1: { style: "phrase", phrase: 4, density: 0.6, shape: "rise", range: 0.5, register: 0.65, noteLength: 0.5, slide: 0.05, accent: 0.3 },
    layer2: { style: "drift", register: 0.5, noteLength: 0.85, density: 0.4 },
  },
  // The plucks and the arp echo, the strings sweep slowly through a phaser.
  fx: {
    drums: [{ effect: "pan" }, { effect: "crush" }],
    bass: [{ effect: "chorus" }, { effect: "fuzz" }],
    synth: [{ effect: "echo", on: true, knobs: [0.35, 0.6, 0.45] }, { effect: "chorus" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.3, 0.4, 0.4] }, { effect: "flanger" }],
    layer2: [{ effect: "phaser", on: true, knobs: [0.45, 0.2, 0.5] }, { effect: "chorus" }],
  },
  // P10 (spec 8.9): an eight-bar build, the full impact, wide supersaw layers.
  drop: {
    build: 8,
    parts: { sweep: "high", roll: true, riser: true, reverb: true, climb: true, hatsOut: false, kickOut: true },
    cliff: "gap",
    cliffLength: "beat",
    impact: { sweep: true, sub: true, burst: true },
    layers: { synth: 0.9, bass: 0.6, drums: 0.7, leads: 0.8 },
    width: 0.9,
    pump: 0.18,
    wind: 4,
    bloom: false,
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "layer2"],
      chords: [[0, 2], [5, 2], [2, 2], [6, 2]],
      beat: "progressive",
      bass: "rolling",
      synth: "pluck",
      layer1: { mode: "arp", arp: { direction: "up", rate: 4, octaves: 2 } },
      layer2: { mode: "pad", pad: { attack: 1.5, release: 3 } },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [5, 1], [2, 1], [6, 1]],
      beat: "progressive",
      bass: "rolling",
      synth: "pluck",
      layer1: { mode: "arp", arp: { direction: "updown", rate: 4, octaves: 2, gate: 0.5 } },
      layer2: { mode: "pad", pad: { brightness: 0.45, motion: 0.4 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 2], [6, 2], [0, 2], [2, 2]],
      beat: "progressive",
      bass: "long",
      synth: "swell",
      layer1: { mode: "generative", gen: { density: 0.45 } },
      layer2: { mode: "pad", pad: { attack: 2.5, release: 5, motion: 0.6 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 2], [5, 2], [2, 2], [6, 2]],
      beat: "progressive",
      bass: "rolling",
      synth: "pluck",
      layer1: { mode: "arp", arp: { direction: "up", rate: 4, octaves: 2 } },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
