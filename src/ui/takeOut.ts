/**
 * G6 review E1: the take sheet's Save and Share inside the APK. Capacitor's WebView has no download listener (an
 * `<a download>` of a blob does nothing there) and no Web Share API, so in the shell the MP3 goes to the native
 * TakePlugin (android/.../TakePlugin.java): written in base64 chunks to the app's cache, then saved to Downloads
 * through MediaStore or shared through the share sheet. A chunk is CHUNK_BYTES of the file (a multiple of 3, so no
 * padding inside the stream), about 512 kB of base64 per bridge message: a ten-minute take (about 11 MB) is some 30
 * messages, never one giant string. The file is written once per take, then Save and Share both use it.
 *
 * The message the sheet shows comes from the plugin's answer: "Saved to Downloads." only when it says saved. In a
 * browser there is no bridge and the sheet keeps its own path. The bridge is the `window.Capacitor` global the shell
 * injects, so this file imports nothing from Capacitor (and nothing from the engine or Tone).
 */
import { nativeBridge, type NativeBridge } from "./keepAwake.ts";

export const TAKE_PLUGIN = "Take";
/** Bytes of the file per bridge message: 384 KiB, a multiple of 3. */
export const CHUNK_BYTES = 384 * 1024;

export const SAVED = "Saved to Downloads.";
export const OLD_ANDROID = "This Android version cannot save to Downloads without a storage permission the app does not ask for. Use Share.";

/** The shell's bridge with the Take plugin, or null (a browser, or a shell without it). */
export function takeBridge(scope: unknown = globalThis): NativeBridge | null {
  return nativeBridge(scope, TAKE_PLUGIN);
}

/** Base64 of some bytes, in slices so no argument list grows with the chunk. */
export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function bytesOf(part: Blob): Promise<Uint8Array> {
  if (typeof part.arrayBuffer === "function") return new Uint8Array(await part.arrayBuffer());
  return new Uint8Array(await new Response(part).arrayBuffer());
}

const staged = new WeakMap<Blob, Promise<void>>();

/** Writes the whole file to the shell's cache under `name`, once per file (a failed write is tried again next time). */
export function stage(bridge: NativeBridge, file: Blob, name: string, chunk: number = CHUNK_BYTES): Promise<void> {
  const known = staged.get(file);
  if (known) return known;
  const call = bridge.nativePromise;
  if (!call) return Promise.reject(new Error("no bridge"));
  const run = (async (): Promise<void> => {
    let offset = 0;
    do {
      const data = toBase64(await bytesOf(file.slice(offset, offset + chunk)));
      await call(TAKE_PLUGIN, "write", { name, offset, data });
      offset += chunk;
    } while (offset < file.size);
  })();
  staged.set(file, run);
  run.catch(() => staged.delete(file));
  return run;
}

function why(err: unknown): string {
  const m = err instanceof Error ? err.message : typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err);
  return m || "unknown error";
}

/** Save in the shell: the message to show, from what the plugin answered. */
export async function nativeSave(bridge: NativeBridge, file: Blob, name: string): Promise<string> {
  try {
    await stage(bridge, file, name);
    const r = (await bridge.nativePromise!(TAKE_PLUGIN, "save", { name, bytes: file.size })) as { saved?: unknown; reason?: unknown } | null;
    if (r?.saved === true) return SAVED;
    if (r?.reason === "old-android") return OLD_ANDROID;
    return "Not saved.";
  } catch (err) {
    return `Not saved: ${why(err)}`;
  }
}

/** Share in the shell: "" once the share sheet is open, else the message to show. */
export async function nativeShare(bridge: NativeBridge, file: Blob, name: string): Promise<string> {
  try {
    await stage(bridge, file, name);
    const r = (await bridge.nativePromise!(TAKE_PLUGIN, "share", { name, bytes: file.size })) as { shared?: unknown } | null;
    return r?.shared === true ? "" : "Share did not open.";
  } catch (err) {
    return `Share failed: ${why(err)}`;
  }
}
