import type { StyleDef } from "../../data.ts";

/**
 * A test fixture (P3): a style file like any in `src/styles/`, kept out of that folder so the app does not list
 * it. The test reads it with the app's own folder and shows it in the picker, loaded and playing, with no other
 * change: adding a style is one new file. Its id is one of the 24 the progression library already tags
 * (`LAUNCH_VIBES`), and every section's chords are a library progression tagged with it (spec 8.2): Chase,
 * Grey city and Northern sky.
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
  leads: { layer1: { style: "hook" }, layer2: { style: "drift" } },
  fx: {
    drums: [{ effect: "crush" }, { effect: "echo" }],
    bass: [{ effect: "fuzz" }, { effect: "chorus" }],
    synth: [{ effect: "chorus", on: true }, { effect: "echo" }],
    layer1: [{ effect: "echo" }, { effect: "phaser" }],
    layer2: [{ effect: "chorus" }, { effect: "tremolo" }],
  },
  sections: [
    { name: "Intro", on: ["drums"], chords: [[0, 1], [6, 1], [5, 1], [4, 1]], beat: "fourFloor", bass: "offbeat", synth: "stabs", layer1: { mode: "generative" }, layer2: { mode: "pad" } },
    {
      name: "Groove",
      on: ["drums", "bass", "synth", "layer1", "layer2"],
      chords: [[0, 1], [3, 1], [6, 1], [5, 1]],
      beat: "techno",
      bass: "offbeat",
      synth: "stabs",
      layer1: { mode: "arp" },
      layer2: { mode: "pad" },
    },
    { name: "Break", on: ["synth"], chords: [[0, 2], [5, 2], [3, 2], [4, 2]], beat: "techno", bass: "long", synth: "sustained", layer1: { mode: "generative" }, layer2: { mode: "pad" } },
    { name: "Outro", on: ["drums", "bass"], chords: [[0, 1], [6, 1], [5, 1], [4, 1]], beat: "techno", bass: "offbeat", synth: "stabs", layer1: { mode: "generative" }, layer2: { mode: "pad" } },
  ],
} satisfies StyleDef;
