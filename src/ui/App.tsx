/**
 * The frame (P1, spec 8.6), top to bottom on every tab: the header (New jam, Songs, Simple and
 * Advanced), the tab's own content, the section strip, the transport bar and the tab bar. Nothing
 * scrolls. The UI reads the song and the position from the engine and calls the engine for every
 * change; it never touches audio.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { Engine, type LatencyHint, type Pending, type Position, type RecordInfo, type Song, type Take } from "../engine/index.ts";
import type { Keeper } from "../store/keeper.ts";
import { Sheet, useLongPress, useVerticalDrag } from "./components.tsx";
import { startFit } from "./fit.ts";
import { barLabel, beatLights, clockLabel, editedSection, keepChosen, recordLabel, sectionLetter, sizeLabel, stripState } from "./logic.ts";
import { SectionSheet, SongsSheet } from "./sheets.tsx";
import { TABS, TAB_NAME, TabIcon, type Tab } from "./theme.tsx";
import { PlayTab } from "./tabs/PlayTab.tsx";
import { ChordsTab } from "./tabs/ChordsTab.tsx";
import { InstrumentTab } from "./tabs/InstrumentTab.tsx";
import { MixTab } from "./tabs/MixTab.tsx";
import { LayerTab } from "./tabs/LayerTab.tsx";

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
  goTab: (t: Tab) => void;
  hint: LatencyHint;
  keeper: Keeper;
  /** Advanced mode (spec 8.1). Until P2 it chooses the Play tab's view and allows editing without playing. */
  advanced: boolean;
  /**
   * The tab body is tall enough to show the filter XY pad and the sends under every page. When it is
   * not, instrument tabs give them a page of their own, so nothing scrolls.
   */
  roomy: boolean;
}

/** Tab body height (CSS px) from which the XY pad and sends sit under every page. */
export const ROOMY_PX = 560;

/** Watches the tab body's height. */
function useRoomy(ref: { current: HTMLElement | null }): boolean {
  const [roomy, setRoomy] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = (): void => setRoomy(el.clientHeight >= ROOMY_PX);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
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

export function App({ engine, hint, keeper }: { engine: Engine; hint: LatencyHint; keeper: Keeper }) {
  const [song, setSong] = useState<Song>(() => engine.getSong());
  const [pos, setPos] = useState<Position>(() => engine.position());
  const [pending, setPending] = useState<Pending>(() => engine.pendingShown());
  const [chosen, setChosen] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("play");
  const [advanced, setAdvanced] = useState(false);
  const [held, setHeld] = useState<number | null>(null);
  const [songs, setSongs] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [take, setTake] = useState<NamedTake | null>(null);
  const [saveFailed, setSaveFailed] = useState(keeper.failed);
  const [idle, setIdle] = useState(keeper.idle());
  const bodyRef = useRef<HTMLElement | null>(null);
  const roomy = useRoomy(bodyRef);
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
      setIdle(keeper.idle());
    });
    return () => {
      offPos();
      offChange();
    };
  }, [engine, keeper]);
  useEffect(() => setIdle(keeper.idle()), [keeper, pos.playing, rec.state]);

  // Text fits its tile: re-fitted after any change on screen and on resize (display only).
  useEffect(() => startFit(document.body), []);

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

  const togglePlay = async (): Promise<void> => {
    if (engine.playing) {
      engine.stop();
      return;
    }
    setStarting(true);
    try {
      await engine.init(hint);
      engine.play();
      setError(null);
    } catch (err) {
      setError(`Audio failed to start: ${String(err)}`);
    } finally {
      setStarting(false);
    }
  };

  const bpmDrag = useVerticalDrag(song.bpm, 80, 180, (v) => (engine.bpm = v), 1, 400);
  const ctx: Ctx = { engine, song, pos, pending, edit, playing, goTab: setTab, hint, keeper, advanced, roomy };
  const taking = rec.state === "recording" || rec.state === "finishing";
  const lights = beatLights(pos.playing, pos.step);
  // On the Advanced Play tab the strip is the grid's column labels: indented under its four columns.
  const gridStrip = tab === "play" && advanced;
  const stripCols = `${gridStrip ? "var(--rowhead) " : ""}repeat(${count}, minmax(0, 1fr))`;

  return (
    <div class={`shell${tab === "play" && !advanced ? " now" : ""}`}>
      <header class="hdr">
        <button
          class="btn hb"
          id="new-jam"
          aria-label="New jam: start a new song; this one stays in Songs"
          disabled={!idle}
          onClick={() => void keeper.create()}
        >
          <span class="plus" aria-hidden="true">+</span>
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

      <main class="body" ref={bodyRef}>
        {error && <p class="err">{error}</p>}
        {rec.error && rec.state === "off" && (
          <p class="err" id="rec-err">
            {rec.error}
          </p>
        )}
        {saveFailed && <p class="err">The song could not be saved on this phone (storage full or blocked).</p>}
        {tab === "play" && <PlayTab ctx={ctx} />}
        {tab === "chords" && <ChordsTab ctx={ctx} />}
        {tab === "mix" && <MixTab ctx={ctx} />}
        {(tab === "layer1" || tab === "layer2") && <LayerTab ctx={ctx} id={tab} key={tab} />}
        {(tab === "drums" || tab === "bass" || tab === "synth") && <InstrumentTab ctx={ctx} inst={tab} key={tab} />}
      </main>

      <div class="secs" style={{ gridTemplateColumns: stripCols }}>
        {gridStrip && <div class="seclabel">Sections</div>}
        {song.sections.map((s, i) => (
          <StripTile
            key={i}
            i={i}
            name={s.name}
            view={stripState(i, { chosen, playing, running: pos.playing, queued: pending.section, name: s.name })}
            onTap={() => engine.switchSection(i)}
            onHold={() => setHeld(i)}
          />
        ))}
      </div>

      <div class="top">
        <button
          id="play"
          class={`play${pos.playing ? " on" : ""}`}
          aria-label={pos.playing ? "Stop" : "Play"}
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

      <nav class="tabs">
        {TABS.map((t) => (
          <button key={t} class={`tab${t === tab ? " on" : ""}`} data-tab={t} aria-current={t === tab} onClick={() => setTab(t)}>
            <TabIcon tab={t} />
            <span>{TAB_NAME[t]}</span>
          </button>
        ))}
      </nav>

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
    </div>
  );
}
