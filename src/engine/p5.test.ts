/** P5: the lead styles in the sequencer and the song document. */
import { describe, expect, it } from "vitest";
import { LEAD_STYLES } from "../music/lead.ts";
import { Sequencer, type NoteEvent, type StepResult } from "./sequencer.ts";
import { defaultSong, parseSong, serializeSong, validateSong } from "./song.ts";

type LayerEvent = Extract<NoteEvent, { inst: "layer1" | "layer2" }>;
const leadEvents = (rs: StepResult[]): LayerEvent[] =>
  rs.flatMap((r) => r.events.filter((e): e is LayerEvent => e.inst === "layer1" && e.mode === "generative"));

function playing(gen: Record<string, unknown>): Sequencer {
  const song = defaultSong();
  const s = song.sections[1];
  s.on.layer1 = true;
  s.layer1.mode = "generative";
  const seq = new Sequencer(song);
  expect(seq.setGen(1, "layer1", gen)).toBe(true);
  seq.switchSection(1);
  seq.start();
  return seq;
}
const run = (seq: Sequencer, steps: number): StepResult[] => Array.from({ length: steps }, () => seq.next());

describe("lead styles in the sequencer (P5)", () => {
  it("every style plays in the sequencer", () => {
    for (const style of LEAD_STYLES) expect(leadEvents(run(playing({ style }), 64)).length, style).toBeGreaterThan(0);
  });

  it("slides, accents and repeats reach the layer's events", () => {
    const ev = leadEvents(run(playing({ style: "roll", slide: 1, accent: 1, repeats: 1, density: 1 }), 64));
    expect(ev.some((e) => e.glideFrom !== undefined)).toBe(true);
    expect(ev.every((e) => e.accent)).toBe(true);
    expect(ev.every((e) => e.repeat === 2 || e.repeat === 3)).toBe(true);
    const none = leadEvents(run(playing({ style: "roll", slide: 0, accent: 0, repeats: 0 }), 64));
    expect(none.some((e) => e.glideFrom !== undefined || e.accent || e.repeat)).toBe(false);
  });

  it("note lengths come from the style: Drift holds for two beats or more", () => {
    const ev = leadEvents(run(playing({ style: "drift" }), 128));
    for (const e of ev) expect(e.len).toBeGreaterThanOrEqual(8);
  });

  it("a song without P5 values plays its lead as before, a sixteenth's 0.8 per note", () => {
    const ev = leadEvents(run(playing({}), 64));
    expect(ev.length).toBeGreaterThan(0);
    for (const e of ev) {
      expect(e.len).toBe(0.8);
      expect(e.glideFrom === undefined && !e.accent && !e.repeat).toBe(true);
    }
  });

  it("setGen takes the style, Shape and Phrase selectors and the 0..1 knobs, and refuses anything else", () => {
    const seq = new Sequencer(defaultSong());
    expect(seq.setGen(0, "layer1", { style: "hook", shape: "valley", phrase: 8, range: 2, accent: -1 })).toBe(true);
    const g = seq.song.sections[0].layer1.gen;
    expect([g.style, g.shape, g.phrase, g.range, g.accent]).toEqual(["hook", "valley", 8, 1, 0]);
    expect(seq.setGen(0, "layer1", { style: "jazz" } as never)).toBe(false);
    expect(seq.setGen(0, "layer1", { shape: "spiral" } as never)).toBe(false);
    expect(seq.setGen(0, "layer1", { phrase: 3 } as never)).toBe(false);
    expect(seq.setGen(0, "layer1", { slide: "lots" } as never)).toBe(false);
    expect(seq.setGen(0, "layer1", { colour: 1 } as never)).toBe(false);
  });

  it("the song keeps the lead's style and knobs, and refuses bad ones", () => {
    const song = defaultSong();
    song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, style: "phrase", shape: "rise", phrase: 2, noteLength: 0.3, variation: 0.7, repeats: 0.1, slide: 0.2, accent: 0.4, range: 0.5, register: 0.2 };
    expect(validateSong(song)).toEqual([]);
    expect(parseSong(serializeSong(song)).sections[0].layer1.gen).toEqual(song.sections[0].layer1.gen);
    for (const [k, v] of [["style", "jazz"], ["shape", "spiral"], ["phrase", 3], ["slide", 2], ["register", -0.1]] as const) {
      const bad = defaultSong();
      (bad.sections[0].layer1.gen as unknown as Record<string, unknown>)[k] = v;
      expect(validateSong(bad).length, k).toBeGreaterThan(0);
    }
  });
});
