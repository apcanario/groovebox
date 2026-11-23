/** P3: styles and the data files (spec 8.2). Every style loads, validates and plays; adding one is one file. */
import { describe, expect, it } from "vitest";
import { Sequencer, type StepResult } from "../engine/sequencer.ts";
import { INSTRUMENTS, LIMITS, defaultSong, validateSong, type InstrumentId } from "../engine/song.ts";
import { FEELS, checkGrid, checkNamed, readData, type BeatDef, type DataFiles, type PatchDef } from "./data.ts";
import {
  BASS_NAMES,
  BASS_PRESETS,
  BASS_RHYTHMS,
  BEAT_NAMES,
  DRUM_PATTERNS,
  DRUM_PRESETS,
  SYNTH_HOLD,
  SYNTH_NAMES,
  SYNTH_PRESETS,
} from "./presets.ts";
import { MOODS, MOOD_TABLE } from "./scales.ts";
import {
  PATCHES,
  checkPatchDef,
  PATCH_IDS,
  STYLES,
  STYLE_IDS,
  readStyles,
  resolvePatch,
  stepVibe,
  styleSong,
  vibeSong,
  vibeStart,
  vibeTiles,
} from "./styles.ts";
import { freeName } from "../store/library.ts";
import { PROGRESSIONS, findProgression, progressionsFor } from "./progressions.ts";
import type { Mood } from "./scales.ts";

const LAUNCH = ["Deep house", "Tropical house", "Deep techno", "Melodic techno", "Drum and bass", "2-step", "Lo-fi", "Ambient"];

/** Which instruments play at least one note in `bars` bars of a section. */
function heard(seq: Sequencer, bars: number): Set<InstrumentId> {
  const out = new Set<InstrumentId>();
  for (let i = 0; i < 16 * bars; i++) for (const e of seq.next().events) out.add(e.inst);
  return out;
}

const appStyles = import.meta.glob("../styles/*.ts", { eager: true }) as DataFiles;
const fixtureStyles = import.meta.glob("./fixtures/styles/*.ts", { eager: true }) as DataFiles;

describe("the eight launch styles (spec 8.2)", () => {
  it("are the eight of P3, in family order, each named in at most 14 characters", () => {
    expect(STYLE_IDS.map((id) => STYLES[id].name)).toEqual(LAUNCH);
    for (const id of STYLE_IDS) expect(STYLES[id].name.length).toBeLessThanOrEqual(14);
    expect(vibeTiles().map((t) => t.family)).toEqual(["house", "house", "techno", "techno", "breaks", "breaks", "slow", "slow"]);
  });

  it("each sets everything: a valid song with bpm, key, mood, five patches, mix and four arranged sections", () => {
    for (const id of STYLE_IDS) {
      const song = vibeSong(id)!;
      expect(validateSong(song), id).toEqual([]);
      expect(song.style).toBe(id);
      expect(song.sections.map((s) => s.name)).toEqual(["Intro", "Groove", "Break", "Outro"]);
      expect(song.mix).toEqual(STYLES[id].mix);
      expect(song.bpm).toBeGreaterThanOrEqual(LIMITS.bpm[0]);
      // Different instruments on in each section, and every instrument on in the groove.
      const ons = song.sections.map((s) => INSTRUMENTS.filter((i) => s.on[i]).join());
      expect(new Set(ons).size, id).toBeGreaterThan(2);
      expect(INSTRUMENTS.every((i) => song.sections[vibeStart(id)].on[i]), id).toBe(true);
    }
  });

  it("each plays every instrument in its groove section (tested over two bars)", () => {
    for (const id of STYLE_IDS) {
      const seq = new Sequencer(vibeSong(id)!);
      seq.load(seq.song, vibeStart(id));
      seq.start();
      expect([...heard(seq, 2)].sort(), id).toEqual([...INSTRUMENTS].sort());
    }
  });

  it("loads the same notes every time (seeds come from the style, not from chance)", () => {
    for (const id of STYLE_IDS) expect(vibeSong(id)).toEqual(vibeSong(id));
    const a = vibeSong(STYLE_IDS[0])!;
    const b = vibeSong(STYLE_IDS[1])!;
    expect(a.sections[1].layer1.gen.seed).not.toBe(b.sections[1].layer1.gen.seed);
  });

  it("Ambient sits under the old 80 bpm floor and Lo-fi at it: the range is 60 to 180", () => {
    expect(LIMITS.bpm).toEqual([60, 180]);
    expect(STYLES.ambient.bpm).toBeLessThan(80);
    expect(STYLES.loFi.bpm).toBeLessThanOrEqual(80);
    expect(validateSong({ ...defaultSong(), bpm: 60 })).toEqual([]);
    expect(validateSong({ ...defaultSong(), bpm: 59 })).not.toEqual([]);
  });
});

