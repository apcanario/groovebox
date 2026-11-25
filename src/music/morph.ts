/**
 * Morph (spec 8.11): the jam changes by itself, slowly, so it can be left playing. Pure and seeded, no audio
 * dependency. The planner decides, bar by bar, what Morph moves; the engine makes each move through the same
 * recorded calls a hand would make (setMacro, setParams, setGen, setPad, toggleInstrument, switchSection), so a
 * saved jam's log holds the journey.
 *
 * What it moves, each within limits the vibe sets (its recipe, `morph` in the style file) and the Morph page's Depth:
 * - sound: the Bright and Space macros of each instrument drift up and down, a small step a bar;
 * - leads: Lock eases off for a few bars now and then on a lead, so a note or two changes, then holds again;
 * - voicing: pads and drones move to another voicing (a step up or down by inversion: same notes, another register)
 *   at a phrase end (the end of the section's chord loop);
 * - instruments: one instrument drops out for a section's length (its chord loop) and returns;
 * - sections (optional, off unless switched on): the section moves on by itself every 16 or 32 bars.
 * A control moved by hand is left alone for HANDS_BARS bars (the engine tells the planner which are held).
 */
import type { InstrumentId, LayerInstrument } from "../engine/song.ts";
import { createRng, deriveSeed, type Rng } from "./random.ts";

/** The things Morph may move, each with its own switch on the Morph page. */
export const MORPH_THINGS = ["sound", "leads", "voicing", "instruments", "sections"] as const;
export type MorphThing = (typeof MORPH_THINGS)[number];

/** Bars a control moved by hand is left alone (spec 8.11). */
export const HANDS_BARS = 16;

/** The Bright and Space macros Morph drifts, per instrument that has them (spec 8.3's table). */
export const MORPH_MACROS: readonly { inst: InstrumentId; id: "bright" | "space" }[] = [
  { inst: "bass", id: "bright" },
  { inst: "synth", id: "bright" },
  { inst: "synth", id: "space" },
  { inst: "layer1", id: "bright" },
  { inst: "layer1", id: "space" },
  { inst: "layer2", id: "bright" },
  { inst: "layer2", id: "space" },
];

/** A vibe's limits for Morph (its style file's `morph`, over DEFAULT_MORPH). */
export interface MorphRecipe {
  /** On when the vibe loads (spec 8.11: Ambient and Drone). */
  on: boolean;
  /** The range, in dial positions 0..1, the Bright and Space macros drift within. */
  bright: [number, number];
  space: [number, number];
  /** How far Lock eases off at most (0..1). */
  lock: number;
  /** The range of the pad and drone voicing dial (0..1, 0.5 as written; each sixth is one inversion). */
  voicing: [number, number];
  /** The instruments that may drop out for a while. */
  drop: InstrumentId[];
  /** Bars between section moves (spec 8.11: 16 or 32). */
  sections: 16 | 32;
  /** What it moves when the song's Morph page says nothing. */
  moves: Record<MorphThing, boolean>;
}

/** The Morph page's settings, stored in the song over the vibe's recipe. */
export interface MorphSettings {
  on?: boolean;
  /** 0..1: how fast it moves (0.5 as built: a quarter of the dial in about 25 bars). */
  speed?: number;
  /** 0..1: how far it moves within the vibe's limits (1 the whole of them). */
  depth?: number;
  moves?: Partial<Record<MorphThing, boolean>>;
  /** The journey's seed; missing, one from the song's vibe (or name), so a vibe always takes the same journey. */
  seed?: number;
}

/** What a song without a recipe plays: off, moderate limits, never the drums, the bass or the sections. */
export const DEFAULT_MORPH: MorphRecipe = {
  on: false,
  bright: [0.3, 0.7],
  space: [0.2, 0.6],
  lock: 0.35,
  voicing: [1 / 3, 2 / 3],
  drop: ["synth", "layer1", "layer2"],
  sections: 32,
  moves: { sound: true, leads: true, voicing: true, instruments: true, sections: false },
};

