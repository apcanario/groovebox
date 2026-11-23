/**
 * The song library (G5): several songs kept on the phone, the last one reopened on launch.
 * Songs and their event logs sit in separate stores so a knob move saves the song without
 * rewriting a long log. Storage is behind a small key-value interface: IndexedDB on the phone,
 * a Map in the tests. No audio dependency.
 */
import { defaultSong, validateSong, type EventLog, type Song } from "../engine/song.ts";

/** The song-name rule lives with the song (G5 review M5); re-exported for the UI and the tests. */
export { cleanName, MAX_SONG_NAME } from "../engine/song.ts";

export type StoreName = "songs" | "logs" | "meta";

export interface Kv {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put(store: StoreName, key: string, value: unknown): Promise<void>;
  del(store: StoreName, key: string): Promise<void>;
  all<T>(store: StoreName): Promise<T[]>;
}

export interface SongRecord {
  id: string;
  name: string;
  /** Milliseconds since 1970 of the last save. */
  updated: number;
  /** The song with its mix, without its log. */
  song: Song;
}

interface LogRecord {
  id: string;
  log: EventLog;
}

export interface SongEntry {
  id: string;
  name: string;
  updated: number;
}


/** "Song N" with the lowest N not taken. */
export function nextName(names: readonly string[]): string {
  const taken = new Set(names.map((n) => n.trim().toLowerCase()));
  for (let i = 1; ; i++) if (!taken.has(`song ${i}`)) return `Song ${i}`;
}

export class Library {
  private seq = 0;

  constructor(
    private kv: Kv,
    private clock: () => number = () => Date.now(),
  ) {}

  /** Every song, newest save first. */
  async list(): Promise<SongEntry[]> {
    const all = await this.kv.all<SongRecord>("songs");
    return all.map(({ id, name, updated }) => ({ id, name, updated })).sort((a, b) => b.updated - a.updated || (a.id < b.id ? 1 : -1));
  }

  /** The song with its log, or null if missing or no longer valid. */
  async load(id: string): Promise<Song | null> {
    const rec = await this.kv.get<SongRecord>("songs", id);
    if (!rec) return null;
    const log = await this.kv.get<LogRecord>("logs", id);
    const doc: Song = log ? { ...rec.song, log: log.log } : { ...rec.song };
    if (validateSong(doc).length) {
      // A log that no longer validates must not cost the song itself.
      const bare: Song = { ...rec.song };
      return validateSong(bare).length ? null : bare;
    }
    return doc;
  }

  /** Save a song document. Its log goes to the log store only when `withLog` is set. */
  async save(id: string, doc: Song, withLog = false): Promise<void> {
    const { log, ...song } = doc;
    await this.kv.put("songs", id, { id, name: song.name, updated: this.clock(), song } satisfies SongRecord);
    if (withLog) {
      if (log) await this.kv.put("logs", id, { id, log } satisfies LogRecord);
      else await this.kv.del("logs", id);
    }
    await this.kv.put("meta", "last", id);
  }

  /** Store a new song under a fresh id and make it the last one. */
  async create(doc: Song): Promise<string> {
    const id = `s${this.clock().toString(36)}${(this.seq++).toString(36)}`;
    await this.save(id, doc, true);
    return id;
  }

  async remove(id: string): Promise<void> {
    await this.kv.del("songs", id);
    await this.kv.del("logs", id);
    if ((await this.kv.get<string>("meta", "last")) === id) await this.kv.del("meta", "last");
  }

  async setLast(id: string): Promise<void> {
    await this.kv.put("meta", "last", id);
  }

  /** The song to open on launch: the last one, else the newest, else a new default song. */
  async open(): Promise<{ id: string; doc: Song }> {
    const last = await this.kv.get<string>("meta", "last");
    if (last) {
      const doc = await this.load(last);
      if (doc) return { id: last, doc };
    }
    for (const e of await this.list()) {
      const doc = await this.load(e.id);
      if (doc) {
        await this.setLast(e.id);
        return { id: e.id, doc };
      }
    }
    return this.fresh();
  }

  /** A new default song named "Song N". */
  async fresh(): Promise<{ id: string; doc: Song }> {
    const names = (await this.list()).map((e) => e.name);
    const doc = { ...defaultSong(), name: nextName(names) };
    const id = await this.create(doc);
    return { id, doc };
  }
}

/** The Kv for tests and for a browser without IndexedDB (nothing survives a reload). */
export class MemoryKv implements Kv {
  private data: Record<StoreName, Map<string, string>> = { songs: new Map(), logs: new Map(), meta: new Map() };
  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const v = this.data[store].get(key);
    return v === undefined ? undefined : (JSON.parse(v) as T);
  }
  async put(store: StoreName, key: string, value: unknown): Promise<void> {
    this.data[store].set(key, JSON.stringify(value));
  }
  async del(store: StoreName, key: string): Promise<void> {
    this.data[store].delete(key);
  }
  async all<T>(store: StoreName): Promise<T[]> {
    return [...this.data[store].values()].map((v) => JSON.parse(v) as T);
  }
}
