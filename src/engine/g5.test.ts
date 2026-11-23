import { describe, expect, it } from "vitest";
import { checkEvents, COALESCE_BEATS, coalesceKey, LogWriter, MAX_EVENTS } from "./eventlog.ts";
import { cloneSong, defaultSong, parseSong, serializeSong, validateSong, type EventLog, type Song } from "./song.ts";

const logOf = (events: EventLog["events"]): EventLog => ({
  recorded: "2026-11-23T10:00:00.000Z",
  seconds: 12.5,
  section: 1,
  start: defaultSong(),
  events,
});

describe("event log writer", () => {
  it("logs edits with their beat, rounded to a thousandth", () => {
    const w = new LogWriter();
    w.push(1.23456, "toggleInstrument", [1, "bass"]);
    w.push(4, "switchSection", [2]);
    expect(w.events).toEqual([
      { b: 1.235, op: "toggleInstrument", a: [1, "bass"] },
      { b: 4, op: "switchSection", a: [2] },
    ]);
  });

  it("merges moves of one knob closer than a 32nd, keeping the last value", () => {
    const w = new LogWriter();
    w.push(0, "setParam", ["synth", "cutoff", 0.1]);
    w.push(0.05, "setParam", ["synth", "cutoff", 0.2]);
    w.push(0.1, "setParam", ["synth", "cutoff", 0.3]);
    expect(w.events).toEqual([{ b: 0, op: "setParam", a: ["synth", "cutoff", 0.3] }]);
    w.push(0.1 + COALESCE_BEATS, "setParam", ["synth", "cutoff", 0.4]);
    expect(w.events).toHaveLength(2);
  });

  it("never merges different knobs, or toggles", () => {
    const w = new LogWriter();
    w.push(0, "setParam", ["synth", "cutoff", 0.1]);
    w.push(0.01, "setParam", ["synth", "resonance", 0.2]);
    w.push(0.02, "setParam", ["synth", "cutoff", 0.3]);
    w.push(0.03, "toggleInstrument", [0, "bass"]);
    w.push(0.04, "toggleInstrument", [0, "bass"]);
    expect(w.events.map((e) => e.op)).toEqual(["setParam", "setParam", "setParam", "toggleInstrument", "toggleInstrument"]);
  });

  it("copies the arguments, so later edits to the caller's objects do not change the log", () => {
    const w = new LogWriter();
    const vals = { lock: 0.2 };
    w.push(0, "setGen", [0, "layer1", vals]);
    vals.lock = 0.9;
    expect(w.events[0].a[2]).toEqual({ lock: 0.2 });
  });

  it("keeps beats in order when the clock resets (Stop during the tail)", () => {
    const w = new LogWriter();
    w.push(32, "switchSection", [1]);
    w.push(0, "switchSection", [2]);
    expect(w.events[1].b).toBe(32);
    expect(checkEvents(w.events, "e", [])).toBeUndefined();
  });

  it("stops at the cap and counts what it dropped", () => {
    const w = new LogWriter();
    for (let i = 0; i < MAX_EVENTS + 3; i++) w.push(i, "switchSection", [0]);
    expect(w.events).toHaveLength(MAX_EVENTS);
    expect(w.dropped).toBe(3);
  });

  it("keys knob moves by target, not by value", () => {
    expect(coalesceKey("setParams", ["synth", { resonance: 1, cutoff: 0 }])).toBe(coalesceKey("setParams", ["synth", { cutoff: 0.5, resonance: 0 }]));
    expect(coalesceKey("setArp", [0, "layer1", { gate: 0.3 }])).not.toBe(coalesceKey("setArp", [1, "layer1", { gate: 0.3 }]));
    expect(coalesceKey("newSeed", [0, "layer1"])).toBeNull();
  });
});

describe("song document with mix and log", () => {
  it("accepts a song without mix or log (G1 to G4 songs still load)", () => {
    expect(validateSong(defaultSong())).toEqual([]);
  });

  it("round-trips mix and log through JSON", () => {
    const s: Song = { ...defaultSong(), mix: { sweep: -0.4, pump: 0.3, saturation: 0.1 }, log: logOf([{ b: 0, op: "bpm", a: [124] }]) };
    expect(parseSong(serializeSong(s))).toEqual(s);
  });

  it("refuses a bad mix", () => {
    const s = { ...defaultSong(), mix: { sweep: 2, pump: 0.3, saturation: 0 } };
    expect(validateSong(s).join()).toMatch(/mix.sweep/);
  });

  it("refuses a log with unknown ops, beats running back, or a bad start song", () => {
    const bad1 = { ...defaultSong(), log: logOf([{ b: 0, op: "explode" as never, a: [] }]) };
    expect(validateSong(bad1).join()).toMatch(/op: unknown/);
    const bad2 = { ...defaultSong(), log: logOf([{ b: 2, op: "bpm", a: [1] }, { b: 1, op: "bpm", a: [2] }]) };
    expect(validateSong(bad2).join()).toMatch(/never before/);
    const start = cloneSong(defaultSong());
    start.bpm = 500;
    const bad3 = { ...defaultSong(), log: { ...logOf([]), start } };
    expect(validateSong(bad3).join()).toMatch(/log.start.bpm/);
    const nested = { ...defaultSong(), log: { ...logOf([]), start: { ...defaultSong(), log: logOf([]) } } };
    expect(validateSong(nested).join()).toMatch(/must not hold a log/);
  });
});
