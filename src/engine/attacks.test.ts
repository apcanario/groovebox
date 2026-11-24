/** Attacks start in audio-time order, however slow a tick's timeouts are (the P9 smoke's hat page error). */
import { describe, expect, it } from "vitest";
import { AttackQueue, freshSetNeeded } from "./attacks.ts";

/**
 * Tone's context, as far as attacks see it: now() is the audio time plus a lookahead; on each tick the timeouts due
 * at the time read on entry run first, then the Transport's steps up to the time read after them.
 */
class FakeTone {
  current = 0;
  readonly lookAhead = 0.1;
  private timeouts: { time: number; fn: () => void }[] = [];
  private stepsDone = 0;
  constructor(private readonly steps: { time: number; fn: () => void }[]) {}
  now(): number {
    return this.current + this.lookAhead;
  }
  setTimeout(fn: () => void, seconds: number): number {
    this.timeouts.push({ time: this.now() + seconds, fn });
    this.timeouts.sort((a, b) => a.time - b.time);
    return this.timeouts.length;
  }
  /** One tick: the timeouts loop (a callback may take `slow` seconds of audio time), then the clock's steps. */
  tick(dt: number, slow = 0): void {
    this.current += dt;
    const now = this.now();
    while (this.timeouts.length && this.timeouts[0].time <= now) this.timeouts.shift()!.fn();
    this.current += slow;
    const end = this.now();
    while (this.stepsDone < this.steps.length && this.steps[this.stepsDone].time <= end) this.steps[this.stepsDone++].fn();
  }
}

describe("attack queue", () => {
  it("starts a roll's waiting hit before a later step's hit when a slow timeout holds the tick", () => {
    const started: number[] = [];
    // A source as Tone keeps it: a start earlier than its last one throws.
    const start = (t: number): void => {
      if (started.length && t < started[started.length - 1]) throw new Error("The time must be greater than or equal to the last scheduled time");
      started.push(t);
    };
    const six = 0.12;
    const steps: { time: number; fn: () => void }[] = [];
    const tone = new FakeTone(steps);
    const q = new AttackQueue(tone);
    // Step 0 rolls four hits inside its sixteenth; step 1 has one hit.
    steps.push({ time: 0.2, fn: () => [0, 1, 2, 3].forEach((k) => q.at(0.2 + (k * six) / 4, () => start(0.2 + (k * six) / 4))) });
    steps.push({ time: 0.2 + six, fn: () => q.at(0.2 + six, () => start(0.2 + six)) });
    tone.tick(0.1); // step 0 runs; its later hits wait
    expect(q.size).toBe(3);
    // A slow timeout (a voice set freed) in this tick: the timeouts read now before the third hit is due, the clock
    // reads it after step 1 is.
    tone.setTimeout(() => {}, 0.05);
    tone.tick(0.06, 0.07);
    tone.tick(0.05);
    tone.tick(0.05);
    expect(started).toEqual([0.2, 0.23, 0.26, 0.29, 0.32].map((t) => expect.closeTo(t, 9)));
    expect(q.size).toBe(0);
  });

  it("waits for a future attack, keeps equal times in order and drops what waits on clear", () => {
    const tone = new FakeTone([]);
    const q = new AttackQueue(tone);
    const log: string[] = [];
    q.at(0.5, () => log.push("b"));
    q.at(0.3, () => log.push("a"));
    q.at(0.5, () => log.push("c"));
    q.at(0.05, () => log.push("now"));
    expect(log).toEqual(["now"]);
    tone.tick(0.25);
    expect(log).toEqual(["now", "a"]);
    q.clear();
    tone.tick(0.5);
    expect(log).toEqual(["now", "a"]);
    q.at(0.9, () => log.push("d"));
    q.at(0.95, () => log.push("e"));
    tone.tick(0.8);
    expect(log).toEqual(["now", "a", "d", "e"]);
  });

  it("drops no attack: a clap queued behind earlier waiting hits, through slow ticks, starts once, in time order", () => {
    // The smoke's silent clap (G3): every attack asked for must start, without a Stop. Hits at fixed, interleaved
    // times (a roll's hits, swung hats, a clap at the same time as a waiting hit), started from steps that run late.
    const tone = new FakeTone([]);
    const q = new AttackQueue(tone);
    const asked: { t: number; name: string }[] = [];
    const started: { t: number; name: string }[] = [];
    const ask = (t: number, name: string): void => {
      asked.push({ t, name });
      q.at(t, () => started.push({ t, name }));
    };
    for (let bar = 0; bar < 8; bar++) {
      const b = 0.2 + bar * 0.48;
      // A roll's four hits ahead, then a clap at the third hit's time and a hat between, asked later.
      [0, 1, 2, 3].forEach((k) => ask(b + k * 0.03, `roll${k}`));
      ask(b + 0.06, "clap");
      ask(b + 0.045, "hat");
      // Asked ahead, as the sequencer asks within the lookahead; a bar is 0.48 s of ticks, some held by a slow timeout.
      tone.tick(0.05, 0.07);
      ask(b + 0.24, "clap");
      for (let i = 0; i < 6; i++) tone.tick(0.05);
      tone.tick(0.03, 0.03);
    }
    for (let i = 0; i < 20; i++) tone.tick(0.05);
    expect(q.size).toBe(0);
    expect(started.length).toBe(asked.length);
    expect(started.filter((s) => s.name === "clap").length).toBe(16);
    // Each one exactly once, in audio-time order.
    const key = (x: { t: number; name: string }): string => `${x.t.toFixed(4)} ${x.name}`;
    expect(new Set(started.map(key)).size).toBe(asked.length);
    for (let i = 1; i < started.length; i++) expect(started[i].t).toBeGreaterThanOrEqual(started[i - 1].t);
  });
});

describe("a new voice set when the cap is full of voices ringing out", () => {
  const cap = 16;
  it("a Held chord after a busy rhythm's releaseAll: all 16 voices let go, five notes get a new set", () => {
    expect(freshSetNeeded({ cap, voices: 16, available: 0 }, 16, 16, 5)).toBe(true);
  });
  it("room left under the cap or available voices: no new set", () => {
    expect(freshSetNeeded({ cap, voices: 11, available: 0 }, 11, 11, 5)).toBe(false);
    expect(freshSetNeeded({ cap, voices: 16, available: 5 }, 11, 11, 5)).toBe(false);
  });
  it("a cap full of notes still held drops notes as before", () => {
    expect(freshSetNeeded({ cap, voices: 16, available: 0 }, 16, 0, 5)).toBe(false);
    expect(freshSetNeeded({ cap, voices: 16, available: 0 }, 16, 4, 5)).toBe(false);
    expect(freshSetNeeded({ cap, voices: 16, available: 0 }, 16, 5, 5)).toBe(true);
  });
});