describe("patch files (P3 review M2)", () => {
  it("every patch file's values are range-checked when read, used by a style or not", () => {
    for (const id of PATCH_IDS) expect(checkPatchDef(PATCHES[id])).toEqual([]);
    const bad: PatchDef = { order: 9, name: "Bad", instrument: "synth", values: { cutoff: 5 } };
    expect(checkPatchDef(bad)).toEqual(["values.cutoff: must be 0..1"]);
    expect(checkPatchDef({ ...bad, instrument: "layer", values: { wave: "noise" as never } })).toEqual(["values.wave: unknown wave"]);
  });
});

describe("adding a style is one new file (spec 8.2)", () => {
  it("a style file dropped in the folder is listed, loads and plays, with no other change", () => {
    const withFixture = readStyles({ ...appStyles, ...fixtureStyles });
    expect(withFixture.ids).toContain("progressive");
    expect(STYLE_IDS).not.toContain("progressive");
    const tiles = vibeTiles(withFixture.ids, withFixture.byId);
    expect(tiles.map((t) => t.name)).toEqual([...LAUNCH, "Test vibe"]);
    const song = styleSong("progressive", withFixture.byId.progressive);
    expect(validateSong(song)).toEqual([]);
    const seq = new Sequencer(song);
    seq.load(song, 1);
    seq.start();
    expect([...heard(seq, 1)].sort()).toEqual([...INSTRUMENTS].sort());
    expect(stepVibe("ambient", 1, tiles)).toBe("progressive");
  });

  it("the dropped-in style also passes the P4 library checks: four cards per feel, every section a progression tagged with it", () => {
    const withFixture = readStyles({ ...appStyles, ...fixtureStyles });
    const problems: string[] = [];
    for (const id of withFixture.ids) {
      for (const f of FEELS) if (progressionsFor(id, f).length < 4) problems.push(`${id}/${f}: ${progressionsFor(id, f).length}`);
      const style = withFixture.byId[id];
      style.sections.forEach((s, i) => {
        const found = findProgression(style.mood as Mood, s.chords.map(([degree, bars]) => ({ degree, bars })));
        if (!found) problems.push(`${id} section ${i}: not in the library`);
        else if (!PROGRESSIONS[found].vibes.includes(id)) problems.push(`${id} section ${i}: ${found} is not tagged ${id}`);
      });
    }
    expect(withFixture.ids.length).toBe(STYLE_IDS.length + 1);
    expect(problems).toEqual([]);
  });

  it("a broken style file is refused, naming the file and the problem", () => {
    const bad = { "../styles/bad.ts": { default: { ...STYLES.deepHouse, sections: STYLES.deepHouse.sections.map((s) => ({ ...s, beat: "polka" })) } } };
    expect(() => readStyles(bad)).toThrow(/bad\.ts: .*beat: unknown polka/);
    const long = { "../styles/long.ts": { default: { ...STYLES.deepHouse, name: "A name far too long" } } };
    expect(() => readStyles(long)).toThrow(/long\.ts: name/);
  });

  it("a beat file dropped in its folder is read like the others", () => {
    const beats = readData<BeatDef>(
      { ...import.meta.glob("../data/beats/*.ts", { eager: true }), ...import.meta.glob("./fixtures/beats/*.ts", { eager: true }) },
      (e) => {
        const out = checkNamed(e);
        checkGrid(e.grid, out);
        return out;
      },
    );
    expect(beats.ids).toEqual([...DRUM_PRESETS.filter((id) => beats.byId[id].order < 50), "testBeat", ...DRUM_PRESETS.filter((id) => beats.byId[id].order > 50)]);
    expect(beats.byId.testBeat.grid.kick[6]).toBe(1);
  });
});

