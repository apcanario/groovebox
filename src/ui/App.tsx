/**
 * The frame (P1, spec 8.6), top to bottom on every tab: the header (New jam, Songs, Simple and
 * Advanced), the tab's own content, the section strip, the transport bar and the tab bar. Nothing
 * scrolls. The UI reads the song and the position from the engine and calls the engine for every
 * change; it never touches audio.
 */
import type { JSX } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { Engine, LIMITS, type LaneBar, type LatencyHint, type Pending, type Position, type RecordInfo, type Song, type Take } from "../engine/index.ts";
import type { Keeper } from "../store/keeper.ts";
import { Sheet, useLongPress, useVerticalDrag } from "./components.tsx";
import { startFit } from "./fit.ts";
import { Icon } from "./icons.tsx";
import { showLanes, startMotion } from "./motion.ts";
import { barLabel, beatLights, clockLabel, editedSection, keepChosen, recordLabel, sectionLetter, sizeLabel, stripState, tapPlay } from "./logic.ts";
import { SectionSheet, SongsSheet } from "./sheets.tsx";
import { VibePicker } from "./vibes.tsx";
import { loadMode, saveMode } from "./mode.ts";
import { TABS, TAB_COLOR, TAB_NAME, TabIcon, type Tab } from "./theme.tsx";
import { PANEL_TABS, tabletPanel, type PanelTab, type SizeClass, type SizeWatch } from "./size.ts";
import { PlayTab } from "./tabs/PlayTab.tsx";
import { ChordsTab } from "./tabs/ChordsTab.tsx";
import { InstrumentTab } from "./tabs/InstrumentTab.tsx";
import { MixTab } from "./tabs/MixTab.tsx";
import { LayerTab } from "./tabs/LayerTab.tsx";
import { SimpleInstrumentTab, SimpleLayerTab } from "./tabs/SimpleTab.tsx";

/** What every tab gets: the engine, a fresh copy of the song, the position and the edited section. */
export interface Ctx {
  engine: Engine;
  song: Song;
  pos: Position;
  pending: Pending;
  /** Section being edited. */
  edit: number;
  /** Section heard now (or the one Play starts from). */
  playing: number;
  /** Every instrument's bar as notes (spec 8.12): the bar shown, or the first bar Play starts with. */
  lanes: LaneBar;
  goTab: (t: Tab) => void;
  hint: LatencyHint;
  keeper: Keeper;
  /** Advanced mode (spec 8.1): app-wide, remembered; it changes what is shown, never what is heard. */
  advanced: boolean;
  /**
   * The tab body is tall enough to show the filter XY pad and the sends under every page. When it is
   * not, instrument tabs give them a page of their own, so nothing scrolls.
   */
  roomy: boolean;
  /** Start the audio (from a tap); false when it failed (the error is shown). */
  startAudio: () => Promise<boolean>;
  /** Open the vibe picker. */
  openVibes: () => void;
}

/** Tab body height (CSS px) from which the XY pad and sends sit under every page. */
export const ROOMY_PX = 560;

/** Watches the tab body's height. */
function useRoomy(ref: { current: HTMLElement | null }, layout: SizeClass): boolean {
  const [roomy, setRoomy] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = (): void => setRoomy(el.clientHeight >= ROOMY_PX);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
    // T1: a new layout mounts a new tab body; watch that one.
  }, [ref, layout]);
  return roomy;
}

/** One tile of the section strip: a tap plays it from the next bar line; a hold opens its sheet. */
function StripTile({
  i,
  name,
  view,
  onTap,
  onHold,
}: {
  i: number;
  name: string;
  view: ReturnType<typeof stripState>;
  onTap: () => void;
  onHold: () => void;
}) {
  const press = useLongPress(onTap, onHold);
  return (
    <button
      class={`sec${view.isPlaying ? " playing" : ""}${view.isEdit ? " edit" : ""}${view.isNext ? " pending" : ""}`}
      data-strip={i}
      aria-label={`Section ${sectionLetter(i)} ${name}: ${view.sub}. Tap to play from the next bar, hold for options`}
      {...press}
    >
      <b>{sectionLetter(i)}</b>
      <span>{view.sub}</span>
    </button>
  );
}

