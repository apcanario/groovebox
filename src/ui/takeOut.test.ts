/**
 * G6 review E1: in the APK a take is handed to the native TakePlugin in chunks, then saved or shared; the message
 * is the plugin's answer. A fake bridge stands in for Capacitor (as in keepAwake.test.ts).
 */
import { describe, expect, it } from "vitest";
import source from "./takeOut.ts?raw";
import { CHUNK_BYTES, OLD_ANDROID, SAVED, TAKE_PLUGIN, nativeSave, nativeShare, stage, takeBridge, toBase64 } from "./takeOut.ts";
import type { NativeBridge } from "./keepAwake.ts";

type Answer = (method: string, o: Record<string, unknown>) => unknown;

/** A shell that keeps what is written, as TakePlugin does, and answers save and share as told. */
function shell(answer: Answer = () => ({}), plugins: string[] = ["KeepAwake", TAKE_PLUGIN]) {
  const calls: [string, string, Record<string, unknown>][] = [];
  const files = new Map<string, Buffer>();
  const cap: NativeBridge = {
    isNativePlatform: () => true,
    isPluginAvailable: (n) => plugins.includes(n),
    nativePromise: async (p, m, o) => {
      const opts = o as Record<string, unknown>;
      calls.push([p, m, opts]);
      if (m === "write") {
        const name = String(opts.name);
        const before = opts.offset === 0 ? Buffer.alloc(0) : (files.get(name) ?? Buffer.alloc(0));
        if (before.length !== opts.offset) throw new Error("chunk out of order");
        const have = Buffer.concat([before, Buffer.from(String(opts.data), "base64")]);
        files.set(name, have);
        const r = answer(m, opts);
        if (r instanceof Error) throw r;
        return { bytes: have.length };
      }
      const r = answer(m, opts);
      if (r instanceof Error) throw r;
      return r;
    },
  };
  return { cap, calls, files };
}

/** A take-sized file of known bytes. */
function mp3(size: number): File {
  const b = new Uint8Array(size);
  for (let i = 0; i < size; i++) b[i] = (i * 31 + (i >> 8)) & 255;
  return new File([b], "t.mp3", { type: "audio/mpeg" });
}

