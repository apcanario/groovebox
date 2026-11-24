/** P9 (spec 8.8): effects as logic: the twelve and their knobs, the slots in the song, the cap, the vibes' slots, the engine's calls. */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FX,
  EFFECTS,
  EFFECT_DEFS,
  FX_SLOTS,
  GATE_PATTERNS,
  MAX_ACTIVE_FX,
  SWEEP_RATES,
  activate,
  crushBits,
  deactivate,
  defaultRack,
  echoBeats,
  formantsAt,
  FORMANTS,
  fxKey,
  gateOpen,
  gateTau,
  squareEdgeSeconds,
  SYNC_RATES,
  mixGains,
  rateHz,
  ringCarrier,
  ringHz,
  shiftHz,
  stepIndex,
  sweepRate,
  vowelSwing,
} from "../music/effects.ts";
import { MAX_DATA_NAME } from "../music/data.ts";
import { STYLES, STYLE_IDS, vibeSong } from "../music/styles.ts";
import { ICON_FOR } from "../ui/icons.tsx";
import { LOG_OPS, coalesceKey } from "./eventlog.ts";
import { Engine } from "./index.ts";
import { INSTRUMENTS, defaultSong, songFx, validateSong, type Song } from "./song.ts";

describe("the twelve effects (spec 8.8)", () => {
  it("are the spec's twelve, each with a name that fits a tile, an icon, three knobs and starting values in range", () => {
    expect(EFFECTS.map((e) => EFFECT_DEFS[e].name)).toEqual(["Chorus", "Phaser", "Flanger", "Fuzz", "Crush", "Tremolo", "Pan", "Gate", "Ring", "Vowel", "Shifter", "Echo"]);
    for (const e of EFFECTS) {
      const d = EFFECT_DEFS[e];
      expect(d.name.length).toBeLessThanOrEqual(MAX_DATA_NAME);
      expect(d.name in ICON_FOR, `${d.name} has an icon`).toBe(true);
      expect(d.knobs).toHaveLength(3);
      for (const v of d.defaults) expect(v >= 0 && v <= 1).toBe(true);
    }
  });

  it("carry the spec's Advanced knobs", () => {
    const want: Record<string, string[]> = {
      chorus: ["Mix", "Rate", "Depth"],
      phaser: ["Mix", "Rate", "Depth"],
      flanger: ["Mix", "Rate", "Feedback"],
      fuzz: ["Amount", "Tone", "Mix"],
      crush: ["Bits", "Rate", "Mix"],
      tremolo: ["Depth", "Rate", "Shape"],
      pan: ["Depth", "Rate", "Shape"],
      gate: ["Pattern", "Depth", "Smooth"],
      ring: ["Mix", "Pitch", "Follow"],
      vowel: ["Mix", "Vowel", "Rate"],
      shifter: ["Mix", "Shift", "Feedback"],
      echo: ["Mix", "Time", "Feedback"],
    };
    for (const e of EFFECTS) expect(EFFECT_DEFS[e].knobs.map((k) => k.label)).toEqual(want[e]);
  });

  it("show every knob value in at most six characters (a dial's hole)", () => {
    for (const e of EFFECTS)
      for (const k of EFFECT_DEFS[e].knobs)
        for (let v = 0; v <= 1.0001; v += 0.05) expect(k.text(v).length, `${e} ${k.label} at ${v.toFixed(2)}: ${k.text(v)}`).toBeLessThanOrEqual(6);
  });

  it("map knobs to what the engine sets", () => {
    expect(stepIndex(0, 5)).toBe(0);
    expect(stepIndex(1, 5)).toBe(4);
    expect(crushBits(0)).toBe(2);
    expect(crushBits(1)).toBe(12);
    expect(shiftHz(0.5)).toBe(0);
    expect(shiftHz(1)).toBeCloseTo(600);
    expect(shiftHz(0)).toBeCloseTo(-600);
    expect(echoBeats(0)).toBe(0.25);
    expect(echoBeats(1)).toBe(2);
    const [d, w] = mixGains(1, true);
    expect(d).toBeCloseTo(w);
    expect(mixGains(0)).toEqual([1, 0]);
    // Ring's Follow: the carrier's own pitch at 0, the note at 1, nothing to follow without a note.
    expect(ringCarrier(0.5, 0, 220)).toBeCloseTo(ringHz(0.5));
    expect(ringCarrier(0.5, 1, 220)).toBeCloseTo(220);
    expect(ringCarrier(0.5, 1, null)).toBeCloseTo(ringHz(0.5));
    // Vowel: A at 0, U at 1; the swing goes to a neighbour.
    expect(formantsAt(0)).toEqual([...FORMANTS[0]]);
    expect(formantsAt(1).map(Math.round)).toEqual([...FORMANTS[4]]);
    expect(vowelSwing(1)).toBeCloseTo(0.75);
    expect(vowelSwing(0)).toBeCloseTo(0.25);
  });

  it("tie the moving effects to the tempo (spec 8.8: Tremolo, Pan, Gate; Phaser and Flanger at a note value)", () => {
    // A note value's rate doubles with the tempo; a free rate does not move.
    const note = SWEEP_RATES.find((r) => "beats" in r)!;
    expect(rateHz(note, 120)).toBeCloseTo(2 * rateHz(note, 60));
    const free = SWEEP_RATES.find((r) => "hz" in r)!;
    expect(rateHz(free, 120)).toBe(rateHz(free, 60));
    expect("beats" in sweepRate(1)).toBe(true);
    expect("hz" in sweepRate(0)).toBe(true);
    for (const p of GATE_PATTERNS) {
      expect(p.steps).toMatch(/^[x.]{16}$/);
      expect(p.name.length).toBeLessThanOrEqual(6);
      expect([...p.steps].some((c) => c === ".")).toBe(true);
    }
    expect(gateOpen("x...............", 0)).toBe(true);
    expect(gateOpen("x...............", 17)).toBe(false);
  });

  it("never open or close faster than 3 ms (P9 review M2: Gate's Smooth, the square Shape at the fastest rate and tempo)", () => {
    expect(gateTau(0)).toBeCloseTo(0.003);
    expect(gateTau(1)).toBeCloseTo(0.03);
    const fastest = 180 / 60 / Math.min(...SYNC_RATES);
    expect(squareEdgeSeconds(fastest)).toBeGreaterThanOrEqual(0.003);
  });
});

