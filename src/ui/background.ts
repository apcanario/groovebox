/**
 * G6 (spec section 2: no screen-off playback, no background audio, no foreground service). Capacitor keeps the
 * WebView running when the app leaves the screen (its KeepRunning preference defaults to true, so the WebView is
 * never paused), so without this the jam would play on behind the home screen or the lock screen. In the APK the
 * jam stops through the engine's own Stop the moment the app goes to the background: on Capacitor's `pause`
 * document event (fired from the activity's onPause by the bridge, MockCordovaWebViewImpl.handlePause) or on the
 * page turning hidden, whichever comes first. A take in progress ends as Stop ends it (tail, then the take sheet).
 * Nothing restarts on return: Play is a tap away. In a browser (Pages) nothing changes.
 *
 * G6 review S2: once stopped, and once a take's tail has closed, the engine also suspends its AudioContext
 * (engine.sleep), so the audio thread does not render silence behind the lock screen; it resumes on return
 * (Capacitor's `resume` event or the page turning visible) and with Play. Nothing heard changes.
 *
 * The shell is found through the `window.Capacitor` global it injects, so this file imports nothing from Capacitor.
 */

/** The part of the engine this uses: its Play/Stop state and Stop. */
export interface Stoppable {
  readonly running: boolean;
  stop(): void;
}

/** The engine's background calls (G6 review S2); optional, so a bare Stoppable still works. */
export interface Sleeper extends Stoppable {
  /** Suspend the audio; false while a take's tail still needs it (try again after the next change). */
  sleep?(): boolean;
  wake?(): void;
  onChange?(fn: () => void): () => void;
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
export function stopInBackground(engine: Sleeper, doc: PageEvents, native: boolean = inNativeShell()): () => void {
  if (!native) return () => undefined;
  let gone = false;
  let waiting: (() => void) | null = null;
  const unwait = (): void => {
    waiting?.();
    waiting = null;
  };
  const trySleep = (): void => {
    if (!engine.sleep || engine.sleep()) return unwait();
    // A take's tail is still closing: sleep once the engine says it changed and sleep is allowed.
    if (!waiting && engine.onChange) {
      waiting = engine.onChange(() => {
        if (gone && engine.sleep?.()) unwait();
      });
    }
  };
  const away = (): void => {
    if (engine.running) engine.stop();
    gone = true;
    trySleep();
  };
  const back = (): void => {
    gone = false;
    unwait();
    engine.wake?.();
  };
  const onVis = (): void => {
    if (doc.visibilityState === "hidden") away();
    else if (doc.visibilityState === "visible") back();
  };
  doc.addEventListener("pause", away);
  doc.addEventListener("resume", back);
  doc.addEventListener("visibilitychange", onVis);
  return () => {
    unwait();
    doc.removeEventListener("pause", away);
    doc.removeEventListener("resume", back);
    doc.removeEventListener("visibilitychange", onVis);
  };
}
