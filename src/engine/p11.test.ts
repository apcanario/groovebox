/** P11 (spec 8.11): Morph in the engine, played without audio (morphDry runs the scheduler's path bar by bar). */
import { describe, expect, it } from "vitest";
import { Engine, type MorphMade } from "./index.ts";
import { LogWriter, checkEvents } from "./eventlog.ts";
import { Sequencer, STEPS_PER_BAR } from "./sequencer.ts";
import { cloneSong, defaultSong, validateSong, type Song } from "./song.ts";
import { STYLES, STYLE_IDS, vibeSong, vibeStart } from "../music/styles.ts";
import { HANDS_BARS } from "../music/morph.ts";

/** Ten minutes of a vibe, in whole bars. */
const tenMinutes = (id: string): number => Math.ceil(600 / ((4 * 60) / STYLES[id].bpm));

function loaded(id: string, song?: Song): Engine {
  const e = new Engine();
  e.loadSong(song ?? vibeSong(id)!, vibeStart(id));
  return e;
}

/** Bars of the trace that start a 16-bar stretch already heard, note for note and value for value. */
function repeats(sigs: string[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (let i = 0; i + 16 <= sigs.length; i++) {
    const k = sigs.slice(i, i + 16).join(",");
    if (seen.has(k)) out.push(i);
    seen.add(k);
  }
  return out;
}

/** Whether a move of Morph's touches a control (the names of music/morph.ts's controlOf). */
function touches(m: MorphMade, control: string): boolean {
  const [kind, rest] = control.split(":");
  if (kind === "macro") {
    const [inst, id] = rest.split(".");
    if (m.op === "setMacro") return m.a[1] === inst && m.a[2] === id;
    if (m.op === "setParams") {
      const keys = Object.keys(m.a[1] as object);
      return m.a[0] === inst && (id === "bright" ? keys.includes("cutoff") : keys.includes("delay"));
    }
    return false;
  }
  if (kind === "on") return m.op === "toggleInstrument" && m.a[1] === rest;
  if (kind === "voicing") return m.op === "setPad" && m.a[1] === rest;
  if (kind === "lock") return m.op === "setGen" && m.a[1] === rest;
  return m.op === "switchSection";
}

describe("Morph in the engine (P11, spec 8.11)", () => {
  it("ten minutes of Ambient with Morph on never repeat a 16-bar stretch exactly and never leave the key", () => {
    const e = loaded("ambient");
    expect(e.morphPlan().on).toBe(true);
    const bars = tenMinutes("ambient");
    expect(bars).toBe(160);
    const r = e.morphDry(bars)!;
    expect(r.trace).toHaveLength(bars);
    expect(repeats(r.trace.map((t) => t.sig))).toEqual([]);
    expect(r.trace.flatMap((t) => t.out)).toEqual([]);
    expect(r.trace.reduce((a, t) => a + t.notes, 0)).toBeGreaterThan(bars);
    const song = e.getSong();
    expect([song.key, song.mood]).toEqual([STYLES.ambient.key, STYLES.ambient.mood]);
    // Every kind of move it has in Ambient happened: the macros, the voicings, an instrument out and back.
    const ops = new Set(r.moves.map((m) => m.op));
    for (const op of ["setMacro", "setPad", "toggleInstrument"]) expect(ops.has(op as MorphMade["op"]), op).toBe(true);
    expect(validateSong(song)).toEqual([]);
    // The check has teeth: without Morph, Ambient's sixteen-bar loop repeats.
    const still = vibeSong("ambient")!;
    still.morph = { on: false };
    expect(repeats(loaded("ambient", still).morphDry(bars)!.trace.map((t) => t.sig)).length).toBeGreaterThan(0);
  });

  it("Drone too: ten minutes, no stretch repeated, in key", () => {
    const e = loaded("drone");
    const r = e.morphDry(tenMinutes("drone"))!;
    expect(repeats(r.trace.map((t) => t.sig))).toEqual([]);
    expect(r.trace.flatMap((t) => t.out)).toEqual([]);
  });

  it("the same seed gives the same ten minutes twice; another seed another journey", () => {
    const a = loaded("ambient").morphDry(160)!;
    const b = loaded("ambient").morphDry(160)!;
    expect(b.moves).toEqual(a.moves);
    expect(b.trace).toEqual(a.trace);
    const ea = loaded("ambient");
    ea.morphDry(160);
    const eb = loaded("ambient");
    eb.morphDry(160);
    expect(eb.getSong()).toEqual(ea.getSong());
    const other = vibeSong("ambient")!;
    other.morph = { seed: 12345 };
    const c = loaded("ambient", other).morphDry(160)!;
    expect(c.moves).not.toEqual(a.moves);
  });

  it("a control moved by hand is not touched for 16 bars, then Morph takes it up again", () => {
    const e = loaded("ambient");
    const hands = ["macro:synth.bright", "macro:layer1.bright", "macro:layer2.space", "voicing:layer1", "on:drums"];
    const r = e.morphDry(160, (bar) => {
      if (bar !== 40) return;
      e.setMacro(1, "synth", "bright", 0.1);
      e.setParam("layer1", "cutoff", 0.3);
      e.setParams("layer2", { delay: 0.2 });
      e.setPad(1, "layer1", { voicing: 0.5 });
      e.toggleInstrument(1, "drums");
      e.toggleInstrument(1, "drums");
    })!;
    for (const c of hands) {
      const during = r.moves.filter((m) => touches(m, c) && m.bar >= 40 && m.bar < 40 + HANDS_BARS);
      expect(during, c).toEqual([]);
    }
    // The macros were moving before the hand and move again after the 16 bars.
    for (const c of hands.slice(0, 3)) {
      expect(r.moves.some((m) => touches(m, c) && m.bar < 40), c).toBe(true);
      expect(r.moves.some((m) => touches(m, c) && m.bar >= 40 + HANDS_BARS), c).toBe(true);
    }
    // Controls no hand touched kept moving through those bars.
    expect(r.moves.some((m) => touches(m, "macro:synth.space") && m.bar >= 40 && m.bar < 56)).toBe(true);
    // What the hand set stands until Morph takes it up.
    expect(r.moves.find((m) => touches(m, "macro:synth.bright") && m.bar >= 40)!.bar).toBeGreaterThanOrEqual(40 + HANDS_BARS);
  });

  it("Morph off changes nothing: no move, the song document as it was, every vibe", () => {
    for (const id of STYLE_IDS) {
      const song = vibeSong(id)!;
      song.morph = { on: false };
      const e = loaded(id, song);
      const before = e.getDocument();
      const r = e.morphDry(64)!;
      expect(r.moves, id).toEqual([]);
      expect(e.getDocument(), id).toEqual(before);
    }
    // Off by default in a dance vibe and in a song with no vibe.
    expect(loaded("deepHouse").morphDry(64)!.moves).toEqual([]);
    const d = new Engine(defaultSong());
    expect(d.morphPlan().on).toBe(false);
    expect(d.morphDry(64)!.moves).toEqual([]);
  });

  it("Morph off plays the notes the sequencer plays without it", () => {
    // The only change P11 made to the notes is the voicing dial, as written when missing (0.5).
    for (const id of ["ambient", "drone", "deepHouse"]) {
      const song = vibeSong(id)!;
      song.morph = { on: false };
      const seq = new Sequencer(cloneSong(song));
      seq.switchSection(vibeStart(id));
      seq.start();
      const plain = Array.from({ length: 64 * STEPS_PER_BAR }, () => seq.next().events);
      const voiced = cloneSong(song);
      for (const s of voiced.sections) for (const l of ["layer1", "layer2"] as const) s[l].pad.voicing = 0.5;
      const seq2 = new Sequencer(voiced);
      seq2.switchSection(vibeStart(id));
      seq2.start();
      const same = Array.from({ length: 64 * STEPS_PER_BAR }, () => seq2.next().events);
      expect(same, id).toEqual(plain);
    }
  });

  it("switching Morph off stops it from the next bar line; on again, it goes on", () => {
    const e = loaded("ambient");
    const r = e.morphDry(80, (bar) => {
      if (bar === 20) e.setMorph({ on: false });
      if (bar === 50) e.setMorph({ on: true });
    })!;
    expect(r.moves.filter((m) => m.bar >= 20 && m.bar < 50)).toEqual([]);
    expect(r.moves.some((m) => m.bar < 20)).toBe(true);
    expect(r.moves.some((m) => m.bar >= 50)).toBe(true);
    expect(e.getMorphSettings()).toEqual({ on: true });
  });

  it("a drop holds Morph: no move from the press until it ends", () => {
    const e = loaded("ambient");
    const r = e.morphDry(60, (bar) => {
      if (bar === 30) e.drop();
    })!;
    expect(e.dropShown().intent).toBe("on");
    expect(r.moves.filter((m) => m.bar >= 30)).toEqual([]);
    expect(r.moves.some((m) => m.bar < 30)).toBe(true);
  });

  it("the Morph page: settings checked, merged and stored in the song", () => {
    const e = loaded("deepHouse");
    expect(e.setMorph({ speed: 2 })).toBe(false);
    expect(e.setMorph({ moves: { sections: true } })).toBe(true);
    expect(e.setMorph({ on: true, depth: 0.3, moves: { leads: false } })).toBe(true);
    expect(e.getMorphSettings()).toEqual({ on: true, depth: 0.3, moves: { sections: true, leads: false } });
    const p = e.morphPlan();
    expect(p.on && p.moves.sections && !p.moves.leads && p.moves.sound).toBe(true);
    expect(validateSong(e.getDocument())).toEqual([]);
    const bad = { ...e.getDocument(), morph: { speed: 3 } };
    expect(validateSong(bad).length).toBeGreaterThan(0);
  });

  it("a pad's voicing moves its held notes an inversion, in key; the dial is checked", () => {
    const e = loaded("ambient");
    expect(e.setPad(1, "layer1", { voicing: 2 })).toBe(true); // clamped
    expect(e.getSong().sections[1].layer1.pad.voicing).toBe(1);
    expect(e.setPad(1, "layer1", { voicing: 0.667 })).toBe(true);
    const seq = new Sequencer(e.getSong());
    seq.switchSection(1);
    seq.start();
    const first = seq.next().events.find((x) => x.inst === "layer1");
    const plainSeq = new Sequencer(vibeSong("ambient")!);
    plainSeq.switchSection(1);
    plainSeq.start();
    const plain = plainSeq.next().events.find((x) => x.inst === "layer1");
    const notes = (x: typeof first): number[] => (x && "notes" in x ? x.notes : []);
    expect(notes(first)).toEqual([...notes(plain).slice(1), notes(plain)[0] + 12]);
    const bad = cloneSong(e.getSong());
    bad.sections[1].layer1.pad.voicing = 1.5;
    expect(validateSong(bad).length).toBeGreaterThan(0);
  });

  it("Morph's moves are logged as Morph's, never merged with a hand's", () => {
    const w = new LogWriter();
    w.push(1, "setMacro", [1, "synth", "bright", 0.5], "morph");
    w.push(1.01, "setMacro", [1, "synth", "bright", 0.6]);
    w.push(1.02, "setMacro", [1, "synth", "bright", 0.61]);
    expect(w.events).toEqual([
      { b: 1, op: "setMacro", a: [1, "synth", "bright", 0.5], by: "morph" },
      { b: 1.01, op: "setMacro", a: [1, "synth", "bright", 0.61] },
    ]);
    const errors: string[] = [];
    checkEvents(w.events, "events", errors);
    expect(errors).toEqual([]);
    checkEvents([{ b: 0, op: "setMorph", a: [{}], by: "robot" }], "events", errors);
    expect(errors.length).toBe(1);
  });
});
