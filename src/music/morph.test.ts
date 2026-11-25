import { describe, expect, it } from "vitest";
import {
  DEFAULT_MORPH,
  MORPH_MACROS,
  MorphPlanner,
  checkMorphRecipe,
  checkMorphSettings,
  controlOf,
  morphStep,
  resolveMorph,
  voiceNotes,
  voicingShift,
  type MorphPlan,
  type MorphView,
} from "./morph.ts";
import { STYLES, STYLE_IDS } from "./styles.ts";

const view = (over: Partial<MorphView> = {}): MorphView => ({
  section: 1,
  sections: 4,
  loopBars: 4,
  sectionBar: 0,
  macros: Object.fromEntries(MORPH_MACROS.map((m) => [`${m.inst}.${m.id}`, 0.5])),
  on: { drums: true, bass: true, synth: true, layer1: true, layer2: true },
  layers: { layer1: { mode: "generative", lock: 0.8, voicing: 0.5 }, layer2: { mode: "pad", lock: 0.8, voicing: 0.5 } },
  sounding: [2, 5, 3, 2],
  ...over,
});

const plan = (over: Partial<MorphPlan> = {}): MorphPlan => ({ ...resolveMorph({ on: true, moves: { ...DEFAULT_MORPH.moves, sections: true } }, undefined, "t"), ...over });

describe("Morph: voicing (P11)", () => {
  it("as written at 0.5 or missing; a sixth of the dial per inversion", () => {
    expect(voicingShift(undefined)).toBe(0);
    expect(voicingShift(0.5)).toBe(0);
    expect(voicingShift(0.667)).toBe(1);
    expect(voicingShift(0)).toBe(-3);
    expect(voicingShift(1)).toBe(3);
  });
  it("a new voicing keeps the chord's notes (so its key) in another register", () => {
    const c = [57, 60, 64, 67];
    expect(voiceNotes(c, 0)).toEqual(c);
    expect(voiceNotes(c, 1)).toEqual([60, 64, 67, 69]);
    expect(voiceNotes(c, -1)).toEqual([55, 57, 60, 64]);
    for (let s = -3; s <= 3; s++) {
      const v = voiceNotes(c, s);
      expect(v.map((n) => n % 12).sort()).toEqual(c.map((n) => n % 12).sort());
      expect([...v].sort((a, b) => a - b)).toEqual(v);
    }
    expect(voiceNotes([38, 45], 2)).toEqual([50, 57]);
  });
});

describe("Morph: settings and recipes (P11)", () => {
  it("on by default in Ambient and Drone, off in every other vibe", () => {
    for (const id of STYLE_IDS) expect(resolveMorph(STYLES[id].morph, undefined, id).on, id).toBe(id === "ambient" || id === "drone");
  });
  it("the song's settings win over the recipe; the seed comes from the vibe", () => {
    const p = resolveMorph(STYLES.ambient.morph, { on: false, speed: 0.9, moves: { sections: true } }, "ambient");
    expect(p.on).toBe(false);
    expect(p.speed).toBe(0.9);
    expect(p.moves.sections).toBe(true);
    expect(p.moves.sound).toBe(true);
    expect(p.seed).toBe(resolveMorph(undefined, undefined, "ambient").seed);
    expect(resolveMorph(undefined, { seed: 7 }, "ambient").seed).toBe(7);
  });
  it("settings and recipes are checked", () => {
    const bad = (v: unknown): number => {
      const e: string[] = [];
      checkMorphSettings(v, "morph", e);
      return e.length;
    };
    expect(bad({ on: true, speed: 0.2, depth: 1, moves: { leads: false }, seed: 3 })).toBe(0);
    expect(bad({ speed: 2 })).toBeGreaterThan(0);
    expect(bad({ moves: { wobble: true } })).toBeGreaterThan(0);
    expect(bad({ seed: 1.5 })).toBeGreaterThan(0);
    expect(bad({ other: 1 })).toBeGreaterThan(0);
    expect(checkMorphRecipe(undefined)).toEqual([]);
    expect(checkMorphRecipe({ bright: [0.8, 0.2] }).length).toBeGreaterThan(0);
    expect(checkMorphRecipe({ sections: 8 }).length).toBeGreaterThan(0);
    expect(checkMorphRecipe({ drop: ["kazoo"] }).length).toBeGreaterThan(0);
  });
});

