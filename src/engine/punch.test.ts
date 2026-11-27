/**
 * T3 (spec 9.4): each punch pad starts and ends on the line the spec names, on the audio clock. The rack runs on a
 * fake AudioContext whose params work out their automation at any time, so "fully in on the start line, fully out
 * on the end line" is read from the scheduled values, not from the code's intent.
 *
 * The grid: at audio time 10 s the transport stands at beat 0 (a bar line), 120 bpm: a beat is 0.5 s, a sixteenth
 * 0.125 s, a bar 2 s. A press at 10.3 s is past every line before it plus the guard.
 */
import { describe, expect, it } from "vitest";
import { PunchRack } from "./punch.ts";
import { FILTER_FLOOR, FILTER_OPEN, RISER_PEAK } from "./punch.ts";
import { FakeContext, FakeParam } from "./fixtures/fakeAudio.ts";
import { PUNCH_GUARD, PUNCH_PADS, beatAt, lineAt, punchEnd, punchStart, type PunchGrid } from "../music/punch.ts";

const GRID: PunchGrid = { at: 10, beats: 0, bpm: 120 };

/** A rack on a fake clock, its internals open for reading. */
function rig(grid: PunchGrid | null = GRID) {
  const ctx = new FakeContext();
  const drums = new FakeParam(ctx, 1);
  const bass = new FakeParam(ctx, 1);
  const jobs: { fn: () => void; s: number }[] = [];
  const rack = new PunchRack(ctx as unknown as BaseAudioContext, () => grid, [drums, bass] as unknown as AudioParam[], (fn, s) => jobs.push({ fn, s }));
  const r = rack as unknown as Record<string, { gain?: FakeParam; frequency?: FakeParam; delayTime?: FakeParam }>;
  const p = {
    dry: r.dry.gain!,
    rec: r.rec.gain!,
    fb: r.fb.gain!,
    wet: r.wet.gain!,
    loop: r.loop.delayTime!,
    filter: r.filter.frequency!,
    echo: r.echoSend.gain!,
    wash: r.washSend.gain!,
    riser: r.riserGain.gain!,
    band: r.riserBand.frequency!,
  };
  const at = (t: number) => {
    ctx.currentTime = t;
  };
  return { ctx, rack, drums, bass, p, jobs, at };
}

/** Bar, beat and sixteenth lines in the test grid. */
const onLine = (t: number, unit: number) => Math.abs((((t - GRID.at) * 2) / unit) % 1) < 1e-9 || Math.abs((((t - GRID.at) * 2) / unit) % 1) > 1 - 1e-9;

describe("the punch grid (pure)", () => {
  it("finds the next line of each unit on the transport's beats, not on the audio clock's seconds", () => {
    const g: PunchGrid = { at: 3.1, beats: 6.3, bpm: 128 };
    // At 3.15 s the transport is at beat 6.41.
    const t = lineAt(g, 3.15, "bar");
    expect(beatAt(g, t)).toBeCloseTo(8, 9);
    expect(beatAt(g, lineAt(g, 3.15, "beat"))).toBeCloseTo(7, 9);
    expect(beatAt(g, lineAt(g, 3.15, "half"))).toBeCloseTo(6.5, 9);
    expect(beatAt(g, lineAt(g, 3.15, "step"))).toBeCloseTo(6.5, 9);
    expect(beatAt(g, lineAt(g, 3.2, "step"))).toBeCloseTo(6.75, 9);
  });

  it("a line closer than the guard is skipped for the one after", () => {
    // 10.49 is 10 ms before the beat at 10.5: inside the guard, so the next beat (11.0).
    expect(punchStart("echo", GRID, 10.49)).toBeCloseTo(11, 9);
    expect(punchStart("echo", GRID, 10.5 - PUNCH_GUARD - 0.001)).toBeCloseTo(10.5, 9);
  });

  it("a hold pad let go before it started ends on the first end line after its start", () => {
    const s = punchStart("cut", GRID, 11.9);
    expect(s).toBeCloseTo(12, 9);
    expect(punchEnd("cut", GRID, s, 11.91)).toBeCloseTo(14, 9);
  });

  it("every pad has a start and an end on its lines at several tempos", () => {
    for (const bpm of [84, 122, 174]) {
      const g = { at: 2, beats: 1.37, bpm };
      for (const pad of PUNCH_PADS) {
        const s = punchStart(pad, g, 2.4);
        const e = punchEnd(pad, g, s, s + 1.3);
        expect(e).toBeGreaterThan(s);
        const unit = { cut: 0.25, filter: 0.25, stutter: 0.5, echo: 1, wash: 1, riser: 0.25 }[pad];
        const end = { cut: 4, filter: 1, stutter: 1, echo: 1, wash: 1, riser: 0.25 }[pad];
        expect(Math.abs(beatAt(g, s) / unit - Math.round(beatAt(g, s) / unit))).toBeLessThan(1e-6);
        expect(Math.abs(beatAt(g, e) / end - Math.round(beatAt(g, e) / end))).toBeLessThan(1e-6);
      }
    }
  });
});

