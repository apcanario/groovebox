/// <reference lib="webworker" />
/**
 * MP3 encoder worker (G5). Receives 16-bit stereo blocks straight from the capture worklet over a
 * MessagePort, encodes them with LAME (@breezystack/lamejs, LGPL-3.0) while the song plays, and writes
 * the MP3 to a file in the origin-private file system as it goes, so neither the samples nor the MP3
 * pile up in memory. Where that file system is missing it keeps the MP3 as a list of Blobs instead.
 */
import { Mp3Encoder } from "@breezystack/lamejs";

type Init = { type: "init"; port: MessagePort; sampleRate: number; kbps: number; name: string };
type Chunk = { type: "chunk"; l: Int16Array; r: Int16Array };
type End = { type: "end" };

declare const self: DedicatedWorkerGlobalScope;

interface Sink {
  write(bytes: Uint8Array): void;
  finish(): Promise<File>;
}

/** Writes through a sync access handle; the finished File is backed by disk. */
async function opfsSink(name: string): Promise<Sink> {
  const root = await navigator.storage.getDirectory();
  // Earlier takes are dropped when a new one starts: by then their sheet has been closed.
  for await (const [entry] of (root as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
    if (entry.startsWith("take-") && entry.endsWith(".mp3")) await root.removeEntry(entry).catch(() => undefined);
  }
  const fh = await root.getFileHandle(name, { create: true });
  const h = await (fh as unknown as { createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle> }).createSyncAccessHandle();
  h.truncate(0);
  let at = 0;
  return {
    write(bytes) {
      at += h.write(bytes, { at });
    },
    async finish() {
      h.flush();
      h.close();
      return fh.getFile();
    },
  };
}

/** Fallback: the MP3 in memory, packed into a Blob every half megabyte. */
function blobSink(name: string): Sink {
  const blobs: Blob[] = [];
  let parts: Uint8Array[] = [];
  let size = 0;
  const pack = (): void => {
    if (parts.length) blobs.push(new Blob(parts as BlobPart[]));
    parts = [];
    size = 0;
  };
  return {
    write(bytes) {
      parts.push(bytes.slice());
      size += bytes.length;
      if (size > 512 * 1024) pack();
    },
    async finish() {
      pack();
      return new File(blobs, name, { type: "audio/mpeg" });
    },
  };
}

let encoder: Mp3Encoder | null = null;
let sink: Sink | null = null;
let queue: Uint8Array[] = [];
let bytes = 0;
let frames = 0;
let lastReport = 0;
let sampleRate = 48000;
let name = "take.mp3";
let ended = false;

function out(b: Uint8Array): void {
  if (!b.length) return;
  bytes += b.length;
  if (sink) sink.write(b);
  else queue.push(b.slice());
}

async function finish(): Promise<void> {
  if (!encoder) return;
  out(encoder.flush());
  encoder = null;
  while (!sink) await new Promise((r) => setTimeout(r, 20));
  const file = await sink.finish();
  self.postMessage({ type: "done", file, bytes, frames, sampleRate });
}

function onPort(e: MessageEvent<Chunk | End>): void {
  const m = e.data;
  if (m.type === "chunk") {
    if (!encoder) return;
    frames += m.l.length;
    out(encoder.encodeBuffer(m.l, m.r));
    if (frames - lastReport >= sampleRate) {
      lastReport = frames;
      self.postMessage({ type: "progress", bytes, frames });
    }
  } else if (m.type === "end" && !ended) {
    ended = true;
    void finish();
  }
}

self.onmessage = (e: MessageEvent<Init>) => {
  const m = e.data;
  if (m.type !== "init") return;
  sampleRate = m.sampleRate;
  name = m.name;
  encoder = new Mp3Encoder(2, m.sampleRate, m.kbps);
  m.port.onmessage = onPort;
  const ready = (s: Sink): void => {
    for (const b of queue) s.write(b);
    queue = [];
    sink = s;
    self.postMessage({ type: "ready", opfs: s !== fallback });
  };
  const fallback = blobSink(name);
  opfsSink(name).then(ready, () => ready(fallback));
};
