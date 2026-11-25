import { describe, expect, it } from "vitest";
import { DROP_LAYERS, DROP_TYPICAL, dropLevels, dropSpread, peakIn, resolveDrop, soundingAt, toLetGo, windCap, windSteps, type Sounding, type WindBar, type WindState } from "./drop.ts";
import { STYLES, STYLE_IDS } from "./styles.ts";

/** P10b (C21, spec 8.9): the wind-down eases every part of the drop back to the section, bar by bar. */

/** The drop as it stands when the second press lands, for a vibe's recipe: its layers, width, pump and a bloom's reverb. */
function dropState(id: string, wind: 2 | 4, comp: number, voices = 35): { from: WindState; to: WindState; bars: number } {
  const r = resolveDrop(STYLES[id].drop, { wind });
  const knob = 0.6;
  const from: WindState = {
    levels: dropLevels(r, DROP_TYPICAL),
    comp,
    spread: dropSpread(r.width),
    verb: r.bloom && r.parts.reverb ? 0.45 : 0,
    pump: knob + r.pump,
    voices,
    held: 4,
  };
  const to: WindState = { levels: { synth: 0, bass: 0, drums: 0, leads: 0 }, comp: 1, spread: 0, verb: 0, pump: knob, voices: 0, held: 0 };
  return { from, to, bars: r.wind };
}

/** Every value the wind-down eases, by name, from a state or a bar. */
function values(s: WindState): Record<string, number> {
  const out: Record<string, number> = { comp: s.comp, spread: s.spread, verb: s.verb, pump: s.pump, voices: s.voices, held: s.held };
  for (const k of DROP_LAYERS) out[`level.${k}`] = s.levels[k];
  return out;
}

const CONTINUOUS = ["comp", "spread", "verb", ...DROP_LAYERS.map((k) => `level.${k}`)];
const COUNTED = ["pump", "voices", "held"];

describe("the Drop's wind-down, bar by bar (P10b, C21)", () => {
  it("has 24 vibes to check", () => {
    expect(STYLE_IDS.length).toBe(24);
  });

  for (const wind of [2, 4] as const)
    for (const comp of [0.7, 1.2])
      it(`every vibe, ${wind} bars, follower at ${comp}: each value falls toward the section every bar and lands on it at the end`, () => {
        for (const id of STYLE_IDS) {
          const { from, to, bars } = dropState(id, wind, comp);
          expect(bars, id).toBe(wind);
          const steps: WindBar[] = windSteps(bars, from, to);
          expect(steps.length, id).toBe(wind);
          const start = values(from);
          const end = values(to);
          const seq = steps.map(values);
          for (const k of [...CONTINUOUS, ...COUNTED]) {
            const total = Math.abs(start[k] - end[k]);
            if (total === 0) {
              for (const s of seq) expect(s[k], `${id} ${k}`).toBe(end[k]);
              continue;
            }
            // Distance left to the section, before the wind-down and after each bar: it falls every bar (in steps).
            const left = [total, ...seq.map((s) => Math.abs(s[k] - end[k]))];
            for (let i = 1; i < left.length; i++) {
              // A count already down to the section's stays there.
              if (COUNTED.includes(k) && left[i - 1] === 0) expect(left[i], `${id} ${k} bar ${i - 1}`).toBe(0);
              else expect(left[i], `${id} ${k} bar ${i - 1}`).toBeLessThan(left[i - 1] - 1e-9);
            }
            // Not everything in the first bar: something is left after it.
            expect(left[1], `${id} ${k} first bar`).toBeGreaterThan(0);
            // Each value always between the drop's and the section's, never past either.
            for (const s of seq) {
              expect(Math.min(start[k], end[k]) - 1e-9 <= s[k] && s[k] <= Math.max(start[k], end[k]) + 1e-9, `${id} ${k}`).toBe(true);
            }
          }
          // The continuous values land exactly on the section's on the last bar line.
          const last = seq[seq.length - 1];
          for (const k of CONTINUOUS) expect(last[k], `${id} ${k} at the end`).toBe(end[k]);
          expect(steps[steps.length - 1].share).toBe(0);
        }
      });

  it("the extra layers leave in steps: a share of the voices each bar, fewest in the last (48 and 35 voices)", () => {
    for (const voices of [48, 35]) {
      const { from, to } = dropState(STYLE_IDS[0], 4, 0.8, voices);
      const four = windSteps(4, from, to).map((s) => s.voices);
      expect(four[0]).toBeLessThan(voices);
      for (let i = 1; i < 4; i++) expect(four[i]).toBeLessThan(four[i - 1]);
      expect(four[3]).toBeGreaterThan(0);
      const two = windSteps(2, from, to).map((s) => s.voices);
      expect(two[0]).toBeLessThan(voices);
      expect(two[1]).toBeLessThan(two[0]);
      expect(two[1]).toBeGreaterThan(0);
      // The held notes leave one or more instruments a bar too, the last bar keeping the fewest.
      const held = windSteps(4, from, to).map((s) => s.held);
      expect(held).toEqual([3, 2, 1, 0]);
      expect(windSteps(2, from, to).map((s) => s.held)).toEqual([3, 1]);
    }
  });

  it("the level falls on the share to the power 1.5 and the spread on its square root: half the bars in, -9 dB", () => {
    const { from, to } = dropState(STYLE_IDS[0], 4, 0.8);
    const s = windSteps(4, from, to);
    // Share left 0.5 after two of four bars: the layers at 0.35 of their level (-9 dB), the spread at 0.71 of the drop's.
    for (const k of DROP_LAYERS) expect(s[1].levels[k]).toBeCloseTo(from.levels[k] * Math.pow(0.5, 1.5), 9);
    expect(s[1].spread).toBeCloseTo(from.spread * Math.SQRT1_2, 9);
  });

  // P10b review E1: the layers' side energy (level times spread, squared) is what widens the master; on the share
  // squared it was nearly all spent in the first bar (0.315 of it kept over the first of two bars). Averaged over the
  // first bar (each value a linear ramp) it keeps at least 38% of the drop's, at 2 and 4 bars, in every vibe.
  for (const wind of [2, 4] as const)
    it(`${wind} bars: the layers' side energy is not spent in the first bar`, () => {
      for (const id of STYLE_IDS) {
        const { from, to, bars } = dropState(id, wind, 0.8);
        const s = windSteps(bars, from, to)[0];
        for (const k of DROP_LAYERS) {
          if (from.levels[k] === 0) continue;
          const N = 200;
          let e = 0;
          for (let j = 0; j <= N; j++) {
            const x = j / N;
            const l = from.levels[k] + (s.levels[k] - from.levels[k]) * x;
            const p = from.spread + (s.spread - from.spread) * x;
            e += (l * p) ** 2 / (N + 1);
          }
          expect(e / (from.levels[k] * from.spread) ** 2, `${id} ${k}`).toBeGreaterThanOrEqual(0.38);
        }
      }
    });

  it("a one-bar or odd length still lands on the section", () => {
    const { from, to } = dropState(STYLE_IDS[0], 2, 0.8);
    const one = windSteps(1, from, to);
    expect(one.length).toBe(1);
    expect(one[0].levels).toEqual(to.levels);
    expect(one[0].comp).toBe(1);
  });
});