describe("take save and share in the APK (G6 review E1)", () => {
  it("finds the Take plugin only inside the shell", () => {
    expect(takeBridge({})).toBeNull();
    expect(takeBridge()).toBeNull();
    expect(takeBridge({ Capacitor: { ...shell().cap, isNativePlatform: () => false } })).toBeNull();
    expect(takeBridge({ Capacitor: shell(undefined, ["KeepAwake"]).cap })).toBeNull();
    const { cap } = shell();
    expect(takeBridge({ Capacitor: cap })).toBe(cap);
  });

  it("encodes base64 as the platform does, across its internal slices", () => {
    for (const n of [0, 1, 2, 3, 0x8000 - 1, 0x8000, 0x8000 * 3 + 7]) {
      const b = new Uint8Array(n).map((_v, i) => (i * 7) & 255);
      expect(toBase64(b)).toBe(Buffer.from(b).toString("base64"));
    }
  });

  it("chunks a large take, in order, with no padding inside, and the shell gets every byte", async () => {
    expect(CHUNK_BYTES % 3).toBe(0);
    const f = mp3(CHUNK_BYTES * 2 + 1234);
    const { cap, calls, files } = shell();
    await stage(cap, f, "Song 2026-11-27 21-05.mp3");
    const writes = calls.filter((c) => c[1] === "write");
    expect(writes.map((c) => c[2].offset)).toEqual([0, CHUNK_BYTES, CHUNK_BYTES * 2]);
    for (const w of writes.slice(0, -1)) expect(String(w[2].data)).not.toContain("=");
    expect(Math.max(...writes.map((w) => String(w[2].data).length))).toBe((CHUNK_BYTES / 3) * 4);
    const got = files.get("Song 2026-11-27 21-05.mp3")!;
    expect(got.length).toBe(f.size);
    expect(got.equals(Buffer.from(await f.arrayBuffer()))).toBe(true);
  });

  it("a ten-minute take (about 11 MB) goes as some 30 messages of about 512 kB each", async () => {
    const f = mp3(11 * 1024 * 1024);
    const { cap, calls, files } = shell();
    await stage(cap, f, "long.mp3");
    const writes = calls.filter((c) => c[1] === "write");
    expect(writes.length).toBe(Math.ceil(f.size / CHUNK_BYTES));
    expect(writes.length).toBeLessThan(40);
    expect(Math.max(...writes.map((w) => String(w[2].data).length))).toBeLessThanOrEqual(512 * 1024);
    expect(files.get("long.mp3")!.length).toBe(f.size);
  });

  it("an empty take is still one write, so the file exists", async () => {
    const { cap, calls } = shell();
    await stage(cap, mp3(0), "empty.mp3");
    expect(calls).toEqual([[TAKE_PLUGIN, "write", { name: "empty.mp3", offset: 0, data: "" }]]);
  });

  it("says Saved to Downloads only when the plugin says saved, and sends the size it must check", async () => {
    const f = mp3(5000);
    const ok = shell((m) => (m === "save" ? { saved: true } : {}));
    expect(await nativeSave(ok.cap, f, "a.mp3")).toBe(SAVED);
    expect(ok.calls.at(-1)).toEqual([TAKE_PLUGIN, "save", { name: "a.mp3", bytes: 5000 }]);

    const old = shell((m) => (m === "save" ? { saved: false, reason: "old-android" } : {}));
    expect(await nativeSave(old.cap, mp3(10), "b.mp3")).toBe(OLD_ANDROID);

    const vague = shell((m) => (m === "save" ? {} : {}));
    expect(await nativeSave(vague.cap, mp3(10), "c.mp3")).toBe("Not saved.");

    const refused = shell((m) => (m === "save" ? new Error("save failed: disk full") : {}));
    const msg = await nativeSave(refused.cap, mp3(10), "d.mp3");
    expect(msg).toBe("Not saved: save failed: disk full");
    expect(msg).not.toContain(SAVED);
  });

  it("a failed write is not saved and is tried again on the next tap", async () => {
    let fail = true;
    const s = shell((m) => (m === "write" && fail ? new Error("write failed") : m === "save" ? { saved: true } : {}));
    const f = mp3(100);
    expect(await nativeSave(s.cap, f, "e.mp3")).toBe("Not saved: write failed");
    expect(s.calls.some((c) => c[1] === "save")).toBe(false);
    fail = false;
    expect(await nativeSave(s.cap, f, "e.mp3")).toBe(SAVED);
  });

  it("Save then Share writes the file once", async () => {
    const s = shell((m) => (m === "save" ? { saved: true } : m === "share" ? { shared: true } : {}));
    const f = mp3(CHUNK_BYTES + 1);
    expect(await nativeSave(s.cap, f, "f.mp3")).toBe(SAVED);
    expect(await nativeShare(s.cap, f, "f.mp3")).toBe("");
    expect(s.calls.map((c) => c[1])).toEqual(["write", "write", "save", "share"]);
    expect(s.calls.at(-1)).toEqual([TAKE_PLUGIN, "share", { name: "f.mp3", bytes: CHUNK_BYTES + 1 }]);
  });

  it("Share reports a sheet that did not open", async () => {
    expect(await nativeShare(shell(() => ({})).cap, mp3(3), "g.mp3")).toBe("Share did not open.");
    expect(await nativeShare(shell((m) => (m === "share" ? { message: "no activity" } : {})).cap, mp3(3), "h.mp3")).toBe("Share did not open.");
    expect(await nativeShare(shell((m) => (m === "share" ? new Error("share failed: x") : {})).cap, mp3(3), "i.mp3")).toBe("Share failed: share failed: x");
  });

  it("imports nothing but the keep-awake bridge finder: no Capacitor, no Tone, no engine", () => {
    const imports = source.match(/^\s*import\s.*$/gm) ?? [];
    expect(imports).toEqual(['import { nativeBridge, type NativeBridge } from "./keepAwake.ts";']);
  });
});