describe("punch pads on the audio clock (spec 9.4)", () => {
  it("Cut: drums and bass silent from the next sixteenth while held, back on the next bar line after release", () => {
    const { rack, drums, bass, at } = rig();
    at(10.3);
    const s = rack.press("cut", true)!;
    expect(s.start).toBeCloseTo(10.375, 9);
    expect(onLine(s.start!, 0.25)).toBe(true);
    for (const g of [drums, bass]) {
      expect(g.at(10.36)).toBe(1);
      expect(g.at(10.375)).toBe(0);
    }
    at(11.1);
    const e = rack.press("cut", false)!;
    expect(e.end).toBeCloseTo(12, 9);
    for (const g of [drums, bass]) {
      expect(g.at(11.5)).toBe(0);
      expect(g.at(11.99)).toBe(0);
      expect(g.at(12)).toBe(1);
    }
    expect(rack.active("cut", 11.99)).toBe(true);
    expect(rack.active("cut", 12)).toBe(false);
  });

  it("Filter: sweeps down from the next sixteenth while held, open again on the next beat after release", () => {
    const { rack, p, at } = rig();
    at(10.3);
    const s = rack.press("filter", true)!;
    expect(s.start).toBeCloseTo(10.375, 9);
    expect(p.filter.at(10.375)).toBeCloseTo(FILTER_OPEN, 3);
    expect(p.filter.at(10.875)).toBeLessThan(FILTER_OPEN / 2);
    expect(p.filter.at(11.375)).toBeCloseTo(FILTER_FLOOR, 3);
    at(11.6);
    const e = rack.press("filter", false)!;
    expect(e.end).toBeCloseTo(12, 9);
    expect(p.filter.at(11.97)).toBeCloseTo(FILTER_FLOOR, 3);
    expect(p.filter.at(12)).toBeCloseTo(FILTER_OPEN, 3);
  });

  it("Stutter: the last half beat loops from the next half beat while held; normal play on the next beat", () => {
    const { rack, p, at } = rig();
    at(10.3);
    const s = rack.press("stutter", true)!;
    expect(s.start).toBeCloseTo(10.5, 9);
    // The loop is half a beat long, set before it comes in.
    expect(p.loop.at(10.495)).toBeCloseTo(0.25, 9);
    expect(p.wet.at(10.49)).toBe(0);
    expect(p.dry.at(10.5)).toBe(0);
    expect(p.rec.at(10.5)).toBe(0);
    expect(p.fb.at(10.5)).toBe(1);
    expect(p.wet.at(10.5)).toBe(1);
    at(11.1);
    const e = rack.press("stutter", false)!;
    expect(e.end).toBeCloseTo(11.5, 9);
    expect(p.wet.at(11.49)).toBe(1);
    expect(p.dry.at(11.5)).toBe(1);
    expect(p.wet.at(11.5)).toBe(0);
    expect(p.fb.at(11.5)).toBe(0);
    expect(p.rec.at(11.5)).toBe(1);
  });

  it("Echo: one tap throws the mix into the delay from the next beat for one bar; the release does nothing", () => {
    const { rack, p, at } = rig();
    at(10.3);
    const s = rack.press("echo", true)!;
    expect(s.start).toBeCloseTo(10.5, 9);
    expect(s.end).toBeCloseTo(12.5, 9);
    at(10.35);
    rack.press("echo", false);
    expect(p.echo.at(10.49)).toBeLessThan(1);
    expect(p.echo.at(10.5)).toBe(1);
    expect(p.echo.at(12.49)).toBeGreaterThan(0);
    expect(p.echo.at(12.5)).toBe(0);
    // A second tap while it runs keeps it in and moves the end a bar on from its own beat.
    at(11.2);
    const again = rack.press("echo", true)!;
    expect(again.start).toBeCloseTo(10.5, 9);
    expect(again.end).toBeCloseTo(13.5, 9);
    expect(p.echo.at(12.5)).toBe(1);
    expect(p.echo.at(13.5)).toBe(0);
  });

  it("Wash: one tap throws the mix into the reverb from the next beat for one bar; idle, the reverb is cut off", () => {
    const { rack, p, at, jobs } = rig();
    expect(rack.washOn()).toBe(false);
    at(10.3);
    const s = rack.press("wash", true)!;
    expect(s.start).toBeCloseTo(10.5, 9);
    expect(s.end).toBeCloseTo(12.5, 9);
    expect(rack.washOn()).toBe(true);
    expect(p.wash.at(10.5)).toBe(1);
    expect(p.wash.at(12.5)).toBe(0);
    // The housekeeping runs once the tail has rung out, well after the end.
    expect(jobs.length).toBe(1);
    expect(10.3 + jobs[0].s).toBeGreaterThan(12.5 + 3);
    jobs[0].fn();
    expect(rack.washOn()).toBe(false);
  });

  it("Riser: climbs from the next sixteenth while held, falls away from the next sixteenth after release", () => {
    const { rack, p, at, ctx } = rig();
    at(10.3);
    const s = rack.press("riser", true)!;
    expect(s.start).toBeCloseTo(10.375, 9);
    expect(ctx.sources.length).toBe(1);
    expect(ctx.sources[0].startAt!).toBeLessThanOrEqual(10.375);
    expect(p.riser.at(10.36)).toBe(0);
    expect(p.riser.at(11.375)).toBeGreaterThan(0);
    expect(p.riser.at(14.375)).toBeCloseTo(RISER_PEAK, 9);
    expect(p.band.at(12.375)).toBeGreaterThan(p.band.at(11.375));
    at(11.0);
    const e = rack.press("riser", false)!;
    // The fall starts at 11.125 and is silent one beat later.
    expect(e.end).toBeCloseTo(11.625, 9);
    expect(p.riser.at(11.125)).toBeGreaterThan(0);
    expect(p.riser.at(11.124)).toBeCloseTo(p.riser.at(11.125), 3);
    expect(p.riser.at(11.625)).toBe(0);
    expect(ctx.sources[0].stopAt!).toBeGreaterThanOrEqual(11.625);
  });

  it("several pads at once: each lands on its own lines, none moves another", () => {
    const { rack, p, drums, at } = rig();
    at(10.3);
    for (const pad of ["cut", "filter", "stutter", "riser"] as const) rack.press(pad, true);
    rack.press("echo", true);
    rack.press("wash", true);
    expect(drums.at(10.375)).toBe(0);
    expect(p.filter.at(11.375)).toBeCloseTo(FILTER_FLOOR, 3);
    expect(p.wet.at(10.5)).toBe(1);
    expect(p.echo.at(10.5)).toBe(1);
    expect(p.wash.at(10.5)).toBe(1);
    at(11.1);
    rack.press("stutter", false);
    at(11.6);
    rack.press("filter", false);
    expect(p.wet.at(11.5)).toBe(0);
    expect(p.filter.at(12)).toBeCloseTo(FILTER_OPEN, 3);
    expect(drums.at(12)).toBe(0); // Cut still held
    expect(p.echo.at(12.49)).toBeGreaterThan(0);
    expect(p.echo.at(12.5)).toBe(0);
    at(12.2);
    rack.press("cut", false);
    rack.press("riser", false);
    expect(drums.at(13.99)).toBe(0);
    expect(drums.at(14)).toBe(1);
    expect(p.riser.at(12.375 + 0.5)).toBe(0);
    const st = rack.state(12.2);
    expect(st.filter((x) => x.start !== null).map((x) => x.pad).sort()).toEqual(["cut", "echo", "riser", "wash"]);
    expect(rack.state(12.6).filter((x) => x.start !== null).map((x) => x.pad).sort()).toEqual(["cut", "riser"]);
  });

  it("pressed again before its release landed: it stays in, and the next release ends it on the next line", () => {
    const { rack, drums, at } = rig();
    at(10.3);
    rack.press("cut", true);
    at(11.1);
    rack.press("cut", false); // would end at 12
    at(11.5);
    rack.press("cut", true);
    expect(drums.at(12)).toBe(0);
    expect(drums.at(12.5)).toBe(0);
    at(13.1);
    const e = rack.press("cut", false)!;
    expect(e.end).toBeCloseTo(14, 9);
    expect(drums.at(14)).toBe(1);
  });

  it("does nothing while the transport is stopped", () => {
    const { rack, drums, at } = rig(null);
    at(10.3);
    expect(rack.press("cut", true)).toBeNull();
    expect(drums.at(11)).toBe(1);
    expect(rack.active("cut")).toBe(false);
  });

  it("Stop (reset) takes every pad out at once, with a ramp", () => {
    const { rack, drums, p, at } = rig();
    at(10.3);
    for (const pad of PUNCH_PADS) rack.press(pad, true);
    at(11);
    rack.reset();
    expect(drums.at(11.001)).toBeLessThan(1);
    expect(drums.at(11.005)).toBe(1);
    expect(p.wet.at(11.005)).toBe(0);
    expect(p.dry.at(11.005)).toBe(1);
    expect(p.echo.at(11.005)).toBe(0);
    expect(p.filter.at(11.02)).toBeCloseTo(FILTER_OPEN, 3);
    expect(p.riser.at(11.05)).toBe(0);
    expect(PUNCH_PADS.some((pad) => rack.active(pad))).toBe(false);
  });

  it("no param is stepped: every move into or out of a pad is a ramp", () => {
    const { rack, drums, p, at } = rig();
    at(10.3);
    for (const pad of PUNCH_PADS) rack.press(pad, true);
    at(11.3);
    for (const pad of PUNCH_PADS) rack.press(pad, false);
    for (const param of [drums, p.dry, p.rec, p.fb, p.wet, p.echo, p.wash, p.riser]) {
      // Sampled every millisecond, the gain never jumps more than a 5 ms ramp allows.
      let last = param.at(10.3);
      for (let t = 10.3; t < 16; t += 0.001) {
        const v = param.at(t);
        expect(Math.abs(v - last)).toBeLessThan(0.25);
        last = v;
      }
    }
  });
});

