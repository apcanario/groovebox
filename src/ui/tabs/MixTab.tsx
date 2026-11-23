/**
 * Mix tab: filter sweep, pump and saturation (page Master), level per instrument (page Levels),
 * the master level meter, and the audio buffer choice.
 */
import { useEffect, useState } from "preact/hooks";
import { INSTRUMENTS, type Engine, type LatencyHint, type MixState } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Dial, Meter, Pager } from "../components.tsx";
import { meterFraction, sweepLabel } from "../logic.ts";
import { INST_COLOR, INST_NAME } from "../theme.tsx";

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

const BUFFERS = [
  ["interactive", "Fast"],
  ["balanced", "Balanced"],
  ["playback", "Safe"],
] as const;

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
  const [page, setPage] = useState(0);
  const mix = engine.getMix();
  const set = (k: keyof MixState) => (v: number) => engine.setMix(k, v);
  return (
    <section class="mixtab">
      <h1 class="head">
        <em>Mix</em>
      </h1>
      <MasterMeter engine={engine} />
      <Pager id="mix" pages={["Master", "Levels"]} page={page} onPage={setPage} />
      {page === 0 ? (
        <div class="dials">
          <Dial id="sweep" label="Filter" value={mix.sweep} min={-1} max={1} bipolar display={sweepLabel(mix.sweep)} color="var(--orange)" onChange={set("sweep")} />
          <Dial id="pump" label="Pump" value={mix.pump} min={0} max={0.95} display={String(Math.round(mix.pump * 100))} color="var(--teal)" onChange={set("pump")} />
          <Dial id="saturation" label="Saturate" value={mix.saturation} min={0} max={1} color="var(--coral)" onChange={set("saturation")} />
        </div>
      ) : (
        <div class="dials">
          {INSTRUMENTS.map((id) => (
            <Dial
              key={id}
              id={`level:${id}`}
              label={INST_NAME[id]}
              value={ctx.song.patches[id].level}
              min={0}
              max={1}
              color={INST_COLOR[id]}
              onChange={(v) => engine.setParam(id, "level", v)}
            />
          ))}
        </div>
      )}
      <div class="label">
        Audio buffer · if it crackles, try a larger one. {pos.playing ? "Stop to change it: " : ""}The page reloads; the song is kept.
      </div>
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
      {armed && !pos.playing && <p class="note">Tap again to reload.</p>}
    </section>
  );
}
