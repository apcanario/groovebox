import { describe, expect, it } from "vitest";
import { LOCK_FROZEN } from "../music/lead.ts";
import {
  addChord,
  GEN_KNOBS,
  LAYER_PATCH_KNOBS,
  PAD_KNOBS,
  genText,
  leadCellClass,
  barLabel,
  chooseSection,
  chordName,
  cycleLength,
  dragValue,
  editedSection,
  fraction,
  hzLabel,
  keepChosen,
  KNOB_PAGES,
  knobPos,
  knobText,
  knobValue,
  meterFraction,
  paginate,
  secondsLabel,
  moveChord,
  removeChord,
  replaceChord,
  stripState,
  sweepLabel,
} from "./logic.ts";
import { NOTE_NAMES } from "../music/scales.ts";
import { PATCH_KEYS } from "../engine/song.ts";

const seq = [
  { degree: 0, bars: 1 as const },
  { degree: 5, bars: 2 as const },
  { degree: 3, bars: 0.5 as const },
];

describe("dial drag", () => {
  it("up raises, down lowers, clamped to the range", () => {
    expect(dragValue(0.5, -110, 0, 1)).toBeCloseTo(1);
    expect(dragValue(0.5, 110, 0, 1)).toBeCloseTo(0);
    expect(dragValue(0.5, -1000, 0, 1)).toBe(1);
    expect(dragValue(0.5, 1000, 0, 1)).toBe(0);
    expect(dragValue(0, -55, -1, 1)).toBeCloseTo(0.5);
  });
  it("rounds to the step", () => {
    expect(dragValue(120, -7, 80, 180, 1, 400)).toBe(122);
  });
  it("fraction of range", () => {
    expect(fraction(0, -1, 1)).toBe(0.5);
    expect(fraction(5, 0, 1)).toBe(1);
  });
});

describe("transport and sections", () => {
  it("bar counter reads bar.beat from 1", () => {
    expect(barLabel(true, 16, 9)).toBe("17.3");
    expect(barLabel(false, 3, 3)).toBe("–");
    expect(barLabel(true, 98, 12)).toBe("99.4");
    expect(barLabel(true, 99, 12)).toBe("100");
  });
  it("edited section follows the playing one unless another is chosen", () => {
    expect(editedSection(null, 2, 4)).toBe(2);
    expect(editedSection(1, 2, 4)).toBe(1);
    expect(editedSection(3, 0, 2)).toBe(1);
    expect(chooseSection(2, 2)).toBe(null);
    expect(chooseSection(1, 2)).toBe(1);
  });
});

describe("chord sequence edits", () => {
  it("adds up to eight", () => {
    let s = seq;
    for (let i = 0; i < 10; i++) s = addChord(s, 4);
    expect(s).toHaveLength(8);
    expect(s[3]).toEqual({ degree: 4, bars: 1 });
    expect(seq).toHaveLength(3);
  });
  it("replaces, removes (never the last one) and moves", () => {
    expect(replaceChord(seq, 1, 6)[1]).toEqual({ degree: 6, bars: 2 });
    expect(removeChord(seq, 0).map((c) => c.degree)).toEqual([5, 3]);
    expect(removeChord([seq[0]], 0)).toHaveLength(1);
    expect(moveChord(seq, 0, 1).map((c) => c.degree)).toEqual([5, 0, 3]);
    expect(moveChord(seq, 2, -1).map((c) => c.degree)).toEqual([0, 3, 5]);
    expect(moveChord(seq, 0, -1)).toBe(seq);
    expect(moveChord(seq, 2, 1)).toBe(seq);
  });
  it("cycles length 1, 2, half", () => {
    expect(cycleLength(seq, 0)[0].bars).toBe(2);
    expect(cycleLength(seq, 1)[1].bars).toBe(0.5);
    expect(cycleLength(seq, 2)[2].bars).toBe(1);
  });
});

describe("labels", () => {
  it("names chords from root and numeral", () => {
    expect(chordName(9, "i", NOTE_NAMES)).toBe("Am");
    expect(chordName(5, "VI", NOTE_NAMES)).toBe("F");
    expect(chordName(11, "ii°", NOTE_NAMES)).toBe("Bdim");
  });
  it("sweep and frequency", () => {
    expect(sweepLabel(0)).toBe("Open");
    expect(sweepLabel(-0.4)).toBe("LP 40");
    expect(sweepLabel(0.25)).toBe("HP 25");
    expect(hzLabel(1800)).toBe("1.8 kHz");
    expect(hzLabel(240.4)).toBe("240 Hz");
  });
});

