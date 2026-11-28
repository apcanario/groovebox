import type { StyleDef } from "../music/data.ts";

/** Minimal techno: a dry kit with rim ticks, two dark chords, a short dub chord, a sparse pulse lead and a low pad. */
export default {
  order: 3,
  name: "Minimal techno",
  family: "techno",
  bpm: 126,
  top: true,
  key: "G",
  mood: "dark",
  // F2 (spec 10.3's Drums, 10.5): Minimal, short dry kick: Machine's short tail, a sharp click;
  // Root tunes the kick to the song's key.
  patches: {
    drums: { patch: "machine", kick: { kickPunch: 0.55, kickClick: 0.45, kickRoot: 1 } },
    bass: "rubber",
    synth: { patch: "glass", set: { decay: 0.4, release: 0.5 } },
    layer1: "bell",
    layer2: { patch: "darkPad", set: { level: 0.6 } },
  },
  mix: { sweep: 0.05, pump: 0.4, saturation: 0.15 },
  leads: {
    layer1: { style: "pulse", hits: 5, length: 16, density: 0.8, register: 0.6, range: 0.3, noteLength: 0.25 },
    layer2: { style: "drift", register: 0.35, noteLength: 0.9, density: 0.3 },
  },
  // The glassy chord echoes, the pulse lead shifts in frequency, the drums pan a little.
  fx: {
    drums: [{ effect: "pan", on: true, knobs: [0.25, 0.57, 0] }, { effect: "crush" }],
    bass: [{ effect: "phaser" }, { effect: "fuzz" }],
    synth: [{ effect: "echo", on: true, knobs: [0.4, 0.6, 0.55] }, { effect: "gate" }],
    layer1: [{ effect: "shifter", on: true, knobs: [0.3, 0.55, 0.3] }, { effect: "echo" }],
    layer2: [{ effect: "chorus" }, { effect: "phaser" }],
  },
  // P10 (spec 8.9): hats out under a closing filter, a sub hit, percussion spread out.
  drop: {
    build: 4,
    parts: { sweep: "low", roll: false, riser: true, reverb: true, climb: false, hatsOut: true, kickOut: true },
    cliff: "gap",
    cliffLength: "beat",
    impact: { sweep: false, sub: true, burst: false },
    layers: { synth: 0.7, bass: 0.4, drums: 1.0, leads: 0.6 },
    width: 0.9,
    pump: 0.08,
    wind: 2,
    bloom: false,
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "bass"],
      chords: [[0, 2], [1, 2]],
      beat: "minimal",
      bass: "dub",
      synth: "dubChord",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 2], [3, 2]],
      beat: "minimal",
      bass: "dub",
      synth: "dubChord",
      layer1: { mode: "generative" },
      layer2: { mode: "pad", pad: { brightness: 0.2 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 2], [0, 2]],
      beat: "minimal",
      bass: "long",
      synth: "dubChord",
      layer1: { mode: "generative", gen: { density: 0.5 } },
      layer2: { mode: "pad", pad: { attack: 2, release: 4 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "synth"],
      chords: [[0, 2], [1, 2]],
      beat: "minimal",
      bass: "dub",
      synth: "dubChord",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