describe("the slots in the song", () => {
  it("default to each instrument's two effects, off; a song saved before P9 loads and plays them off", () => {
    const song = defaultSong();
    expect(validateSong(song)).toEqual([]);
    const fx = songFx(song);
    for (const id of INSTRUMENTS) {
      expect(fx[id]).toHaveLength(FX_SLOTS);
      expect(fx[id].map((s) => s.effect)).toEqual(DEFAULT_FX[id]);
      expect(fx[id].every((s) => !s.on)).toBe(true);
    }
    expect(defaultRack("bass")[0].knobs).toEqual(EFFECT_DEFS.fuzz.defaults);
  });

  it("are checked: an unknown effect, a third slot, a knob out of range or a missing instrument is refused", () => {
    const ok: Song = { ...defaultSong(), fx: songFx(defaultSong()) };
    expect(validateSong(ok)).toEqual([]);
    const bad = (f: (s: Song) => void): string[] => {
      const s = JSON.parse(JSON.stringify(ok)) as Song;
      f(s);
      return validateSong(s);
    };
    expect(bad((s) => ((s.fx!.bass[0] as { effect: string }).effect = "wah")).join()).toMatch(/fx.bass\[0\].effect/);
    expect(bad((s) => (s.fx!.synth as unknown[]).push(s.fx!.synth[0])).join()).toMatch(/fx.synth: must be 2 slots/);
    expect(bad((s) => (s.fx!.drums[1].knobs[2] = 1.5)).join()).toMatch(/fx.drums\[1\].knobs/);
    expect(bad((s) => delete (s.fx as Partial<Song["fx"]>)!.layer2).join()).toMatch(/fx.layer2/);
    expect(bad((s) => ((s.fx!.layer1[0] as { on: unknown }).on = "yes")).join()).toMatch(/fx.layer1\[0\].on/);
  });
});

describe("the cap on active slots (spec 8.8, Pedro 24 Nov 2026)", () => {
  it("is six: the P9 measure found ten too much", () => {
    expect(MAX_ACTIVE_FX).toBe(6);
  });

  it("turns off the slot switched on longest ago, and only it", () => {
    let order: string[] = [];
    const keys = INSTRUMENTS.flatMap((id) => [fxKey(id, 0), fxKey(id, 1)]);
    for (const k of keys.slice(0, 6)) {
      const r = activate(order, k, 6);
      expect(r.off).toEqual([]);
      order = r.order;
    }
    const r = activate(order, keys[6], 6);
    expect(r.off).toEqual([keys[0]]);
    expect(r.order).toEqual(keys.slice(1, 7));
    // Switching one on again moves it to the newest; switching one off frees its place.
    expect(activate(r.order, keys[1], 6)).toEqual({ order: [...keys.slice(2, 7), keys[1]], off: [] });
    expect(deactivate(r.order, keys[3])).toEqual([keys[1], keys[2], keys[4], keys[5], keys[6]]);
  });

  it("in the engine: a seventh slot switched on turns the oldest off in the song; every effect and slot stays selectable", () => {
    const e = new Engine(defaultSong());
    const order: [string, number][] = [];
    for (const id of INSTRUMENTS) for (const i of [0, 1]) order.push([id, i]);
    for (const [id, i] of order.slice(0, 6)) expect(e.setFx(id as never, i, { on: true })).toBe(true);
    const on = (): string[] => INSTRUMENTS.flatMap((id) => e.getFx()[id].flatMap((s, i) => (s.on ? [fxKey(id, i)] : [])));
    expect(on()).toHaveLength(6);
    e.setFx("layer1", 0, { on: true });
    expect(on()).toHaveLength(6);
    expect(e.getFx().drums[0].on).toBe(false);
    expect(e.getFx().layer1[0].on).toBe(true);
    // Each of the twelve can be put in any slot.
    for (const fx of EFFECTS) {
      expect(e.setFx("bass", 1, { effect: fx })).toBe(true);
      expect(e.getFx().bass[1].effect).toBe(fx);
      expect(e.getFx().bass[1].knobs).toEqual(EFFECT_DEFS[fx].defaults);
    }
  });

  it("a loaded song with more than six on plays the first six (in instrument order)", () => {
    const s = defaultSong();
    s.fx = songFx(s);
    for (const id of INSTRUMENTS) for (const slot of s.fx[id]) slot.on = true;
    const e = new Engine(s);
    const on = INSTRUMENTS.flatMap((id) => e.getFx()[id].map((x) => x.on));
    expect(on).toEqual([true, true, true, true, true, true, false, false, false, false]);
  });
});