describe("section strip", () => {
  it("a chosen section goes back to following when it becomes the playing one or disappears", () => {
    expect(keepChosen(null, 1, 4)).toBe(null);
    expect(keepChosen(2, 1, 4)).toBe(2);
    expect(keepChosen(2, 2, 4)).toBe(null);
    expect(keepChosen(3, 0, 3)).toBe(null);
  });
  it("following: the playing section is marked playing, not edited", () => {
    const base = { chosen: null, playing: 1, edit: 1, running: true };
    expect(stripState(1, { ...base, name: "Groove" })).toEqual({ isPlaying: true, isEdit: false, sub: "Playing" });
    expect(stripState(0, { ...base, name: "Intro" })).toEqual({ isPlaying: false, isEdit: false, sub: "Intro" });
  });
  it("a chosen section is marked editing; the playing one still says playing", () => {
    const base = { chosen: 2, playing: 1, edit: 2, running: true };
    expect(stripState(2, { ...base, name: "Break" })).toEqual({ isPlaying: false, isEdit: true, sub: "Editing" });
    expect(stripState(1, { ...base, name: "Groove" })).toEqual({ isPlaying: true, isEdit: false, sub: "Playing" });
  });
  it("stopped: the start section shows its name, and editing another shows Editing", () => {
    expect(stripState(0, { chosen: null, playing: 0, edit: 0, running: false, name: "Intro" })).toEqual({
      isPlaying: true,
      isEdit: false,
      sub: "Intro",
    });
    expect(stripState(3, { chosen: 3, playing: 0, edit: 3, running: false, name: "Drop" }).sub).toBe("Editing");
  });
});

describe("patch knobs (G3)", () => {
  it("time dials are exponential and round-trip; amounts are 0..1", () => {
    const k = { key: "attack" as const, label: "A", seconds: [0.002, 2] as [number, number] };
    expect(knobValue(k, 0)).toBeCloseTo(0.002);
    expect(knobValue(k, 1)).toBeCloseTo(2);
    expect(knobValue(k, 0.5)).toBeCloseTo(Math.sqrt(0.004));
    for (const p of [0, 0.25, 0.7, 1]) expect(knobPos(k, knobValue(k, p))).toBeCloseTo(p);
    expect(knobPos(k, 0.0001)).toBe(0);
    expect(knobPos(k, 10)).toBe(1);
    const a = { key: "drive" as const, label: "D" };
    expect(knobValue(a, 0.3)).toBe(0.3);
    expect(knobText(a, 0.42)).toBe("42");
    expect(knobText(k, 0.004)).toBe("4 ms");
    expect(secondsLabel(1.25)).toBe("1.3 s");
  });
  it("no page holds more than six dials, and every dial names a patch key", () => {
    for (const [inst, pages] of Object.entries(KNOB_PAGES)) {
      for (const p of pages!) {
        expect(p.knobs.length, inst).toBeLessThanOrEqual(6);
        for (const k of p.knobs) expect(PATCH_KEYS).toContain(k.key);
      }
    }
    expect(KNOB_PAGES.drums).toHaveLength(2);
    const drumKeys = KNOB_PAGES.drums!.flatMap((p) => p.knobs.map((k) => k.key));
    for (const k of ["kickLevel", "kickDecay", "clapLevel", "clapDecay", "hatLevel", "hatDecay", "openLevel", "openDecay", "pitch", "drive"])
      expect(drumKeys).toContain(k);
  });
  it("paginate splits by six", () => {
    expect(paginate([1, 2, 3, 4, 5, 6, 7, 8]).map((p) => p.length)).toEqual([6, 2]);
    expect(paginate([])).toEqual([[]]);
  });
  it("meter maps -60..0 dB to 0..1", () => {
    expect(meterFraction(-Infinity)).toBe(0);
    expect(meterFraction(-30)).toBe(0.5);
    expect(meterFraction(3)).toBe(1);
  });
});

describe("layer tab (G4)", () => {
  it("six generative knobs, the spec's, in the design's order", () => {
    expect(GEN_KNOBS.map((k) => k.key)).toEqual(["lock", "hits", "length", "tension", "density", "rotate"]);
  });
  it("whole-number knobs show their value, amounts show 0..100", () => {
    const hits = GEN_KNOBS.find((k) => k.key === "hits")!;
    const lock = GEN_KNOBS.find((k) => k.key === "lock")!;
    expect(genText(hits, 7)).toBe("7");
    expect(genText(lock, 0.82)).toBe("82");
    expect(genText(lock, LOCK_FROZEN)).toBe("100"); // 100 on the dial is frozen
  });
  it("no layer page has more than six dials", () => {
    expect(GEN_KNOBS.length).toBeLessThanOrEqual(6);
    expect(PAD_KNOBS.length).toBeLessThanOrEqual(6);
    expect(LAYER_PATCH_KNOBS.length).toBeLessThanOrEqual(6);
  });
  it("lead row cells: hit, skipped hit, playing step", () => {
    expect(leadCellClass(false, false, false)).toBe("st");
    expect(leadCellClass(true, true, false)).toBe("st h");
    expect(leadCellClass(true, false, true)).toBe("st h lo now");
  });
  it("pad times map both ways on their curve", () => {
    for (const k of PAD_KNOBS) for (const p of [0, 0.3, 1]) expect(knobPos(k, knobValue(k, p))).toBeCloseTo(p);
  });
});
