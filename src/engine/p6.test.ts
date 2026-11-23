/** P6: the lead's step row (the phrase's bar in the lanes), knobs turned while playing, every vibe's leads. */
import { describe, expect, it } from "vitest";
import { LEAD_SHAPES, LEAD_STYLES, PHRASE_BARS } from "../music/lead.ts";
import { phraseBars } from "../music/leadStyles.ts";
import { createRng } from "../music/random.ts";
import { STYLES, STYLE_IDS, vibeSong } from "../music/styles.ts";
import { Sequencer, STEPS_PER_BAR, type GenValues, type NoteEvent, type StepResult } from "./sequencer.ts";
import { defaultSong } from "./song.ts";

type LayerEvent = Extract<NoteEvent, { inst: "layer1" | "layer2" }>;

function playing(gen: GenValues, on = true): Sequencer {
  const song = defaultSong();
  const s = song.sections[1];
  s.on.layer1 = on;
  s.layer1.mode = "generative";
  const seq = new Sequencer(song);
  expect(seq.setGen(1, "layer1", gen)).toBe(true);
  seq.switchSection(1);
  seq.start();
  return seq;
}
const bar = (seq: Sequencer): StepResult[] => Array.from({ length: STEPS_PER_BAR }, () => seq.next());

describe("the step row: the phrase's bar in the lanes (P6)", () => {
  it("counts the bars of the phrase in every style, bar after bar", () => {
    for (const style of LEAD_STYLES)
      for (const phrase of PHRASE_BARS) {
        const seq = playing({ style, phrase });
        const of = style === "phrase" ? Math.max(2, phrase) : phrase;
        expect(phraseBars(seq.song.sections[1].layer1.gen)).toBe(of);
        for (let b = 0; b < 2 * of + 1; b++) {
          bar(seq);
          // The bar just scheduled.
          expect(seq.lanes(b).phrase.layer1, `${style} ${phrase} bar ${b}`).toEqual({ bar: b % of, of });
        }
      }
  });

  it("stopped, the lane shows the first bar of the phrase", () => {
    const song = defaultSong();
    song.sections[0].layer1.mode = "generative";
    song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, style: "hook", phrase: 2 };
    expect(new Sequencer(song).lanes().phrase.layer1).toEqual({ bar: 0, of: 2 });
  });

  it("a layer that is off still shows a phrase bar: the bar its greyed notes come from", () => {
    const seq = playing({ style: "roll", phrase: 4 }, false);
    for (let b = 0; b < 3; b++) bar(seq);
    expect(seq.lanes(2).phrase.layer1).toEqual({ bar: 0, of: 4 });
  });

  it("a layer not in Lead shows no phrase; another section starts at its first bar", () => {
    const seq = playing({ style: "hook", phrase: 4 });
    seq.song.sections[1].layer2.mode = "pad";
    expect(seq.lanes().phrase.layer2).toBeNull();
    const other = seq.song.sections[2];
    other.on.layer1 = true;
    other.layer1.mode = "generative";
    other.layer1.gen = { ...other.layer1.gen, style: "hook", phrase: 4 };
    bar(seq);
    bar(seq);
    expect(seq.lanes(1).phrase.layer1).toEqual({ bar: 1, of: 4 });
    seq.switchSection(2);
    bar(seq);
    expect(seq.lanes(2).phrase.layer1).toEqual({ bar: 0, of: 4 });
  });

  it("the Phrase knob turned mid-phrase shows at once", () => {
    const seq = playing({ style: "hook", phrase: 4 });
    bar(seq);
    bar(seq);
    bar(seq);
    seq.setGen(1, "layer1", { phrase: 2 });
    expect(seq.lanes(2).phrase.layer1).toEqual({ bar: 0, of: 2 });
  });
});

describe("every lead knob turned while playing (P6)", () => {
  // A knob moved on every step, in every style, for many bars: every note the lead plays has a finite, positive
  // length (so the voice lets it go: no stuck note), a pitch in the lead's range and a level in 0..1.
  const KNOBS: [keyof GenValues, (r: () => number) => unknown][] = [
    ["density", (r) => r()],
    ["lock", (r) => r()],
    ["shape", (r) => LEAD_SHAPES[Math.floor(r() * LEAD_SHAPES.length)]],
    ["range", (r) => r()],
    ["register", (r) => r()],
    ["tension", (r) => r()],
    ["noteLength", (r) => r()],
    ["phrase", (r) => PHRASE_BARS[Math.floor(r() * PHRASE_BARS.length)]],
    ["variation", (r) => r()],
    ["repeats", (r) => r()],
    ["slide", (r) => r()],
    ["accent", (r) => r()],
    ["hits", (r) => 1 + Math.floor(r() * 16)],
    ["rotate", (r) => Math.floor(r() * 16)],
    ["length", (r) => 2 + Math.floor(r() * 15)],
  ];

  it("no note without an end, out of range or out of level, in any style", () => {
    const rng = createRng(606);
    const r = () => rng.next();
    for (const style of LEAD_STYLES) {
      const seq = playing({ style, density: 1 });
      let notes = 0;
      for (let step = 0; step < 16 * 24; step++) {
        const [key, value] = KNOBS[step % KNOBS.length];
        expect(seq.setGen(1, "layer1", { [key]: value(r) } as GenValues)).toBe(true);
        // A style switch now and then, as the style row does.
        if (step % 37 === 0) seq.setGen(1, "layer1", { style: LEAD_STYLES[Math.floor(r() * LEAD_STYLES.length)] });
        for (const e of seq.next().events) {
          if (e.inst !== "layer1") continue;
          const ev = e as LayerEvent;
          notes++;
          expect(Number.isFinite(ev.len) && ev.len > 0, `${style} len ${ev.len}`).toBe(true);
          expect(ev.len).toBeLessThanOrEqual(16 * 8);
          for (const m of ev.notes) expect(m >= 36 && m <= 96, `${style} midi ${m}`).toBe(true);
          expect(ev.vel > 0 && ev.vel <= 1, `${style} vel ${ev.vel}`).toBe(true);
          if (ev.glideFrom !== undefined) expect(Number.isFinite(ev.glideFrom)).toBe(true);
        }
      }
      expect(notes, style).toBeGreaterThan(0);
    }
  });
});

describe("every vibe's leads (P6)", () => {
  it("each vibe gives both layers a lead style, in every section, and plays it where the layer is in Lead", () => {
    for (const id of STYLE_IDS) {
      const def = STYLES[id];
      const song = vibeSong(id)!;
      for (const lid of ["layer1", "layer2"] as const) {
        expect(LEAD_STYLES, `${id} ${lid}`).toContain(def.leads[lid].style);
        for (const [i, s] of song.sections.entries()) {
          const want = def.sections[i][lid].gen?.style ?? def.leads[lid].style;
          expect(s[lid].gen.style, `${id} ${lid} section ${i}`).toBe(want);
        }
      }
    }
  });

  it("the eight launch vibes do not all lead the same way: at least four styles among their lead layers", () => {
    const used = new Set<string>();
    for (const id of STYLE_IDS) {
      const song = vibeSong(id)!;
      for (const s of song.sections) for (const lid of ["layer1", "layer2"] as const) if (s[lid].mode === "generative") used.add(s[lid].gen.style!);
    }
    expect(used.size).toBeGreaterThanOrEqual(4);
  });
});
