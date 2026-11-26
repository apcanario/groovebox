/**
 * The Drop (spec 8.9), the pure part: each vibe's recipe (data in its style file), the settings the Drop page
 * changes, and the conductor that runs build, cliffhanger, impact, the drop and the wind-down bar line by bar line.
 * No audio dependency: the engine asks the conductor at every bar line what this bar is, and plays it.
 */

export const DROP_BUILDS = [2, 4, 8] as const;
export type DropBuild = (typeof DROP_BUILDS)[number];
export const DROP_WINDS = [2, 4] as const;
export type DropWind = (typeof DROP_WINDS)[number];
/** Gap: silence; Hold: one filtered chord hangs; None: no cliffhanger (a bloom). */
export const DROP_CLIFFS = ["gap", "hold", "none"] as const;
export type DropCliff = (typeof DROP_CLIFFS)[number];

/** One vibe's drop (spec 8.9, "Each vibe has its own recipe"). */
export interface DropRecipe {
  /** Bars of build. */
  build: DropBuild;
  /** What the build does: the filter that empties the low end (high) or closes the top (low), and its parts. */
  parts: {
    sweep: "high" | "low" | "none";
    /** A snare or clap roll that speeds up. */
    roll: boolean;
    /** A noise riser sweeping upward. */
    riser: boolean;
    /** The reverb grows. */
    reverb: boolean;
    /** The lead climbs an octave for the second half of the build. */
    climb: boolean;
    /** Hats (closed and open) drop out during the build. */
    hatsOut: boolean;
    /** The kick drops out for the last bar of the build. */
    kickOut: boolean;
  };
  cliff: DropCliff;
  /** How long the cliffhanger is: the last beat or the last half bar of the build. */
  cliffLength: "beat" | "half";
  /** The impact on the bar line; all false is no impact (a bloom). */
  impact: { sweep: boolean; sub: boolean; burst: boolean };
  /** How much of each extra layer, 0..1 (0: none). */
  layers: { synth: number; bass: number; drums: number; leads: number };
  /** How wide the extra layers are spread, 0..1 (the Drop page's Width knob). */
  width: number;
  /** Extra pump depth while the drop is on (added to the Pump knob, 0..0.3). */
  pump: number;
  /** Bars of wind-down. */
  wind: DropWind;
  /** A bloom (Ambient, Drone): the extra layers open over the build instead of arriving on the impact. */
  bloom: boolean;
}

/** What the Advanced Drop page sets, stored in the song (spec 8.9): over the vibe's recipe. */
export interface DropSettings {
  build?: DropBuild;
  cliff?: DropCliff;
  wind?: DropWind;
  width?: number;
}

