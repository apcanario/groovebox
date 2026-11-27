import { describe, expect, it } from "vitest";
import { LATE_LEAD } from "./attacks.ts";
import {
  RUN_LEAD,
  RUN_MARGIN,
  RUN_TRIES,
  SILENT,
  bassRunStats,
  gateOnly,
  pairSilent,
  startTogether,
  type GatedSynth,
  type RunSource,
} from "./bassRun.ts";

/** A clock whose time moves on by `stall` seconds at each start a source receives (a main thread building nodes). */
function rig(n: number, stalls: number[]) {
  let now = 1;
  let call = 0;
  const log: { src: number; op: "start" | "stop"; t: number; at: number }[] = [];
  const sources: RunSource[] = Array.from({ length: n }, (_, src) => ({
    start(t: number) {
      log.push({ src, op: "start", t, at: now });
      now += stalls[call++] ?? 0;
    },
    stop(t: number) {
      log.push({ src, op: "stop", t, at: now });
    },
  }));
  return { sources, log, clock: { currentTime: () => now }, now: () => now };
}

/** The last start time of each source. */
const lastStarts = (log: { src: number; op: string; t: number }[], n: number): number[] =>
  Array.from({ length: n }, (_, i) => log.filter((e) => e.src === i && e.op === "start").at(-1)!.t);

describe("F0: the bass's oscillators start together once", () => {
  it("never starts a set later than a note can start (RUN_LEAD within LATE_LEAD)", () => {
    expect(RUN_LEAD).toBeLessThanOrEqual(LATE_LEAD);
    expect(RUN_MARGIN).toBeLessThan(RUN_LEAD);
  });

  it("starts every source at one time, RUN_LEAD ahead, with no stall", () => {
    const r = rig(3, []);
    const t = startTogether(r.sources, r.clock);
    expect(t).toBeCloseTo(1 + RUN_LEAD, 9);
    expect(r.log.map((e) => e.op)).toEqual(["start", "start", "start"]);
    expect(lastStarts(r.log, 3)).toEqual([t, t, t]);
  });

  it("keeps the starts when a stall leaves at least RUN_MARGIN", () => {
    const r = rig(2, [0.02, 0.01]);
    const t = startTogether(r.sources, r.clock);
    expect(r.log.filter((e) => e.op === "stop")).toEqual([]);
    expect(lastStarts(r.log, 2)).toEqual([t, t]);
  });

  it("stops and restarts every source, later, when a stall ate the lead (E1: 9 ms wave, 20 ms sub, more under load)", () => {
    const r = rig(2, [0.02, 0.04]);
    const t = startTogether(r.sources, r.clock);
    const stops = r.log.filter((e) => e.op === "stop");
    expect(stops).toHaveLength(2);
    expect(stops[0].t).toBe(stops[1].t);
    expect(stops[0].t).toBeGreaterThan(1 + RUN_LEAD);
    expect(t).toBeGreaterThan(stops[0].t);
    expect(lastStarts(r.log, 2)).toEqual([t, t]);
    // the retry's starts were all made with the margin left
    const retry = r.log.filter((e) => e.op === "start" && e.t === t);
    for (const e of retry) expect(e.at + RUN_MARGIN).toBeLessThanOrEqual(t);
  });

  it("gives up after RUN_TRIES on a thread that stalls at every start, still at one time, and counts it (review M1)", () => {
    const before = bassRunStats.giveUps;
    const r = rig(2, Array(100).fill(0.1));
    const t = startTogether(r.sources, r.clock);
    expect(r.log.filter((e) => e.op === "start")).toHaveLength(2 * RUN_TRIES);
    expect(lastStarts(r.log, 2)).toEqual([t, t]);
    expect(bassRunStats.giveUps).toBe(before + 1);
  });

  it("counts no give-up when the starts are kept, or kept after a retry", () => {
    const before = bassRunStats.giveUps;
    startTogether(rig(2, []).sources, rig(2, []).clock);
    const r = rig(2, [0.02, 0.04]);
    startTogether(r.sources, r.clock);
    expect(bassRunStats.giveUps).toBe(before);
  });

  it("start times of one source strictly increase, and each restart comes after its stop", () => {
    const r = rig(3, [0.05, 0, 0, 0.05, 0, 0]);
    startTogether(r.sources, r.clock);
    for (let i = 0; i < 3; i++) {
      const own = r.log.filter((e) => e.src === i);
      for (let k = 1; k < own.length; k++) expect(own[k].t).toBeGreaterThan(own[k - 1].t);
    }
  });
});

describe("F0: a note only gates the bass's envelopes", () => {
  function synth() {
    const calls: string[] = [];
    const s: GatedSynth & { calls: string[] } = {
      calls,
      envelope: {
        triggerAttack: (t, v) => calls.push(`attack ${t} ${v}`),
        triggerRelease: (t) => calls.push(`release ${t}`),
      },
      _triggerEnvelopeAttack: () => void calls.push("osc start"),
      _triggerEnvelopeRelease: () => void calls.push("osc stop"),
    };
    return s;
  }

  it("attack and release reach the envelope and never the oscillator", () => {
    const s = synth();
    gateOnly(s);
    s._triggerEnvelopeAttack(2, 0.8);
    s._triggerEnvelopeRelease(2.5);
    s._triggerEnvelopeAttack(2.6, 1);
    expect(s.calls).toEqual(["attack 2 0.8", "release 2.5", "attack 2.6 1"]);
  });
});

describe("F0 review E1: the previous wave set and its sub retire as one pair", () => {
  it("retires only when every voice of the pair is silent", () => {
    expect(pairSilent([0, 0])).toBe(true);
    expect(pairSilent([SILENT / 2, 0])).toBe(true);
    // Sustain 0: the wave silent after its decay, the sub still at 0.23 in its release (the review's measure)
    expect(pairSilent([0, 0.23])).toBe(false);
    expect(pairSilent([0.23, 0])).toBe(false);
    expect(pairSilent([SILENT, 0])).toBe(false);
  });
});