describe("the wind-down's voices on the audio clock (P10b, second fix)", () => {
  const v = (start: number, off: number, held?: string): Sounding => ({ start, off, held });

  it("counts a voice from its start until it is let go", () => {
    const vs = [v(0, 1), v(0.5, 2), v(1, 1.5)];
    expect(soundingAt(vs, 0.75)).toBe(2);
    expect(soundingAt(vs, 1)).toBe(2); // the first is let go on 1, the third starts there
    expect(soundingAt(vs, 2)).toBe(0);
    expect(peakIn(vs, 0, 1)).toBe(2);
    expect(peakIn(vs, 1, 2)).toBe(2);
    expect(peakIn(vs, 2, 3)).toBe(0);
  });

  it("counts what sounds across the window's start", () => {
    expect(peakIn([v(0, Infinity), v(0.2, 5)], 3, 4)).toBe(2);
  });

  it("lets go what sounds across a bar line past its allowance, held doubles last and the bass last of them", () => {
    const vs = [v(0, Infinity, "bass"), v(0.1, Infinity, "layer2"), v(0.2, Infinity, "synth"), v(1.5, 2.5), v(1.8, 2.2), v(1.9, 2)];
    expect(toLetGo(vs, 2, 6)).toEqual([]);
    expect(toLetGo(vs, 2, 4)).toEqual([vs[3]]);
    expect(toLetGo(vs, 2, 1)).toEqual([vs[3], vs[4], vs[1], vs[2]]);
    expect(toLetGo(vs, 2, 0)).toHaveLength(5); // the one let go on 2 is not sounding across it
  });

  it("allows fewer each bar than sounded in the bar before, never under the section's", () => {
    expect(windCap(20, 30)).toBe(20);
    expect(windCap(20, 12)).toBe(11);
    expect(windCap(5, 0)).toBe(0);
    expect(windCap(5, 3, 2)).toBe(2);
  });
});
