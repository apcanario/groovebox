import type { StyleDef } from "../music/data.ts";

/**
 * Drone (spec 8.10): dark and slow, staying on one chord for eight bars. Layer 2 in Drone mode holds the root and
 * fifth and glides between chords; Layer 1 a pad that swoops; attacks and releases of ten to twenty seconds; the air
 * layer and a 16-second reverb. A sparse pulse only in the groove; Shifter, Vowel and Echo on the layers.
 */
export default {
  order: 3,
  name: "Drone",
  family: "slow",
  bpm: 60,
  key: "D",
  mood: "dark",
  patches: {
    drums: "soft",
    bass: { patch: "sub", set: { attack: 2, release: 6, sustain: 0.9 } },
    // P8 review M6: a low, closed organ (square) held long, darker than Ambient's sawtooth Pad swell.
    synth: { patch: "organ", set: { attack: 8, decay: 1, sustain: 0.9, release: 14, cutoff: 0.2, envAmount: 0, reverb: 0.8, drift: 0.5, driftRate: 0.1 } },
    layer1: { patch: "darkPad", set: { attack: 6, release: 12, drift: 0.6, driftRate: 0.08, level: 0.55 } },
    layer2: { patch: "driftPad", set: { attack: 10, release: 16, cutoff: 0.45, drift: 0.7, driftRate: 0.05 } },
  },
  mix: { sweep: -0.15, pump: 0, saturation: 0.1, air: 0.6, reverbDecay: 16 },
  leads: {
    layer1: { style: "drift", register: 0.4, range: 0.4, noteLength: 1, density: 0.25, slide: 0.4 },
    layer2: { style: "drift", register: 0.3, range: 0.3, noteLength: 1, density: 0.2 },
  },
  // Spec 8.10: Shifter, Vowel and Echo; the drone shifts and talks, the pad echoes long.
  fx: {
    drums: [{ effect: "echo" }, { effect: "gate" }],
    bass: [{ effect: "chorus" }, { effect: "ring" }],
    synth: [{ effect: "echo", on: true, knobs: [0.4, 1, 0.65] }, { effect: "phaser" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.35, 1, 0.6] }, { effect: "vowel", on: true, knobs: [0.35, 0.25, 0.17] }],
    layer2: [{ effect: "shifter", on: true, knobs: [0.3, 0.52, 0.4] }, { effect: "vowel" }],
  },
  // P10 (spec 8.9): a bloom: no roll, no impact, the drone opens and widens over eight bars.
  drop: {
    build: 8,
    parts: { sweep: "none", roll: false, riser: false, reverb: true, climb: false, hatsOut: false, kickOut: false },
    cliff: "none",
    cliffLength: "beat",
    impact: { sweep: false, sub: false, burst: false },
    layers: { synth: 0.8, bass: 0.0, drums: 0.0, leads: 1.0 },
    width: 1.0,
    pump: 0,
    wind: 4,
    bloom: true,
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[0, 8], [6, 8]],
      beat: "none",
      bass: "pedal",
      synth: "sustained",
      layer1: { mode: "pad", pad: { attack: 10, release: 16, motion: 0.5, swoop: 0.7 } },
      layer2: { mode: "drone", drone: { fifth: true }, pad: { attack: 12, release: 18, motion: 0.6, swoop: 0.8 } },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      // P8 review S4: eight bars a chord, so Drone stays longer than Ambient's four (the card Deep winter).
      chords: [[0, 8], [5, 8]],
      beat: "slowPulse",
      bass: "pedal",
      synth: "sustained",
      layer1: { mode: "pad", pad: { attack: 4, release: 12, motion: 0.5, swoop: 0.6 } },
      layer2: { mode: "drone", drone: { fifth: true }, pad: { attack: 4, release: 14, motion: 0.6, swoop: 0.7 } },
    },
    {
      name: "Break",
      on: ["layer1", "layer2"],
      chords: [[0, 8], [1, 8]],
      beat: "none",
      bass: "pedal",
      synth: "sustained",
      layer1: { mode: "pad", pad: { attack: 12, release: 18, motion: 0.8, swoop: 0.9 } },
      layer2: { mode: "drone", drone: { fifth: false }, pad: { attack: 12, release: 20, motion: 0.8, swoop: 0.9 } },
    },
    {
      name: "Outro",
      on: ["synth", "layer2"],
      chords: [[0, 8], [6, 8]],
      beat: "none",
      bass: "pedal",
      synth: "sustained",
      layer1: { mode: "pad", pad: { attack: 10, release: 20, swoop: 0.7 } },
      layer2: { mode: "drone", drone: { fifth: true }, pad: { attack: 12, release: 20, swoop: 0.8 } },
    },
  ],
} satisfies StyleDef;
