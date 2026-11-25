/**
 * P11 review E1 and S1: what Morph takes out (an instrument) or eases (a Lock) is given back when its journey stops,
 * restarts or holds: Stop then Play, a song loaded, a new seed, Morph switched off, a drop. The real engine, its
 * scheduler's callback driven step by step, with Tone and the audio graph replaced by fakes: no audio runs here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  // Any property is a no-op function returning the same proxy (0 as a number): stands in for the audio graph.
  const anything: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === "then" ? undefined : k === Symbol.toPrimitive ? () => 0 : anything),
    apply: () => anything,
  });
  const tick: { fn: ((time: number) => void) | null } = { fn: null };
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
    scheduleRepeat: (fn: (time: number) => void) => {
      tick.fn = fn;
      return 0;
    },
  };
  const ctx = { currentTime: 0, sampleRate: 48000, rawContext: {}, latencyHint: "balanced" };
  return { anything, transport, ctx, tick };
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

import { Engine } from "./index.ts";
import { STEPS_PER_BAR } from "./sequencer.ts";
import { vibeSong, vibeStart } from "../music/styles.ts";
import type { Song } from "./song.ts";

/** Ambient's journey takes the drums out of section 1 (B) at bar 80 for one chord loop (16 bars). */
const OUT_BAR = 80;

async function playing(song: Song, section: number): Promise<Engine> {
  const e = new Engine();
  await e.init();
  e.loadSong(song, section);
  e.play();
  return e;
}

/** Play `bars` bars through the scheduler's callback; `atBar` runs before each bar line (a hand). */
function bars(e: Engine, n: number, atBar?: (bar: number) => void): void {
  for (let i = 0; i < n * STEPS_PER_BAR; i++) {
    if (i % STEPS_PER_BAR === 0) atBar?.(e.morphBar());
    h.ctx.currentTime += 0.125;
    h.tick.fn!(h.ctx.currentTime + 0.1);
  }
}

const drums = (e: Engine): boolean => e.getSong().sections[1].on.drums;

beforeEach(() => {
  h.transport.state = "stopped";
  h.ctx.currentTime = 0;
});

describe("Morph gives back what it owes (P11 review E1, S1)", () => {
  it("the journey as the scheduler plays it takes Ambient's drums out at bar 80", async () => {
    const e = await playing(vibeSong("ambient")!, vibeStart("ambient"));
    bars(e, OUT_BAR + 1);
    expect(drums(e)).toBe(false);
    // Saved now (autosave, a song switch), the jam keeps its drums: Morph would give them back.
    expect(e.getDocument().sections[1].on.drums).toBe(true);
  });

  it("Stop gives the drums back at once; Play then starts a journey with them", async () => {
    const e = await playing(vibeSong("ambient")!, vibeStart("ambient"));
    bars(e, OUT_BAR + 2);
    expect(drums(e)).toBe(false);
    e.stop();
    expect(drums(e)).toBe(true);
    expect(e.getDocument().sections[1].on.drums).toBe(true);
    e.play();
    const off: number[] = [];
    bars(e, OUT_BAR, (bar) => void (drums(e) || off.push(bar)));
    expect(off).toEqual([]);
  });

  it("a song loaded while Morph has an instrument out: the old one is saved whole, and opens whole", async () => {
    const e = await playing(vibeSong("ambient")!, vibeStart("ambient"));
    bars(e, OUT_BAR + 3);
    expect(drums(e)).toBe(false);
    const saved = e.getDocument();
    e.loadAtBar(vibeSong("deepHouse")!, vibeStart("deepHouse"));
    bars(e, 2);
    expect(e.getSong().style).toBe("deepHouse");
    e.stop();
    e.loadSong(saved, 1);
    expect(drums(e)).toBe(true);
    e.play();
    bars(e, 4);
    expect(drums(e)).toBe(true);
  });

  it("Stop gives back a Lock Morph has eased; saved meanwhile, it is at its base", async () => {
    const e = await playing(vibeSong("deepHouse")!, vibeStart("deepHouse"));
    expect(e.setMorph({ on: true })).toBe(true);
    // deepHouse with Morph on eases layer1's Lock at bar 9 for two bars.
    bars(e, 10);
    expect(e.getSong().sections[1].layer1.gen.lock).toBeLessThan(0.75);
    expect(e.getDocument().sections[1].layer1.gen.lock).toBe(0.75);
    e.stop();
    expect(e.getSong().sections[1].layer1.gen.lock).toBe(0.75);
  });

  it("Morph switched off gives back the instrument and the Lock on the next bar line", async () => {
    const e = await playing(vibeSong("ambient")!, vibeStart("ambient"));
    bars(e, OUT_BAR + 1);
    expect(drums(e)).toBe(false);
    e.setMorph({ on: false });
    bars(e, 1);
    expect(drums(e)).toBe(true);
    bars(e, 40);
    expect(drums(e)).toBe(true);
    e.stop();
    const d = await playing(vibeSong("deepHouse")!, vibeStart("deepHouse"));
    d.setMorph({ on: true });
    bars(d, 10);
    expect(d.getSong().sections[1].layer1.gen.lock).toBeLessThan(0.75);
    d.setMorph({ on: false });
    bars(d, 1);
    expect(d.getSong().sections[1].layer1.gen.lock).toBe(0.75);
  });

  it("a new seed gives back what the old journey had out", async () => {
    const e = await playing(vibeSong("ambient")!, vibeStart("ambient"));
    bars(e, OUT_BAR + 1);
    expect(drums(e)).toBe(false);
    e.setMorph({ seed: 4242 });
    bars(e, 1);
    expect(drums(e)).toBe(true);
  });

  it("a drop pressed while Morph has the drums out plays them from the build's first bar (S1)", async () => {
    const e = await playing(vibeSong("ambient")!, vibeStart("ambient"));
    bars(e, OUT_BAR + 1);
    expect(drums(e)).toBe(false);
    e.drop();
    e.morphTraceOn(true);
    const off: number[] = [];
    bars(e, 30, (bar) => void (drums(e) || off.push(bar)));
    // The drop started on the first bar line after the press: the drums are back on that one, before it plays.
    expect(e.morphTrace[0].held).toBe(true);
    expect(off).toEqual([OUT_BAR + 1]);
    expect(drums(e)).toBe(true);
  });
});
