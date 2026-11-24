/**
 * Effects (P9, spec 8.8): the twelve effects, the two slots per instrument and their knobs, as data and pure
 * mappings from a knob's 0..1 to what the engine sets. No audio dependency; the engine's src/engine/fx.ts builds the
 * sound from these. Unit-tested in src/engine/p9.test.ts.
 */
import { LFO_RATES, LFO_RATE_LABEL } from "./sound.ts";

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
/** A position 0..1 picking one of `n` steps. */
export const stepIndex = (v: number, n: number): number => Math.round(clamp01(v) * (n - 1));

export const EFFECTS = ["chorus", "phaser", "flanger", "fuzz", "crush", "tremolo", "pan", "gate", "ring", "vowel", "shifter", "echo"] as const;
export type EffectId = (typeof EFFECTS)[number];

/** Three knobs of an effect, each 0..1. */
export type FxKnobs = [number, number, number];

/** One effect slot: which effect, whether it is on, and its three knobs. */
export interface FxSlot {
  effect: EffectId;
  on: boolean;
  knobs: FxKnobs;
}

/** The two slots of one instrument. */
export type FxRack = [FxSlot, FxSlot];

/** Slots per instrument (spec 8.8: at most two effects per instrument). */
export const FX_SLOTS = 2;

/**
 * Most slots active at once across the app (spec 8.8). P9 measured all ten on at 72 to 78% audio load against 64 to 65%
 * with all off (tools/cost.py, median of 5, repeated), past the top of P7's 54 to 71%, so the cap is six (69%) (Pedro,
 * 24 Nov 2026: every effect and slot stays to choose from; switching on one past the cap turns off the slot switched on
 * longest ago).
 */
export const MAX_ACTIVE_FX = 6;

/** Rates in beats per cycle that move with the tempo (spec 8.8: Tremolo, Pan, Gate; Phaser and Flanger at a note value). */
export const SYNC_RATES = LFO_RATES;
export const SYNC_RATE_LABEL = LFO_RATE_LABEL;

/** Phaser and Flanger rates: four free rates in hertz, then note values from 8 bars to a quarter (tempo-synced). */
export const SWEEP_RATES: readonly ({ hz: number } | { beats: number })[] = [
  { hz: 0.05 },
  { hz: 0.1 },
  { hz: 0.25 },
  { hz: 0.5 },
  { beats: 32 },
  { beats: 16 },
  { beats: 8 },
  { beats: 4 },
  { beats: 2 },
  { beats: 1 },
];
export const SWEEP_RATE_LABEL = [".05 Hz", ".1 Hz", ".25 Hz", ".5 Hz", "8b", "4b", "2b", "1b", "1/2", "1/4"] as const;
export function sweepRate(v: number): { hz: number } | { beats: number } {
  return SWEEP_RATES[stepIndex(v, SWEEP_RATES.length)];
}
/** Cycles a second of a sweep rate at a tempo. */
export function rateHz(r: { hz: number } | { beats: number }, bpm: number): number {
  return "hz" in r ? r.hz : bpm / 60 / r.beats;
}

/** Echo times in beats (1/16 to 1/2, dotted values between). */
export const ECHO_BEATS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;
export const ECHO_LABEL = ["1/16", "1/8", "1/8.", "1/4", "1/4.", "1/2"] as const;
export const echoBeats = (v: number): number => ECHO_BEATS[stepIndex(v, ECHO_BEATS.length)];

/** Vowel's movement: off, or a cycle of 4 bars down to an eighth (tempo-synced). */
export const VOWEL_RATES = [0, 16, 8, 4, 2, 1, 0.5] as const;
export const VOWEL_RATE_LABEL = ["Still", "4b", "2b", "1b", "1/2", "1/4", "1/8"] as const;
export const vowelBeats = (v: number): number => VOWEL_RATES[stepIndex(v, VOWEL_RATES.length)];

