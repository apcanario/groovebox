/** The Keeper (G5 review M6), with a fake engine and the in-memory store. */
import { describe, expect, it } from "vitest";
import { defaultSong, type EventLog, type Song } from "../engine/song.ts";
import type { Engine, RecordState } from "../engine/index.ts";
import { Keeper, SAVE_DELAY_MS } from "./keeper.ts";
import { drawLaunch } from "./vibeBag.ts";
import { Library, MemoryKv } from "./library.ts";
import { vibeSong } from "../music/styles.ts";

class FakeEngine {
  song: Song = defaultSong();
  log: EventLog | null = null;
  playing = false;
  state: RecordState = "off";
  getDocument(): Song {
    if (this.queued) return { ...this.queued };
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
  queued: Song | null = null;
  loadSong(s: Song): void {
    this.song = { ...s };
    this.log = s.log ?? null;
  }
  /** Playing: waits for the "bar line" (land()); stopped: at once. */
  loadAtBar(s: Song): void {
    if (this.playing) this.queued = { ...s };
    else this.loadSong(s);
  }
  pendingLoad() {
    return this.queued && { name: this.queued.name, style: this.queued.style };
  }
  land(): void {
    if (this.queued) this.loadSong(this.queued);
    this.queued = null;
  }
  changeFns: (() => void)[] = [];
  runFns: ((on: boolean) => void)[] = [];
  onChange(fn?: () => void): () => void {
    if (fn) this.changeFns.push(fn);
    return () => undefined;
  }
  onRunning(fn: (on: boolean) => void): () => void {
    this.runFns.push(fn);
    return () => undefined;
  }
  /** An edit from the UI. */
  edit(): void {
    this.song = { ...this.song, bpm: this.song.bpm + 1 };
    for (const fn of this.changeFns) fn();
  }
  play(): void {
    this.playing = true;
    for (const fn of this.runFns) fn(true);
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

  it("a vibe starts a new song named after it; the jam it replaces stays in Songs (P3)", async () => {
    const { lib, engine, keeper, first } = await setup();
    const vibe = { ...vibeSong("deepHouse")! };
    expect(await keeper.startVibe(vibe, 1)).toBe(true);
    expect(keeper.id).not.toBe(first.id);
    expect(engine.song.style).toBe("deepHouse");
    expect(engine.song.name).toBe("Deep house");
    expect(await keeper.startVibe(vibe, 1)).toBe(true);
    expect(engine.song.name).toBe("Deep house 2");
    const names = (await lib.list()).map((e) => e.name).sort();
    expect(names).toEqual(["Deep house", "Deep house 2", first.doc.name].sort());
    expect(await lib.load(keeper.id)).toMatchObject({ style: "deepHouse", name: "Deep house 2" });
  });

  it("a vibe over the untouched first-launch song replaces it; refused while a take records", async () => {
    const { lib, engine, keeper } = await setup();
    keeper.scratch = true;
    expect(await keeper.startVibe(vibeSong("loFi")!, 1)).toBe(true);
    expect((await lib.list()).map((e) => e.name)).toEqual(["Lo-fi"]);
    engine.state = "recording";
    expect(await keeper.startVibe(vibeSong("ambient")!, 1)).toBe(false);
    engine.state = "armed";
    expect(await keeper.startVibe(vibeSong("ambient")!, 1)).toBe(true);
  });

  it("while playing, the new song waits for the bar line and is saved as it will play; a second vibe before then replaces it", async () => {
    const { lib, engine, keeper, first } = await setup();
    engine.playing = true;
    expect(await keeper.startVibe(vibeSong("loFi")!, 1)).toBe(true);
    expect(engine.song.name).toBe(first.doc.name);
    expect(await keeper.startVibe(vibeSong("ambient")!, 1)).toBe(true);
    const list = (await lib.list()).map((e) => e.name).sort();
    expect(list).toEqual(["Ambient", first.doc.name].sort());
    await keeper.flush();
    expect((await lib.load(keeper.id))!.style).toBe("ambient");
    engine.land();
    expect(engine.song.style).toBe("ambient");
  });

  it("two quick vibe taps leave one new song: the second waits for the first and replaces it (P3 review S1)", async () => {
    const { lib, engine, keeper, first } = await setup();
    engine.playing = true;
    const a = keeper.startVibe(vibeSong("loFi")!, 1);
    const b = keeper.startVibe(vibeSong("ambient")!, 1);
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect((await lib.list()).map((e) => e.name).sort()).toEqual(["Ambient", first.doc.name].sort());
    expect(engine.pendingLoad()?.style).toBe("ambient");
  });

  it("a vibe picked when its turn comes sees the vibe queued by the tap before it (P3 review S1)", async () => {
    const { lib, engine, keeper, first } = await setup();
    engine.playing = true;
    const seen: (string | undefined)[] = [];
    const pick = (id: string) => () => {
      seen.push(engine.pendingLoad()?.style);
      return { doc: vibeSong(id)!, section: 1 };
    };
    const a = keeper.startVibeWith(pick("loFi"));
    const b = keeper.startVibeWith(pick("ambient"));
    await Promise.all([a, b]);
    expect(seen).toEqual([undefined, "loFi"]);
    expect((await lib.list()).map((e) => e.name).sort()).toEqual(["Ambient", first.doc.name].sort());
    expect(await keeper.startVibeWith(() => null)).toBe(false);
  });
});

describe("Keeper: the launch jam (F1, spec 10.1)", () => {
  async function launched() {
    const kv = new CountingKv();
    const lib = new Library(kv, (() => {
      let t = 1000;
      return () => (t += 10);
    })());
    const old = await lib.create({ ...vibeSong("loFi")!, name: "Old jam" });
    const engine = new FakeEngine();
    const keeper = new Keeper(engine as unknown as Engine, lib, old, true);
    keeper.listen();
    const draw = drawLaunch(1234, null)!;
    keeper.openLaunch(draw.song, 1);
    return { lib, engine, keeper, old, draw };
  }

  it("an untouched launch jam adds nothing to Songs, and the last jam is first there", async () => {
    const { lib, engine, keeper, old, draw } = await launched();
    expect(engine.song.style).toBe(draw.id);
    expect(keeper.launch).toBe(true);
    await keeper.flush();
    await new Promise((r) => setTimeout(r, SAVE_DELAY_MS + 50));
    const list = await lib.list();
    expect(list.map((e) => e.id)).toEqual([old]);
    expect(list[0].name).toBe("Old jam");
  });

  it("a vibe drawn over the untouched launch jam is still not in Songs", async () => {
    const { lib, engine, keeper, old } = await launched();
    expect(await keeper.startVibe(drawLaunch(99, null)!.song, 1)).toBe(true);
    expect(await keeper.startVibe(vibeSong("ambient")!, 1)).toBe(true);
    expect(engine.song.style).toBe("ambient");
    await keeper.flush();
    expect((await lib.list()).map((e) => e.id)).toEqual([old]);
  });

  it("played, the launch jam becomes a song in Songs, newest first", async () => {
    const { lib, engine, keeper, old, draw } = await launched();
    engine.play();
    await keeper.flush();
    expect(keeper.launch).toBe(false);
    const list = await lib.list();
    expect(list.map((e) => e.id)).toEqual([keeper.id, old]);
    expect(await lib.load(keeper.id)).toMatchObject({ style: draw.id, key: draw.song.key, bpm: draw.song.bpm });
  });

  it("edited, the launch jam is saved with the edit, once", async () => {
    const { lib, engine, keeper, old, draw } = await launched();
    engine.edit();
    engine.edit();
    await keeper.flush();
    const list = await lib.list();
    expect(list).toHaveLength(2);
    expect(list[1].id).toBe(old);
    expect((await lib.load(keeper.id))!.bpm).toBe(draw.song.bpm + 2);
  });

  it("opening a saved song leaves the untouched launch jam out of Songs", async () => {
    const { lib, engine, keeper, old } = await launched();
    expect(await keeper.open(old)).toBe(true);
    expect(keeper.launch).toBe(false);
    expect(engine.song.name).toBe("Old jam");
    expect((await lib.list()).map((e) => e.id)).toEqual([old]);
  });
});

