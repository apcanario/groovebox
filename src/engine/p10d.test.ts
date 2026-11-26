/**
 * P10d: the Play button shows the transport's real state. The real engine, its scheduler's callback driven step by step,
 * with Tone and the audio graph replaced by fakes. The fake Draw keeps what the engine hands it, as Tone's does, and
 * runs it later, so a position scheduled before Stop arrives after it, as it does in the browser.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
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
  const draw: (() => void)[] = [];
  return { anything, transport, ctx, tick, draw };
});

vi.mock("tone", () => ({
  setContext: () => undefined,
  Context: class {},
  start: async () => undefined,
  getContext: () => h.ctx,
  getTransport: () => h.transport,
  getDraw: () => ({ schedule: (fn: () => void) => void h.draw.push(fn) }),
  now: () => h.ctx.currentTime,
}));

vi.mock("./audio.ts", () => ({ Graph: { build: async () => h.anything } }));

import { Engine } from "./index.ts";
import { vibeSong, vibeStart } from "../music/styles.ts";

/** The scheduler's callback, `n` steps, a lookahead ahead of the clock; what it hands the screen waits in `h.draw`. */
function steps(n: number): void {
  for (let i = 0; i < n; i++) {
    h.ctx.currentTime += 0.125;
    h.tick.fn!(h.ctx.currentTime + 0.1);
  }
}

/** The screen's frame: run what Draw holds. */
function frame(): void {
  for (const fn of h.draw.splice(0)) fn();
}

/** What the button shows, as the app reads it: the last state onRunning told. */
async function engineWithButton(): Promise<{ e: Engine; shown: () => boolean; heard: () => boolean }> {
  const e = new Engine();
  await e.init();
  e.loadSong(vibeSong("deepHouse")!, vibeStart("deepHouse"));
  let shown = e.playing;
  let heard = e.position().playing;
  e.onRunning((on) => (shown = on));
  e.onPosition((p) => (heard = p.playing));
  return { e, shown: () => shown, heard: () => heard };
}

beforeEach(() => {
  h.transport.state = "stopped";
  h.ctx.currentTime = 0;
  h.draw.length = 0;
});

describe("the Play button follows the transport (P10d)", () => {
  it("shows Stop from the tap on, before the first position is heard, and stays there while it plays", async () => {
    const { e, shown } = await engineWithButton();
    e.play();
    expect(shown()).toBe(true);
    for (let k = 0; k < 16; k++) {
      steps(1);
      expect(shown()).toBe(true);
      frame();
      expect(shown()).toBe(true);
    }
  });

  it("a position scheduled before Stop and drawn after it does not show the stopped transport as playing", async () => {
    const { e, shown, heard } = await engineWithButton();
    e.play();
    steps(8);
    frame();
    expect(heard()).toBe(true);
    // The steps of the lookahead are scheduled, not yet drawn, when Stop is tapped.
    steps(2);
    e.stop();
    expect(shown()).toBe(false);
    frame();
    expect(e.position().playing).toBe(false);
    expect(heard()).toBe(false);
    expect(shown()).toBe(false);
  });

  it("Stop during a drop's build, then Play: Stop shows at once and stays, and DROP shows off after the Stop", async () => {
    const { e, shown } = await engineWithButton();
    e.play();
    steps(4);
    frame();
    e.drop();
    steps(27);
    frame();
    expect(e.dropShown().phase).not.toBe("off");
    // Across a bar line: the button's phase for it is scheduled, not yet drawn, when Stop is tapped.
    steps(2);
    e.stop();
    frame();
    expect(shown()).toBe(false);
    expect(e.dropShown().phase).toBe("off");
    e.play();
    for (let k = 0; k < 8; k++) {
      steps(1);
      frame();
      expect(shown()).toBe(true);
      expect(e.position().playing).toBe(true);
    }
  });

  it("later taps: each Play shows Stop and each Stop shows Play, with positions left over from the run before", async () => {
    const { e, shown, heard } = await engineWithButton();
    for (let round = 0; round < 3; round++) {
      e.play();
      steps(3);
      expect(shown()).toBe(true);
      frame();
      expect(heard()).toBe(true);
      steps(2);
      e.stop();
      frame();
      expect(shown()).toBe(false);
      expect(heard()).toBe(false);
    }
  });
});
