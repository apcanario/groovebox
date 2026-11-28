/**
 * F2 (spec 10.5): the kick's four parts as numbers. Pure, no audio dependency, unit-tested.
 *
 * - Click: a burst of a few milliseconds (`kickClick`, scaled by Punch). 0 at the default: the old kick had none.
 * - Sweep: the pitch falls from `sweepRatio` times the body to the body over `KICK_SWEEP_S`. With Root off, Punch
 *   moves the ratio 2x to 7x: the default Punch, 0.5, is the old membrane's 4.5x over 45 ms (about 220 Hz down to 49 Hz
 *   at the default Pitch), so the ten other vibes are unchanged. With Root on, Punch sets the start in hertz
 *   (`sweepStartHz`), so the top vibes' Punch values start the sweep in spec 10.5's 150 to 200 Hz in any key.
 * - Body: a sine at `bodyHz`: the song's root in its octave nearest 45 to 60 Hz with Root on, the Pitch dial (Tune) as
 *   built with it off.
 * - Tail: the body's decay, the Length axis: the kick's Decay dial as built (`drumDecay`), so a song that never set
 *   Length keeps the old kick's length.
 *
 * Every value is read when a hit starts, so a move acts from the next kick and never steps a sounding one.
 */
import { kickHz } from "./sound.ts";
import { NOTE_NAMES, type KeyName } from "./scales.ts";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** The kick's own settings over the drum patch. Optional in a song: a missing one is its default (KICK_DEFAULTS). */
export interface KickSettings {
  /** Quadrant up: sweep depth and click together, 0..1. */
  kickPunch: number;
  /** Advanced: the click's level, 0..1 (0, no click). */
  kickClick: number;
  /** Advanced: the Root switch, 0 off (Tune, the Pitch dial as built) or 1 on (the song's root). */
  kickRoot: number;
}
export const KICK_KEYS = ["kickPunch", "kickClick", "kickRoot"] as const satisfies readonly (keyof KickSettings)[];
export type KickKey = (typeof KICK_KEYS)[number];

/** The defaults reproduce the membrane kick of before F2: its sweep, no click, the Pitch dial. */
export const KICK_DEFAULTS: KickSettings = { kickPunch: 0.5, kickClick: 0, kickRoot: 0 };

/** The sweep's length, in seconds (the membrane's pitch decay). */
export const KICK_SWEEP_S = 0.045;
/** The click's length, in seconds. */
export const KICK_CLICK_S = 0.004;
/** The click's level at Click 1 and Punch 1, against a body at velocity 1. */
export const KICK_CLICK_MAX = 0.5;
/** The band the body sits in with Root on (spec 10.5). */
export const KICK_BAND: readonly [number, number] = [45, 60];

/** Sweep start over the body: 2x at Punch 0, 4.5x (the old kick) at 0.5, 7x at 1. */
export const sweepRatio = (punch: number): number => 2 + 5 * clamp01(punch);

/** With Root on, the Punch values the top vibes use (KICK_PUNCH_BAND) start the sweep in this band (spec 10.5). */
export const KICK_SWEEP_BAND: readonly [number, number] = [150, 200];
/** The Punch values that map onto KICK_SWEEP_BAND: the top vibes' range, Ambient's 0.2 to Drum and bass's 0.7. */
export const KICK_PUNCH_BAND: readonly [number, number] = [0.2, 0.7];

/** With Root on, the sweep's start in hertz: geometric in Punch, 150 Hz at Punch 0.2 and 200 Hz at 0.7 (134 to 238 Hz
 *  over the whole axis), whatever the key. */
export function sweepStartHz(punch: number): number {
  const [f0, f1] = KICK_SWEEP_BAND;
  const [p0, p1] = KICK_PUNCH_BAND;
  return f0 * Math.pow(f1 / f0, (clamp01(punch) - p0) / (p1 - p0));
}

/** The click's gain: the Click dial, more of it with Punch (half at Punch 0, 1.5x at Punch 1). */
export const clickGain = (click: number, punch: number): number => KICK_CLICK_MAX * clamp01(click) * (0.5 + clamp01(punch)) / 1.5;

/** A pitch class's octave nearest the kick band: inside it where one octave falls inside, else the nearer edge's. */
export function rootBodyHz(key: KeyName): number {
  const pc = NOTE_NAMES.indexOf(key);
  const [lo, hi] = KICK_BAND;
  let best = 0;
  let bestDist = Infinity;
  for (let oct = -4; oct <= 0; oct++) {
    const hz = 440 * Math.pow(2, (pc - 9) / 12 + oct);
    const d = hz < lo ? Math.log2(lo / hz) : hz > hi ? Math.log2(hz / hi) : 0;
    if (d < bestDist) {
      best = hz;
      bestDist = d;
    }
  }
  return best;
}

/** A kick setting from a patch, its default where the patch has none (a song saved before F2, the ten other vibes). */
export function kickSetting(p: Partial<KickSettings>, k: KickKey): number {
  const v = p[k];
  return typeof v === "number" && Number.isFinite(v) ? v : KICK_DEFAULTS[k];
}

/** What one hit plays. */
export interface KickShape {
  bodyHz: number;
  sweepRatio: number;
  sweepS: number;
  clickGain: number;
  clickS: number;
}

/** One hit's shape from the settings, the Pitch dial and the song's key. */
export function kickShape(s: KickSettings, pitch: number, key: KeyName): KickShape {
  const root = s.kickRoot >= 0.5;
  const bodyHz = root ? rootBodyHz(key) : kickHz(pitch);
  return {
    bodyHz,
    sweepRatio: root ? sweepStartHz(s.kickPunch) / bodyHz : sweepRatio(s.kickPunch),
    sweepS: KICK_SWEEP_S,
    clickGain: clickGain(s.kickClick, s.kickPunch),
    clickS: KICK_CLICK_S,
  };
}
