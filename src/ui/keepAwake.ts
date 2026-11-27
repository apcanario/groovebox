/**
 * G6: the native keep-screen-on path for the APK (spec section 2). Android's WebView has no Screen Wake Lock
 * API, so inside the Capacitor shell the screen is kept on by KeepAwakePlugin (android/.../KeepAwakePlugin.java,
 * FLAG_KEEP_SCREEN_ON, no permission). The bridge is reached through the global that Capacitor injects into the
 * page, so the web build imports nothing from Capacitor; in a browser there is no bridge and this does nothing
 * (App.tsx's Wake Lock path covers it).
 */

/** The part of Capacitor's injected `window.Capacitor` this file uses. */
export interface NativeBridge {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
}

export const KEEP_AWAKE_PLUGIN = "KeepAwake";

/** The injected bridge, or null in a browser. */
export function nativeBridge(scope: unknown = globalThis): NativeBridge | null {
  const cap = (scope as { Capacitor?: NativeBridge } | null | undefined)?.Capacitor;
  if (!cap || typeof cap.nativePromise !== "function") return null;
  if (typeof cap.isNativePlatform === "function" && !cap.isNativePlatform()) return null;
  if (typeof cap.isPluginAvailable === "function" && !cap.isPluginAvailable(KEEP_AWAKE_PLUGIN)) return null;
  return cap;
}

/**
 * Asks the native shell to keep the screen on (true) or let it sleep (false). Returns whether a native call was
 * made. A refused or failed call is swallowed: the screen then sleeps on the phone's timeout, as in a browser.
 */
export function setNativeKeepAwake(on: boolean, bridge: NativeBridge | null = nativeBridge()): boolean {
  if (!bridge?.nativePromise) return false;
  try {
    void bridge.nativePromise(KEEP_AWAKE_PLUGIN, "set", { on }).catch(() => undefined);
  } catch {
    return false;
  }
  return true;
}
