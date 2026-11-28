import type { StyleDef } from "../music/data.ts";

/** 2-step: a swung skipping beat and bass, organ chords pushed ahead of the beat, a bell lead over a pad. */
export default {
  order: 2,
  name: "2-step",
  family: "breaks",
  bpm: 132,
  top: true,
  key: "G",
  mood: "house",
  // F2 (spec 10.3's Drums, 10.5): 2-step: a firm kick with click; Root tunes the kick to the song's key.
  patches: {
    drums: { patch: "punchy", kick: { kickPunch: 0.6, kickClick: 0.35, kickRoot: 1 } },
    bass: "round",
    synth: "organ",
    layer1: "bell",
    layer2: "warmPad",
  },
  mix: { sweep: 0, pump: 0.45, saturation: 0.05 },
  // P6: a choppy one-bar hook with quick repeats, swung by the beat; the pad layer drifts.
  leads: {
    layer1: { style: "hook", phrase: 1, density: 0.6, shape: "zigzag", range: 0.35, register: 0.6, noteLength: 0.35, repeats: 0.15, accent: 0.3 },
    layer2: { style: "drift", register: 0.45, noteLength: 0.8, density: 0.45 },
  },
  // P9: the bass chorused, the stabs echoed, the lead in dotted eighths, the pad chorused.
  fx: {
    drums: [{ effect: "echo" }, { effect: "crush" }],
    bass: [{ effect: "chorus", on: true, knobs: [0.5, 0.3, 0.4] }, { effect: "fuzz" }],
    synth: [{ effect: "echo", on: true, knobs: [0.3, 0.4, 0.35] }, { effect: "tremolo" }],
    layer1: [{ effect: "ring" }, { effect: "echo", on: true, knobs: [0.3, 0.4, 0.35] }],
    layer2: [{ effect: "vowel" }, { effect: "chorus", on: true }],
  },
  // P10 (spec 8.9): a clap roll, a beat of silence, a sweep and a sub hit.
  drop: {
    build: 4,
    parts: { sweep: "high", roll: true, riser: true, reverb: true, climb: true, hatsOut: false, kickOut: true },
    cliff: "gap",
    cliffLength: "beat",
    impact: { sweep: true, sub: true, burst: false },
    layers: { synth: 0.8, bass: 0.6, drums: 0.9, leads: 0.7 },
    width: 1.0,
    pump: 0.12,
    wind: 2,
    bloom: false,
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "synth"],
      chords: [[0, 1], [5, 1], [3, 1], [4, 1]],
      beat: "twoStep",
      bass: "garageSkip",
      synth: "push",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [5, 1], [3, 1], [4, 1]],
      beat: "twoStep",
      bass: "garageSkip",
      synth: "push",
      layer1: { mode: "generative", gen: { tension: 0.45, density: 0.7 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Break",
      on: ["synth", "layer2"],
      chords: [[3, 2], [4, 2]],
      beat: "twoStep",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { brightness: 0.55 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 1], [5, 1], [3, 1], [4, 1]],
      beat: "twoStep",
      bass: "garageSkip",
      synth: "push",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
