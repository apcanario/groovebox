import "./style.css";
import { render } from "preact";
import { BASS_PRESETS, DRUM_PRESETS, EFFECT_DEFS, Engine, MACROS, SYNTH_PRESETS, type LatencyHint } from "./engine/index.ts";
import { STYLES, STYLE_IDS, TOP_IDS, vibeBpmRange, vibeSong, vibeStart } from "./music/styles.ts";
import { App } from "./ui/App.tsx";
import { startSizeWatch, type SizeClass } from "./ui/size.ts";
import { openIdb } from "./store/idb.ts";
import { Keeper } from "./store/keeper.ts";
import { drawLaunch, localBagStorage } from "./store/vibeBag.ts";
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
  keeper.start();
  // F1 (spec 10.1): a cold start opens the Play tab on a top vibe drawn from the launch bag, its key and bpm rolled in
  // the same draw, seeded from the clock. Nothing sounds until Play. The jam from last time stays first in Songs; the
  // launch jam joins Songs only once it is played or edited. A first launch's empty "Song 1" is not kept beside it.
  const launch = drawLaunch(Date.now(), localBagStorage(), undefined, true);
  if (launch) {
    if (opened.fresh) await lib.remove(id).catch(() => undefined);
    keeper.openLaunch(launch.song, vibeStart(launch.id));
  } else {
    // No top vibes to draw (F1 review M4): the first launch's empty "Song 1" stays open, and the first vibe loaded
    // over it replaces it in Songs (P3).
    keeper.scratch = !!opened.fresh;
  }
  // T1 (spec 9.1): the layout follows the screen's size live; `?size=` or `__size.force` holds one for smoke and shots.
  const sizes = startSizeWatch();
  render(<App engine={engine} hint={hint} keeper={keeper} sizes={sizes} />, document.querySelector<HTMLDivElement>("#app")!);
  // Exposed for automated smoke tests.
  const w = window as unknown as {
    __groovebox: Engine;
    __keeper: Keeper;
    __macros: typeof MACROS;
    __vibes: { id: string; name: string; bpm: number; start: number; top: boolean; range: [number, number] }[];
    __topIds: readonly string[];
    __data: { beats: readonly string[]; bass: readonly string[]; synth: readonly string[] };
    __fx: { defs: typeof EFFECT_DEFS };
    __vibeSong: typeof vibeSong;
    __morphDry: (song: unknown, section: number, bars: number) => unknown;
    __size: { get: () => SizeClass; force: (c: SizeClass | null) => void };
  };
  // T1: the size class shown, and a way to force one (null follows the screen again).
  w.__size = { get: () => sizes.current, force: (c) => sizes.force(c) };
  // P3: every vibe and every beat and rhythm that exists, so the smoke test loops whatever is there.
  // F1: `top` marks the top vibes (spec 10.2), which the picker shows first.
  // F1 review M2: the top vibes in the picker's order (spec 10.2); `__vibes` keeps the arrows' order.
  w.__topIds = TOP_IDS;
  w.__vibes = STYLE_IDS.map((id) => ({ id, name: STYLES[id].name, bpm: STYLES[id].bpm, start: vibeStart(id), top: STYLES[id].top === true, range: vibeBpmRange(STYLES[id]) }));
  w.__data = { beats: DRUM_PRESETS, bass: BASS_PRESETS, synth: SYNTH_PRESETS };
  // P9: the effects that exist, so the smoke test walks whatever is there.
  w.__fx = { defs: EFFECT_DEFS };
  // The macro mapping, for the smoke test's read-back of every Simple move in Advanced.
  w.__macros = MACROS;
  // P10: a vibe's song by id, so the smoke test loads each one mid-jam and measures its drop.
  w.__vibeSong = vibeSong;
  // P11: Morph's journey for a song played from a section, worked out without audio on an engine of its own, so the
  // smoke test can hold what the live engine did against it.
  w.__morphDry = (song, section, bars) => {
    const e = new Engine();
    e.loadSong(song as Parameters<Engine["loadSong"]>[0], section);
    return e.morphDry(bars);
  };
  w.__groovebox = engine;
  w.__keeper = keeper;
}

void boot();