export const MORPH_SPEED = 0.5;
export const MORPH_DEPTH = 0.7;

/** Morph as a song plays it: the recipe, the page's settings over it, and the seed. */
export interface MorphPlan {
  on: boolean;
  speed: number;
  depth: number;
  moves: Record<MorphThing, boolean>;
  seed: number;
  recipe: MorphRecipe;
}

/** A seed from a text (FNV-1a), so a vibe's journey is the same every time. Not a random choice. */
export function textSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h & 0x7fffffff;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** The recipe (a vibe's partial one over the default) with the song's settings over it. */
export function resolveMorph(recipe: Partial<MorphRecipe> | undefined, settings: MorphSettings | undefined, name: string): MorphPlan {
  const r: MorphRecipe = { ...DEFAULT_MORPH, ...recipe, moves: { ...DEFAULT_MORPH.moves, ...recipe?.moves } };
  const s = settings ?? {};
  return {
    on: s.on ?? r.on,
    speed: s.speed === undefined ? MORPH_SPEED : clamp01(s.speed),
    depth: s.depth === undefined ? MORPH_DEPTH : clamp01(s.depth),
    moves: { ...r.moves, ...s.moves },
    seed: s.seed ?? textSeed(`morph:${name}`),
    recipe: r,
  };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const unit = (v: unknown): boolean => isNum(v) && v >= 0 && v <= 1;
const range = (v: unknown): boolean => Array.isArray(v) && v.length === 2 && unit(v[0]) && unit(v[1]) && (v[0] as number) <= (v[1] as number);
const INSTS = ["drums", "bass", "synth", "layer1", "layer2"];

/** Every problem with a song's Morph settings, pushed onto `errors`. */
export function checkMorphSettings(v: unknown, at: string, errors: string[]): void {
  if (!isObj(v)) return void errors.push(`${at}: not an object`);
  if (v.on !== undefined && typeof v.on !== "boolean") errors.push(`${at}.on: must be true or false`);
  if (v.speed !== undefined && !unit(v.speed)) errors.push(`${at}.speed: must be 0..1`);
  if (v.depth !== undefined && !unit(v.depth)) errors.push(`${at}.depth: must be 0..1`);
  if (v.seed !== undefined && !(Number.isInteger(v.seed) && (v.seed as number) >= 0)) errors.push(`${at}.seed: must be a whole number`);
  if (v.moves !== undefined) {
    if (!isObj(v.moves)) errors.push(`${at}.moves: not an object`);
    else
      for (const [k, x] of Object.entries(v.moves)) {
        if (!(MORPH_THINGS as readonly string[]).includes(k)) errors.push(`${at}.moves.${k}: unknown`);
        else if (typeof x !== "boolean") errors.push(`${at}.moves.${k}: must be true or false`);
      }
  }
  for (const k of Object.keys(v)) if (!["on", "speed", "depth", "moves", "seed"].includes(k)) errors.push(`${at}.${k}: unknown`);
}

/** Every problem with a style's (partial) recipe. */
export function checkMorphRecipe(r: unknown): string[] {
  if (r === undefined) return [];
  const out: string[] = [];
  if (!isObj(r)) return ["morph: not an object"];
  if (r.on !== undefined && typeof r.on !== "boolean") out.push("morph.on: must be true or false");
  for (const k of ["bright", "space", "voicing"]) if (r[k] !== undefined && !range(r[k])) out.push(`morph.${k}: a range [low, high] within 0..1`);
  if (r.lock !== undefined && !unit(r.lock)) out.push("morph.lock: must be 0..1");
  if (r.drop !== undefined && !(Array.isArray(r.drop) && r.drop.every((x) => INSTS.includes(x as string)))) out.push("morph.drop: instruments");
  if (r.sections !== undefined && r.sections !== 16 && r.sections !== 32) out.push("morph.sections: 16 or 32");
  if (r.moves !== undefined) {
    if (!isObj(r.moves)) out.push("morph.moves: not an object");
    else for (const [k, x] of Object.entries(r.moves)) if (!(MORPH_THINGS as readonly string[]).includes(k) || typeof x !== "boolean") out.push(`morph.moves.${k}: unknown`);
  }
  for (const k of Object.keys(r)) if (!["on", "bright", "space", "lock", "voicing", "drop", "sections", "moves"].includes(k)) out.push(`morph.${k}: unknown`);
  return out;
}

// ---- Voicing --------------------------------------------------------------------------------------

/** Inversions the voicing dial reaches each way from the chord as written. */
export const VOICING_STEPS = 3;

/** The voicing dial (0..1, 0.5 as written) as inversions: -3..3. */
export function voicingShift(v: number | undefined): number {
  return v === undefined ? 0 : Math.max(-VOICING_STEPS, Math.min(VOICING_STEPS, Math.round((v - 0.5) * 2 * VOICING_STEPS)));
}

/**
 * A chord's notes moved by `shift` inversions: up, its lowest note goes up an octave each time; down, its highest
 * goes down an octave. The same pitch classes, so it never leaves the key; ascending. At 0 (the dial as written, or
 * missing) the notes come back as given, in their order: what played before P11 (P11 review M3).
 */
export function voiceNotes(notes: readonly number[], shift: number): number[] {
  if (shift === 0) return [...notes];
  const out = [...notes].sort((a, b) => a - b);
  if (out.length === 0) return out;
  for (let i = 0; i < shift; i++) {
    out.push(out.shift()! + 12);
  }
  for (let i = 0; i > shift; i--) {
    out.unshift(out.pop()! - 12);
  }
  return out;
}

// ---- The planner ----------------------------------------------------------------------------------

/** What the planner sees at a bar line: the playing section as the song holds it. */
export interface MorphView {
  section: number;
  sections: number;
  /** The section's chord loop, in bars (at least 1): its phrase. */
  loopBars: number;
  /** Bars since the section started (0 on its first bar). */
  sectionBar: number;
  /** Where each drifting macro's dial stands now (`synth.bright`). */
  macros: Record<string, number>;
  /** Instruments on in the playing section. */
  on: Record<InstrumentId, boolean>;
  /** Each layer of the playing section: its mode, Lock and voicing dial. */
  layers: Record<LayerInstrument, { mode: string; lock: number; voicing: number }>;
  /** Instruments on, per section (for sections worth moving to). */
  sounding: number[];
}

/** One move, as the engine makes it. `control` is what a hand would hold (see `controlOf`). */
export type MorphMove =
  | { kind: "macro"; inst: InstrumentId; id: "bright" | "space"; pos: number }
  | { kind: "lock"; section: number; layer: LayerInstrument; lock: number }
  | { kind: "voicing"; section: number; layer: LayerInstrument; voicing: number }
  | { kind: "toggle"; section: number; inst: InstrumentId }
  | { kind: "section"; index: number };

/** The control a move touches, by the same names the engine marks hand moves with. */
export function controlOf(m: MorphMove): string {
  switch (m.kind) {
    case "macro":
      return `macro:${m.inst}.${m.id}`;
    case "lock":
      return `lock:${m.layer}`;
    case "voicing":
      return `voicing:${m.layer}`;
    case "toggle":
      return `on:${m.inst}`;
    case "section":
      return "section";
  }
}

/** The speed dial as a rate: 0.5 to 2 times as built. */
export const speedRate = (speed: number): number => Math.pow(2, 2 * clamp01(speed) - 1);

/** Macro dial positions a bar at speed 1x. */
const MACRO_STEP = 0.01;

/** How far a drifting macro dial moves in one bar at the plan's speed. */
export const morphStep = (plan: MorphPlan): number => MACRO_STEP * speedRate(plan.speed);

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

interface Drift {
  target: number | null;
  rest: number;
}

/**
 * The seeded journey. Each thing has its own stream of the seed, so a hand holding one control changes nothing of
 * the others. `bar()` is called once per bar line, in order, from the first bar of the song (bar 0, where nothing
 * moves); it returns the moves of that bar, leaving out every control `held` names.
 */
export class MorphPlanner {
  private n = 0;
  private drifts = new Map<string, Drift>();
  private rngs: Record<MorphThing, Rng>;
  private ease = new Map<LayerInstrument, { section: number; base: number; until: number }>();
  private out: { section: number; inst: InstrumentId; back: number } | null = null;

  constructor(readonly seed: number) {
    this.rngs = {
      sound: createRng(deriveSeed(seed, 1)),
      leads: createRng(deriveSeed(seed, 2)),
      voicing: createRng(deriveSeed(seed, 3)),
      instruments: createRng(deriveSeed(seed, 4)),
      sections: createRng(deriveSeed(seed, 5)),
    };
  }

  /** A bar passes with no moves (Morph off, a drop running, a song landing): the journey's clock goes on. */
  pass(): void {
    this.n++;
  }

  /** Bars planned so far. */
  get bars(): number {
    return this.n;
  }

  /**
   * What Morph owes back (P11 review E1): the instrument it has out and the Locks it has eased, as the moves that give
   * them back (the instrument toggled on again where it went out, each Lock set to its base). The engine skips a move a
   * hand made moot (the instrument already on, a Lock held by hand).
   */
  owed(): MorphMove[] {
    const out: MorphMove[] = [];
    if (this.out) out.push({ kind: "toggle", section: this.out.section, inst: this.out.inst });
    for (const [layer, e] of this.ease) out.push({ kind: "lock", section: e.section, layer, lock: e.base });
    return out;
  }

  /** The moves of `owed()`, now forgotten: the journey stops, pauses or starts again (Stop, Play, a song, a seed, Morph off, a drop). */
  release(): MorphMove[] {
    const out = this.owed();
    this.out = null;
    this.ease.clear();
    return out;
  }

  bar(plan: MorphPlan, v: MorphView, held: (control: string) => boolean): MorphMove[] {
    const bar = this.n++;
    if (bar === 0) return [];
    const rate = speedRate(plan.speed);
    const r = plan.recipe;
    const out: MorphMove[] = [];
    const push = (m: MorphMove): void => {
      if (!held(controlOf(m))) out.push(m);
    };
    // An instrument out in a section that is no longer playing comes back there at once.
    if (this.out && this.out.section !== v.section) {
      push({ kind: "toggle", section: this.out.section, inst: this.out.inst });
      this.out = null;
    }
    for (const [id, e] of this.ease)
      if (e.section !== v.section) {
        push({ kind: "lock", section: e.section, layer: id, lock: e.base });
        this.ease.delete(id);
      }

    if (plan.moves.sound) {
      const rng = this.rngs.sound;
      for (const m of MORPH_MACROS) {
        const key = `${m.inst}.${m.id}`;
        const [lo, hi] = m.id === "bright" ? r.bright : r.space;
        const c = (lo + hi) / 2;
        const half = ((hi - lo) / 2) * plan.depth;
        const d = this.drifts.get(key) ?? { target: null, rest: 0 };
        this.drifts.set(key, d);
        // Its draws happen whether or not a hand holds it, so the other macros' journeys never change.
        if (d.target === null) {
          if (d.rest > 0) {
            d.rest--;
            continue;
          }
          d.target = round3(c - half + 2 * half * rng.next());
        }
        const now = v.macros[key];
        if (now === undefined) continue;
        const step = morphStep(plan);
        const diff = d.target - now;
        if (Math.abs(diff) <= step) {
          const pos = d.target;
          d.target = null;
          d.rest = Math.round((2 + rng.int(9)) / rate);
          if (Math.abs(pos - now) >= 0.0005) push({ kind: "macro", inst: m.inst, id: m.id, pos });
        } else push({ kind: "macro", inst: m.inst, id: m.id, pos: round3(now + Math.sign(diff) * step) });
      }
    }

    if (plan.moves.leads) {
      const rng = this.rngs.leads;
      for (const id of ["layer1", "layer2"] as const) {
        const e = this.ease.get(id);
        if (e) {
          if (bar >= e.until) {
            push({ kind: "lock", section: e.section, layer: id, lock: e.base });
            this.ease.delete(id);
          }
          continue;
        }
        const go = rng.next() < 0.06 * rate;
        const bars = 2 + rng.int(3);
        const l = v.layers[id];
        if (!go || !v.on[id] || l.mode !== "generative" || held(`lock:${id}`)) continue;
        const lock = round3(Math.max(0, l.lock - r.lock * plan.depth));
        if (lock >= l.lock) continue;
        this.ease.set(id, { section: v.section, base: l.lock, until: bar + bars });
        push({ kind: "lock", section: v.section, layer: id, lock });
      }
    }

    // A phrase end: the section's chord loop starts again.
    const phrase = v.sectionBar > 0 && v.sectionBar % Math.max(1, v.loopBars) === 0;

    if (plan.moves.voicing && phrase) {
      const rng = this.rngs.voicing;
      for (const id of ["layer1", "layer2"] as const) {
        const go = rng.next() < 0.5 * rate;
        const pick = rng.next();
        const l = v.layers[id];
        if (!go || (l.mode !== "pad" && l.mode !== "drone")) continue;
        const [lo, hi] = r.voicing;
        const c = (lo + hi) / 2;
        const half = ((hi - lo) / 2) * plan.depth;
        const a = voicingShift(c - half);
        const b = voicingShift(c + half);
        const cur = voicingShift(l.voicing);
        const choices: number[] = [];
        for (let s = a; s <= b; s++) if (s !== cur) choices.push(s);
        if (!choices.length) continue;
        const s = choices[Math.min(choices.length - 1, Math.floor(pick * choices.length))];
        push({ kind: "voicing", section: v.section, layer: id, voicing: round3(0.5 + s / (2 * VOICING_STEPS)) });
      }
    }

    if (plan.moves.instruments && phrase) {
      const rng = this.rngs.instruments;
      const go = rng.next() < 0.5 * rate * plan.depth;
      const pick = rng.next();
      if (this.out) {
        // Back after a phrase; a hand that switched it on already brought it back; a hand holding it waits.
        if (v.on[this.out.inst]) this.out = null;
        else if (bar >= this.out.back && !held(`on:${this.out.inst}`)) {
          push({ kind: "toggle", section: this.out.section, inst: this.out.inst });
          this.out = null;
        }
      } else if (go) {
        const sounding = (Object.keys(v.on) as InstrumentId[]).filter((id) => v.on[id]);
        const may = r.drop.filter((id) => v.on[id] && !held(`on:${id}`));
        // Never the last two sounding: what is left still plays.
        if (sounding.length > 2 && may.length) {
          const inst = may[Math.min(may.length - 1, Math.floor(pick * may.length))];
          this.out = { section: v.section, inst, back: bar + Math.max(1, v.loopBars) };
          push({ kind: "toggle", section: v.section, inst });
        }
      }
    }

    if (plan.moves.sections && v.sections > 1 && bar % r.sections === 0) {
      const rng = this.rngs.sections;
      const pick = rng.next();
      // Sections with something to play, other than this one.
      const others = Array.from({ length: v.sections }, (_, i) => i).filter((i) => i !== v.section && (v.sounding[i] ?? 0) > 0);
      if (others.length) push({ kind: "section", index: others[Math.min(others.length - 1, Math.floor(pick * others.length))] });
    }
    return out;
  }
}
