/** Attacks start in audio-time order, however slow a tick's timeouts are (the P9 smoke's hat page error). */
import { describe, expect, it } from "vitest";
import { AttackQueue } from "./attacks.ts";

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
});
