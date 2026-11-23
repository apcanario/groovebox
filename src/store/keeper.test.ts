/** The Keeper (G5 review M6), with a fake engine and the in-memory store. */
import { describe, expect, it } from "vitest";
import { defaultSong, type EventLog, type Song } from "../engine/song.ts";
import type { Engine, RecordState } from "../engine/index.ts";
import { Keeper } from "./keeper.ts";
import { Library, MemoryKv } from "./library.ts";

class FakeEngine {
  song: Song = defaultSong();
  log: EventLog | null = null;
  playing = false;
  state: RecordState = "off";
  getDocument(): Song {
    const d: Song = { ...this.song };
    if (this.log) d.log = this.log;
    return d;
  }
  getLog(): EventLog | null {
    return this.log;
  }
  recordInfo() {
    return { state: this.state, error: null, seconds: 0, bytes: 0 };
  }
  loadSong(s: Song): void {
    this.song = { ...s };
    this.log = s.log ?? null;
  }
  onChange(): () => void {
    return () => undefined;
  }
}

class CountingKv extends MemoryKv {
  logPuts = 0;
  async put(store: "songs" | "logs" | "meta", key: string, value: unknown): Promise<void> {
    if (store === "logs") this.logPuts++;
    return super.put(store, key, value);
  }
}

async function setup() {
  const kv = new CountingKv();
  const lib = new Library(kv);
  const first = await lib.fresh();
  const engine = new FakeEngine();
  engine.loadSong(first.doc);
  const keeper = new Keeper(engine as unknown as Engine, lib, first.id, true);
  return { kv, lib, engine, keeper, first };
}

const aLog = (): EventLog => ({ recorded: "2026-11-23T10:00:00.000Z", seconds: 1, section: 0, start: defaultSong(), events: [] });

describe("Keeper", () => {
  it("saves the log only when it changed", async () => {
    const { kv, engine, keeper } = await setup();
    const before = kv.logPuts;
    await keeper.flush();
    expect(kv.logPuts).toBe(before);
    engine.log = aLog();
    await keeper.flush();
    expect(kv.logPuts).toBe(before + 1);
    await keeper.flush();
    expect(kv.logPuts).toBe(before + 1);
  });

  it("refuses open, create and remove while playing or recording", async () => {
    const { engine, keeper, first } = await setup();
    engine.playing = true;
    expect(await keeper.create()).toBe(false);
    expect(await keeper.open(first.id)).toBe(false);
    expect(await keeper.remove(first.id)).toBe(false);
    engine.playing = false;
    engine.state = "finishing";
    expect(await keeper.create()).toBe(false);
    engine.state = "off";
    expect(await keeper.create()).toBe(true);
  });

  it("deleting the open song opens the next one", async () => {
    const { lib, engine, keeper, first } = await setup();
    expect(await keeper.create()).toBe(true);
    const second = keeper.id;
    expect(second).not.toBe(first.id);
    expect(await keeper.remove(second)).toBe(true);
    expect(keeper.id).toBe(first.id);
    expect(engine.song.name).toBe(first.doc.name);
    expect((await lib.list()).map((e) => e.id)).toEqual([first.id]);
  });
});