/** Sampled every millisecond from `t0` to `t1`, the param never jumps more than a 5 ms ramp allows. */
function noStep(param: FakeParam, t0: number, t1: number, most = 0.25): void {
  let last = param.at(t0);
  for (let t = t0; t < t1; t += 0.001) {
    const v = param.at(t);
    expect(Math.abs(v - last)).toBeLessThan(most);
    last = v;
  }
}

describe("a quick second press before the start line (T3 review E1, E2)", () => {
  for (const pad of ["echo", "wash"] as const) {
    it(`${pad}: a second tap inside the first beat keeps it fully in from its start line for the bar (E1)`, () => {
      const { rack, p, at } = rig();
      const send = pad === "echo" ? p.echo : p.wash;
      at(10.1);
      rack.press(pad, true);
      at(10.25);
      const s = rack.press(pad, true)!;
      expect(s.start).toBeCloseTo(10.5, 9);
      expect(s.end).toBeCloseTo(12.5, 9);
      expect(send.at(10.49)).toBeLessThan(1);
      for (const t of [10.5, 10.6, 11, 11.5, 12.49 - 0.005]) expect(send.at(t)).toBe(1);
      expect(send.at(12.5)).toBe(0);
      noStep(send, 10, 13);
    });

    it(`${pad}: a second tap inside the guard of the start line keeps the start and ends a bar from the next beat`, () => {
      const { rack, p, at } = rig();
      const send = pad === "echo" ? p.echo : p.wash;
      at(10.1);
      rack.press(pad, true);
      at(10.49);
      const s = rack.press(pad, true)!;
      expect(s.start).toBeCloseTo(10.5, 9);
      expect(s.end).toBeCloseTo(13, 9);
      for (const t of [10.5, 11, 12.5, 12.99 - 0.005]) expect(send.at(t)).toBe(1);
      expect(send.at(13)).toBe(0);
      noStep(send, 10, 14);
    });

    it(`${pad}: three taps, two before the start and one while it runs, stay in to the last tap's bar`, () => {
      const { rack, p, at } = rig();
      const send = pad === "echo" ? p.echo : p.wash;
      at(10.1);
      rack.press(pad, true);
      at(10.2);
      rack.press(pad, true);
      at(11.2);
      const s = rack.press(pad, true)!;
      expect(s.start).toBeCloseTo(10.5, 9);
      expect(s.end).toBeCloseTo(13.5, 9);
      for (const t of [10.5, 11.2, 12.5, 13.49 - 0.005]) expect(send.at(t)).toBe(1);
      expect(send.at(13.5)).toBe(0);
      noStep(send, 10, 14);
    });
  }

  it("a tap after the last one ended is a fresh tap on its own beat", () => {
    const { rack, p, at } = rig();
    at(10.1);
    rack.press("echo", true);
    at(12.7);
    const s = rack.press("echo", true)!;
    expect(s.start).toBeCloseTo(13, 9);
    expect(s.end).toBeCloseTo(15, 9);
    expect(p.echo.at(12.9)).toBe(0);
    expect(p.echo.at(13)).toBe(1);
    expect(p.echo.at(15)).toBe(0);
  });

  it("Cut: let go and pressed again before its start line, silent from that line and not before (E2)", () => {
    const { rack, drums, bass, at } = rig();
    at(10.3);
    rack.press("cut", true);
    at(10.31);
    rack.press("cut", false);
    at(10.32);
    const s = rack.press("cut", true)!;
    expect(s.start).toBeCloseTo(10.375, 9);
    expect(s.held).toBe(true);
    expect(s.end).toBeNull();
    for (const g of [drums, bass]) {
      expect(g.at(10.33)).toBe(1);
      expect(g.at(10.369)).toBe(1);
      expect(g.at(10.375)).toBe(0);
      expect(g.at(12)).toBe(0);
      expect(g.at(14)).toBe(0);
      noStep(g, 10.3, 15);
    }
    at(13.1);
    expect(rack.press("cut", false)!.end).toBeCloseTo(14, 9);
    expect(drums.at(14)).toBe(1);
  });

  it("Cut: let go before its start line and not pressed again, in on its line and out on the bar after", () => {
    const { rack, drums, at } = rig();
    at(10.3);
    rack.press("cut", true);
    at(10.31);
    const e = rack.press("cut", false)!;
    expect(e.end).toBeCloseTo(12, 9);
    expect(drums.at(10.36)).toBe(1);
    expect(drums.at(10.375)).toBe(0);
    expect(drums.at(11.99)).toBe(0);
    expect(drums.at(12)).toBe(1);
  });

  it("Filter: let go and pressed again before its start line, the sweep starts on its line (E2)", () => {
    const { rack, p, at } = rig();
    at(10.3);
    rack.press("filter", true);
    at(10.31);
    rack.press("filter", false);
    at(10.32);
    const s = rack.press("filter", true)!;
    expect(s.start).toBeCloseTo(10.375, 9);
    expect(p.filter.at(10.33)).toBeCloseTo(FILTER_OPEN, 3);
    expect(p.filter.at(10.375)).toBeCloseTo(FILTER_OPEN, 3);
    expect(p.filter.at(10.875)).toBeLessThan(FILTER_OPEN / 2);
    expect(p.filter.at(11.375)).toBeCloseTo(FILTER_FLOOR, 3);
    expect(p.filter.at(12.5)).toBeCloseTo(FILTER_FLOOR, 3);
    at(12.6);
    expect(rack.press("filter", false)!.end).toBeCloseTo(13, 9);
    expect(p.filter.at(13)).toBeCloseTo(FILTER_OPEN, 3);
  });

  it("Stutter: let go and pressed again before its start line, the loop is set before it comes in on its line (E2)", () => {
    const { rack, p, at } = rig();
    at(10.3);
    rack.press("stutter", true);
    at(10.31);
    rack.press("stutter", false);
    at(10.32);
    const s = rack.press("stutter", true)!;
    expect(s.start).toBeCloseTo(10.5, 9);
    expect(p.wet.at(10.33)).toBe(0);
    expect(p.dry.at(10.33)).toBe(1);
    expect(p.wet.at(10.49)).toBe(0);
    expect(p.dry.at(10.5)).toBe(0);
    expect(p.wet.at(10.5)).toBe(1);
    expect(p.fb.at(10.5)).toBe(1);
    expect(p.wet.at(11.5)).toBe(1); // still held
    // Wherever the loop is heard, it is half a beat long.
    for (let t = 10.3; t < 12; t += 0.001) if (p.wet.at(t) > 0 || p.fb.at(t) > 0) expect(p.loop.at(t)).toBeCloseTo(0.25, 9);
    for (const g of [p.dry, p.wet, p.fb]) noStep(g, 10.3, 12);
    at(11.6);
    expect(rack.press("stutter", false)!.end).toBeCloseTo(12, 9);
    expect(p.wet.at(12)).toBe(0);
    expect(p.dry.at(12)).toBe(1);
  });

  it("Stutter: a first stutter pressed twice in rhythm never loops at a length other than the half beat", () => {
    const { rack, p, at } = rig();
    at(10.3);
    rack.press("stutter", true);
    at(10.4);
    rack.press("stutter", false);
    at(10.45);
    rack.press("stutter", true);
    at(10.9);
    rack.press("stutter", false);
    for (let t = 10.3; t < 12; t += 0.001) if (p.wet.at(t) > 0 || p.fb.at(t) > 0) expect(p.loop.at(t)).toBeCloseTo(0.25, 9);
    expect(p.wet.at(10.5)).toBe(1);
    expect(p.wet.at(11)).toBe(0);
  });

  it("Riser: let go and pressed again before its start line, it starts climbing on its line and keeps climbing (E2)", () => {
    const { rack, p, at } = rig();
    at(10.3);
    rack.press("riser", true);
    at(10.31);
    rack.press("riser", false);
    at(10.32);
    const s = rack.press("riser", true)!;
    expect(s.start).toBeCloseTo(10.375, 9);
    expect(s.end).toBeNull();
    expect(p.riser.at(10.33)).toBe(0);
    expect(p.riser.at(10.37)).toBe(0);
    expect(p.riser.at(11.375)).toBeGreaterThan(0);
    expect(p.riser.at(12)).toBeGreaterThan(p.riser.at(11.375));
    expect(p.riser.at(14.375)).toBeCloseTo(RISER_PEAK, 9);
    expect(p.band.at(12.375)).toBeGreaterThan(p.band.at(11.375));
    noStep(p.riser, 10.3, 15, 0.01);
  });
});

