import type { StyleDef } from "../music/data.ts";

/** Deep house: dorian sevenths and ninths, a shuffled beat, offbeat bass, warm stabs, a bell lead over a pad. */
export default {
  order: 1,
  name: "Deep house",
  family: "house",
  bpm: 122,
  top: true,
  key: "F",
  mood: "deep",
  // F2 (spec 10.3's Drums, 10.5): Thump or House shuffle, round kick: a middle sweep, a touch of click;
  // Root tunes the kick to the song's key.
  patches: {
    drums: { patch: "punchy", kick: { kickPunch: 0.45, kickClick: 0.1, kickRoot: 1 } },
    bass: "round",
    synth: "warmStab",
    layer1: "bell",
    layer2: "warmPad",
  },
  mix: { sweep: 0, pump: 0.6, saturation: 0.1 },
  // P6: a short bell hook over two bars on Layer 1; the pad layer, switched to Lead, drifts in long notes.
  leads: {
    layer1: { style: "hook", phrase: 2, density: 0.65, shape: "arch", range: 0.35, register: 0.6, noteLength: 0.45, slide: 0.1, accent: 0.25 },
    layer2: { style: "drift", register: 0.4, noteLength: 0.8, density: 0.5 },
  },
  // P9: a dub echo on the stabs and the lead, the pad chorused.
  fx: {
    drums: [{ effect: "crush" }, { effect: "echo" }],
    bass: [{ effect: "chorus" }, { effect: "fuzz" }],
    synth: [{ effect: "echo", on: true, knobs: [0.35, 0.4, 0.45] }, { effect: "chorus" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.3, 0.6, 0.35] }, { effect: "phaser" }],
    layer2: [{ effect: "chorus", on: true }, { effect: "tremolo" }],
  },
  // P10 (spec 8.9): a four-bar build with a clap roll and a riser, a beat of silence, a sweep and a sub hit.
  drop: {
    build: 4,
    parts: { sweep: "high", roll: true, riser: true, reverb: true, climb: true, hatsOut: false, kickOut: true },
    cliff: "gap",
    cliffLength: "beat",
    impact: { sweep: true, sub: true, burst: false },
    layers: { synth: 0.8, bass: 0.5, drums: 0.6, leads: 0.6 },
    width: 0.75,
    pump: 0.12,
    wind: 2,
    bloom: false,
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "layer2"],
      chords: [[0, 2], [3, 2]],
      beat: "thump",
      bass: "offbeat",
      synth: "stabs",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [3, 1], [2, 1], [3, 1]],
      beat: "houseShuffle",
      bass: "offbeat",
      synth: "stabs",
      layer1: { mode: "generative", gen: { density: 0.8, variation: 0.4 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 2], [3, 2]],
      beat: "houseShuffle",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "arp", arp: { direction: "updown", rate: 2, octaves: 2 } },
      layer2: { mode: "pad", pad: { attack: 1.2, release: 2.5 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer2"],
      chords: [[0, 2], [3, 2]],
      beat: "houseShuffle",
      bass: "offbeat",
      synth: "stabs",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
