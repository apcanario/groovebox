/**
 * T3 (spec 9.4): the engine's punch API. The real engine with Tone and the audio graph replaced by fakes (the punch
 * rack's own timing is tested on the audio clock in punch.test.ts): a press reaches the rack only while playing,
 * Stop takes every pad out, a press is no song edit (that it is logged in a take: record.test.ts), and a press leaves
 * the Drop's level follower going while Cut pauses its readings.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const anything: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => 0 : anything),
    apply: () => anything,
  });
  const presses: [string, boolean][] = [];
  const resets = { n: 0 };
  const cutIn = { on: false };
  const comps: number[] = [];
  const drop = { compValue: 1, setComp: (v: number) => void comps.push(v) };
  const punch = {
    active: (pad: string) => pad === "cut" && cutIn.on,
    press: (pad: string, down: boolean) => {
      presses.push([pad, down]);
      return null;
    },
    reset: () => void resets.n++,
    state: () => [],
  };
  const graph: unknown = new Proxy(
    {},
    { get: (_t, k) => (k === "punch" ? punch : k === "drop" ? drop : k === "then" ? undefined : anything) },
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
  return { graph, transport, ctx, presses, resets, cutIn, comps };
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
  h.cutIn.on = false;
  h.comps.length = 0;
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

describe("punch pads and the Drop's level follower (T3 review M4)", () => {
  /** The engine with a drop sounding and its follower ready to read a beat (private state set as a drop leaves it). */
  async function dropping() {
    const e = new Engine();
    await e.init();
    e.play();
    const x = e as unknown as Record<string, unknown>;
    x.doubling = () => true;
    x.dropper = { active: true, reset: () => undefined };
    x.dropPlan = { phase: "on" };
    x.dropRef = 1;
    x.dropRefs = new Map([[0, 1]]);
    x.dropLast = 1;
    const follow = (energy: number) => (x.dropFollow as (en: unknown, ph: string, r: boolean, k: number) => void).call(e, { energy }, "on", true, 0);
    return { e, x, follow };
  }

  it("a punch press is no hand on the mix: the follower keeps reading; a mix move still stops it", async () => {
    const { e, x, follow } = await dropping();
    e.punch("echo", true);
    e.punch("cut", true);
    e.punch("cut", false);
    expect(x.dropHand).toBe(false);
    follow(4);
    expect(h.comps.length).toBe(1);
    e.setMix("pump", 0.5);
    expect(x.dropHand).toBe(true);
  });

  it("while Cut is in, the follower takes no reading (it hears the channels after Cut)", async () => {
    const { follow } = await dropping();
    h.cutIn.on = true;
    follow(0.01);
    follow(0.01);
    expect(h.comps).toEqual([]);
    h.cutIn.on = false;
    follow(4);
    expect(h.comps.length).toBe(1);
  });
});