describe("small guards (T3 review M1, M3, M9)", () => {
  it("after a Stop during a Wash, the reverb is cut from its send once its tail has rung out (M1)", () => {
    const { rack, at, jobs } = rig();
    at(10.3);
    rack.press("wash", true);
    at(11);
    rack.reset();
    expect(jobs.length).toBe(2);
    // The tap's own job belongs to an older press: it does nothing.
    jobs[0].fn();
    expect(rack.washOn()).toBe(true);
    expect(jobs[1].s).toBeGreaterThan(3.5);
    jobs[1].fn();
    expect(rack.washOn()).toBe(false);
  });

  it("the first Wash builds its reverb before its start line is chosen, so the line is still ahead (M3)", () => {
    const { rack, ctx, at } = rig();
    // Building the reverb takes 40 ms here, past the 25 ms guard of the line it would have chosen.
    const make = ctx.createConvolver.bind(ctx);
    ctx.createConvolver = () => {
      ctx.currentTime += 0.04;
      return make();
    };
    at(10.47);
    const s = rack.press("wash", true)!;
    expect(ctx.currentTime).toBeCloseTo(10.51, 9);
    expect(s.start!).toBeGreaterThanOrEqual(ctx.currentTime + PUNCH_GUARD);
    expect(s.start).toBeCloseTo(11, 9);
  });

  it("without cancelAndHoldAtTime, every move is still a ramp from where the param is (M9)", () => {
    const ctx = new FakeContext();
    const drums = new FakeParam(ctx, 1);
    const plain = (p: FakeParam) => Object.defineProperty(p, "cancelAndHoldAtTime", { value: undefined });
    plain(drums);
    const orig = ctx.createGain.bind(ctx);
    ctx.createGain = () => {
      const n = orig();
      plain(n.gain);
      return n;
    };
    const rack = new PunchRack(ctx as unknown as BaseAudioContext, () => GRID, [drums] as unknown as AudioParam[], () => undefined);
    const r = rack as unknown as Record<string, { gain: FakeParam }>;
    ctx.currentTime = 10.3;
    rack.press("cut", true);
    rack.press("stutter", true);
    rack.press("echo", true);
    ctx.currentTime = 10.31;
    rack.press("cut", false);
    ctx.currentTime = 10.32;
    rack.press("cut", true);
    ctx.currentTime = 11.1;
    rack.press("cut", false);
    rack.press("stutter", false);
    ctx.currentTime = 11.3;
    rack.press("echo", true);
    expect(drums.at(10.375)).toBe(0);
    expect(drums.at(12)).toBe(1);
    expect(r.wet.gain.at(10.5)).toBe(1);
    expect(r.wet.gain.at(11.5)).toBe(0);
    expect(r.echoSend.gain.at(12)).toBe(1);
    expect(r.echoSend.gain.at(13.5)).toBe(0);
    for (const g of [drums, r.dry.gain, r.wet.gain, r.fb.gain, r.echoSend.gain]) noStep(g, 10.3, 15);
  });
});