describe("the engine's setFx", () => {
  it("changes effect, knobs and on/off, keeps the rest, and refuses bad input", () => {
    const e = new Engine(defaultSong());
    expect(e.setFx("synth", 0, { effect: "vowel" })).toBe(true);
    expect(e.getFx().synth[0]).toEqual({ effect: "vowel", on: false, knobs: EFFECT_DEFS.vowel.defaults });
    expect(e.setFx("synth", 0, { knobs: [0.1, 2, -1] })).toBe(true);
    expect(e.getFx().synth[0].knobs).toEqual([0.1, 1, 0]);
    expect(e.setFx("synth", 0, { on: true })).toBe(true);
    expect(e.getFx().synth[0]).toEqual({ effect: "vowel", on: true, knobs: [0.1, 1, 0] });
    expect(e.setFx("synth", 2, { on: true })).toBe(false);
    expect(e.setFx("synth", 0, { effect: "wah" as never })).toBe(false);
    expect(e.setFx("synth", 0, { knobs: [0.1, 0.2] })).toBe(false);
    expect(e.setFx("nope" as never, 0, { on: true })).toBe(false);
    // The document carries the slots, so a save and a reload keep them.
    const doc = e.getDocument();
    expect(validateSong(doc)).toEqual([]);
    expect(new Engine(doc).getFx().synth[0]).toEqual({ effect: "vowel", on: true, knobs: [0.1, 1, 0] });
  });

  it("is a logged op that replays as engine[op](...args); knob drags of one slot merge", () => {
    expect(LOG_OPS).toContain("setFx");
    const a = new Engine(defaultSong());
    const args = ["layer2", 1, { effect: "gate", on: true }] as const;
    (a as unknown as Record<string, (...x: unknown[]) => unknown>)["setFx"](...args);
    expect(a.getFx().layer2[1]).toEqual({ effect: "gate", on: true, knobs: EFFECT_DEFS.gate.defaults });
    expect(coalesceKey("setFx", ["bass", 0, { knobs: [1, 2, 3] }])).toBe(coalesceKey("setFx", ["bass", 0, { knobs: [0, 0, 0] }]));
    expect(coalesceKey("setFx", ["bass", 0, { knobs: [1, 2, 3] }])).not.toBe(coalesceKey("setFx", ["bass", 1, { knobs: [1, 2, 3] }]));
  });
});

describe("the vibes' slots (P9: the eight of P3)", () => {
  it("every vibe sets two effects per instrument, arrives with at most the cap on, and loads them into the song", () => {
    expect(STYLE_IDS.length).toBeGreaterThanOrEqual(8);
    for (const id of STYLE_IDS) {
      const def = STYLES[id];
      for (const inst of INSTRUMENTS) expect(def.fx[inst], `${id} ${inst}`).toHaveLength(2);
      const song = vibeSong(id)!;
      expect(validateSong(song)).toEqual([]);
      const fx = songFx(song);
      for (const inst of INSTRUMENTS) expect(fx[inst].map((s) => s.effect)).toEqual(def.fx[inst].map((f) => f.effect));
      const on = INSTRUMENTS.flatMap((inst) => fx[inst]).filter((s) => s.on).length;
      expect(on, id).toBeGreaterThan(0);
      expect(on, id).toBeLessThanOrEqual(MAX_ACTIVE_FX);
    }
  });

  it("Lo-fi arrives with Crush and Chorus on the keys (spec 8.8)", () => {
    const fx = songFx(vibeSong("loFi")!);
    expect(fx.synth.map((s) => [s.effect, s.on])).toEqual([
      ["crush", true],
      ["chorus", true],
    ]);
  });
});
