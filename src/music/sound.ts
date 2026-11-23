/**
 * Sound-parameter mappings (G3): knob values 0..1 to seconds, hertz and cents. Pure, no audio
 * dependency, unit-tested. Tempo-aware where a fixed time would not fit 170 to 176 bpm.
 */
import type { DrumVoice } from "./presets.ts";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** Seconds of one sixteenth at a tempo. */
export const sixteenthSeconds = (bpm: number): number => 60 / bpm / 4;

/** Kick end pitch: 35 Hz at 0, 80 Hz at 1 (about 49 Hz at 0.4). */
export function kickHz(pitch: number): number {
  return 35 * Math.pow(80 / 35, clamp01(pitch));
}

/** Decay of each drum voice at the middle of its dial, in seconds. */
export const DRUM_DECAY_BASE: Record<DrumVoice, number> = { kick: 0.2, clap: 0.07, hat: 0.035, open: 0.15, perc: 0.18, shaker: 0.05 };
/** The longest a voice may ring, in beats, before the pattern's own gaps cap it. */
export const DRUM_DECAY_MAX_BEATS: Record<DrumVoice, number> = { kick: 1.25, clap: 1, hat: 0.5, open: 1, perc: 1, shaker: 0.5 };
/** Release of each drum voice's envelope after its decay, in seconds. */
export const DRUM_RELEASE: Record<DrumVoice, number> = { kick: 0.05, clap: 0.02, hat: 0.01, open: 0.05, perc: 0.04, shaker: 0.015 };

/**
 * A drum voice's decay in seconds: 0.35x to 2.8x its base, capped at its beat limit for the tempo
 * and, given `gap` (sixteenths until the voice's next hit), so decay plus release ends before that
 * hit: a tail never runs into the next one at any tempo or decay (G3 review S2).
 */
export function drumDecay(voice: DrumVoice, amount: number, bpm: number, gap = Infinity): number {
  const s = DRUM_DECAY_BASE[voice] * Math.pow(2, (clamp01(amount) - 0.5) * 3);
  const room = 0.9 * gap * sixteenthSeconds(bpm) - DRUM_RELEASE[voice];
  return Math.max(0.005, Math.min(s, (DRUM_DECAY_MAX_BEATS[voice] * 60) / bpm, room));
}

/**
 * A drum voice's level as a gain multiplier on its C1 trim: 0 at 0, 1 at the default (the top).
 * The dial only lowers a voice from the trim C1 set against crackle, never raises it (G3 review M2).
 */
export const drumLevel = (amount: number): number => clamp01(amount);

/** Bass glide time: up to 150 ms, never more than three quarters of the note it slides into. */
export function glideSeconds(amount: number, noteSeconds: number): number {
  return Math.min(clamp01(amount) * 0.15, 0.75 * Math.max(0, noteSeconds));
}

/** Detune spread of the synth's two oscillators, 0 to 60 cents. */
export const detuneCents = (v: number): number => clamp01(v) * 60;

/** Sub oscillator gain: 0 at 0, 0.9 at the default (the top), so the dial never lifts the sub past its G1 level. */
export const subGain = (v: number): number => clamp01(v) * 0.9;

/**
 * Filter envelope: the filter rests at the XY cutoff (`baseHz`) and the envelope opens it by up to
 * five octaves, never past `maxHz`. Returns the depth in Hz added at the envelope's peak.
 */
export function envDepthHz(baseHz: number, amount: number, maxHz: number): number {
  const peak = Math.min(maxHz, baseHz * Math.pow(2, clamp01(amount) * 5));
  return Math.max(0, peak - baseHz);
}

/** Top of the layers' pad filter: the C1 ceiling every filter shares. */
export const PAD_TOP_HZ = 10000;

/** Pad brightness: the pad filter's top, 300 Hz at 0 to 10 kHz at 1 (about 1.2 kHz at the default 0.4). */
export function padBrightnessHz(v: number): number {
  return 300 * Math.pow(PAD_TOP_HZ / 300, clamp01(v));
}

/** Pad motion: how far the slow sweep closes the pad filter below its top, 0 to two octaves (in cents). */
export const padMotionCents = (v: number): number => clamp01(v) * 2400;

/**
 * C4 (P2): a held four-note pad measured about 13 dB over the same layer's lead and arp. Pad notes play
 * at this fraction of their velocity (-12 dB), so a mode switch keeps the layer's level and the Level and
 * Space macros act alike in every mode. Layer 2's default level and envelope changed to match (song.ts).
 */
