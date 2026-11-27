/**
 * F0 (C24): the bass's oscillators run for the life of their voice set. Pure: the clock and the sources are passed in
 * (Tone's context and the voice set's oscillators in the app).
 *
 * Why (bundle 7b review E1): a Tone synth starts its oscillator at every note and builds the native node inside that
 * start. The wave and its sine sub at one pitch were two such starts per note, so on a stalled main thread the sub's
 * native start could reach the audio thread after the note's time and begin late; legato kept the offset, and the sub
 * cancelled the wave's fundamental (master 0.5 to 1.5 dB down) until a gap in the bass. Now a voice set's oscillators
 * are started together once, while the set is silent, and a note only opens their envelopes, so no note can start one
 * without the other.
 */
import { LATE_LEAD, MIN_GAP } from "./attacks.ts";

/** An oscillator of a voice set: Tone's Source start and stop, at audio times. */
export interface RunSource {
  start(time: number): unknown;
  stop(time: number): unknown;
}

/** The audio time now (the context's currentTime). */
export interface RunClock {
  currentTime(): number;
}

/**
 * How far past the current time a voice set's oscillators start, in seconds. No longer than `LATE_LEAD`: a note is never
 * started before the current time plus `LATE_LEAD` (attacks.ts), so a set started now runs before its first note.
 */
export const RUN_LEAD = LATE_LEAD;

/**
 * How much of `RUN_LEAD` must be left once every start is made, in seconds: about two render quanta at 44.1 kHz. With
 * less, the audio thread may already have passed the start time and clamped one start and not the other.
 */
export const RUN_MARGIN = 0.006;

/** How many times a set is started before its start is taken as it stands (a main thread stalled each time). */
export const RUN_TRIES = 8;

/**
 * F0 review M1: how many sets `startTogether` kept after `RUN_TRIES` without the margin left, so their starts may have
 * reached the audio thread apart. Read by the smoke test, which requires 0.
 */
export const bassRunStats = { giveUps: 0 };

/**
 * Start `sources` together at one audio time and return it. The time is read once, every start is made, then the clock
 * is read again: if less than `RUN_MARGIN` is left (the main thread stalled while Tone built the native nodes), the
 * starts may not all have reached the audio thread in time, so every source is stopped and started again, later.
 */
export function startTogether(sources: readonly RunSource[], clock: RunClock): number {
  let t = clock.currentTime() + RUN_LEAD;
  for (let tries = 1; ; tries++) {
    for (const s of sources) s.start(t);
    const cur = clock.currentTime();
    if (cur + RUN_MARGIN <= t) return t;
    if (tries >= RUN_TRIES) {
      bassRunStats.giveUps++;
      return t;
    }
    const stopAt = Math.max(cur, t) + MIN_GAP;
    for (const s of sources) s.stop(stopAt);
    t = Math.max(clock.currentTime() + RUN_LEAD, stopAt + MIN_GAP);
  }
}

/** A Tone synth as `gateOnly` reaches it: its envelope and the two calls Monophonic makes at each note. */
export interface GatedSynth {
  envelope: { triggerAttack(time: number, velocity?: number): unknown; triggerRelease(time: number): unknown };
  _triggerEnvelopeAttack(time: number, velocity?: number): void;
  _triggerEnvelopeRelease(time: number): void;
}

/**
 * Make a synth's notes open and close only its envelope: Tone's Synth also starts its oscillator at each attack and
 * stops it after each release (or after the decay when sustain is 0). Its oscillator is started once, by `startTogether`.
 */
export function gateOnly(s: GatedSynth): void {
  s._triggerEnvelopeAttack = (time, velocity) => void s.envelope.triggerAttack(time, velocity);
  s._triggerEnvelopeRelease = (time) => void s.envelope.triggerRelease(time);
}

/** Below this envelope level a voice is taken as silent (the level `Bass` retires a voice set at). */
export const SILENT = 1e-4;

/**
 * F0 review E1: whether a previous voice set may be retired. The sub's pitch is its wave's frequency signal, so the wave
 * and the sub retire as one pair, only once every envelope of the pair is silent: a wave disposed under a sounding sub
 * (Sustain 0 silences the wave while the sub's sustain is at least 0.6) took the sub's frequency to 0 Hz and left it on
 * a DC level for its whole release.
 */
export function pairSilent(levels: readonly number[]): boolean {
  return levels.every((l) => l < SILENT);
}