describe("presets as data (P3)", () => {
  it("keeps every preset id saved songs use, with their names", () => {
    for (const id of ["fourFloor", "houseShuffle", "techno", "twoStep", "dnb"]) expect(DRUM_PRESETS).toContain(id);
    for (const id of ["offbeat", "rolling", "long", "dnbSub"]) expect(BASS_PRESETS).toContain(id);
    for (const id of ["stabs", "offbeat", "sustained"]) expect(SYNTH_PRESETS).toContain(id);
    expect(MOODS).toEqual(["major", "minor", "house", "deep", "dark"]);
    expect(MOOD_TABLE.deep).toEqual({ scale: "dorian", voicing: "extended", label: "Deep", simple: "Deep", feel: "dreamy" });
    expect(BEAT_NAMES.dnb).toEqual({ name: "DnB", simple: "Breakbeat" });
    expect(BASS_NAMES.dnbSub).toEqual({ name: "DnB sub", simple: "Deep" });
    expect(SYNTH_NAMES.sustained.name).toBe("Held");
    expect([...SYNTH_HOLD]).toEqual(["sustained"]);
  });

  it("the old presets keep their notes", () => {
    expect(DRUM_PATTERNS.fourFloor.grid.kick.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0)).toEqual([0, 4, 8, 12]);
    expect(DRUM_PATTERNS.houseShuffle.swing).toBe(0.18);
    expect(BASS_RHYTHMS.offbeat.map((h) => h.step)).toEqual([2, 6, 10, 14]);
  });

  it("every name is at most 14 characters and every beat, rhythm and patch the styles use exists", () => {
    for (const n of [...Object.values(BEAT_NAMES), ...Object.values(BASS_NAMES), ...Object.values(SYNTH_NAMES)]) {
      expect(n.name.length).toBeLessThanOrEqual(14);
      expect(n.simple.length).toBeLessThanOrEqual(14);
    }
    for (const id of PATCH_IDS) expect(PATCHES[id].name.length).toBeLessThanOrEqual(14);
  });

  it("a patch lays its values over the instrument's defaults, and a style's changes over the patch", () => {
    const p = resolvePatch("layer2", { patch: "warmPad", set: { cutoff: 0.2 } });
    expect(p.cutoff).toBe(0.2);
    expect(p.reverb).toBe(PATCHES.warmPad.values.reverb);
    expect(() => resolvePatch("bass", "warmPad")).toThrow(/for layer/);
    expect(() => resolvePatch("bass", "nothing")).toThrow(/unknown patch/);
  });
});

describe("the vibe arrows and names", () => {
  it("step to the next and previous vibe, wrapping; from no vibe to the first or last", () => {
    expect(stepVibe("deepHouse", 1)).toBe("tropicalHouse");
    expect(stepVibe("deepHouse", -1)).toBe("ambient");
    expect(stepVibe("ambient", 1)).toBe("deepHouse");
    expect(stepVibe(undefined, 1)).toBe("deepHouse");
    expect(stepVibe(undefined, -1)).toBe("ambient");
  });

  it("a vibe loaded again gets a free name, so the jam it replaces stays apart in Songs", () => {
    expect(freeName("Deep house", [])).toBe("Deep house");
    expect(freeName("Deep house", ["Deep house", "deep house 2"])).toBe("Deep house 3");
    expect(freeName("W".repeat(24), ["W".repeat(24)]).length).toBeLessThanOrEqual(24);
  });
});

describe("a song queued for the bar line (P3: a vibe loaded mid-jam)", () => {
  const steps = (seq: Sequencer, n: number): StepResult[] => Array.from({ length: n }, () => seq.next());

  it("lands on the next bar line, not before, starting in its section; toggles queued for the old song drop", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    steps(seq, 5);
    const vibe = vibeSong("deepTechno")!;
    seq.queueSong(vibe, 1);
    seq.toggleInstrument(seq.section, "bass");
    expect(seq.songQueued).toBe(true);
    const before = steps(seq, 11);
    expect(before.every((r) => !r.loaded && r.section === 0)).toBe(true);
    expect(seq.song.style).toBeUndefined();
    const at = seq.next();
    expect(at.step).toBe(0);
    expect(at.loaded).toBe(true);
    expect(at.section).toBe(1);
    expect(at.applied).toEqual({ section: 1, toggles: [] });
    expect(seq.song.style).toBe("deepTechno");
    expect(seq.songQueued).toBe(false);
    expect(seq.pending()).toEqual({ section: null, toggles: [] });
    expect(seq.song.sections[1].on.bass).toBe(true);
  });

  it("a second song queued before the bar line replaces the first; while stopped it loads at once", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    steps(seq, 3);
    seq.queueSong(vibeSong("loFi")!, 1);
    seq.queueSong(vibeSong("ambient")!, 1);
    steps(seq, 14);
    expect(seq.song.style).toBe("ambient");
    seq.stop();
    seq.queueSong(vibeSong("twoStep")!, 2);
    expect(seq.song.style).toBe("twoStep");
    expect(seq.section).toBe(2);
  });

  it("the lanes of the bar before the landing show the old song, the bar after the new one", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    steps(seq, 4);
    seq.queueSong(vibeSong("ambient")!, 1);
    steps(seq, 12);
    expect(seq.lanes(0).section).toBe(0);
    seq.next();
    const lane = seq.lanes(1);
    expect(lane.section).toBe(1);
    expect(lane.on.drums).toBe(true);
  });
});
