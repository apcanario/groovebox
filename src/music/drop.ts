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
 * The follower's next gain from the current one `c` and the gain that would bring the drop to the section's level
 * (`aim`), never over `top`: at most `stepDb` a beat, and unchanged when within `deadDb` of it.
 */
export function followStep(c: number, aim: number, stepDb: number, deadDb: number, top = Infinity): number {
  if (Math.abs(20 * Math.log10(aim / c)) < deadDb) return c;
  const k = Math.pow(10, stepDb / 20);
  return Math.min(top, c * k, Math.max(c / k, aim));
}
