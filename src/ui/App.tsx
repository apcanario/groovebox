/**
 * The shell (G2): transport bar, section strip, tab bar and the eight tabs. The UI reads the song
 * and the position from the engine and calls the engine for every change; it never touches audio.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { Engine, MOOD_TABLE, type LatencyHint, type Pending, type Position, type RecordInfo, type Song, type Take } from "../engine/index.ts";
import type { Keeper } from "../store/keeper.ts";
import { Sheet, useVerticalDrag } from "./components.tsx";
import { barLabel, chooseSection, clockLabel, editedSection, keepChosen, recordLabel, sectionLetter, sizeLabel, stripState } from "./logic.ts";
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
}

const SCALE_SHORT = { major: "maj", minor: "min", dorian: "dor", phrygian: "phr" } as const;

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
  const file = new File([take.file], take.name, { type: "audio/mpeg" });
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
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
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [take, setTake] = useState<NamedTake | null>(null);
  const [saveFailed, setSaveFailed] = useState(keeper.failed);
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
  }, [engine]);

  useWakeLock(pos.playing);

  const count = song.sections.length;
  const playing = Math.min(pos.section, count - 1);
  const edit = editedSection(chosen, playing, count);
  // A chosen section that no longer exists, or that is now the playing one, goes back to following.
  useEffect(() => {
    const keep = keepChosen(chosen, playing, count);
    if (keep !== chosen) setChosen(keep);
  }, [chosen, count, playing]);

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
  const ctx: Ctx = { engine, song, pos, pending, edit, playing, goTab: setTab, hint, keeper };
  const taking = rec.state === "recording" || rec.state === "finishing";
  const mood = MOOD_TABLE[song.mood];

  return (
    <div class="shell">
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
        <button class="pill key" id="keymood" aria-label="Key and mood: open Chords" onClick={() => setTab("chords")}>
          <b>
            {song.key} {SCALE_SHORT[mood.scale]}
          </b>
          <span>{mood.label}</span>
        </button>
        <div class="pill bar" aria-label="Bar and beat">
          <b id="bar">{barLabel(pos.playing, pos.bar, pos.step)}</b>
          <span>bar</span>
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
          {taking && <b id="rec-time">{clockLabel(rec.seconds)}</b>}
        </button>
      </div>

      <div class="secs" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
        {song.sections.map((s, i) => {
          const { isPlaying, isEdit, sub } = stripState(i, { chosen, playing, edit, running: pos.playing, name: s.name });
          const queued = pending.section === i;
          return (
            <button
              key={i}
              class={`sec${isPlaying ? " playing" : ""}${isEdit ? " edit" : ""}${queued ? " pending" : ""}`}
              data-strip={i}
              aria-label={`Edit section ${sectionLetter(i)} ${s.name}`}
              aria-pressed={i === edit}
              onClick={() => setChosen(chooseSection(i, playing))}
            >
              <b>{sectionLetter(i)}</b>
              <span>{sub}</span>
            </button>
          );
        })}
      </div>

      <main class="body">
        {error && <p class="err">{error}</p>}
        {saveFailed && <p class="err">The song could not be saved on this phone (storage full or blocked).</p>}
        {tab === "play" && <PlayTab ctx={ctx} />}
        {tab === "chords" && <ChordsTab ctx={ctx} />}
        {tab === "mix" && <MixTab ctx={ctx} />}
        {(tab === "layer1" || tab === "layer2") && <LayerTab ctx={ctx} id={tab} key={tab} />}
        {(tab === "drums" || tab === "bass" || tab === "synth") && <InstrumentTab ctx={ctx} inst={tab} key={tab} />}
      </main>

      {take && <TakeSheet take={take} onClose={() => setTake(null)} />}

      <nav class="tabs">
        {TABS.map((t) => (
          <button key={t} class={`tab${t === tab ? " on" : ""}`} data-tab={t} aria-current={t === tab} onClick={() => setTab(t)}>
            <TabIcon tab={t} />
            {TAB_NAME[t]}
          </button>
        ))}
      </nav>
    </div>
  );
}