/** The recipe a song without a vibe plays: the full thing, at a medium width. */
export const DEFAULT_DROP: DropRecipe = {
  build: 4,
  parts: { sweep: "high", roll: true, riser: true, reverb: true, climb: true, hatsOut: false, kickOut: true },
  cliff: "gap",
  cliffLength: "beat",
  impact: { sweep: true, sub: true, burst: true },
  layers: { synth: 0.8, bass: 0.6, drums: 0.7, leads: 0.7 },
  width: 0.8,
  pump: 0.15,
  wind: 2,
  bloom: false,
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** The recipe with the song's Drop page settings over it. */
export function resolveDrop(recipe: DropRecipe | undefined, settings: DropSettings | undefined): DropRecipe {
  const r = recipe ?? DEFAULT_DROP;
  const s = settings ?? {};
  return {
    ...r,
    parts: { ...r.parts },
    impact: { ...r.impact },
    layers: { ...r.layers },
    build: s.build ?? r.build,
    cliff: s.cliff ?? r.cliff,
    wind: s.wind ?? r.wind,
    width: s.width === undefined ? r.width : clamp01(s.width),
  };
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Every problem with a song's Drop page settings, pushed onto `errors`. */
export function checkDropSettings(v: unknown, at: string, errors: string[]): void {
  if (!isObj(v)) return void errors.push(`${at}: not an object`);
  if (v.build !== undefined && !(DROP_BUILDS as readonly unknown[]).includes(v.build)) errors.push(`${at}.build: must be 2, 4 or 8`);
  if (v.wind !== undefined && !(DROP_WINDS as readonly unknown[]).includes(v.wind)) errors.push(`${at}.wind: must be 2 or 4`);
  if (v.cliff !== undefined && !(DROP_CLIFFS as readonly unknown[]).includes(v.cliff)) errors.push(`${at}.cliff: unknown`);
  if (v.width !== undefined && !(isNum(v.width) && v.width >= 0 && v.width <= 1)) errors.push(`${at}.width: must be 0..1`);
  for (const k of Object.keys(v)) if (!["build", "wind", "cliff", "width"].includes(k)) errors.push(`${at}.${k}: unknown`);
}

/** Every problem with a style's recipe. */
export function checkDropRecipe(r: unknown): string[] {
  const out: string[] = [];
  if (!isObj(r)) return ["drop: needs a recipe"];
  if (!(DROP_BUILDS as readonly unknown[]).includes(r.build)) out.push("drop.build: must be 2, 4 or 8");
  if (!(DROP_WINDS as readonly unknown[]).includes(r.wind)) out.push("drop.wind: must be 2 or 4");
  if (!(DROP_CLIFFS as readonly unknown[]).includes(r.cliff)) out.push("drop.cliff: unknown");
  if (r.cliffLength !== "beat" && r.cliffLength !== "half") out.push("drop.cliffLength: beat or half");
  const p = r.parts;
  if (!isObj(p) || !["high", "low", "none"].includes(p.sweep as string)) out.push("drop.parts.sweep: high, low or none");
  else for (const k of ["roll", "riser", "reverb", "climb", "hatsOut", "kickOut"]) if (typeof p[k] !== "boolean") out.push(`drop.parts.${k}: must be true or false`);
  const i = r.impact;
  if (!isObj(i) || !["sweep", "sub", "burst"].every((k) => typeof i[k] === "boolean")) out.push("drop.impact: sweep, sub and burst, each true or false");
  const l = r.layers;
  if (!isObj(l) || !["synth", "bass", "drums", "leads"].every((k) => isNum(l[k]) && (l[k] as number) >= 0 && (l[k] as number) <= 1))
    out.push("drop.layers: synth, bass, drums and leads, each 0..1");
  else if (!["synth", "bass", "drums", "leads"].some((k) => (l[k] as number) > 0)) out.push("drop.layers: at least one extra layer");
  if (!(isNum(r.width) && r.width >= 0 && r.width <= 1)) out.push("drop.width: must be 0..1");
  if (!(isNum(r.pump) && r.pump >= 0 && r.pump <= 0.3)) out.push("drop.pump: must be 0..0.3");
  if (typeof r.bloom !== "boolean") out.push("drop.bloom: must be true or false");
  return out;
}

// ---- The conductor ------------------------------------------------------------------------------

/** Where the drop is: normal size, building, on, or winding down. */
export type DropPhase = "off" | "build" | "on" | "wind";

/**
 * What the next press is waiting to do at the next bar line: start the build (`on`), cancel the build (`cancel`),
 * start the wind-down (`off`), or nothing.
 */
export type DropIntent = "none" | "on" | "cancel" | "off";

/** What one bar is, asked at its bar line. */
export interface DropBar {
  phase: DropPhase;
  /** Bar within the phase, from 0. */
  index: number;
  /** Bars in the phase (0 for `on` and `off`: they last until a press). */
  length: number;
  /** The impact is on this bar line (the first bar of a drop after its build). */
  impact: boolean;
  /** This is the last bar of the build: the cliffhanger falls at its end. */
  cliff: boolean;
  /** On this bar line the music is back at its normal size (after a wind-down or a cancelled build). */
  end: boolean;
  /** The end is a cancelled build. */
  cancelled: boolean;
}

/** What the button shows (spec 8.9): the phase, what a press waits for, and the bars left in the build or wind-down. */
export interface DropView {
  phase: DropPhase;
  intent: DropIntent;
  /** Bars left in the build or wind-down, counting the bar playing; the build's length while armed; 0 otherwise. */
  barsLeft: number;
  /** Bars in the build or wind-down (0 otherwise). */
  length: number;
}

/**
 * The Drop's bar-line state machine. `press` records what the next bar line does; `bar` is called once at every bar
 * line, in order, and returns what that bar is. Nothing happens between bar lines: a press is never immediate.
 */
export class DropConductor {
  phase: DropPhase = "off";
  intent: DropIntent = "none";
  private index = 0;
  private length = 0;

  /** The DROP button. Returns what it did. A press during the wind-down does nothing. */
  press(): "armed" | "disarmed" | "cancel" | "uncancel" | "wind" | "unwind" | "ignored" {
    switch (this.phase) {
      case "off":
        this.intent = this.intent === "on" ? "none" : "on";
        return this.intent === "on" ? "armed" : "disarmed";
      case "build":
        this.intent = this.intent === "cancel" ? "none" : "cancel";
        return this.intent === "cancel" ? "cancel" : "uncancel";
      case "on":
        this.intent = this.intent === "off" ? "none" : "off";
        return this.intent === "off" ? "wind" : "unwind";
      default:
        return "ignored";
    }
  }

  /** Anything but normal: building, on, winding down, or armed to build at the next bar line. */
  get active(): boolean {
    return this.phase !== "off" || this.intent === "on";
  }

  /** Back to normal at once (Stop, a new song). */
  reset(): void {
    this.phase = "off";
    this.intent = "none";
    this.index = 0;
    this.length = 0;
  }

  /** The bar starting at this bar line. `build` and `wind`: the lengths a build or wind-down starting here takes. */
  bar(build: number, wind: number): DropBar {
    const plain = { impact: false, cliff: false, end: false, cancelled: false };
    const intent = this.intent;
    this.intent = "none";
    switch (this.phase) {
      case "off":
        if (intent === "on") return this.enter("build", Math.max(1, build), plain);
        return { phase: "off", index: 0, length: 0, ...plain };
      case "build":
        if (intent === "cancel") return { ...this.enter("off", 0, plain), end: true, cancelled: true };
        this.index++;
        if (this.index >= this.length) return { ...this.enter("on", 0, plain), impact: true };
        return this.view(plain);
      case "on":
        if (intent === "off") return this.enter("wind", Math.max(1, wind), plain);
        this.index++;
        return this.view(plain);
      case "wind":
        this.index++;
        if (this.index >= this.length) return { ...this.enter("off", 0, plain), end: true };
        return this.view(plain);
    }
  }

  /** What the button shows now. */
  view(): DropView;
  view(plain: Omit<DropBar, "phase" | "index" | "length">): DropBar;
  view(plain?: Omit<DropBar, "phase" | "index" | "length">): DropBar | DropView {
    if (plain) return { phase: this.phase, index: this.index, length: this.length, ...plain, cliff: this.phase === "build" && this.index === this.length - 1 };
    const counted = this.phase === "build" || this.phase === "wind";
    return { phase: this.phase, intent: this.intent, barsLeft: counted ? this.length - this.index : 0, length: counted ? this.length : 0 };
  }

  private enter(phase: DropPhase, length: number, plain: Omit<DropBar, "phase" | "index" | "length">): DropBar {
    this.phase = phase;
    this.index = 0;
    this.length = length;
    return this.view(plain);
  }
}

/**
 * The roll of one bar of the build (spec 8.9: "a snare or clap roll speeds up"): the hit positions in sixteenths of
 * the bar and their velocities. Quarters, then eighths, then sixteenths, the last beat of the build in 32nds, and
 * louder as it goes. `index` is the bar of the build, `length` its bars; `cutAt` drops hits from that sixteenth (the
 * cliffhanger's start).
 */
export function rollHits(index: number, length: number, cutAt = 16): { at: number; vel: number }[] {
  const f = index / Math.max(1, length);
  const per = f < 0.25 ? 1 : f < 0.5 ? 2 : 4;
  const last = index === length - 1;
  const out: { at: number; vel: number }[] = [];
  const step = 4 / per;
  for (let at = 0; at < 16 - 1e-9; at += step) {
    if (last && length > 1 && at >= 12 && per >= 4) {
      out.push({ at, vel: 0 }, { at: at + step / 2, vel: 0 });
    } else out.push({ at, vel: 0 });
  }
  const kept = out.filter((h) => h.at < cutAt);
  return kept.map((h) => ({ at: h.at, vel: 0.35 + 0.6 * ((index + h.at / 16) / Math.max(1, length)) }));
}

/**
 * P10 review S5: the follower keys each beat by its place in the section's own loop: its chord cycle, repeated to
 * 8 bars or more. In beats.
 */
export function loopBeats(chordBars: number[]): number {
  const cycle = chordBars.reduce((a, b) => a + b, 0);
  if (!(cycle > 0)) return 32;
  return Math.max(1, Math.round(4 * cycle * Math.ceil(8 / cycle - 1e-9)));
}

/**
 * P10 fix: the bars after a section lands (past its landing bar) before its beats count as its level: as many as the
 * longest attack of its sounding instruments takes, so a pad or drone still swelling in (Ambient, Drone: 3 to 8 s)
 * is not taken for the section's level. 0 for attacks under a bar.
 */
export function refSettleBars(attacks: readonly number[], barSeconds: number): number {
  const a = Math.max(0, ...attacks.filter((x) => Number.isFinite(x)));
  return barSeconds > 0 ? Math.floor(a / barSeconds) : 0;
}

/**
 * P10 fix: the section's own level at a place in its loop (`key`), as heard before the build. A place not heard (a
 * section played for less than its loop) has none: `fallback` (`followFallback`: the section's last bar before the
 * build while a punchy drop settles) or null. Never the mean of every place: on a vibe whose chords differ in level, that pulled the
 * drop away from the section and held it there.
 */
export function followRef(refs: ReadonlyMap<number, number>, key: number, fallback = 0): number | null {
  const r = refs.get(key);
  if (r !== undefined && r > 0) return r;
  return fallback > 0 ? fallback : null;
}

/**
 * C27: what a place of the loop not heard before the build is read against (0: nothing, the follower holds there). A
 * punchy drop, while it settles, reads it against the section's last bar before the build, so its first bar's coarse
 * moves still take out what the extra layers add. A bloom (Ambient, Drone) never reads one: its loop runs 16 bars of
 * slow chords that differ in level and swell in over three bars, and the last bar before the build is often the next
 * chord swelling in (Drone's sat 1.3 to 1.6 dB under the rest): read against it, a drop on the chord not heard was
 * pulled 1 to 3 dB under the section and held there. The bloom's layers add well under 1 dB past the limiter, so it
 * holds at its gain until it reaches places heard, and settles there.
 */
export function followFallback(bloom: boolean, settling: boolean, last: number): number {
  return !bloom && settling ? last : 0;
}

/** P10 fix: the settled follower's aim, kept within `rangeDb` of the gain it settled on. */
export function trackBound(aim: number, settled: number, rangeDb: number): number {
  const k = Math.pow(10, rangeDb / 20);
  return Math.min(settled * k, Math.max(settled / k, aim));
}

/**
 * The follower's next gain from the current one `c` and the gain that would bring the drop to the section's level
 * (`aim`), never over `top`: at most `stepDb` a beat, and unchanged when within `deadDb` of it.
 */
export function followStep(c: number, aim: number, stepDb: number, deadDb: number, top = Infinity): number {
  if (Math.abs(20 * Math.log10(aim / c)) < deadDb) return c;
  const k = Math.pow(10, stepDb / 20);
  return Math.min(top, c * k, Math.max(c / k, aim));
}

// ---- The wind-down (P10b, C21) ------------------------------------------------------------------

/** The extra layers' groups (the recipe's `layers`). */
export type DropLayer = keyof DropRecipe["layers"];
export const DROP_LAYERS: readonly DropLayer[] = ["synth", "bass", "drums", "leads"];

/** A typical groove's energy on the master output (-19 dB), against which the drop's extra layers are sized. */
export const DROP_TYPICAL = Math.pow(10, -1.9);

/**
 * The extra layers' levels: the recipe's amounts, a little more with the width, and sized to the section's own level
 * (`ref`, its energy before the build, against a typical groove's), so a loud drone gets layers as large, relative to
 * it, as a quiet groove does. 0 or no reading: sized as a typical groove.
 */
export function dropLevels(r: DropRecipe, ref: number): Record<DropLayer, number> {
  const size = ref > 0 ? Math.max(0.5, Math.min(3, Math.sqrt(ref / DROP_TYPICAL))) : 1;
  const w = (0.5 + 0.5 * r.width) * size;
  return { synth: r.layers.synth * w, bass: r.layers.bass * w, drums: r.layers.drums * w, leads: r.layers.leads * w };
}

/** How far the drop's extra layers are panned out at width `w` (0..1). */
export const dropSpread = (w: number): number => 0.5 + 0.5 * w;

/** Everything the wind-down eases, as the drop has it (from) or as the section has it (to). */
export interface WindState {
  /** Each extra layer's level. */
  levels: Record<DropLayer, number>;
  /** The level follower's gain (1 at the section's level). */
  comp: number;
  /** How far the extra layers are panned out (0: centre). */
  spread: number;
  /** The build's reverb send (a bloom keeps it through the drop; 0 otherwise). */
  verb: number;
  /** The master's pump depth (the Pump knob, plus the recipe's extra while the drop is on). */
  pump: number;
  /** Overlay voices allowed to sound at once. */
  voices: number;
  /** Instruments whose held notes are doubled (P10 review S8). */
  held: number;
}

/**
 * One bar of the wind-down. The continuous values (levels, comp, spread, verb) are ramped across the bar and reached
 * exactly on its closing bar line; the counted ones (pump, voices, held) hold for the whole bar.
 */
export interface WindBar extends WindState {
  /** Share of the drop left at the bar's closing bar line (1: the drop, 0: the section). */
  share: number;
}

/**
 * P10b (C21, spec 8.9): the wind-down's targets bar by bar, a calm-down that mirrors the build. Over `bars` bars the
 * share of the drop left falls by an even step a bar, 1 - (i+1)/bars at the close of bar i, so every bar takes some
 * and the last bar line lands exactly on the section's values. Levels (and the follower's gain, which makes up for
 * them) fall on the share to the power 1.5, between an even step in amplitude and one in loudness; the spread falls on
 * the share's square root. The layers' side energy (what widens the master) goes with level squared times spread
 * squared: on the share squared and the share (P10b review E1) nearly all of it went in the first bar (dubTechno: 13%
 * of the extra width left after the first of two bars). Measured per bar the layers' level also follows the notes
 * (dubTechno's own bars differ by up to 4 to 6 dB), so the first bar takes little (2 bars: -3 dB; 4 bars: -1.6 dB on
 * the bar's mean) and each later bar more (4 bars: 4, 6, then the last to silence). Voices, held notes and the pump step down bar by bar on the
 * bar's middle share (counts rounded up, at least one fewer a bar while any are left): a share leaves every bar,
 * fewest remaining in the last; at the end bar line all of them are the section's (`to`).
 */
export function windSteps(bars: number, from: WindState, to: WindState): WindBar[] {
  const n = Math.max(1, Math.round(bars));
  const lerp = (a: number, b: number, s: number): number => b + (a - b) * s;
  const out: WindBar[] = [];
  // A count leaves at least one a bar while it is above the section's, so every bar is heard to take some.
  const count = (from: number, to: number, mid: number, prev: number): number =>
    Math.max(to, Math.min(prev - 1, Math.ceil(to + (from - to) * mid - 1e-9)));
  for (let i = 0; i < n; i++) {
    const share = i === n - 1 ? 0 : 1 - (i + 1) / n;
    const loud = Math.pow(share, 1.5);
    const wide = Math.sqrt(share);
    const mid = 1 - (i + 0.5) / n;
    const levels = {} as Record<DropLayer, number>;
    for (const k of DROP_LAYERS) levels[k] = lerp(from.levels[k], to.levels[k], loud);
    out.push({
      share,
      levels,
      comp: lerp(from.comp, to.comp, loud),
      spread: lerp(from.spread, to.spread, wide),
      verb: lerp(from.verb, to.verb, share),
      pump: lerp(from.pump, to.pump, mid),
      voices: count(from.voices, to.voices, mid, i ? out[i - 1].voices : from.voices),
      held: count(from.held, to.held, mid, i ? out[i - 1].held : from.held),
    });
  }
  return out;
}

/**
 * P10b (second fix, spec 8.9): one overlay voice on the audio clock, from its start to the moment it is let go (a
 * sustained note at its note-off, a hit when its decay has fallen 35 dB, a voice let go early on a wind-down bar line
 * at that bar line). Its release after that is a tail, not a voice. `held` names the instrument whose held notes it
 * doubles. The wind-down's allowance counts these, so "fewer voices each bar" is what sounds, not what was scheduled.
 */
export interface Sounding {
  start: number;
  off: number;
  held?: string;
}

/** Voices sounding at audio time `t` (started at or before it, not yet let go). */
export function soundingAt(voices: readonly Sounding[], t: number): number {
  let n = 0;
  for (const v of voices) if (v.start <= t + 1e-6 && v.off > t + 1e-6) n++;
  return n;
}

/** The most voices sounding at once in the window [a, b) of audio time. */
export function peakIn(voices: readonly Sounding[], a: number, b: number): number {
  let most = soundingAt(voices, a);
  for (const v of voices) if (v.start > a && v.start < b - 1e-6) most = Math.max(most, soundingAt(voices, v.start));
  return most;
}

/** The order in which held notes' doubles leave in a wind-down: the layers first, the bass last. */
export const HELD_ORDER = ["layer2", "layer1", "synth", "bass"];

/**
 * The voices to let go on a wind-down bar line `t` so that at most `cap` sound across it: every voice sounding there
 * past the cap, the ones not holding an instrument's notes first (oldest first), then the held doubles in
 * HELD_ORDER (oldest first within one).
 */
export function toLetGo<T extends Sounding>(voices: readonly T[], t: number, cap: number): T[] {
  const on = voices.filter((v) => v.start <= t + 1e-6 && v.off > t + 1e-6);
  const extra = on.length - Math.max(0, cap);
  if (extra <= 0) return [];
  const rank = (v: Sounding): number => (v.held === undefined ? -1 : Math.max(0, HELD_ORDER.indexOf(v.held)));
  return [...on].sort((x, y) => rank(x) - rank(y) || x.start - y.start).slice(0, extra);
}

/**
 * A wind-down bar's voice allowance (spec 8.9: fewer voices are let in each bar): the planned step, and never more
 * than one fewer than the most that sounded at once in the bar before (a bar that played fewer than its allowance
 * still leaves the next with fewer), never under the section's.
 */
export function windCap(planned: number, before: number, to = 0): number {
  return Math.max(to, Math.min(planned, before - 1));
}
