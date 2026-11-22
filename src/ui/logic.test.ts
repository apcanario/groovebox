import { describe, expect, it } from "vitest";
import {
  addChord,
  barLabel,
  chooseSection,
  chordName,
  cycleLength,
  dragValue,
  editedSection,
  fraction,
  hzLabel,
  moveChord,
  removeChord,
  replaceChord,
  sweepLabel,
} from "./logic.ts";
import { NOTE_NAMES } from "../music/scales.ts";

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