/** Keep the screen on while playing (spec section 2). Released on stop; re-taken when the page returns. */
function useWakeLock(on: boolean): void {
  const lock = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    let cancelled = false;
    const take = async (): Promise<void> => {
      try {
        if (!("wakeLock" in navigator) || lock.current) return;
        const l = await navigator.wakeLock.request("screen");
        if (cancelled) void l.release();
        else {
          lock.current = l;
          l.addEventListener("release", () => {
            if (lock.current === l) lock.current = null;
          });
        }
      } catch {
        // Refused (page hidden, battery saver): the next visibility change tries again.
      }
    };
    const onVis = (): void => {
      if (document.visibilityState === "visible") void take();
    };
    if (on) {
      void take();
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      const l = lock.current;
      lock.current = null;
      if (l) void l.release().catch(() => undefined);
    };
  }, [on]);
}

/** The record state, re-read on every engine change and four times a second while a take runs (display only). */
function useRecordInfo(engine: Engine): RecordInfo {
  const [info, setInfo] = useState<RecordInfo>(() => engine.recordInfo());
  useEffect(() => engine.onChange(() => setInfo(engine.recordInfo())), [engine]);
  const running = info.state === "recording" || info.state === "finishing";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setInfo(engine.recordInfo()), 250);
    return () => clearInterval(t);
  }, [engine, running]);
  return info;
}

type NamedTake = Take & { name: string };

/** A finished take: save it to the phone or share it. */
function TakeSheet({ take, onClose }: { take: NamedTake; onClose: () => void }) {
  // Built once per take: App re-renders on every position change (G5 review M4).
  const { file, canShare } = useMemo(() => {
    const f = new File([take.file], take.name, { type: "audio/mpeg" });
    return { file: f, canShare: typeof navigator.canShare === "function" && navigator.canShare({ files: [f] }) };
  }, [take]);
  const [msg, setMsg] = useState("");
  const save = (): void => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = take.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setMsg("Saved to Downloads.");
  };
  const share = async (): Promise<void> => {
    try {
      await navigator.share({ files: [file], title: take.name });
    } catch {
      // Cancelled by the user, or refused: the Save button still works.
    }
  };
  return (
    <Sheet onClose={onClose}>
      <h2>Take recorded</h2>
      <p class="note" id="take-info">
        {take.name} · {clockLabel(take.seconds)} · {sizeLabel(take.bytes)} MP3
      </p>
      <div class="menu">
        <button class="btn" id="take-save" onClick={save}>
          Save MP3
        </button>
        <button class="btn" id="take-share" disabled={!canShare} onClick={() => void share()}>
          Share
        </button>
        <button class="btn" id="take-close" onClick={onClose}>
          Close
        </button>
      </div>
      {msg && <p class="note">{msg}</p>}
      <p class="note">The event log of this take is saved with the song.</p>
    </Sheet>
  );
}

/** The live size class (spec 9.1). Display only: a change re-lays the screen and never calls the engine. */
function useSizeClass(watch: SizeWatch): SizeClass {
  const [size, setSize] = useState<SizeClass>(() => watch.current);
  useEffect(() => {
    setSize(watch.current);
    return watch.on(setSize);
  }, [watch]);
  return size;
}

/** The tablet rail (spec 9.2): the seven instruments, icon over word; the chosen one's panel shows beside the pads. */
function Rail({ panel, setTab }: { panel: PanelTab; setTab: (t: Tab) => void }) {
  return (
    <nav class="rail">
      {PANEL_TABS.map((t) => (
        <button
          key={t}
          class={`tab${t === panel ? " on" : ""}`}
          style={{ "--c": TAB_COLOR[t] }}
          data-tab={t}
          aria-current={t === panel}
          onClick={() => setTab(t)}
        >
          <TabIcon tab={t} />
          <span>{TAB_NAME[t]}</span>
        </button>
      ))}
    </nav>
  );
}

/**
 * The tablet frame (T1 slice a, spec 9.1 to 9.3): the pads (the Play tab, the section strip, the transport) and one
 * instrument (the rail and the chosen panel) both on screen. Landscape puts them side by side, the pads on the left;
 * portrait puts the panel on top and the pads in a dock at the bottom, the rail as its tab bar. The panels and the pads
 * are the phone's screens for now; slices b and c lay them out for the larger screen.
 */
