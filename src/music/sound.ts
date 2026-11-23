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
export const DRUM_DECAY_BASE: Record<DrumVoice, number> = { kick: 0.2, clap: 0.07, hat: 0.035, open: 0.15 };
/** The longest a voice may ring, in beats, before the pattern's own gaps cap it. */
export const DRUM_DECAY_MAX_BEATS: Record<DrumVoice, number> = { kick: 1.25, clap: 1, hat: 0.5, open: 1 };
/** Release of each drum voice's envelope after its decay, in seconds. */
export const DRUM_RELEASE: Record<DrumVoice, number> = { kick: 0.05, clap: 0.02, hat: 0.01, open: 0.05 };

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