describe("Morph: the planner (P11)", () => {
  it("bar 0 moves nothing; a plan with every switch off moves nothing", () => {
    const p = new MorphPlanner(5);
    expect(p.bar(plan(), view(), () => false)).toEqual([]);
    const off = plan({ moves: { sound: false, leads: false, voicing: false, instruments: false, sections: false } });
    for (let i = 0; i < 200; i++) expect(p.bar(off, view({ sectionBar: i }), () => false)).toEqual([]);
  });

  it("the same seed gives the same moves; another seed others", () => {
    const run = (seed: number): string => {
      const p = new MorphPlanner(seed);
      const out = [];
      for (let i = 0; i < 128; i++) out.push(p.bar(plan(), view({ sectionBar: i }), () => false));
      return JSON.stringify(out);
    };
    expect(run(11)).toBe(run(11));
    expect(run(11)).not.toBe(run(12));
  });

  it("the macros move a small step a bar, inside the vibe's limits, and never a held control", () => {
    const p = new MorphPlanner(3);
    const pl = plan();
    const v = view();
    const held = new Set(["macro:synth.bright", "lock:layer1", "on:drums", "section"]);
    for (let i = 0; i < 400; i++) {
      const moves = p.bar(pl, { ...v, sectionBar: i }, (c) => held.has(c));
      for (const m of moves) {
        expect(held.has(controlOf(m)), controlOf(m)).toBe(false);
        if (m.kind === "macro") {
          const key = `${m.inst}.${m.id}`;
          expect(Math.abs(m.pos - v.macros[key])).toBeLessThanOrEqual(morphStep(pl) + 1e-9);
          const [lo, hi] = m.id === "bright" ? pl.recipe.bright : pl.recipe.space;
          expect(m.pos).toBeGreaterThanOrEqual(Math.min(lo, 0.5) - 1e-9);
          expect(m.pos).toBeLessThanOrEqual(Math.max(hi, 0.5) + 1e-9);
          v.macros[key] = m.pos;
        }
        if (m.kind === "toggle") v.on[m.inst] = !v.on[m.inst];
      }
    }
    expect(v.macros["synth.bright"]).toBe(0.5);
    expect(v.macros["layer1.bright"]).not.toBe(0.5);
  });

  it("Lock eases off for a few bars on a lead, then comes back to where it was", () => {
    const p = new MorphPlanner(9);
    const v = view();
    let eased = 0;
    let lock = v.layers.layer1.lock;
    for (let i = 1; i < 400; i++) {
      for (const m of p.bar(plan({ moves: { sound: false, leads: true, voicing: false, instruments: false, sections: false } }), { ...v, sectionBar: i }, () => false)) {
        if (m.kind !== "lock") continue;
        expect(m.layer).toBe("layer1"); // layer 2 is a pad
        if (m.lock < 0.8) {
          eased++;
          expect(lock).toBe(0.8);
        } else expect(m.lock).toBe(0.8);
        lock = m.lock;
      }
    }
    expect(eased).toBeGreaterThan(3);
    expect(lock).toBeGreaterThanOrEqual(0); // ends either eased or back
  });

  it("voicings and drop-outs change only at phrase ends; an instrument out comes back after a phrase", () => {
    const p = new MorphPlanner(21);
    const v = view({ loopBars: 8 });
    let out: string | null = null;
    let outAt = 0;
    let backs = 0;
    for (let i = 1; i < 800; i++) {
      for (const m of p.bar(plan({ moves: { sound: false, leads: false, voicing: true, instruments: true, sections: false } }), { ...v, sectionBar: i }, () => false)) {
        expect(i % 8, `${m.kind} at bar ${i}`).toBe(0);
        if (m.kind === "toggle") {
          if (v.on[m.inst]) {
            expect(out).toBeNull();
            out = m.inst;
            outAt = i;
          } else {
            expect(m.inst).toBe(out);
            expect(i - outAt).toBeGreaterThanOrEqual(8);
            out = null;
            backs++;
          }
          v.on[m.inst] = !v.on[m.inst];
          expect(Object.values(v.on).filter(Boolean).length).toBeGreaterThanOrEqual(2);
        }
        if (m.kind === "voicing") v.layers[m.layer].voicing = m.voicing;
      }
    }
    expect(backs).toBeGreaterThan(2);
  });

  it("sections move on every 16 or 32 bars only when switched on", () => {
    const p = new MorphPlanner(4);
    const at: number[] = [];
    for (let i = 0; i <= 128; i++) for (const m of p.bar(plan({ moves: { sound: false, leads: false, voicing: false, instruments: false, sections: true } }), view({ sectionBar: i }), () => false)) if (m.kind === "section") at.push(i);
    expect(at).toEqual([32, 64, 96, 128]);
  });
});
