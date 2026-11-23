import "./style.css";
import { render } from "preact";
import { BASS_PRESETS, DRUM_PRESETS, Engine, MACROS, SYNTH_PRESETS, type LatencyHint } from "./engine/index.ts";
import { STYLES, STYLE_IDS, vibeStart } from "./music/styles.ts";
import { App } from "./ui/App.tsx";
import { openIdb } from "./store/idb.ts";
import { Keeper } from "./store/keeper.ts";
import { Library, MemoryKv, type Kv } from "./store/library.ts";

const hintParam = new URLSearchParams(location.search).get("hint");
const hint: LatencyHint = hintParam === "interactive" || hintParam === "playback" ? hintParam : "balanced";

async function boot(): Promise<void> {
  let kv: Kv;
  let persistent = true;
  try {
    kv = await openIdb();
  } catch {
    kv = new MemoryKv();
    persistent = false;
  }
  let lib = new Library(kv);
  // The last song reopens on launch.
  let opened;
  try {
    opened = await lib.open();
  } catch {
    lib = new Library(new MemoryKv());
    persistent = false;
    opened = await lib.open();
  }
  const { id, doc } = opened;
  const engine = new Engine();
  try {
    engine.loadSong(doc);
  } catch {
    // A stored song that no longer loads: start from the default, kept under the same id.
  }
  const keeper = new Keeper(engine, lib, id, persistent);
  keeper.scratch = !!opened.fresh;
  keeper.start();
  // The vibe picker opens the app (spec 8.2); "Continue last jam" shows unless this is a first launch's new song.
  render(<App engine={engine} hint={hint} keeper={keeper} />, document.querySelector<HTMLDivElement>("#app")!);
  // Exposed for automated smoke tests.
  const w = window as unknown as {
    __groovebox: Engine;
    __keeper: Keeper;
    __macros: typeof MACROS;
    __vibes: { id: string; name: string; bpm: number; start: number }[];
    __data: { beats: readonly string[]; bass: readonly string[]; synth: readonly string[] };
  };
  // P3: every vibe and every beat and rhythm that exists, so the smoke test loops whatever is there.
  w.__vibes = STYLE_IDS.map((id) => ({ id, name: STYLES[id].name, bpm: STYLES[id].bpm, start: vibeStart(id) }));
  w.__data = { beats: DRUM_PRESETS, bass: BASS_PRESETS, synth: SYNTH_PRESETS };
  // The macro mapping, for the smoke test's read-back of every Simple move in Advanced.
  w.__macros = MACROS;
  w.__groovebox = engine;
  w.__keeper = keeper;
}

void boot();
