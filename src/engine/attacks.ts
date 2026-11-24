/**
 * An instrument's attacks, started in audio-time order. Pure: the clock is passed in (Tone's context in the app).
 *
 * Why (the P9 smoke's page error "The time must be greater than or equal to the last scheduled time", thrown by a
 * Source's state timeline from a hat's triggerAttack): an attack in the future (a swung step, a roll's later hits)
 * waits on the context's timeouts. On each clock tick Tone runs those timeouts first, against the time it read on
 * entry, and only then runs the Transport's steps, against a time it reads afterwards. A slow timeout in that tick
 * (a voice set built or freed, a wave change) moves that second reading on by its length, so a step can start a hit
 * later than a roll's last hit that is still waiting; when that hit then starts, it starts before the source's
 * last start, and Tone throws. So an attack that starts now first starts every waiting attack due no later than it.
 */
export interface AttackClock {
  /** Audio time attacks are scheduled up to now (Tone's now(): the current time plus the lookahead). */
  now(): number;
  /** Call `fn` once `seconds` have passed on this clock. */
  setTimeout(fn: () => void, seconds: number): unknown;
}

export class AttackQueue {
  private waiting: { time: number; run: () => void }[] = [];

  constructor(private readonly clock: AttackClock) {}

  /** Start `run` at audio time `time`: now if it is due, else when it is, and never after a later attack. */
  at(time: number, run: () => void): void {
    const wait = time - this.clock.now();
    if (wait <= 0) {
      this.due(time);
      run();
      return;
    }
    let i = this.waiting.length;
    while (i > 0 && this.waiting[i - 1].time > time) i--;
    this.waiting.splice(i, 0, { time, run });
    this.clock.setTimeout(() => this.due(time), wait);
  }

  /** Attacks waiting now. */
  get size(): number {
    return this.waiting.length;
  }

  /** Drop every waiting attack (Stop). */
  clear(): void {
    this.waiting = [];
  }

  /** Start, in time order, every waiting attack due at or before `time`. */
  private due(time: number): void {
    while (this.waiting.length && this.waiting[0].time <= time) this.waiting.shift()!.run();
  }
}
