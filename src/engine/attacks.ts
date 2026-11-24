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
 *
 * C18 (P8, a P9 smoke's "Start time must be strictly greater than previous start time"): Tone clamps a start in the
 * past to the context's current time, so two late attacks on one source both start at that time, and a restart at a
 * source's own last start time throws. So the queue also hands each attack the time to start at: never before the
 * current time, and strictly after the last start it gave the same source (by at least `MIN_GAP`).
 */
export interface AttackClock {
  /** Audio time attacks are scheduled up to now (Tone's now(): the current time plus the lookahead). */
  now(): number;
  /** Call `fn` once `seconds` have passed on this clock. */
  setTimeout(fn: () => void, seconds: number): unknown;
  /** The audio time now (the context's currentTime): a start before it is clamped to it. Default: no clamp. */
  currentTime?(): number;
}

/** Smallest gap between two starts of one source, in seconds: 0.1 ms, well over Tone's 1e-6 comparison epsilon. */
export const MIN_GAP = 1e-4;

export class AttackQueue {
  private waiting: { time: number; source: string; run: (t: number) => void }[] = [];
  /** The last start time handed to each source. */
  private last = new Map<string, number>();

  constructor(private readonly clock: AttackClock) {}

  /**
   * Start `run` at audio time `time`: now if it is due, else when it is, and never after a later attack. `run` gets
   * the time to start at, which every start of `source` must use: `time`, or later when `time` has already passed or
   * the source's last start was at or after it, so a source's start times strictly increase.
   */
  at(time: number, run: (t: number) => void, source = ""): void {
    const wait = time - this.clock.now();
    if (wait <= 0) {
      this.due(time);
      this.start(time, source, run);
      return;
    }
    let i = this.waiting.length;
    while (i > 0 && this.waiting[i - 1].time > time) i--;
    this.waiting.splice(i, 0, { time, source, run });
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
    while (this.waiting.length && this.waiting[0].time <= time) {
      const w = this.waiting.shift()!;
      this.start(w.time, w.source, w.run);
    }
  }

  /** Run one attack at its time, moved up to the current time and past the source's last start. */
  private start(time: number, source: string, run: (t: number) => void): void {
    const prev = this.last.get(source);
    let t = Math.max(time, this.clock.currentTime?.() ?? -Infinity);
    if (prev !== undefined && t < prev + MIN_GAP) t = prev + MIN_GAP;
    this.last.set(source, t);
    run(t);
  }
}

/**
 * Whether `n` new notes need a new voice set: PolySynth drops a note when its free voices (available, plus the room
 * left under the cap) run out, and counts a voice until its release has rung out. A new set is needed only when the
 * notes would fit but for voices already let go (`ringing`); a cap full of notes still held drops notes as before.
 */
export function freshSetNeeded(pool: { cap: number; voices: number; available: number }, active: number, ringing: number, n: number): boolean {
  const free = pool.available + Math.max(0, pool.cap - pool.voices);
  return free < n && active - ringing + n <= pool.cap;
}