function TabletShell(p: {
  size: SizeClass;
  ctx: Ctx;
  advanced: boolean;
  panel: PanelTab;
  setTab: (t: Tab) => void;
  bodyRef: { current: HTMLElement | null };
  header: JSX.Element;
  errors: JSX.Element;
  strip: JSX.Element;
  transport: JSX.Element;
  overlays: JSX.Element;
}) {
  const { ctx, advanced, panel } = p;
  const land = p.size === "landscape";
  const rail = <Rail panel={panel} setTab={p.setTab} />;
  const pads = (
    <section class="pads">
      <main class="body padsbody">
        <PlayTab ctx={ctx} />
      </main>
      {p.strip}
      {p.transport}
      {!land && rail}
    </section>
  );
  const inst = (
    <section class="inst" data-panel={panel}>
      {land && rail}
      <main class="body" ref={p.bodyRef}>
        {p.errors}
        {panel === "chords" && <ChordsTab ctx={ctx} />}
        {panel === "mix" && <MixTab ctx={ctx} />}
        {(panel === "layer1" || panel === "layer2") &&
          (advanced ? <LayerTab ctx={ctx} id={panel} key={panel} /> : <SimpleLayerTab ctx={ctx} id={panel} key={`s${panel}`} />)}
        {(panel === "drums" || panel === "bass" || panel === "synth") &&
          (advanced ? (
            <InstrumentTab ctx={ctx} inst={panel} key={panel} />
          ) : (
            <SimpleInstrumentTab ctx={ctx} inst={panel} key={`s${panel}`} />
          ))}
      </main>
    </section>
  );
  return (
    // The pads are always on screen: the Play tab's taller strip ("atplay") and, in Simple, the Now view ("now").
    <div class={`shell tablet ${p.size} atplay${advanced ? "" : " now"}`}>
      {p.header}
      {/* One order in both orientations, so a rotation re-lays the halves without remounting them; portrait's CSS puts
          the panel above the dock. */}
      <div class="desk">
        {pads}
        {inst}
      </div>
      {p.overlays}
    </div>
  );
}

