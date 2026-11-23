/**
 * Queued switching (spec sections 3 and 7). Section switches and instrument on/off for the playing
 * section wait for the next bar line and land there together, and so does a progression card (P4). Tapping the same switch again before
 * the bar line cancels it. Pure: no audio dependency.
 */
import type { Mood } from "../music/scales.ts";
import type { ChordStep, InstrumentId } from "./song.ts";

export interface PendingToggle {
  section: number;
  instrument: InstrumentId;
}

/** A progression waiting for the bar line (P4, a Simple Chords card): the song's mood and one section's chords. */
export interface PendingChords {
  section: number;
  mood: Mood;
  chords: ChordStep[];
}

export interface Pending {
  section: number | null;
  toggles: PendingToggle[];
  /** A progression landing on the bar line (P4); absent when none. */
  chords?: PendingChords;
}

function sameChords(a: PendingChords, b: PendingChords): boolean {
  return (
    a.section === b.section &&
    a.mood === b.mood &&
    a.chords.length === b.chords.length &&
    a.chords.every((c, i) => c.degree === b.chords[i].degree && c.bars === b.chords[i].bars)
  );
}

function copyChords(c: PendingChords): PendingChords {
  return { section: c.section, mood: c.mood, chords: c.chords.map((x) => ({ degree: x.degree, bars: x.bars })) };
}

export class SwitchQueue {
  private section: number | null = null;
  private toggles = new Map<string, PendingToggle>();
  private chords: PendingChords | null = null;

  /** Queue a switch to section `target` while `playing` plays. Tapping it again cancels it. */
  queueSection(target: number, playing: number): void {
    if (this.section === target || target === playing) this.section = null;
    else this.section = target;
  }

  /** Queue an on/off for an instrument of the playing section. Tapping it again cancels it. */
  queueToggle(section: number, instrument: InstrumentId): void {
    const key = `${section}:${instrument}`;
    if (this.toggles.has(key)) this.toggles.delete(key);
    else this.toggles.set(key, { section, instrument });
  }

  /**
   * Queue a progression (P4): the song's mood and a section's chords, together on the bar line. One waits at a
   * time: another replaces it, and the same one tapped again cancels it.
   */
  queueChords(c: PendingChords): void {
    this.chords = this.chords && sameChords(this.chords, c) ? null : copyChords(c);
  }

  isPendingToggle(section: number, instrument: InstrumentId): boolean {
    return this.toggles.has(`${section}:${instrument}`);
  }

  pending(): Pending {
    const out: Pending = { section: this.section, toggles: [...this.toggles.values()] };
    if (this.chords) out.chords = copyChords(this.chords);
    return out;
  }

  get empty(): boolean {
    return this.section === null && this.toggles.size === 0 && this.chords === null;
  }

  /** Take everything that is pending, leaving the queue empty. Called on the bar line. */
  flush(): Pending {
    const out = this.pending();
    this.section = null;
    this.toggles.clear();
    this.chords = null;
    return out;
  }

  /** Re-index after sections were inserted or removed; entries mapped to null are dropped. */
  remap(fn: (i: number) => number | null): void {
    this.section = this.section === null ? null : fn(this.section);
    const kept = [...this.toggles.values()]
      .map((t) => ({ section: fn(t.section), instrument: t.instrument }))
      .filter((t): t is PendingToggle => t.section !== null);
    this.toggles.clear();
    for (const t of kept) this.toggles.set(`${t.section}:${t.instrument}`, t);
    if (this.chords) {
      const to = fn(this.chords.section);
      this.chords = to === null ? null : { ...this.chords, section: to };
    }
  }

  clear(): void {
    this.flush();
  }

  /** An independent copy (for the lanes' look-ahead). `toggles: false` leaves the copy's toggles out. */
  clone(toggles = true): SwitchQueue {
    const c = new SwitchQueue();
    c.section = this.section;
    if (toggles) for (const [k, t] of this.toggles) c.toggles.set(k, { ...t });
    c.chords = this.chords && copyChords(this.chords);
    return c;
  }
}

/** Merge two pending sets: the section of `b` wins when it has one; toggles of both, each once. */
export function mergePending(a: Pending, b: Pending): Pending {
  const toggles = [...a.toggles];
  for (const t of b.toggles) {
    if (!toggles.some((u) => u.section === t.section && u.instrument === t.instrument)) toggles.push(t);
  }
  const out: Pending = { section: b.section ?? a.section, toggles };
  const chords = b.chords ?? a.chords;
  if (chords) out.chords = chords;
  return out;
}

/**
 * Switches the scheduler has already applied but the listener has not heard yet. The sequencer
 * flushes the queue when it schedules a bar's first step, a lookahead before that bar line sounds;
 * until the drawn position reaches that bar, the switch is still "pending" to the person playing.
 */
export class InFlight {
  private items: { bar: number; pending: Pending }[] = [];

  /** The scheduler applied `pending` at the start of `bar`. */
  land(bar: number, pending: Pending): void {
    this.items.push({ bar, pending });
  }

  /** The drawn (heard) position reached `bar`: everything landed at or before it is heard. */
  reach(bar: number): void {
    this.items = this.items.filter((i) => i.bar > bar);
  }

  clear(): void {
    this.items = [];
  }

  /** What to show as pending: in-flight switches, then the live queue on top. */
  shown(live: Pending): Pending {
    let out: Pending = { section: null, toggles: [] };
    for (const i of this.items) out = mergePending(out, i.pending);
    return mergePending(out, live);
  }
}
