import { describe, expect, it } from "vitest";
import { DEFAULT_DROP, DropConductor, checkDropRecipe, followRef, followStep, loopBeats, refSettleBars, trackBound, resolveDrop, rollHits, type DropBar } from "./drop.ts";
import { STYLES, STYLE_IDS, vibeSong } from "./styles.ts";
import { defaultSong, validateSong } from "../engine/song.ts";

/** Run the conductor over `bars` bar lines, pressing before the bar lines listed. */
function run(c: DropConductor, bars: number, presses: number[], build = 4, wind = 2): DropBar[] {
  const out: DropBar[] = [];
  for (let b = 0; b < bars; b++) {
    if (presses.includes(b)) c.press();
    out.push(c.bar(build, wind));
  }
  return out;
}

describe("the Drop's conductor (spec 8.9)", () => {
  it("builds for the recipe's bars from the next bar line, hangs on the last, lands the impact, then stays on", () => {
    const c = new DropConductor();
    const bars = run(c, 40, [2]);
    expect(bars.slice(0, 2).every((b) => b.phase === "off")).toBe(true);
    expect(bars.slice(2, 6).map((b) => [b.phase, b.index, b.cliff])).toEqual([
      ["build", 0, false],
      ["build", 1, false],
      ["build", 2, false],
      ["build", 3, true],
    ]);
    expect(bars[6]).toMatchObject({ phase: "on", impact: true });
    // It stays on until the second press: 34 bars later still on, and no second impact.
    expect(bars.slice(7).every((b) => b.phase === "on" && !b.impact && !b.end)).toBe(true);
  });

  it("winds down over the recipe's bars from the bar line after the second press, and ends on a bar line", () => {
    const c = new DropConductor();
    const bars = run(c, 16, [0, 8], 2, 4);
    expect(bars[2]).toMatchObject({ phase: "on", impact: true });
    expect(bars.slice(8, 12).map((b) => [b.phase, b.index])).toEqual([
      ["wind", 0],
      ["wind", 1],
      ["wind", 2],
      ["wind", 3],
    ]);
    expect(bars[12]).toMatchObject({ phase: "off", end: true, cancelled: false });
    expect(bars.slice(13).every((b) => b.phase === "off" && !b.end)).toBe(true);
  });

  it("a press during the build cancels it on the next bar line; a second press takes the cancel back", () => {
    const c = new DropConductor();
    const bars = run(c, 8, [0, 2]);
    expect(bars[1].phase).toBe("build");
    expect(bars[2]).toMatchObject({ phase: "off", end: true, cancelled: true });
    const d = new DropConductor();
    d.press();
    d.bar(4, 2);
    expect(d.press()).toBe("cancel");
    expect(d.press()).toBe("uncancel");
    expect(d.bar(4, 2).phase).toBe("build");
  });

  it("a second press before the bar line disarms; a press during the wind-down does nothing", () => {
    const c = new DropConductor();
    expect(c.press()).toBe("armed");
    expect(c.press()).toBe("disarmed");
    expect(c.bar(2, 2).phase).toBe("off");
    expect(c.active).toBe(false);
    run(c, 3, [0], 1, 2); // build 1 bar: off->build, on, on
    expect(c.phase).toBe("on");
    c.press();
    c.bar(1, 2);
    expect(c.phase).toBe("wind");
    expect(c.press()).toBe("ignored");
  });

  it("shows the bars left of the build and the wind-down", () => {
    const c = new DropConductor();
    c.press();
    c.bar(4, 2);
    expect(c.view()).toMatchObject({ phase: "build", barsLeft: 4, length: 4 });
    c.bar(4, 2);
    expect(c.view().barsLeft).toBe(3);
  });
});

describe("the roll", () => {
  it("speeds up bar by bar, gets louder and stops at the cliffhanger", () => {
    const per = [0, 1, 2, 3].map((i) => rollHits(i, 4).length);
    expect(per[0]).toBeLessThan(per[1]);
    expect(per[1]).toBeLessThan(per[2]);
    expect(per[3]).toBeGreaterThan(per[2]);
    const last = rollHits(3, 4, 12);
    expect(last.every((h) => h.at < 12)).toBe(true);
    expect(rollHits(3, 4)[0].vel).toBeGreaterThan(rollHits(0, 4)[0].vel);
  });
});

