/**
 * Mix tab: the master level meter over three pages: filter sweep, pump and saturation (Master),
 * level per instrument (Levels), and the audio buffer choice (Audio).
 */
import { useEffect, useState } from "preact/hooks";
import { INSTRUMENTS, type Engine, type LatencyHint, type MixState } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Dial, GroupLabel, Meter, Pager } from "../components.tsx";
import { meterFraction, simpleSweepLabel, sweepLabel, type PageDef } from "../logic.ts";
import { motionWanted, onMotionPref, setMotionOn } from "../motion.ts";
import { INST_COLOR, INST_NAME, InstName } from "../theme.tsx";

/** Reads the engine's meter about 15 times a second while the tab is open. Display only: nothing is scheduled from here. */
function MasterMeter({ engine }: { engine: Engine }) {
  const [m, setM] = useState({ rms: -Infinity, peak: -Infinity });
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number): void => {
      if (t - last > 66) {
        last = t;
        setM({ rms: engine.level(), peak: engine.peak() });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);
  const text = Number.isFinite(m.peak) ? `${m.peak.toFixed(1)} dB` : "–";
  return <Meter fill={meterFraction(m.rms)} peak={meterFraction(m.peak)} text={text} />;
}

/** The app's own motion switch (spec 8.12): off, nothing moves and every state reads by fill and hatching. */
function MotionSwitch() {
  const [wanted, setWanted] = useState(motionWanted);
  useEffect(() => onMotionPref(() => setWanted(motionWanted())), []);
  // The phone's reduce-motion setting holds everything still whatever the switch says: show Still (P1b review M10).
  const [system, setSystem] = useState(() => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const fn = (): void => setSystem(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const on = wanted && !system;
  return (
    <>
      <GroupLabel thing="Motion" />
      <div class="seg two">
        {([true, false] as const).map((v) => (
          <button key={String(v)} class={on === v ? "on" : ""} data-motion={v ? "on" : "off"} aria-pressed={on === v} onClick={() => setMotionOn(v)}>
            {v ? "Moving" : "Still"}
          </button>
        ))}
      </div>
      {system && <p class="note" id="motion-system">The phone's setting is on.</p>}
      <p class="note">Still stops every movement on screen. The phone's reduce-motion setting does the same.</p>
    </>
  );
}

const BUFFERS = [
  ["interactive", "Fast"],
  ["balanced", "Balanced"],
  ["playback", "Safe"],
] as const;

type MixPage = "master" | "levels" | "audio";
const MIX_PAGES: PageDef<MixPage>[] = [
  ["master", "Master"],
  ["levels", "Levels"],
  ["audio", "Audio"],
];

export function MixTab({ ctx }: { ctx: Ctx }) {
  const { engine, hint, pos } = ctx;
  // Changing the buffer reloads the page; the song is saved first and reopens (G5). Refused while
  // playing, and asks for a second tap when stopped.
  const [armed, setArmed] = useState<LatencyHint | null>(null);
  const choose = (h: LatencyHint): void => {
    if (h === hint) return;
    if (armed === h) void ctx.keeper.flush().then(() => (location.href = `?hint=${h}`));
    else setArmed(h);
  };
  const [page, setPage] = useState<MixPage>("master");
  const mix = engine.getMix();
  const set = (k: keyof MixState) => (v: number) => engine.setMix(k, v);
  return (
    <section class="mixtab">
      <MasterMeter engine={engine} />
      <Pager id="mix" pages={MIX_PAGES} page={page} onPage={setPage} />
      {page === "master" && (
        <div class="dials n3">
          <Dial id="sweep" label={ctx.advanced ? "Filter" : "Tone"} value={mix.sweep} min={-1} max={1} bipolar display={ctx.advanced ? sweepLabel(mix.sweep) : simpleSweepLabel(mix.sweep)} color="var(--orange)" onChange={set("sweep")} />
          <Dial id="pump" label="Pump" value={mix.pump} min={0} max={0.95} display={String(Math.round(mix.pump * 100))} color="var(--teal)" onChange={set("pump")} />
          <Dial id="saturation" label={ctx.advanced ? "Saturate" : "Grit"} value={mix.saturation} min={0} max={1} color="var(--coral)" onChange={set("saturation")} />
        </div>
      )}
      {page === "levels" && (
        <div class="dials n5">
          {INSTRUMENTS.map((id) => (
            <Dial
              key={id}
              id={`level:${id}`}
              label={INST_NAME[id]}
              name={<InstName id={id} />}
              value={ctx.song.patches[id].level}
              min={0}
              max={1}
              color={INST_COLOR[id]}
              onChange={(v) => engine.setParam(id, "level", v)}
            />
          ))}
        </div>
      )}
      {page === "audio" && (
        <>
          <div class="seg">
            {BUFFERS.map(([h, name]) => (
              <button
                key={h}
                class={`${hint === h ? "on" : ""}${armed === h ? " armed" : ""}`}
                data-hint={h}
                aria-pressed={hint === h}
                disabled={pos.playing && hint !== h}
                onClick={() => choose(h)}
              >
                {armed === h && !pos.playing ? "Tap again" : name}
              </button>
            ))}
          </div>
          <p class="note">If it crackles, try Safe. The page reloads; the song is kept.</p>
          {pos.playing && <p class="note">Stop to change it.</p>}
          {armed && !pos.playing && <p class="note">Tap again to reload.</p>}
          <MotionSwitch />
        </>
      )}
    </section>
  );
}
