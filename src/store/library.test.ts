import { describe, expect, it } from "vitest";
import { defaultSong, type Song } from "../engine/song.ts";
import { cleanName, Library, MemoryKv, nextName } from "./library.ts";

const clock = () => {
  let t = 1000;
  return () => (t += 10);
};

const withLog = (s: Song): Song => ({
  ...s,
  log: { recorded: "2026-11-23T10:00:00.000Z", seconds: 3, section: 0, start: defaultSong(), events: [{ b: 1, op: "bpm", a: [125] }] },
});

describe("song names", () => {
  it("numbers new songs with the lowest free number", () => {
    expect(nextName([])).toBe("Song 1");
    expect(nextName(["Song 1", "song 2", "Jam"])).toBe("Song 3");
    expect(nextName(["Song 2"])).toBe("Song 1");
  });
  it("cleans names", () => {
    expect(cleanName("  deep   night ")).toBe("deep night");
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("x".repeat(40))).toHaveLength(24);
  });
});

describe("library", () => {
  it("opens a new default song on first launch, then reopens the last song", async () => {
    const kv = new MemoryKv();
    const lib = new Library(kv, clock());
    const first = await lib.open();
    expect(first.doc.name).toBe("Song 1");
    const doc = { ...first.doc, bpm: 130 };
    await lib.save(first.id, doc);
    const second = await lib.fresh();
    expect(second.doc.name).toBe("Song 2");
    await lib.setLast(first.id);
    // A new Library on the same storage is a reload.
    const again = await new Library(kv, clock()).open();
    expect(again.id).toBe(first.id);
    expect(again.doc.bpm).toBe(130);
  });

  it("keeps the log in its own store and saves it only when asked", async () => {
    const lib = new Library(new MemoryKv(), clock());
    const { id, doc } = await lib.open();
    await lib.save(id, withLog(doc), true);
    expect((await lib.load(id))?.log?.events).toHaveLength(1);
    // A knob save without the log keeps the stored log.
    await lib.save(id, { ...doc, bpm: 99 });
    const back = await lib.load(id);
    expect(back?.bpm).toBe(99);
    expect(back?.log?.events).toHaveLength(1);
  });

  it("lists newest first and deletes song and log together", async () => {
    const lib = new Library(new MemoryKv(), clock());
    const a = await lib.open();
    const b = await lib.fresh();
    await lib.save(a.id, withLog(a.doc), true);
    expect((await lib.list()).map((e) => e.id)).toEqual([a.id, b.id]);
    await lib.remove(a.id);
    expect((await lib.list()).map((e) => e.id)).toEqual([b.id]);
    expect(await lib.load(a.id)).toBeNull();
    // The last song was deleted: launch opens the newest left.
    expect((await lib.open()).id).toBe(b.id);
  });

  it("drops a broken log rather than the song, and skips a broken song", async () => {
    const kv = new MemoryKv();
    const lib = new Library(kv, clock());
    const { id, doc } = await lib.open();
    await kv.put("logs", id, { id, log: { junk: true } });
    const back = await lib.load(id);
    expect(back?.name).toBe(doc.name);
    expect(back?.log).toBeUndefined();
    await kv.put("songs", id, { id, name: "x", updated: 1, song: { nonsense: 1 } });
    expect(await lib.load(id)).toBeNull();
    const fresh = await lib.open();
    expect(fresh.id).not.toBe(id);
  });
});