export function App({ engine, hint, keeper, sizes }: { engine: Engine; hint: LatencyHint; keeper: Keeper; sizes: SizeWatch }) {
  const size = useSizeClass(sizes);
  const tablet = size !== "phone";
  const [song, setSong] = useState<Song>(() => engine.getSong());
  const [pos, setPos] = useState<Position>(() => engine.position());
  // P10d: the Play button shows the transport as Play and Stop set it, not the heard position (a lookahead behind).
  const [running, setRunning] = useState(() => engine.running);
  useEffect(() => engine.onRunning(setRunning), [engine]);
  const [pending, setPending] = useState<Pending>(() => engine.pendingShown());
  const [chosen, setChosen] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("play");
  // T1: on a tablet the pads are always on screen, so the instrument half keeps its last panel while Play is chosen.
  const lastPanel = useRef<PanelTab>("chords");
  const panel = tabletPanel(tab, lastPanel.current);
  lastPanel.current = panel;
  const [advanced, setAdvancedState] = useState(() => loadMode() === "advanced");
  const setAdvanced = (on: boolean): void => {
    saveMode(on ? "advanced" : "simple");
    setAdvancedState(on);
  };
  const [held, setHeld] = useState<number | null>(null);
  const [songs, setSongs] = useState(false);
  // The vibe picker opens the app (spec 8.2).
  const [vibes, setVibes] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [take, setTake] = useState<NamedTake | null>(null);
  const [saveFailed, setSaveFailed] = useState(keeper.failed);
  const bodyRef = useRef<HTMLElement | null>(null);
  const roomy = useRoomy(bodyRef, size);
  const rec = useRecordInfo(engine);
  useEffect(() => engine.onTake(setTake), [engine]);
  useEffect(() => keeper.onChange(() => setSaveFailed(keeper.failed)), [keeper]);

  useEffect(() => {
    let lastSection = engine.position().section;
    const offPos = engine.onPosition((p) => {
      setPos(p);
      setPending(engine.pendingShown());
      // Switches land on the bar line: re-read the song there, and whenever the section changes.
      if (p.step === 0 || p.section !== lastSection || !p.playing) setSong(engine.getSong());
      lastSection = p.section;
    });
    const offChange = engine.onChange(() => {
      setSong(engine.getSong());
      setPending(engine.pendingShown());
      setPos(engine.position());
    });
    return () => {
      offPos();
      offChange();
    };
  }, [engine, keeper]);

  // Text fits its tile: re-fitted after any change on screen and on resize (display only).
  useEffect(() => startFit(document.body), []);
  // One loop for every movement on screen (spec 8.12, Motion).
  useEffect(() => startMotion(engine), [engine]);

  // The lanes: read from the engine when the bar shown changes, and after a song change at most once per
  // animation frame (a dial drag changes the song on every event; P1b review M9), never per frame otherwise.
  const [songRev, setSongRev] = useState(0);
  const revFrame = useRef(0);
  useEffect(() => {
    if (revFrame.current) return;
    revFrame.current = requestAnimationFrame(() => {
      revFrame.current = 0;
      setSongRev((r) => r + 1);
    });
  }, [song]);
  useEffect(() => () => cancelAnimationFrame(revFrame.current), []);
  const lanes = useMemo(
    () => engine.lanes(pos.playing ? pos.bar : undefined),
    [engine, songRev, pos.bar, pos.playing, pos.section],
  );
  useEffect(() => showLanes(lanes), [lanes]);

  useWakeLock(pos.playing);

  const count = song.sections.length;
  const playing = Math.min(pos.section, count - 1);
  const edit = editedSection(chosen, playing, count);
  // A chosen section that no longer exists, or that is now the playing one, goes back to following;
  // Simple has no editing without playing.
  useEffect(() => {
    const keep = advanced ? keepChosen(chosen, playing, count) : null;
    if (keep !== chosen) setChosen(keep);
  }, [chosen, count, playing, advanced]);

  const startAudio = async (): Promise<boolean> => {
    if (engine.ready) return true;
    setStarting(true);
    try {
      await engine.init(hint);
      setError(null);
      return true;
    } catch (err) {
      setError(`Audio failed to start: ${String(err)}`);
      return false;
    } finally {
      setStarting(false);
    }
  };

  const togglePlay = (): Promise<void> => tapPlay(engine, startAudio);

  const bpmDrag = useVerticalDrag(song.bpm, LIMITS.bpm[0], LIMITS.bpm[1], (v) => (engine.bpm = v), 1, 400);
  const ctx: Ctx = {
    engine,
    song,
    pos,
    pending,
    edit,
    playing,
    lanes,
    goTab: setTab,
    hint,
    keeper,
    advanced,
    roomy,
    startAudio,
    openVibes: () => setVibes(true),
  };
  const taking = rec.state === "recording" || rec.state === "finishing";
  // P10: a section tapped during the drop waits for its wind-down.
  const dropHeld = engine.dropShown().queued;
  const lights = beatLights(pos.playing, pos.step);
  // On the Advanced Play tab the strip is the grid's column labels: indented under its four columns.
  const gridStrip = (tablet || tab === "play") && advanced;
  const stripCols = `${gridStrip ? "var(--rowhead) " : ""}repeat(${count}, minmax(0, 1fr))`;

  // The pieces every layout shares (T1): the phone stacks them as spec 8.6 says; a tablet arranges them by spec 9.2 and 9.3.
  const header = (
    <header class="hdr">
      <button
        class="btn hb"
        id="new-jam"
        aria-label="New jam: pick a vibe; this jam stays in Songs"
        onClick={() => setVibes(true)}
      >
        <Icon thing="New jam" />
        <span>New jam</span>
      </button>
      <button class="btn hb" id="songs-open" aria-label={`Songs: ${song.name}`} onClick={() => setSongs(true)}>
        <span>Songs</span>
      </button>
      <div class="modesw" role="radiogroup" aria-label="Mode">
        {(["simple", "advanced"] as const).map((m) => {
          const on = (m === "advanced") === advanced;
          return (
            <button
              key={m}
              class={`btn${on ? " on" : ""}`}
              data-appmode={m}
              role="radio"
              aria-checked={on}
              onClick={() => setAdvanced(m === "advanced")}
            >
              {m === "simple" ? "Simple" : "Advanced"}
            </button>
          );
        })}
      </div>
    </header>
  );
  const errors = (
    <>
      {error && <p class="err">{error}</p>}
      {rec.error && rec.state === "off" && (
        <p class="err" id="rec-err">
          {rec.error}
        </p>
      )}
      {saveFailed && <p class="err">The song could not be saved on this phone (storage full or blocked).</p>}
    </>
  );
  const strip = (
    <div class="secs" style={{ gridTemplateColumns: stripCols }}>
      {gridStrip && <div class="seclabel">Sections</div>}
      {song.sections.map((s, i) => (
        <StripTile
          key={i}
          i={i}
          name={s.name}
          view={stripState(i, { chosen, playing, running: pos.playing, queued: pending.section, name: s.name, afterDrop: dropHeld === i })}
          onTap={() => engine.switchSection(i)}
          onHold={() => setHeld(i)}
        />
      ))}
    </div>
  );
  const transport = (
    <div class="top">
      <button
        id="play"
        class={`play${running ? " on" : ""}`}
        aria-label={running ? "Stop" : "Play"}
        disabled={starting}
        onClick={() => void togglePlay()}
      >
        <i />
      </button>
      <div class="pill drag" id="bpm" role="slider" aria-label="Tempo, drag up or down" aria-valuenow={song.bpm} {...bpmDrag}>
        <b>{song.bpm}</b>
        <span>bpm</span>
      </div>
      <div class="pill bar" aria-label="Bar and beat" data-nofit>
        <b id="bar">{barLabel(pos.playing, pos.bar, pos.step)}</b>
        <span>bar</span>
      </div>
      <div class="beats" id="beats" data-nofit aria-label={`Beat ${lights.lastIndexOf(true) + 1} of 4`}>
        {lights.map((on, b) => (
          <i key={b} class={`${on ? "on" : ""}${b === 0 ? " one" : ""}`} data-beat={b} />
        ))}
      </div>
      <button
        id="rec"
        class={`rec ${rec.state}`}
        aria-label={recordLabel(rec.state)}
        aria-pressed={rec.state !== "off"}
        disabled={rec.state === "finishing"}
        onClick={() => engine.record()}
      >
        <i />
        {taking && (
          <b id="rec-time" data-nofit>
            {clockLabel(rec.seconds)}
          </b>
        )}
      </button>
    </div>
  );
  const overlays = (
    <>
      {vibes && <VibePicker ctx={ctx} onClose={() => setVibes(false)} />}
      {take && <TakeSheet take={take} onClose={() => setTake(null)} />}
      {songs && <SongsSheet ctx={ctx} onClose={() => setSongs(false)} />}
      {held !== null && (
        <SectionSheet
          ctx={ctx}
          index={held}
          advanced={advanced}
          chosen={chosen}
          onChoose={setChosen}
          onClose={() => setHeld(null)}
          key={held}
        />
      )}
    </>
  );

  if (tablet) return <TabletShell {...{ size, ctx, advanced, panel, setTab, bodyRef, header, errors, strip, transport, overlays }} />;

  return (
    // P10d: "atplay" on the Play tab in both modes (the taller strip and DROP's row under the grid or the lanes, so DROP
    // and Morph keep one screen position); "now" on Simple's alone.
    <div class={`shell${tab === "play" ? " atplay" : ""}${tab === "play" && !advanced ? " now" : ""}`}>
      {header}

      <main class="body" ref={bodyRef}>
        {errors}
        {tab === "play" && <PlayTab ctx={ctx} />}
        {tab === "chords" && <ChordsTab ctx={ctx} />}
        {tab === "mix" && <MixTab ctx={ctx} />}
        {(tab === "layer1" || tab === "layer2") &&
          (advanced ? <LayerTab ctx={ctx} id={tab} key={tab} /> : <SimpleLayerTab ctx={ctx} id={tab} key={`s${tab}`} />)}
        {(tab === "drums" || tab === "bass" || tab === "synth") &&
          (advanced ? <InstrumentTab ctx={ctx} inst={tab} key={tab} /> : <SimpleInstrumentTab ctx={ctx} inst={tab} key={`s${tab}`} />)}
      </main>

      {strip}

      {transport}

      <nav
        class="tabs"
        style={{
          "--ti": TABS.indexOf(tab),
          "--ti4x": TABS.indexOf(tab) % 4,
          "--ti4y": Math.floor(TABS.indexOf(tab) / 4),
          "--tc": TAB_COLOR[tab],
        }}
      >
        <i class="marker" aria-hidden="true" />
        {TABS.map((t) => (
          <button
            key={t}
            class={`tab${t === tab ? " on" : ""}`}
            style={{ "--c": TAB_COLOR[t] }}
            data-tab={t}
            aria-current={t === tab}
            onClick={() => setTab(t)}
          >
            <TabIcon tab={t} />
            <span>{TAB_NAME[t]}</span>
          </button>
        ))}
      </nav>

      {overlays}
    </div>
  );
}
