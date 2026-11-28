/**
 * Keeps the engine's song saved (G5): every edit saves the song a moment later, a finished take
 * saves its event log, and leaving the page saves at once. Songs are switched only while stopped.
 */
import type { Engine, EventLog, Song } from "../engine/index.ts";
import { freeName, type Library, type SongEntry } from "./library.ts";

/** Edits closer together than this share one save (a knob drag saves once it rests). */
export const SAVE_DELAY_MS = 400;

export class Keeper {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private savedLog: EventLog | null;
  private chain: Promise<void> = Promise.resolve();
  /** startVibe calls, one after another (P3 review S1). */
  private vibeChain: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  /** The last save failed (storage full, private mode): the UI says so. */
  failed = false;
  /**
   * The open song is the default one made on a first launch and nothing has been changed in it: a vibe
   * loaded over it replaces it in Songs instead of keeping an empty "Song 1" (P3).
   */
  scratch = false;
  /**
   * F1 (spec 10.1): the open song is the launch jam, drawn on a cold start and not in Songs yet. It is saved, as a
   * new song, the first time it is played or edited; never played or edited, it adds nothing to Songs. `id` is
   * empty while this holds.
   */
  launch = false;
  /** The song a vibe started that is still waiting for its bar line. */
  private queuedId: string | null = null;

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
    this.listen();
    const now = (): void => void this.flush();
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && now());
    window.addEventListener("pagehide", now);
  }

  /** Hear the engine: an edit saves a moment later; Play or an edit keeps the launch jam (F1). */
  listen(): void {
    this.engine.onChange(() => this.schedule());
    this.engine.onRunning((on) => {
      if (on) void this.keepLaunch();
    });
  }

  /**
   * Open the launch jam (F1, spec 10.1): `doc` is loaded from `section` and held outside Songs until it is played or
   * edited. The last jam stays in Songs as it was, and so stays first there.
   */
  openLaunch(doc: Song, section: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // Loading counts as a change: the flag is set only once it has landed, so the load itself keeps nothing.
    this.launch = false;
    this.scratch = false;
    this.queuedId = null;
    this.id = "";
    this.engine.loadSong(doc, section);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.launch = true;
    this.savedLog = this.engine.getLog();
    this.emit();
  }

  /** The launch jam becomes a song in Songs, named after its vibe (F1). Runs once; the chain keeps saves in order. */
  private keepLaunch(): Promise<void> {
    if (!this.launch) return this.chain;
    this.launch = false;
    const doc = this.engine.getDocument();
    this.chain = this.chain
      .then(async () => {
        const names = (await this.lib.list()).map((e) => e.name);
        const named: Song = { ...doc, name: freeName(doc.name, names) };
        const id = await this.lib.create(named);
        this.id = id;
        this.savedLog = named.log ?? null;
        this.setFailed(false);
        this.emit();
      })
      .catch(() => this.setFailed(true));
    return this.chain;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Save now (and wait for it). */
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // The untouched launch jam is not saved (F1).
    if (this.launch) return this.chain;
    const id = this.id;
    const doc = this.engine.getDocument();
    const log = this.engine.getLog();
    const withLog = log !== this.savedLog;
    // An empty id: the launch jam's first save is still in the chain ahead of this one; save under the id it got.
    this.chain = this.chain
      .then(() => {
        const to = id || this.id;
        return to ? this.lib.save(to, doc, withLog) : undefined;
      })
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
    if (this.launch && id === this.id) {
      const { id: next, doc } = await this.lib.open();
      this.launch = false;
      this.switchTo(next, doc);
      return true;
    }
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

  /**
   * Start a vibe (P3, spec 8.2): `doc` becomes a new song in Songs, named after the vibe, and loads on the next
   * bar line while playing (at once when stopped), from `section`. The jam it replaces is saved and stays in
   * Songs. Refused while a take is recording or finishing.
   */
  startVibe(doc: Song, section: number): Promise<boolean> {
    return this.startVibeWith(() => ({ doc, section }));
  }

  /**
   * As `startVibe`, with the vibe chosen by `pick` once every earlier call has finished (P3 review S1): calls
   * run one after another, so a second quick tap sees the first one's pending load (and replaces it), and an
   * arrow steps from the vibe the first tap queued. `pick` returning null takes nothing.
   */
  startVibeWith(pick: () => { doc: Song; section: number } | null): Promise<boolean> {
    const run = this.vibeChain.then(() => {
      const got = pick();
      return got ? this.startVibeNow(got.doc, got.section) : false;
    });
    this.vibeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async startVibeNow(doc: Song, section: number): Promise<boolean> {
    const st = this.engine.recordInfo().state;
    if (st === "recording" || st === "finishing") return false;
    // F1: a vibe over the untouched launch jam (stopped, so never heard) is a launch jam in its place: still not in Songs.
    if (this.launch) {
      this.openLaunch(doc, section);
      return true;
    }
    // Replaced, not kept: the untouched first-launch song, or a vibe still waiting for its bar line (never heard).
    const drop = this.scratch || (this.engine.pendingLoad() && this.queuedId === this.id) ? this.id : null;
    this.scratch = false;
    await this.flush();
    const names = (await this.lib.list()).filter((e) => e.id !== drop).map((e) => e.name);
    const named: Song = { ...doc, name: freeName(doc.name, names) };
    const id = await this.lib.create(named);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.id = id;
    this.engine.loadAtBar(named, section);
    this.queuedId = this.engine.pendingLoad() ? id : null;
    // Loading counts as a change; the new song is saved already.
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.savedLog = this.engine.getLog();
    if (drop) await this.lib.remove(drop);
    await this.lib.setLast(id);
    this.emit();
    return true;
  }

  idle(): boolean {
    return !this.engine.playing && this.engine.recordInfo().state === "off";
  }

  private switchTo(id: string, doc: Song): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // Opening another song leaves an untouched launch jam unsaved (F1).
    this.launch = false;
    this.id = id;
    this.engine.loadSong(doc);
    // Loading counts as a change; nothing new to save.
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.savedLog = this.engine.getLog();
    this.emit();
  }

  private schedule(): void {
    this.scratch = false;
    if (this.launch) void this.keepLaunch();
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
