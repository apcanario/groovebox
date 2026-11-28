import type { StyleDef } from "../music/data.ts";

/** Downtempo: a lazy swung head-nod, a walking bass, keys broken into single notes, a soft sine line and a tape pad. */
export default {
  order: 4,
  name: "Downtempo",
  family: "slow",
  bpm: 92,
  top: true,
  bpmRange: [86, 100],
  key: "A",
  mood: "house",
  // F2 (spec 10.3's Drums, 10.5): Downtempo: a gentle kick, a little click; Root tunes the kick to the song's key.
  patches: {
    drums: { patch: "dusty", kick: { kickPunch: 0.4, kickClick: 0.15, kickRoot: 1 } },
    bass: "warmBass",
    synth: "softKeys",
    layer1: "softSine",
    layer2: "tapePad",
  },
  mix: { sweep: -0.05, pump: 0.25, saturation: 0.2 },
  leads: {
    layer1: { style: "phrase", phrase: 4, density: 0.5, shape: "arch", range: 0.4, register: 0.55, noteLength: 0.65, slide: 0.2, accent: 0.15 },
    layer2: { style: "drift", register: 0.45, noteLength: 0.85, density: 0.35 },
  },
  // Crushed drums, chorused keys, an echo on the line.
  fx: {
    drums: [{ effect: "crush", on: true, knobs: [0.5, 0.55, 0.35] }, { effect: "echo" }],
    bass: [{ effect: "chorus" }, { effect: "fuzz" }],
    synth: [{ effect: "chorus", on: true, knobs: [0.5, 0.25, 0.55] }, { effect: "tremolo" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.35, 0.6, 0.45] }, { effect: "vowel" }],
    layer2: [{ effect: "phaser" }, { effect: "chorus" }],
  },
  // P10 (spec 8.9): a short riser under a held chord, a soft sub hit.
  drop: {
    build: 2,
    parts: { sweep: "low", roll: false, riser: true, reverb: true, climb: false, hatsOut: false, kickOut: true },
    cliff: "hold",
    cliffLength: "beat",
    impact: { sweep: false, sub: true, burst: false },
    layers: { synth: 0.7, bass: 0.4, drums: 0.5, leads: 0.6 },
    width: 0.7,
    pump: 0.05,
    wind: 2,
    bloom: false,
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[0, 2], [5, 2]],
      beat: "downtempo",
      bass: "walking",
      synth: "broken",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { attack: 1.5, release: 3 } },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [5, 1], [3, 1], [4, 1]],
      beat: "downtempo",
      bass: "walking",
      synth: "broken",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { brightness: 0.3 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1"],
      chords: [[5, 2], [0, 2]],
      beat: "downtempo",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative", gen: { style: "drift", density: 0.4 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer2"],
      chords: [[0, 2], [5, 2]],
      beat: "downtempo",
      bass: "walking",
      synth: "broken",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
