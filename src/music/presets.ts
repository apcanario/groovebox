/** Bass rhythm, synth rhythm and drum presets. 16 steps per bar. No audio dependency. */

export interface RhythmHit {
  step: number; // 0..15
  len: number; // in steps
  vel: number; // 0..1
}

export const BASS_PRESETS = ["offbeat", "rolling", "long", "dnbSub"] as const;
export type BassPreset = (typeof BASS_PRESETS)[number];

export const BASS_RHYTHMS: Record<BassPreset, RhythmHit[]> = {
  offbeat: [2, 6, 10, 14].map((step) => ({ step, len: 1.6, vel: 0.9 })),
  rolling: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((step) => ({
    step,
    len: 0.8,
    vel: step % 2 === 0 ? 0.9 : 0.7,
  })),
  long: [
    { step: 0, len: 7.5, vel: 0.9 },
    { step: 8, len: 7.5, vel: 0.85 },
  ],
  dnbSub: [
    { step: 0, len: 6, vel: 0.95 },
    { step: 10, len: 5.5, vel: 0.9 },
  ],
};

export const SYNTH_PRESETS = ["stabs", "offbeat", "sustained"] as const;
export type SynthPreset = (typeof SYNTH_PRESETS)[number];

export const SYNTH_RHYTHMS: Record<SynthPreset, RhythmHit[]> = {
  stabs: [
    { step: 0, len: 1.4, vel: 0.9 },
    { step: 3, len: 1.4, vel: 0.65 },
    { step: 6, len: 1.4, vel: 0.65 },
    { step: 11, len: 1.4, vel: 0.65 },
    { step: 14, len: 1.4, vel: 0.65 },
  ],
  offbeat: [2, 6, 10, 14].map((step) => ({ step, len: 1.2, vel: 0.75 })),
  // Sustained holds the chord; the sequencer stretches it to the chord's length.
  sustained: [{ step: 0, len: 16, vel: 0.7 }],
};

export const DRUM_VOICES = ["kick", "clap", "hat", "open"] as const;
export type DrumVoice = (typeof DRUM_VOICES)[number];

export const DRUM_PRESETS = ["fourFloor", "houseShuffle", "techno", "twoStep", "dnb"] as const;
export type DrumPreset = (typeof DRUM_PRESETS)[number];

/** Velocity per step (0 = off), 16 steps per voice. */
export type DrumGrid = Record<DrumVoice, number[]>;

export interface DrumPattern {
  grid: DrumGrid;
  /** Delay of odd sixteenths, as a fraction of a step (0 = straight). */
  swing: number;
}

function row(hits: Record<number, number>): number[] {
  return Array.from({ length: 16 }, (_, i) => hits[i] ?? 0);
}

export const DRUM_PATTERNS: Record<DrumPreset, DrumPattern> = {
  fourFloor: {
    swing: 0,
    grid: {
      kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
      clap: row({ 4: 0.9, 12: 0.9 }),
      hat: row({ 1: 0.3, 3: 0.3, 5: 0.3, 7: 0.3, 9: 0.3, 11: 0.3, 13: 0.3, 15: 0.3 }),
      open: row({ 2: 0.8, 6: 0.8, 10: 0.8, 14: 0.8 }),
    },
  },
  houseShuffle: {
    swing: 0.18,
    grid: {
      kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
      clap: row({ 4: 0.9, 12: 0.9, 15: 0.3 }),
      hat: row({ 1: 0.4, 3: 0.5, 5: 0.4, 7: 0.5, 9: 0.4, 11: 0.5, 13: 0.4, 15: 0.5 }),
      open: row({ 2: 0.7, 6: 0.7, 10: 0.7, 14: 0.7 }),
    },
  },
  techno: {
    swing: 0,
    grid: {
      kick: row({ 0: 1, 4: 1, 8: 1, 12: 1 }),
      clap: row({ 12: 0.6 }),
      hat: row(Object.fromEntries(Array.from({ length: 16 }, (_, i) => [i, i % 4 === 2 ? 0 : i % 2 ? 0.35 : 0.2]))),
      open: row({ 2: 0.7, 6: 0.7, 10: 0.7, 14: 0.7 }),
    },
  },
  twoStep: {
    swing: 0.22,
    grid: {
      kick: row({ 0: 1, 7: 0.7, 10: 0.9 }),
      clap: row({ 4: 0.9, 12: 0.9 }),
      hat: row({ 1: 0.3, 2: 0.6, 5: 0.3, 6: 0.6, 9: 0.3, 10: 0.6, 13: 0.3, 14: 0.6 }),
      open: row({ 15: 0.5 }),
    },
  },
  dnb: {
    swing: 0,
    grid: {
      kick: row({ 0: 1, 10: 0.95 }),
      clap: row({ 4: 1, 12: 1, 15: 0.3 }),
      hat: row({ 0: 0.3, 2: 0.5, 4: 0.3, 6: 0.5, 8: 0.3, 10: 0.5, 12: 0.3 }),
      open: row({ 14: 0.6 }),
    },
  },
};
