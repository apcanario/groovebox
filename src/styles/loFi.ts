import type { StyleDef } from "../music/data.ts";

/**
 * Lo-fi: slow and swung, jazzy sevenths, a crunchy boom bap, long bass notes, soft keys and a quiet sine lead.
 * P8: through the lo-fi master (bit-crush, slow pitch wobble, noise; spec 8.7), the pad a wobbling tape pad, and the
 * bass walking in the break.
 */
export default {
  order: 1,
  name: "Lo-fi",
  family: "slow",
  bpm: 80,
  top: true,
  bpmRange: [74, 88],
  key: "D",
  mood: "deep",
  patches: {
    drums: "crunchy",
    bass: "warmBass",
    synth: "softKeys",
    layer1: "softSine",
    layer2: { patch: "tapePad", set: { cutoff: 0.35 } },
  },
  mix: { sweep: -0.2, pump: 0.2, saturation: 0.35, lofi: 1 },
  // P6: a lazy, sliding line over four bars that rests between phrases; Drift in the break; the pad layer drifts.
  leads: {
    layer1: { style: "phrase", phrase: 4, density: 0.45, shape: "valley", range: 0.4, register: 0.5, noteLength: 0.6, slide: 0.3, accent: 0.1 },
    layer2: { style: "drift", register: 0.4, noteLength: 0.85, density: 0.4 },
  },
  // P9 (spec 8.8): Crush and Chorus on the keys; the pad wobbles with a slow tremolo.
  fx: {
    drums: [{ effect: "crush" }, { effect: "echo" }],
    bass: [{ effect: "chorus" }, { effect: "fuzz" }],
    synth: [{ effect: "crush", on: true, knobs: [0.4, 0.35, 0.5] }, { effect: "chorus", on: true, knobs: [0.6, 0.25, 0.6] }],
    layer1: [{ effect: "echo" }, { effect: "vowel" }],
    layer2: [{ effect: "tremolo", on: true, knobs: [0.35, 0.43, 0] }, { effect: "chorus" }],
  },
  // P10 (spec 8.9): a filter-down and the beat falling back in.
  drop: {
    build: 2,
    parts: { sweep: "low", roll: false, riser: false, reverb: false, climb: false, hatsOut: true, kickOut: true },
    cliff: "none",
    cliffLength: "beat",
    impact: { sweep: false, sub: false, burst: false },
    layers: { synth: 0.5, bass: 0.3, drums: 0.4, leads: 0.6 },
    width: 0.6,
    pump: 0.0,
    wind: 2,
    bloom: false,
  },
  sections: [
    {
      name: "Intro",
      on: ["synth", "layer2"],
      chords: [[3, 1], [4, 1], [0, 2]],
      beat: "boomBap",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[3, 1], [4, 1], [0, 2]],
      beat: "boomBap",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative", gen: { density: 0.55, tension: 0.5 } },
      layer2: { mode: "pad", pad: { brightness: 0.3 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1"],
      chords: [[5, 2], [4, 2]],
      beat: "boomBap",
      bass: "walking",
      synth: "sustained",
      layer1: { mode: "generative", gen: { style: "drift", density: 0.4 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Outro",
      on: ["drums", "synth"],
      chords: [[3, 1], [4, 1], [0, 2]],
      beat: "boomBap",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative" },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
