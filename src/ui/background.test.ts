/**
 * G6 (spec section 2): in the APK the jam stops when the app goes to the background, through the engine's Stop, and
 * a take in progress ends as Stop ends it. Tone, the graph and the recorder are fakes (as in engine/record.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import source from "./background.ts?raw";

const h = vi.hoisted(() => {
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
  const recorders: { stops: number; resolve: (t: unknown) => void }[] = [];
  return { anything, transport, ctx, recorders };
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

vi.mock("../engine/audio.ts", () => ({ Graph: { build: async () => h.anything } }));

vi.mock("../engine/recorder.ts", () => ({
  MP3_KBPS: 160,
  prepareTap: async () => undefined,
  Recorder: class {
    node = {};
    bytes = 0;
    private rec: { stops: number; resolve: (t: unknown) => void };
    private done: Promise<unknown>;
    constructor() {
      let resolve!: (t: unknown) => void;
      this.done = new Promise((r) => (resolve = r));
      this.rec = { stops: 0, resolve };
      h.recorders.push(this.rec);
    }
    stop(): Promise<unknown> {
      this.rec.stops++;
      return this.done;
    }
  },
}));

import { Engine } from "../engine/index.ts";
import { inNativeShell, stopInBackground, type PageEvents } from "./background.ts";

/** A document stand-in: events plus a settable visibility. */
function page(): PageEvents & { hide: () => void; show: () => void; fire: (t: string) => void; count: () => number } {
  const target = new EventTarget();
  let vis = "visible";
  let listeners = 0;
  return {
    get visibilityState() {
      return vis;
    },
    addEventListener: (t, fn) => {
      listeners++;
      target.addEventListener(t, fn);
    },
    removeEventListener: (t, fn) => {
      listeners--;
      target.removeEventListener(t, fn);
    },
    hide: () => {
      vis = "hidden";
      target.dispatchEvent(new Event("visibilitychange"));
    },
    show: () => {
      vis = "visible";
      target.dispatchEvent(new Event("visibilitychange"));
    },
    fire: (t) => target.dispatchEvent(new Event(t)),
    count: () => listeners,
  };
}

async function ready(): Promise<Engine> {
  const e = new Engine();
  await e.init();
  return e;
}

beforeEach(() => {
  h.transport.state = "stopped";
  h.ctx.currentTime = 0;
  h.recorders.length = 0;
  vi.useRealTimers();
});

describe("stop in the background (G6, spec section 2)", () => {
  it("knows the native shell from a browser", () => {
    expect(inNativeShell({})).toBe(false);
    expect(inNativeShell(null)).toBe(false);
    expect(inNativeShell({ Capacitor: {} })).toBe(false);
    expect(inNativeShell({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
    expect(inNativeShell({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
    // The test runner is not the shell.
    expect(inNativeShell()).toBe(false);
  });

  it("Capacitor's pause event stops a playing jam through Stop", async () => {
    const e = await ready();
    const doc = page();
    const off = stopInBackground(e, doc, true);
    e.play();
    expect(e.running).toBe(true);
    expect(e.playing).toBe(true);
    doc.fire("pause");
    expect(e.running).toBe(false);
    expect(e.playing).toBe(false);
    off();
  });

  it("the page turning hidden stops it too; showing again does not restart it", async () => {
    const e = await ready();
    const doc = page();
    stopInBackground(e, doc, true);
    e.play();
    doc.hide();
    expect(e.running).toBe(false);
    doc.show();
    expect(e.running).toBe(false);
    expect(e.playing).toBe(false);
  });

  it("calls Stop only when playing (a stopped engine is left alone)", () => {
    const calls: string[] = [];
    const fake = { running: false, stop: () => calls.push("stop") };
    const doc = page();
    stopInBackground(fake, doc, true);
    doc.fire("pause");
    doc.hide();
    expect(calls).toEqual([]);
    fake.running = true;
    doc.fire("pause");
    expect(calls).toEqual(["stop"]);
  });

  it("a take in progress ends the way Stop ends it: the tail, then the take is handed over", async () => {
    vi.useFakeTimers();
    const e = await ready();
    const got: unknown[] = [];
    e.onTake((t) => got.push(t));
    const doc = page();
    stopInBackground(e, doc, true);
    e.play();
    e.record();
    expect(e.recordInfo().state).toBe("recording");
    doc.fire("pause");
    expect(e.running).toBe(false);
    expect(e.recordInfo().state).toBe("finishing");
    expect(h.recorders[0].stops).toBe(0);
    // The tail (RECORD_TAIL, 1.5 s) then closes the take, as after a tap on Stop.
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.recorders[0].stops).toBe(1);
    h.recorders[0].resolve({ file: {} as File, bytes: 10, seconds: 2, sampleRate: 48000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(e.recordInfo().state).toBe("off");
    expect(got).toHaveLength(1);
    // A second pause (the pause and the hidden page both arrive) changes nothing.
    doc.hide();
    expect(h.recorders[0].stops).toBe(1);
  });

  it("does nothing in a browser, and removes its listeners when disposed", () => {
    const calls: string[] = [];
    const fake = { running: true, stop: () => calls.push("stop") };
    const web = page();
    stopInBackground(fake, web, false);
    web.fire("pause");
    web.hide();
    expect(calls).toEqual([]);
    expect(web.count()).toBe(0);
    const app = page();
    const off = stopInBackground(fake, app, true);
    expect(app.count()).toBe(2);
    off();
    expect(app.count()).toBe(0);
    app.fire("pause");
    expect(calls).toEqual([]);
  });

  it("imports nothing: no Capacitor, no Tone, no engine", () => {
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