export const PAD_TRIM = 0.25;

// ---- P7 (spec 8.7, 8.10) --------------------------------------------------------------------

/** Perc pitch: 110 Hz (a low tom) at 0 to 440 Hz (a high conga) at 1. */
export function percHz(pitch: number): number {
  return 110 * Math.pow(4, clamp01(pitch));
}

/** The FM wave's modulator ratios, a dial position 0..1 picking one: low ratios warm, 3.5 and up bell-like. */
export const FM_RATIOS = [0.5, 1, 1.5, 2, 3, 3.5, 4, 5, 7] as const;
export function fmRatio(v: number): number {
  return FM_RATIOS[Math.round(clamp01(v) * (FM_RATIOS.length - 1))];
}
/** The FM wave's index: 0 (a sine) to 12 (bright and metallic). */
export const fmIndex = (v: number): number => clamp01(v) * 12;

/** The synced filter LFO's rates, in beats per cycle, a dial position 0..1 picking one (4 bars down to a sixteenth). */
export const LFO_RATES = [16, 8, 4, 2, 1, 0.5, 1 / 3, 0.25] as const;
/** What the LFO rate dial shows: bars as "4b", note values as fractions (short enough for a dial's hole). */
export const LFO_RATE_LABEL = ["4b", "2b", "1b", "1/2", "1/4", "1/8", "1/8T", "1/16"] as const;
export function lfoBeats(v: number): number {
  return LFO_RATES[lfoRateIndex(v)];
}
export function lfoRateIndex(v: number): number {
  return Math.round(clamp01(v) * (LFO_RATES.length - 1));
}
/** How far the synced LFO closes the filter at the bottom of its cycle: up to three octaves, in cents. */
export const lfoDepthCents = (v: number): number => clamp01(v) * 3600;

/** The free-running drift (spec 8.10): one cycle in 120 s at 0 down to 4 s at 1. */
export function driftPeriod(v: number): number {
  return 120 * Math.pow(4 / 120, clamp01(v));
}
/** What the drift moves at full depth: the filter closes an octave, the pitch sinks 8 cents, the pan swings 0.6, the sends rise 0.3. */
export const DRIFT_MAX = { filterCents: 1200, pitchCents: 8, pan: 0.6, send: 0.3 } as const;

/** Swoop (spec 8.10): the glide between chords, 0.25 s at 0 to 8 s at 1. A pad glides only when its Swoop is above 0. */
export function swoopSeconds(v: number): number {
  return 0.25 * Math.pow(32, clamp01(v));
}
/** A drone's Swoop when the section does not set one: about 1.4 s. */
export const DRONE_SWOOP = 0.5;

/**
 * The long reverb (spec 8.10, up to 20 s) at the cost of a short one (P7): the impulse is never longer than
 * REVERB_IR seconds; a longer decay is its own exponential envelope cut at that length, carried on by feeding the
 * reverb's output back through a delay of exactly that length at the gain the envelope has fallen by over it, so the
 * tail goes on falling at the same rate. Decay is the time to fall 60 dB.
 */
export const REVERB_IR = 3.2;
export function reverbPlan(decay: number): { length: number; feedback: number } {
  const d = Math.max(0.1, decay);
  if (d <= REVERB_IR) return { length: d, feedback: 0 };
  return { length: REVERB_IR, feedback: Math.pow(10, (-3 * REVERB_IR) / d) };
}

/**
 * A stereo impulse of `seconds` at `rate`: seeded noise (never Math.random) under a 10 ms fade-in and an exponential
 * fall of 60 dB over `decay` seconds. Each channel draws its own noise.
 */
export function reverbImpulse(seconds: number, decay: number, rate: number, rng: { next(): number }): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const n = Math.max(1, Math.round(seconds * rate));
  const fade = Math.max(1, Math.round(0.01 * rate));
  const k = (3 * Math.LN10) / Math.max(0.1, decay); // amplitude falls by 10^-3 over `decay`
  const out: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(n), new Float32Array(n)];
  for (const ch of out)
    for (let i = 0; i < n; i++) ch[i] = (rng.next() * 2 - 1) * Math.exp((-k * i) / rate) * Math.min(1, i / fade);
  return out;
}