describe("recipes", () => {
  it("every vibe has a valid recipe of its own", () => {
    expect(STYLE_IDS.length).toBe(24);
    for (const id of STYLE_IDS) expect(checkDropRecipe(STYLES[id].drop), id).toEqual([]);
  });

  it("Ambient and Drone bloom: no roll, no impact, eight bars", () => {
    for (const id of ["ambient", "drone"]) {
      const r = STYLES[id].drop;
      expect(r.bloom).toBe(true);
      expect(r.build).toBe(8);
      expect(r.parts.roll).toBe(false);
      expect(r.impact).toEqual({ sweep: false, sub: false, burst: false });
      expect(r.cliff).toBe("none");
    }
  });

  it("Deep techno is restrained, Lo-fi is a filter-down, EDM and Trance are the full thing", () => {
    const dt = STYLES.deepTechno.drop;
    expect(dt.parts).toMatchObject({ hatsOut: true, sweep: "low", roll: false, riser: false, kickOut: true });
    expect(dt.layers.synth).toBeGreaterThan(dt.layers.drums);
    const lf = STYLES.loFi.drop;
    expect(lf.parts.sweep).toBe("low");
    expect(lf.parts.roll || lf.parts.riser).toBe(false);
    for (const id of ["edm", "trance"]) {
      const r = STYLES[id].drop;
      expect(r.parts).toMatchObject({ roll: true, riser: true, reverb: true, climb: true });
      expect(r.impact).toEqual({ sweep: true, sub: true, burst: true });
      expect(r.cliff).toBe("gap");
    }
  });

  it("the Drop page's settings sit over the recipe, and the song checks them", () => {
    const r = resolveDrop(STYLES.edm.drop, { build: 2, cliff: "hold", wind: 4, width: 0.3 });
    expect(r).toMatchObject({ build: 2, cliff: "hold", wind: 4, width: 0.3, pump: STYLES.edm.drop.pump });
    expect(resolveDrop(undefined, undefined)).toEqual(DEFAULT_DROP);
    const song = { ...defaultSong(), drop: { build: 4 as const, width: 0.5 } };
    expect(validateSong(song)).toEqual([]);
    expect(validateSong({ ...song, drop: { build: 3 } })).not.toEqual([]);
    expect(validateSong({ ...song, drop: { width: 2 } })).not.toEqual([]);
    // A vibe's song carries no settings: the recipe is read from the style file.
    expect(vibeSong("edm")!.drop).toBeUndefined();
  });
});

describe("P10 review: the level follower's steps and loop", () => {
  it("S1: ignores an error under the dead band and limits a fine step to 0.5 dB", () => {
    expect(followStep(1, Math.pow(10, -0.2 / 20), 0.5, 0.3)).toBe(1);
    const down = followStep(1, 0.5, 0.5, 0.3);
    expect(20 * Math.log10(down)).toBeCloseTo(-0.5, 6);
    const up = followStep(0.8, 1.2, 0.5, 0.3, 1.25);
    expect(20 * Math.log10(up / 0.8)).toBeCloseTo(0.5, 6);
    expect(followStep(1.24, 2, 3, 0, 1.25)).toBe(1.25);
    expect(followStep(1, 0.9, 3, 0)).toBeCloseTo(0.9, 9);
  });
  it("P10 fix: a place in the loop not heard before the build has no reference, never the section's mean", () => {
    const refs = new Map([[0, 0.02], [1, 0.01]]);
    expect(followRef(refs, 1)).toBe(0.01);
    expect(followRef(refs, 7)).toBeNull();
    expect(followRef(new Map([[3, 0]]), 3)).toBeNull();
    // While settling, a place not heard is read against the section's last bar, not the mean of every place.
    expect(followRef(refs, 7, 0.03)).toBe(0.03);
    expect(followRef(refs, 1, 0.03)).toBe(0.01);
    // Ambient's case: a 16-bar loop with a loud chord (+1.2 dB) and a quiet one (-1.4 dB); only the quiet places and
    // two bars of the loud ones were heard. The drop adds nothing past the limiter, so the right gain is 1. Its first
    // two bars land on loud places not heard: the follower holds there, then settles on heard places, and the drop
    // stays at the section's level wherever it is (with the mean in their place it settled 1.2 dB low and held there).
    const loud = Math.pow(10, 0.12);
    const quiet = Math.pow(10, -0.14);
    const level = (beat: number): number => (Math.floor(beat / 16) % 4 < 2 ? loud : quiet);
    const heard = new Map<number, number>();
    for (let b = 24; b < 64; b++) heard.set(b, level(b));
    let c = 1;
    let followed = 0;
    const window: { e: number; c: number; ref: number }[] = [];
    for (let b = 0; b < 32 && followed < 8; b++) {
      const ref = followRef(heard, b);
      if (ref === null) continue;
      window.push({ e: level(b) * c * c, c, ref });
      if (window.length > 4) window.shift();
      const ratio = window.reduce((a, w) => a + w.e / (w.c * w.c * w.ref), 0) / window.length;
      c = followStep(c, 1 / Math.sqrt(ratio), 0.5, 0.3, 1.25);
      followed++;
    }
    expect(followed).toBe(8);
    expect(Math.abs(20 * Math.log10(c))).toBeLessThan(0.3);
  });
  it("P10 fix: once settled, the follower tracks within 3 dB of where it settled", () => {
    const k = Math.pow(10, 3 / 20);
    expect(trackBound(0.5, 1, 3)).toBeCloseTo(1 / k, 9);
    expect(trackBound(2, 1, 3)).toBeCloseTo(k, 9);
    expect(trackBound(0.9, 1, 3)).toBe(0.9);
  });
  it("P10 fix: the reference waits out the section's longest attack", () => {
    expect(refSettleBars([0.005, 0.01], 2)).toBe(0);
    expect(refSettleBars([3, 4, 0.005], 3.75)).toBe(1); // Ambient's groove at 64 bpm
    expect(refSettleBars([8, 4], 4)).toBe(2); // Drone's organ at 60 bpm
    expect(refSettleBars([], 2)).toBe(0);
  });
  it("S5: keys the reference by the section's own loop, 8 bars or more", () => {
    expect(loopBeats([1, 1, 1, 1])).toBe(32);
    expect(loopBeats([2, 2, 2, 2, 2, 2, 2, 2])).toBe(64);
    expect(loopBeats([3])).toBe(36);
    expect(loopBeats([0.5, 0.5])).toBe(32);
    expect(loopBeats([8])).toBe(32);
    expect(loopBeats([])).toBe(32);
  });
});
