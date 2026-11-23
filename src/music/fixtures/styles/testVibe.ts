import type { StyleDef } from "../../data.ts";

/**
 * A test fixture (P3): a style file like any in `src/styles/`, kept out of that folder so the app does not list
 * it. The test reads it with the app's own folder and shows it in the picker, loaded and playing, with no other
 * change: adding a style is one new file.
 */
export default {
  order: 9,
  name: "Test vibe",
  family: "other",
  bpm: 100,
  key: "D",
  mood: "minor",
  patches: { drums: "punchy", bass: "round", synth: "warmStab", layer1: "bell", layer2: "warmPad" },
  mix: { sweep: 0, pump: 0.4, saturation: 0 },
  sections: [
    { name: "Intro", on: ["drums"], chords: [[0, 1]], beat: "fourFloor", bass: "offbeat", synth: "stabs", layer1: { mode: "generative" }, layer2: { mode: "pad" } },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [3, 1]],
      beat: "techno",
      bass: "offbeat",
      synth: "stabs",
      layer1: { mode: "arp" },
      layer2: { mode: "pad" },
    },
    { name: "Break", on: ["synth"], chords: [[5, 2]], beat: "techno", bass: "long", synth: "sustained", layer1: { mode: "generative" }, layer2: { mode: "pad" } },
    { name: "Outro", on: ["drums", "bass"], chords: [[0, 1]], beat: "techno", bass: "offbeat", synth: "stabs", layer1: { mode: "generative" }, layer2: { mode: "pad" } },
  ],
} satisfies StyleDef;
