/**
 * The engine's record state machine (G5 review M6, S1, M2, M3, M8), with Tone, the audio graph and the
 * recorder replaced by fakes: no audio runs here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  // Any property is a no-op function returning the same proxy: stands in for the audio graph.
  const anything: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === "then" ? undefined : anything),
    apply: () => anything,
  });
  const transport = {
    state: "stopped" as "started" | "stopped",
    ticks: 0,
    PPQ: 192,
    bpm: { value: 120, rampTo: () => undefined },
    start() {
      this.state = "started";
    },
    stop() {
      this.state = "stopped";
    },
    scheduleRepeat: () => 0,
  };
  const ctx = { currentTime: 0, sampleRate: 48000, rawContext: {}, latencyHint: "balanced" };
  type Settle = { resolve: (t: unknown) => void; reject: (e: Error) => void };
  const recorders: { stops: number; settle: Settle }[] = [];
  const tap = { fail: false };
  return { anything, transport, ctx, recorders, tap };
});

vi.mock("tone", () => ({
  setContext: () => undefined,
  Context: class {},
  start: async () => undefined,
  getContext: () => h.ctx,
  getTransport: () => h.transport,
  getDraw: () => ({ schedule: () => undefined }),
  now: () => h.ctx.currentTime,
}));

vi.mock("./audio.ts", () => ({ Graph: { build: async () => h.anything } }));

vi.mock("./recorder.ts", () => ({
  MP3_KBPS: 160,
  prepareTap: async () => {
    if (h.tap.fail) throw new Error("no AudioWorklet");
  },
  Recorder: class {
    node = {};
    bytes = 0;
    private rec: { stops: number; settle: { resolve: (t: unknown) => void; reject: (e: Error) => void } };
    private done: Promise<unknown>;
    constructor() {
      if (h.tap.fail) throw new Error("capture processor not loaded");
      let settle!: { resolve: (t: unknown) => void; reject: (e: Error) => void };
      this.done = new Promise((resolve, reject) => (settle = { resolve, reject }));
      this.rec = { stops: 0, settle };
      h.recorders.push(this.rec);
    }
    stop(): Promise<unknown> {
      this.rec.stops++;
      return this.done;
    }
  },
}));

import { Engine } from "./index.ts";

const take = { file: {} as File, bytes: 10, seconds: 2, sampleRate: 48000 };
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

async function ready(): Promise<Engine> {
  const e = new Engine();
  await e.init();
  return e;
}

beforeEach(() => {
  h.transport.state = "stopped";
  h.ctx.currentTime = 0;
  h.recorders.length = 0;
  h.tap.fail = false;
  vi.useRealTimers();
});

describe("record state machine", () => {
  it("off, armed, off while stopped; armed turns into a take on Play", async () => {
    const e = await ready();
    expect(e.recordInfo().state).toBe("off");
    e.record();
    expect(e.recordInfo().state).toBe("armed");
    e.record();
    expect(e.recordInfo().state).toBe("off");
    e.record();
    e.play();
    expect(e.recordInfo().state).toBe("recording");
    expect(h.recorders).toHaveLength(1);
  });

  it("Record while playing starts a take at once; Record again finishes it and hands over the take", async () => {
    const e = await ready();
    const got: unknown[] = [];
    e.onTake((t) => got.push(t));
    e.play();
    e.record();
    expect(e.recordInfo().state).toBe("recording");
    e.record();
    expect(e.recordInfo().state).toBe("finishing");
    h.recorders[0].settle.resolve(take);
    await flush();
    expect(e.recordInfo().state).toBe("off");
    expect(got).toHaveLength(1);
    expect(e.getLog()).not.toBeNull();
  });

  it("a failing encoder ends the take: state off, log saved, error shown, no take handed over (S1)", async () => {
    const e = await ready();
    const got: unknown[] = [];
    e.onTake((t) => got.push(t));
    e.play();
    e.record();
    e.bpm = 130;
    e.record();
    h.recorders[0].settle.reject(new Error("disk full"));
    await flush();
    const info = e.recordInfo();
    expect(info.state).toBe("off");
    expect(info.error).toMatch(/disk full/);
    expect(got).toHaveLength(0);
    expect(e.getLog()?.events.map((x) => x.op)).toEqual(["bpm"]);
    // The next take clears the error.
    e.record();
    expect(e.recordInfo().error).toBeNull();
  });

  it("Play during the Stop tail closes the old take at once and only once (M3)", async () => {
    vi.useFakeTimers();
    const e = await ready();
    e.play();
    e.record();
    e.stop();
    expect(e.recordInfo().state).toBe("finishing");
    e.play();
    expect(h.recorders[0].stops).toBe(1);
    vi.advanceTimersByTime(2000);
    expect(h.recorders[0].stops).toBe(1);
    h.recorders[0].settle.resolve(take);
    await vi.runAllTimersAsync();
    expect(e.recordInfo().state).toBe("off");
  });

  it("logs only edits that were taken (M2)", async () => {
    const e = await ready();
    e.play();
    e.record();
    const bpm = e.bpm;
    e.bpm = bpm; // unchanged
    expect(e.deleteSection(99)).toBe(false); // refused
    expect(e.setChords(0, [])).toBe(false); // refused
    e.setMix("pump", Number.NaN); // refused
    e.setMix("pump", 0.5);
    e.record();
    h.recorders[0].settle.resolve(take);
    await flush();
    expect(e.getLog()?.events.map((x) => x.op)).toEqual(["setMix"]);
  });

  it("a capture processor that fails to load is reported, not silent (M8)", async () => {
    h.tap.fail = true;
    const e = await ready();
    expect(e.recordInfo().error).toMatch(/Recording unavailable/);
    e.play();
    e.record();
    expect(e.recordInfo().state).toBe("off");
    expect(e.recordInfo().error).toMatch(/no AudioWorklet/);
  });
});
