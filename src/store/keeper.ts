/**
 * Keeps the engine's song saved (G5): every edit saves the song a moment later, a finished take
 * saves its event log, and leaving the page saves at once. Songs are switched only while stopped.
 */
import type { Engine, EventLog, Song } from "../engine/index.ts";
import type { Library, SongEntry } from "./library.ts";

/** Edits closer together than this share one save (a knob drag saves once it rests). */
export const SAVE_DELAY_MS = 400;

export class Keeper {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private savedLog: EventLog | null;
  private chain: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  /** The last save failed (storage full, private mode): the UI says so. */
  failed = false;

  constructor(
    readonly engine: Engine,
    private lib: Library,
    public id: string,
    /** False when IndexedDB is missing: songs live until the page closes. */
    readonly persistent: boolean,
  ) {
    this.savedLog = engine.getLog();
  }

  start(): void {
    this.engine.onChange(() => this.schedule());
    const now = (): void => void this.flush();
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && now());
    window.addEventListener("pagehide", now);
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Save now (and wait for it). */
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const id = this.id;
    const doc = this.engine.getDocument();
    const log = this.engine.getLog();
    const withLog = log !== this.savedLog;
    this.chain = this.chain
      .then(() => this.lib.save(id, doc, withLog))
      .then(
        () => {
          if (withLog) this.savedLog = log;
          this.setFailed(false);
        },
        () => this.setFailed(true),
      );
    return this.chain;
  }

  list(): Promise<SongEntry[]> {
    return this.lib.list();
  }

  /** Open a saved song. Refused while playing or recording. */
  async open(id: string): Promise<boolean> {
    if (!this.idle()) return false;
    await this.flush();
    const doc = await this.lib.load(id);
    if (!doc) return false;
    this.switchTo(id, doc);
    await this.lib.setLast(id);
    return true;
  }

  /** Start a new default song named "Song N". Refused while playing or recording. */
  async create(): Promise<boolean> {
    if (!this.idle()) return false;
    await this.flush();
    const { id, doc } = await this.lib.fresh();
    this.switchTo(id, doc);
    return true;
  }

  /** Delete a song; deleting the open one opens the next (or a new one). Refused while playing or recording. */
  async remove(id: string): Promise<boolean> {
    if (!this.idle()) return false;
    if (id !== this.id) {
      await this.lib.remove(id);
      this.emit();
      return true;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.chain;
    await this.lib.remove(id);
    const { id: next, doc } = await this.lib.open();
    this.switchTo(next, doc);
    return true;
  }

  idle(): boolean {
    return !this.engine.playing && this.engine.recordInfo().state === "off";
  }

  private switchTo(id: string, doc: Song): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.id = id;
    this.engine.loadSong(doc);
    // Loading counts as a change; nothing new to save.
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.savedLog = this.engine.getLog();
    this.emit();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  private setFailed(v: boolean): void {
    if (v === this.failed) return;
    this.failed = v;
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}