/** Formants of five vowels (first three, Hz) and their levels. */
export const VOWELS = ["A", "E", "I", "O", "U"] as const;
export const FORMANTS: readonly (readonly [number, number, number])[] = [
  [700, 1220, 2600],
  [400, 1700, 2600],
  [290, 1870, 2800],
  [450, 800, 2830],
  [325, 700, 2530],
];
export const FORMANT_GAINS = [1, 0.6, 0.3] as const;
/** The three formants at a Vowel position 0..1 (A at 0, U at 1), between vowels on a log scale. */
export function formantsAt(v: number): [number, number, number] {
  const x = clamp01(v) * (FORMANTS.length - 1);
  const i = Math.min(FORMANTS.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((k) => FORMANTS[i][k] * Math.pow(FORMANTS[i + 1][k] / FORMANTS[i][k], f)) as [number, number, number];
}
/** Where Vowel's movement swings to: the next vowel along (from U back towards O). */
export function vowelSwing(v: number): number {
  const step = 1 / (FORMANTS.length - 1);
  return clamp01(v) + step <= 1 ? clamp01(v) + step : clamp01(v) - step;
}
/** Cents from one set of formants to another, formant by formant. */
export const formantCents = (from: readonly number[], to: readonly number[]): number[] => from.map((f, k) => 1200 * Math.log2(to[k] / f));

/** Gate patterns: 16 sixteenths each, 1 open, 0 closed. */
export const GATE_PATTERNS: readonly { name: string; steps: string }[] = [
  { name: "8ths", steps: "x.x.x.x.x.x.x.x." },
  { name: "16ths", steps: "xx.xxx.xxx.xxx.x" },
  { name: "Off", steps: ".x.x.x.x.x.x.x.x" },
  { name: "Trance", steps: "x.xxx.xxx.xxx.xx" },
  { name: "Skip", steps: "x..x..x..x..x.x." },
  { name: "Stab", steps: "x...x...x...x..." },
  { name: "Broken", steps: "x.x..xx.x..x.xx." },
  { name: "Long", steps: "xxxxxx..xxxxxx.." },
];
export const gatePattern = (v: number): string => GATE_PATTERNS[stepIndex(v, GATE_PATTERNS.length)].steps;
/** Whether a gate pattern is open on a sixteenth. */
export const gateOpen = (pattern: string, step: number): boolean => pattern[((step % 16) + 16) % 16] === "x";
/**
 * Gate's Smooth: the time constant of each open or close, 3 to 30 ms. P9 review M2: no shorter than 3 ms, so a
 * close on a sustained pad is not a click.
 */
export const gateTau = (v: number): number => 0.003 + clamp01(v) * 0.027;

/**
 * Tremolo's and Pan's Shape at its square end: the sine LFO through tanh(SQUARE_STEEPNESS x). Its swing from 10% to
 * 90% of the way takes `squareEdgeSeconds` of a cycle; P9 review M2 wants it no shorter than 3 ms at the fastest rate
 * and tempo (unit-tested).
 */
export const SQUARE_STEEPNESS = 6;
export function squareEdgeSeconds(hz: number, k = SQUARE_STEEPNESS): number {
  // tanh(k sin(wt)) / tanh(k) from -0.8 to 0.8.
  const x = Math.atanh(0.8 * Math.tanh(k)) / k;
  return (2 * Math.asin(x)) / (2 * Math.PI * hz);
}

/** Chorus rate, 0.1 to 4 Hz, and depth, up to 5 ms of swing. */
export const chorusHz = (v: number): number => 0.1 * Math.pow(40, clamp01(v));
export const chorusDepth = (v: number): number => clamp01(v) * 0.005;
/** Phaser depth: up to an octave and a half each way, in cents. */
export const phaserCents = (v: number): number => clamp01(v) * 1800;
/** Flanger and Echo feedback, at most 0.85. */
export const feedback = (v: number): number => clamp01(v) * 0.85;
/** Fuzz drive (1 to 41 times into a hard clip) and tone (a low-pass 500 Hz to 8 kHz, under C1's 10 kHz). */
export const fuzzDrive = (v: number): number => 1 + clamp01(v) * 40;
export const fuzzToneHz = (v: number): number => 500 * Math.pow(16, clamp01(v));
/** Crush: bits 2 to 12, and the rate it holds samples at, 1.5 kHz to 44 kHz. */
export const crushBits = (v: number): number => 2 + clamp01(v) * 10;
export const crushRate = (v: number): number => 1500 * Math.pow(2, clamp01(v) * 4.9);
/** Ring: the carrier's own pitch, 30 Hz to 2 kHz. With Follow it moves towards the note played. */
export const ringHz = (v: number): number => 30 * Math.pow(2000 / 30, clamp01(v));
export function ringCarrier(pitch: number, follow: number, noteHz: number | null): number {
  const f = noteHz === null ? 0 : clamp01(follow);
  return Math.pow(ringHz(pitch), 1 - f) * Math.pow(noteHz ?? 1, f);
}
/** Shifter: down or up by up to 600 Hz, none at the middle. */
export function shiftHz(v: number): number {
  const s = 2 * clamp01(v) - 1;
  return Math.sign(s) * 600 * s * s;
}
/** Shifter feedback, at most 0.8. */
export const shiftFeedback = (v: number): number => clamp01(v) * 0.8;

/** Equal-power dry and wet for a Mix knob. `half`: at most an even blend (for effects heard against their own dry). */
export function mixGains(v: number, half = false): [number, number] {
  const a = (clamp01(v) * Math.PI) / (half ? 4 : 2);
  return [Math.cos(a), Math.sin(a)];
}

// ---- What the screen shows -------------------------------------------------------------------

export interface FxKnobDef {
  label: string;
  text: (v: number) => string;
}

export interface EffectDef {
  /** The effect's name: the Simple button's word (spec 8.8). */
  name: string;
  knobs: [FxKnobDef, FxKnobDef, FxKnobDef];
  /** Where a slot starts when this effect is picked. */
  defaults: FxKnobs;
}

const pct = (v: number): string => String(Math.round(clamp01(v) * 100));
const MIX: FxKnobDef = { label: "Mix", text: pct };
const hz = (x: number): string => (x < 10 ? x.toFixed(1) : String(Math.round(x)));
const SYNC_RATE: FxKnobDef = { label: "Rate", text: (v) => SYNC_RATE_LABEL[stepIndex(v, SYNC_RATES.length)] };
const SWEEP_RATE: FxKnobDef = { label: "Rate", text: (v) => SWEEP_RATE_LABEL[stepIndex(v, SWEEP_RATES.length)] };
const SHAPE: FxKnobDef = { label: "Shape", text: pct };
const DEPTH: FxKnobDef = { label: "Depth", text: pct };
const FEEDBACK: FxKnobDef = { label: "Feedback", text: pct };

export const EFFECT_DEFS: Record<EffectId, EffectDef> = {
  chorus: { name: "Chorus", knobs: [MIX, { label: "Rate", text: (v) => hz(chorusHz(v)) }, DEPTH], defaults: [0.7, 0.35, 0.55] },
  phaser: { name: "Phaser", knobs: [MIX, SWEEP_RATE, DEPTH], defaults: [0.8, 0.85, 0.7] },
  flanger: { name: "Flanger", knobs: [MIX, SWEEP_RATE, FEEDBACK], defaults: [0.7, 0.7, 0.55] },
  fuzz: { name: "Fuzz", knobs: [{ label: "Amount", text: pct }, { label: "Tone", text: (v) => hz(fuzzToneHz(v) / 1000) + "k" }, MIX], defaults: [0.45, 0.5, 0.7] },
  crush: { name: "Crush", knobs: [{ label: "Bits", text: (v) => String(Math.round(crushBits(v))) }, { label: "Rate", text: (v) => hz(crushRate(v) / 1000) + "k" }, MIX], defaults: [0.3, 0.45, 0.8] },
  tremolo: { name: "Tremolo", knobs: [DEPTH, SYNC_RATE, SHAPE], defaults: [0.7, 0.71, 0.3] },
  pan: { name: "Pan", knobs: [DEPTH, SYNC_RATE, SHAPE], defaults: [0.8, 0.43, 0.2] },
  gate: { name: "Gate", knobs: [{ label: "Pattern", text: (v) => GATE_PATTERNS[stepIndex(v, GATE_PATTERNS.length)].name }, DEPTH, { label: "Smooth", text: pct }], defaults: [0, 0.9, 0.3] },
  ring: { name: "Ring", knobs: [MIX, { label: "Pitch", text: (v) => hz(ringHz(v)) }, { label: "Follow", text: pct }], defaults: [0.6, 0.45, 0] },
  vowel: { name: "Vowel", knobs: [MIX, { label: "Vowel", text: (v) => VOWELS[stepIndex(v, VOWELS.length)] }, { label: "Rate", text: (v) => VOWEL_RATE_LABEL[stepIndex(v, VOWEL_RATES.length)] }], defaults: [0.85, 0.25, 0.5] },
  shifter: { name: "Shifter", knobs: [MIX, { label: "Shift", text: (v) => { const s = Math.round(shiftHz(v)); return s > 0 ? `+${s}` : String(s); } }, FEEDBACK], defaults: [0.6, 0.62, 0.3] },
  echo: { name: "Echo", knobs: [MIX, { label: "Time", text: (v) => ECHO_LABEL[stepIndex(v, ECHO_BEATS.length)] }, FEEDBACK], defaults: [0.45, 0.6, 0.45] },
};

/** An effect's slot at its starting knobs. */
export function fxSlot(effect: EffectId, on = false, knobs?: FxKnobs): FxSlot {
  return { effect, on, knobs: knobs ? [...knobs] : [...EFFECT_DEFS[effect].defaults] };
}

/** The two slots an instrument has when its song does not set them: both off. */
export const DEFAULT_FX: Record<"drums" | "bass" | "synth" | "layer1" | "layer2", [EffectId, EffectId]> = {
  drums: ["crush", "echo"],
  bass: ["fuzz", "chorus"],
  synth: ["chorus", "echo"],
  layer1: ["echo", "phaser"],
  layer2: ["chorus", "tremolo"],
};

export function defaultRack(inst: keyof typeof DEFAULT_FX): FxRack {
  return [fxSlot(DEFAULT_FX[inst][0]), fxSlot(DEFAULT_FX[inst][1])];
}

/** Every problem with a slot, pushed onto `errors`. */
export function checkFxSlot(s: unknown, at: string, errors: string[]): void {
  if (typeof s !== "object" || s === null || Array.isArray(s)) return void errors.push(`${at}: not an object`);
  const o = s as Record<string, unknown>;
  if (!(EFFECTS as readonly unknown[]).includes(o.effect)) errors.push(`${at}.effect: unknown effect`);
  if (typeof o.on !== "boolean") errors.push(`${at}.on: must be true or false`);
  const k = o.knobs;
  if (!Array.isArray(k) || k.length !== 3 || !k.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1))
    errors.push(`${at}.knobs: must be three values 0..1`);
}

// ---- The cap on active slots --------------------------------------------------------------

/** A slot's key in the activation order: "bass:1". */
export const fxKey = (inst: string, slot: number): string => `${inst}:${slot}`;

/**
 * Switch a slot on under the cap: it joins the order (newest last); past the cap the slot switched on longest ago
 * leaves it and is returned, to be switched off. Pure.
 */
export function activate(order: readonly string[], key: string, cap = MAX_ACTIVE_FX): { order: string[]; off: string[] } {
  const next = [...order.filter((k) => k !== key), key];
  const off: string[] = [];
  while (next.length > Math.max(1, cap)) off.push(next.shift()!);
  return { order: next, off };
}

/** A slot switched off leaves the order. */
export const deactivate = (order: readonly string[], key: string): string[] => order.filter((k) => k !== key);
