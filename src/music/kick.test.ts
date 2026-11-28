/** F2 (spec 10.5): the kick's numbers. */
import { describe, expect, it } from "vitest";
import { KICK_BAND, KICK_DEFAULTS, KICK_SWEEP_BAND, KICK_SWEEP_S, clickGain, kickSetting, kickShape, rootBodyHz, sweepRatio, type KickSettings } from "./kick.ts";
import { kickHz } from "./sound.ts";
import { NOTE_NAMES, type KeyName } from "./scales.ts";
import { defaultPatch, validateSong } from "../engine/song.ts";
import { STYLE_IDS, TOP_IDS, vibeSong } from "./styles.ts";

const cents = (a: number, b: number): number => 1200 * Math.log2(a / b);
/** Cents from `hz` to the nearest octave of a pitch class. */
const toPitchClass = (hz: number, key: KeyName): number => {
  const c = cents(hz, 440 * Math.pow(2, (NOTE_NAMES.indexOf(key) - 9) / 12));
  return c - 1200 * Math.round(c / 1200);
};

describe("the kick's defaults reproduce the membrane kick", () => {
  it("its sweep, no click, the Pitch dial", () => {
    expect(KICK_DEFAULTS).toEqual({ kickPunch: 0.5, kickClick: 0, kickRoot: 0 });
    const s = kickShape(KICK_DEFAULTS, 0.4, "C");
    expect(s.sweepRatio).toBe(4.5); // MembraneSynth octaves 4.5 (a multiplier in Tone)
    expect(s.sweepS).toBe(0.045);
    expect(s.clickGain).toBe(0);
    expect(s.bodyHz).toBeCloseTo(kickHz(0.4), 9);
  });

  it("a patch without kick settings reads the defaults", () => {
    const p = defaultPatch("drums");
    expect(kickSetting(p, "kickPunch")).toBe(0.5);
    expect(kickSetting(p, "kickClick")).toBe(0);
    expect(kickSetting(p, "kickRoot")).toBe(0);
    expect(kickSetting({ ...p, kickPunch: 0.9 }, "kickPunch")).toBe(0.9);
  });

  it("the ten other vibes' songs carry no kick settings", () => {
    for (const id of STYLE_IDS.filter((i) => !TOP_IDS.includes(i))) {
      const d = vibeSong(id)!.patches.drums;
      expect([d.kickPunch, d.kickClick, d.kickRoot], id).toEqual([undefined, undefined, undefined]);
    }
  });
});

describe("Root tunes the body to the song's root (spec 10.5)", () => {
  it("every key: within 30 cents of the root, in 45 to 60 Hz where an octave falls there", () => {
    for (const key of NOTE_NAMES) {
      const hz = rootBodyHz(key);
      expect(Math.abs(toPitchClass(hz, key)), key).toBeLessThan(30);
      const inBand = [hz / 2, hz, hz * 2].some((f) => f >= KICK_BAND[0] && f <= KICK_BAND[1]);
      if (inBand) expect(hz >= KICK_BAND[0] && hz <= KICK_BAND[1], `${key} ${hz}`).toBe(true);
      // Otherwise the octave nearest the band: no more than half an octave outside it.
      expect(hz).toBeGreaterThan(KICK_BAND[0] / Math.SQRT2);
      expect(hz).toBeLessThan(KICK_BAND[1] * Math.SQRT2);
    }
  });

  it("A is 55 Hz, G 49, F# 46.2; Root off is the Pitch dial", () => {
    expect(rootBodyHz("A")).toBeCloseTo(55, 6);
    expect(rootBodyHz("G")).toBeCloseTo(49.0, 1);
    expect(rootBodyHz("F#")).toBeCloseTo(46.25, 1);
    const on = { ...KICK_DEFAULTS, kickRoot: 1 };
    expect(kickShape(on, 0.9, "A").bodyHz).toBeCloseTo(55, 6);
    expect(kickShape(KICK_DEFAULTS, 0.9, "A").bodyHz).toBeCloseTo(kickHz(0.9), 9);
  });
});

describe("Punch and Click", () => {
  it("Root off: Punch moves the sweep from 2x to 7x the body; Root on: Punch 0.3 starts it in 150 to 200 Hz", () => {
    expect(sweepRatio(0)).toBe(2);
    expect(sweepRatio(1)).toBe(7);
    expect(sweepRatio(-1)).toBe(2);
    const mid = kickShape({ ...KICK_DEFAULTS, kickRoot: 1, kickPunch: 0.3 }, 0.4, "A");
    expect(mid.bodyHz * mid.sweepRatio).toBeGreaterThan(150);
    expect(mid.bodyHz * mid.sweepRatio).toBeLessThan(200);
    expect(KICK_SWEEP_S).toBeLessThan(0.05);
  });

  it("every top vibe, in all twelve keys, starts its sweep in 150 to 200 Hz (spec 10.5)", () => {
    for (const id of TOP_IDS) {
      const d = vibeSong(id)!.patches.drums as unknown as KickSettings & { pitch: number };
      expect(d.kickRoot, id).toBe(1);
      for (const key of NOTE_NAMES) {
        const s = kickShape(d, d.pitch, key);
        const start = s.bodyHz * s.sweepRatio;
        expect(start, `${id} in ${key}`).toBeGreaterThanOrEqual(KICK_SWEEP_BAND[0] - 1e-9);
        expect(start, `${id} in ${key}`).toBeLessThanOrEqual(KICK_SWEEP_BAND[1] + 1e-9);
      }
    }
  });

  it("with Root on, Punch still moves the sweep's start, and with Root off it keeps the old ratio", () => {
    const on = (p: number) => kickShape({ ...KICK_DEFAULTS, kickRoot: 1, kickPunch: p }, 0.4, "D");
    expect(on(0).bodyHz * on(0).sweepRatio).toBeLessThan(on(1).bodyHz * on(1).sweepRatio);
    expect(kickShape({ ...KICK_DEFAULTS, kickPunch: 1 }, 0.4, "D").sweepRatio).toBe(7);
  });

  it("the click is off at Click 0 and rises with Punch", () => {
    expect(clickGain(0, 1)).toBe(0);
    expect(clickGain(1, 0)).toBeLessThan(clickGain(1, 1));
    expect(clickGain(1, 1)).toBeLessThanOrEqual(0.5);
  });

  it("a song with kick settings in range is valid, one out of range is not", () => {
    const song = vibeSong(STYLE_IDS[0])!;
    song.patches.drums = { ...song.patches.drums, kickPunch: 1, kickClick: 0.3, kickRoot: 1 };
    expect(validateSong(song)).toEqual([]);
    song.patches.drums.kickClick = 2;
    expect(validateSong(song)).toContain("patches.drums.kickClick: must be 0..1");
  });
});
