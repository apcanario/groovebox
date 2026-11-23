/**
 * The app-wide Simple or Advanced toggle (spec 8.1): remembered on the phone between launches; a new
 * install starts in Simple. It changes what is shown, never what is heard: it lives outside the song.
 */
const KEY = "groovebox.mode";

export type AppMode = "simple" | "advanced";

/** The mode stored on the phone; Simple when none is stored or storage is blocked. */
export function loadMode(storage: Pick<Storage, "getItem"> | null = safeStorage()): AppMode {
  try {
    return storage?.getItem(KEY) === "advanced" ? "advanced" : "simple";
  } catch {
    return "simple";
  }
}

export function saveMode(mode: AppMode, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try {
    storage?.setItem(KEY, mode);
  } catch {
    // Storage blocked: the switch still acts for this session.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
