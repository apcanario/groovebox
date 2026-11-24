import type { StyleDef } from "../music/data.ts";

/**
 * Trance: 138 bpm in F# minor, an offbeat bass, a gated supersaw, a saw arp, and a warm pad cut into sixteenths by
 * the Gate effect's trance pattern, over uplifting minor chords. P8 review S6: its own key, bass, sounds and effects,
 * no longer a copy of Progressive. P8 review M5: the supersaw's release is 0.2 s (0.5 s kept twelve voices sounding).
 */
export default {
  order: 3,
  name: "Trance",
  family: "other",
  bpm: 138,
  key: "F#",
  mood: "minor",
  patches: { drums: "bigRoom", bass: "pluckBass", synth: { patch: "supersaw", set: { release: 0.2 } }, layer1: "sawLead", layer2: "warmPad" },
  mix: { sweep: 0, pump: 0.6, saturation: 0.15, reverbDecay: 3 },
  leads: {
    layer1: { style: "roll", density: 0.7, range: 0.5, register: 0.65, noteLength: 0.35, accent: 0.3 },
    layer2: { style: "drift", register: 0.55, noteLength: 0.9, density: 0.4 },
  },
  // The supersaw chorused wide, the arp echoing, the pad gated in the trance pattern (Gate's fourth, x.xxx.xxx.xxx.xx).
  fx: {
    drums: [{ effect: "pan" }, { effect: "echo" }],
    bass: [{ effect: "fuzz" }, { effect: "tremolo" }],
    synth: [{ effect: "chorus", on: true }, { effect: "flanger" }],
    layer1: [{ effect: "echo", on: true, knobs: [0.35, 0.4, 0.45] }, { effect: "pan" }],
    layer2: [{ effect: "gate", on: true, knobs: [3 / 7, 0.9, 0.3] }, { effect: "phaser" }],
  },
  sections: [
    {
      name: "Intro",
      on: ["drums", "bass"],
      chords: [[0, 2], [5, 2], [3, 2], [4, 2]],
      beat: "trance",
      bass: "offbeat",
      synth: "gate",
      layer1: { mode: "arp", arp: { direction: "up", rate: 4, octaves: 2 } },
      layer2: { mode: "pad" },
    },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [2, 1], [6, 1], [5, 1]],
      beat: "trance",
      bass: "offbeat",
      synth: "gate",
      layer1: { mode: "arp", arp: { direction: "updown", rate: 4, octaves: 3, gate: 0.6 } },
      layer2: { mode: "pad", pad: { brightness: 0.5 } },
    },
    {
      name: "Break",
      on: ["synth", "layer1", "layer2"],
      chords: [[5, 2], [6, 2], [0, 2], [2, 2]],
      beat: "trance",
      bass: "long",
      synth: "sustained",
      layer1: { mode: "generative", gen: { style: "phrase", phrase: 4, density: 0.5, shape: "rise" } },
      layer2: { mode: "pad", pad: { attack: 2, release: 4 } },
    },
    {
      name: "Outro",
      on: ["drums", "bass", "layer1"],
      chords: [[0, 2], [5, 2], [3, 2], [4, 2]],
      beat: "trance",
      bass: "offbeat",
      synth: "gate",
      layer1: { mode: "arp", arp: { direction: "up", rate: 4, octaves: 2 } },
      layer2: { mode: "pad" },
    },
  ],
} satisfies StyleDef;
