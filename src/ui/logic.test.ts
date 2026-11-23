import { describe, expect, it } from "vitest";
import { LOCK_FROZEN } from "../music/lead.ts";
import {
  addChord,
  chipPage,
  LEAD_PAGES,
  leadDialSet,
  leadDialText,
  leadDialValue,
  phraseSegments,
  LAYER_PATCH_KNOBS,
  PAD_KNOBS,
  barLabel,
  beatLights,
  chordName,
  cycleLength,
  dragValue,
  editedSection,
  editWithoutPlaying,
  fitSize,
  shownPage,
  withFilterPage,
  fraction,
  hzLabel,
  keepChosen,
  KNOB_PAGES,
  knobPos,
  knobText,
  knobValue,
  meterFraction,
  paginate,
  knobLabel,
  moveChord,
  removeChord,
  replaceChord,
  stripState,
  stripWord,
  STRIP_WORD_PX,
  textPx,
  plays,
  nowTile,
  sweepLabel,
} from "./logic.ts";
import { NOTE_NAMES } from "../music/scales.ts";
import { defaultSong, PATCH_KEYS, type ChordStep } from "../engine/song.ts";
import { Sequencer } from "../engine/sequencer.ts";
import { InFlight } from "../engine/queue.ts";

const seq: ChordStep[] = [
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
  });
  it("edit without playing is Advanced only, and never the playing section", () => {
    expect(editWithoutPlaying(3, 1, true)).toBe(3);
    expect(editWithoutPlaying(1, 1, true)).toBe(null);
    expect(editWithoutPlaying(3, 1, false)).toBe(null);
  });
  it("beat lights: lit up to the beat playing, the bar line lights only the first, dark when stopped", () => {
    expect(beatLights(true, 0)).toEqual([true, false, false, false]);
    expect(beatLights(true, 9)).toEqual([true, true, true, false]);
    expect(beatLights(true, 15)).toEqual([true, true, true, true]);
    expect(beatLights(false, 9)).toEqual([false, false, false, false]);
  });
  it("text fit: the largest size that fits, never under 10 px", () => {
    expect(fitSize(15, (px) => px * 6 <= 70)).toBe(11.5);
    expect(fitSize(15, () => true)).toBe(15);
    expect(fitSize(15, () => false)).toBe(10);
    expect(fitSize(15, (px) => px <= 9)).toBe(10);
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
  it("cycles length 1, 2, 4, 8, half (P7 adds 4 and 8 bars)", () => {
    expect(cycleLength(seq, 0)[0].bars).toBe(2);
    expect(cycleLength(seq, 1)[1].bars).toBe(4);
    expect(cycleLength(cycleLength(seq, 1), 1)[1].bars).toBe(8);
    expect(cycleLength(cycleLength(cycleLength(seq, 1), 1), 1)[1].bars).toBe(0.5);
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
  it("following: the playing section says Playing while running, the others their names", () => {
    const base = { chosen: null, playing: 1, running: true, queued: null };
    expect(stripState(1, { ...base, name: "Groove" })).toEqual({ isPlaying: true, isNext: false, isEdit: false, sub: "Playing" });
    expect(stripState(0, { ...base, name: "Intro" })).toEqual({ isPlaying: false, isNext: false, isEdit: false, sub: "Intro" });
  });
  it("a tapped section says Next bar until the bar line", () => {
    const base = { chosen: null, playing: 1, running: true, queued: 2 };
    expect(stripState(2, { ...base, name: "Break" })).toEqual({ isPlaying: false, isNext: true, isEdit: false, sub: "Next bar" });
    expect(stripState(1, { ...base, name: "Groove" }).sub).toBe("Playing");
  });
  it("a section edited without playing says Editing; queued wins over editing", () => {
    const base = { chosen: 3, playing: 1, running: true, queued: null };
    expect(stripState(3, { ...base, name: "Outro" })).toEqual({ isPlaying: false, isNext: false, isEdit: true, sub: "Editing" });
    expect(stripState(3, { ...base, queued: 3, name: "Outro" })).toEqual({ isPlaying: false, isNext: true, isEdit: true, sub: "Next bar" });
  });
  it("stopped: the start section shows its name, never Next bar", () => {
    expect(stripState(0, { chosen: null, playing: 0, running: false, queued: 2, name: "Intro" }).sub).toBe("Intro");
    expect(stripState(2, { chosen: null, playing: 0, running: false, queued: 2, name: "Break" }).sub).toBe("Break");
  });
});

describe("strip word (P1 fix E1)", () => {
  it("keeps a name that fits the narrowest tile", () => {
    for (const n of ["Intro", "Groove", "Break", "Outro", "Section D", "Next bar", "Playing", "Editing"]) {
      expect(stripWord(n)).toBe(n);
      expect(textPx(n)).toBeLessThanOrEqual(STRIP_WORD_PX);
    }
  });
  it("cuts a long or wide name to fit, ending in an ellipsis", () => {
    for (const n of ["Breakdown 2", "W".repeat(12), "M".repeat(12), "mmmmmmmmmmmm", "@@@@@@@@@@@@", "ドラムブレイクです"]) {
      const w = stripWord(n);
      expect(w.endsWith("…")).toBe(true);
      expect(textPx(w.slice(0, -1)) + 6).toBeLessThanOrEqual(STRIP_WORD_PX);
      expect(n.startsWith(w.slice(0, -1))).toBe(true);
    }
    expect(stripWord("Breakdown 2")).toBe("Breakdo…");
    expect(stripWord("WWWWWWWWWWWW")).toBe("WWWW…");
  });
  it("keeps at least one letter and drops a trailing space before the ellipsis", () => {
    expect(stripWord("WWWWW", 5)).toBe("W…");
    expect(stripWord("Big drop zone")).toBe("Big drop…");
  });
  it("the strip shows the cut word", () => {
    const base = { chosen: null, playing: 1, running: true, queued: null };
    expect(stripState(0, { ...base, name: "W".repeat(12) }).sub).toBe("WWWW…");
  });
});

describe("plays (P1 fix M4)", () => {
  it("names a preset, an edited preset, a rhythm and a layer mode", () => {
    const song = defaultSong();
    expect(plays(song, 0, "drums")).toBe("Four floor");
    song.sections[0].drums.grid = { kick: Array(16).fill(0) } as unknown as NonNullable<(typeof song.sections)[0]["drums"]["grid"]>;
    expect(plays(song, 0, "drums")).toBe("Four floor, edited");
    expect(plays(song, 2, "bass")).toBe("Long notes");
    expect(plays(song, 1, "synth")).toBe("Stabs");
    expect(plays(song, 0, "layer1")).toBe("Lead");
    expect(plays(song, 2, "layer1")).toBe("Arp");
  });
});

describe("Now tile (P1 fix S2)", () => {
  it("a tap within the lookahead after a switch lands shows Next bar on the tile it toggled", () => {
    const song = defaultSong();
    const seq = new Sequencer(song);
    const inFlight = new InFlight();
    seq.start();
    seq.switchSection(2); // Break
    // The scheduler runs bar 0 and applies the switch on the first step of bar 1, a lookahead before it sounds.
    for (let k = 0; k < 17; k++) {
      const r = seq.next();
      if (r.applied) inFlight.land(r.bar, r.applied);
    }
    const heard = 0; // the listener is still on bar 0, Intro
    expect(seq.section).toBe(2);
    seq.toggleInstrument(seq.section, "bass"); // what toggleInstrumentInPlaying does
    const shown = inFlight.shown(seq.pending());
    const tile = nowTile(seq.song, seq.section, shown, "bass", true);
    expect(tile).toEqual({ on: false, queued: true, sub: "Next bar" });
    // Reading the heard section instead shows no pending mark: the bug this fixes.
    expect(nowTile(seq.song, heard, shown, "bass", true).queued).toBe(false);
  });
  it("stopped: shows what it plays, not Next bar", () => {
    const song = defaultSong();
    expect(nowTile(song, 0, { toggles: [{ section: 0, instrument: "drums" }] }, "drums", false)).toEqual({ on: true, queued: true, sub: "Four floor" });
    expect(nowTile(song, 9, { toggles: [] }, "bass", false).sub).toBe("Rolling"); // clamped to the last section
  });
});

describe("pages (P1)", () => {
  it("short screens get a Filter page; a page that disappears falls back to the first", () => {
    const pages = [["beat", "Beat"], ["kick", "Kick"]] as const;
    expect(withFilterPage(pages, true).map(([k]) => k)).toEqual(["beat", "kick"]);
    expect(withFilterPage(pages, false).map(([k]) => k)).toEqual(["beat", "kick", "filter"]);
    expect(shownPage(withFilterPage(pages, true), "filter")).toBe("beat");
    expect(shownPage(withFilterPage(pages, false), "filter")).toBe("filter");
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
    expect(knobText(k, 0.004)).toBe("4");
    expect(knobText(k, 1.25)).toBe("1250");
    expect(knobLabel({ ...k, label: "Decay" })).toBe("Decay ms");
    expect(knobLabel(a)).toBe("D");
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
  it("the lead's pages: Notes and Feel of six (spec 8.5), Pulse's own three (P6)", () => {
    expect(LEAD_PAGES.notes.map((k) => k.label)).toEqual(["Busy", "Lock", "Shape", "Range", "Register", "Tension"]);
    expect(LEAD_PAGES.feel.map((k) => k.label)).toEqual(["Note length", "Phrase", "Variation", "Repeats", "Slide", "Accent"]);
    expect(LEAD_PAGES.pulse.map((k) => k.key)).toEqual(["hits", "rotate", "length"]);
  });
  it("lead dials show amounts 0..100, Range in octaves, Register in words, the selectors' choice", () => {
    const d = (key: string) => [...LEAD_PAGES.notes, ...LEAD_PAGES.feel, ...LEAD_PAGES.pulse].find((k) => k.key === key)!;
    expect(leadDialText(d("lock"), 0.82)).toBe("82");
    expect(leadDialText(d("lock"), LOCK_FROZEN)).toBe("100"); // 100 on the dial is frozen
    expect(leadDialText(d("hits"), 7)).toBe("7");
    expect(leadDialText(d("range"), 0)).toBe("0.5");
    expect(leadDialText(d("range"), 1)).toBe("3");
    expect(leadDialText(d("register"), 0.1)).toBe("Low");
    expect(leadDialText(d("register"), 0.5)).toBe("Mid");
    expect(leadDialText(d("register"), 0.9)).toBe("High");
    expect(leadDialText(d("shape"), 2)).toBe("Arch");
    expect(leadDialText(d("phrase"), 3)).toBe("8");
    expect(leadDialSet(d("shape"), 4.4)).toEqual({ shape: "zigzag" });
    expect(leadDialSet(d("phrase"), 0)).toEqual({ phrase: 1 });
    expect(leadDialSet(d("slide"), 0.3)).toEqual({ slide: 0.3 });
  });
  it("an unset lead knob reads its style's default; Busy reads the stored density", () => {
    const d = (key: string) => [...LEAD_PAGES.notes, ...LEAD_PAGES.feel].find((k) => k.key === key)!;
    const g = { lock: 0.75, hits: 7, rotate: 0, length: 5, tension: 0.35, density: 0.6, seed: 1, style: "roll" as const };
    expect(leadDialValue(d("density"), g)).toBe(0.6);
    expect(leadDialText(d("shape"), leadDialValue(d("shape"), g))).toBe("Zig"); // Roll's default (Zigzag, shortened to fit)
    expect(leadDialText(d("phrase"), leadDialValue(d("phrase"), g))).toBe("2");
    expect(leadDialText(d("shape"), leadDialValue(d("shape"), { ...g, shape: "fall" }))).toBe("Fall");
  });
  it("the step row's phrase: one segment per bar, the playing one lit", () => {
    expect(phraseSegments({ bar: 1, of: 4 })).toEqual([false, true, false, false]);
    expect(phraseSegments(null)).toBeNull();
  });
  it("no layer page has more than six dials", () => {
    for (const page of Object.values(LEAD_PAGES)) expect(page.length).toBeLessThanOrEqual(6);
    expect(PAD_KNOBS.length).toBeLessThanOrEqual(6);
    expect(LAYER_PATCH_KNOBS.length).toBeLessThanOrEqual(6);
  });
  it("pad times map both ways on their curve", () => {
    for (const k of PAD_KNOBS) for (const p of [0, 0.3, 1]) expect(knobPos(k, knobValue(k, p))).toBeCloseTo(p);
  });
});

import { clockLabel, sizeLabel } from "./logic.ts";
describe("record labels (G5)", () => {
  it("shows elapsed time as m:ss, then h:mm:ss", () => {
    expect(clockLabel(0)).toBe("0:00");
    expect(clockLabel(7.9)).toBe("0:07");
    expect(clockLabel(754)).toBe("12:34");
    expect(clockLabel(3723)).toBe("1:02:03");
  });
  it("shows sizes in KB under a megabyte, else MB", () => {
    expect(sizeLabel(500)).toBe("1 KB");
    expect(sizeLabel(820 * 1024)).toBe("820 KB");
    expect(sizeLabel(9.6 * 1024 * 1024)).toBe("9.6 MB");
  });
});

describe("chipPage (P3 review M8)", () => {
  const ten = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  it("up to a row of options is one page with no More", () => {
    expect(chipPage(ten.slice(0, 5), "c", 5)).toEqual({ pages: 1, page: 0, shown: ["a", "b", "c", "d", "e"], pad: 0 });
  });
  it("more than a row pages them four at a time, opening on the chosen value's page", () => {
    expect(chipPage(ten, null, 5)).toMatchObject({ pages: 3, page: 0, shown: ["a", "b", "c", "d"], pad: 0 });
    expect(chipPage(ten, "f", 5)).toMatchObject({ page: 1, shown: ["e", "f", "g", "h"] });
    expect(chipPage(ten, "zz", 5).page).toBe(0);
  });
  it("pads the last page so More keeps its place, and wraps", () => {
    expect(chipPage(ten, "j", 5)).toEqual({ pages: 3, page: 2, shown: ["i", "j"], pad: 2 });
    expect(chipPage(ten, "j", 5, 3).page).toBe(0);
    expect(chipPage(ten, null, 5, -1).page).toBe(2);
  });
});
