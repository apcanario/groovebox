/**
 * G6 (spec section 2: no screen-off playback, no background audio, no foreground service). Capacitor keeps the
 * WebView running when the app leaves the screen (its KeepRunning preference defaults to true, so the WebView is
 * never paused), so without this the jam would play on behind the home screen or the lock screen. In the APK the
 * jam stops through the engine's own Stop the moment the app goes to the background: on Capacitor's `pause`
 * document event (fired from the activity's onPause by the bridge, MockCordovaWebViewImpl.handlePause) or on the
 * page turning hidden, whichever comes first. A take in progress ends as Stop ends it (tail, then the take sheet).
 * Nothing restarts on return: Play is a tap away. In a browser (Pages) nothing changes.
 *
 * The shell is found through the `window.Capacitor` global it injects, so this file imports nothing from Capacitor.
 */

/** The part of the engine this uses: its Play/Stop state and Stop. */
export interface Stoppable {
  readonly running: boolean;
  stop(): void;
}

/** The part of the document this uses. */
export interface PageEvents {
  readonly visibilityState: string;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
}

/** True inside the native shell (Capacitor's injected bridge says so); false in a browser. */
export function inNativeShell(scope: unknown = globalThis): boolean {
  const cap = (scope as { Capacitor?: { isNativePlatform?: () => boolean } } | null | undefined)?.Capacitor;
  return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform() === true;
}

/**
 * Stops the engine whenever the app goes to the background, inside the native shell only. Returns a function that
 * stops listening. `native` is read once.
 */
export function stopInBackground(engine: Stoppable, doc: PageEvents, native: boolean = inNativeShell()): () => void {
  if (!native) return () => undefined;
  const away = (): void => {
    if (engine.running) engine.stop();
  };
  const onVis = (): void => {
    if (doc.visibilityState === "hidden") away();
  };
  doc.addEventListener("pause", away);
  doc.addEventListener("visibilitychange", onVis);
  return () => {
    doc.removeEventListener("pause", away);
    doc.removeEventListener("visibilitychange", onVis);
  };
}
