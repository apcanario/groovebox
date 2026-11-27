/**
 * T3 (spec 9.4): the engine's punch API. The real engine with Tone and the audio graph replaced by fakes (the punch
 * rack's own timing is tested on the audio clock in punch.test.ts): a press reaches the rack only while playing,
 * Stop takes every pad out, a press is logged in a take and is no song edit.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const anything: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => 0 : anything),
    apply: () => anything,
  });
  const presses: [string, boolean][] = [];
  const resets = { n: 0 };
  const punch = {
    press: (pad: string, down: boolean) => {
      presses.push([pad, down]);
      return null;
    },
    reset: () => void resets.n++,
    state: () => [],
  };
  const graph: unknown = new Proxy(
    {},
    { get: (_t, k) => (k === "punch" ? punch : k === "then" ? undefined : anything) },
  );
  const transport = {
    state: "stopped" as "started" | "stopped",
    ticks: 0,
    PPQ: 192,
    bpm: { value: 120, rampTo: () => undefined, setValueAtTime: () => undefined },
    start() {
      this.state = "started";
    },
    stop() {
      this.state = "stopped";
    },
    scheduleRepeat: () => 0,
  };
  const ctx = { currentTime: 0, sampleRate: 48000, rawContext: {}, latencyHint: "balanced" };
  return { graph, transport, ctx, presses, resets };
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

vi.mock("./audio.ts", () => ({ Graph: { build: async () => h.graph } }));

import { Engine, PUNCH_PADS } from "./index.ts";

beforeEach(() => {
  h.transport.state = "stopped";
  h.presses.length = 0;
  h.resets.n = 0;
});

describe("Engine.punch (T3)", () => {
  it("does nothing while stopped; while playing every pad reaches the rack, held together", async () => {
    const e = new Engine();
    await e.init();
    e.punch("cut", true);
    expect(h.presses).toEqual([]);
    e.play();
    for (const pad of PUNCH_PADS) e.punch(pad, true);
    e.punch("cut", false);
    expect(h.presses).toEqual([...PUNCH_PADS.map((p) => [p, true]), ["cut", false]]);
  });

  it("a press is no song edit (no change event) and an unknown pad is ignored", async () => {
    const e = new Engine();
    await e.init();
    e.play();
    let changes = 0;
    e.onChange(() => changes++);
    e.punch("filter", true);
    e.punch("nope" as never, true);
    expect(changes).toBe(0);
    expect(h.presses).toEqual([["filter", true]]);
  });

  it("Stop takes every pad out", async () => {
    const e = new Engine();
    await e.init();
    e.play();
    e.punch("stutter", true);
    e.stop();
    expect(h.resets.n).toBe(1);
  });
});
