/**
 * Queued switching (spec sections 3 and 7). Section switches and instrument on/off for the playing
 * section wait for the next bar line and land there together. Tapping the same switch again before
 * the bar line cancels it. Pure: no audio dependency.
 */
import type { InstrumentId } from "./song.ts";

export interface PendingToggle {
  section: number;
  instrument: InstrumentId;
}

export interface Pending {
  section: number | null;
  toggles: PendingToggle[];
}

export class SwitchQueue {
  private section: number | null = null;
  private toggles = new Map<string, PendingToggle>();

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

  isPendingToggle(section: number, instrument: InstrumentId): boolean {
    return this.toggles.has(`${section}:${instrument}`);
  }

  pending(): Pending {
    return { section: this.section, toggles: [...this.toggles.values()] };
  }

  get empty(): boolean {
    return this.section === null && this.toggles.size === 0;
  }

  /** Take everything that is pending, leaving the queue empty. Called on the bar line. */
  flush(): Pending {
    const out = this.pending();
    this.section = null;
    this.toggles.clear();
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
  }

  clear(): void {
    this.flush();
  }
}
