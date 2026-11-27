/**
 * Mix tab: the master level meter over three pages: filter sweep, pump and saturation (Master),
 * level per instrument (Levels), and the audio buffer choice (Audio).
 */
import { useEffect, useState } from "preact/hooks";
import { DROP_BUILDS, DROP_CLIFFS, DROP_WINDS, INSTRUMENTS, MIX_RANGES, mixValue, type Engine, type LatencyHint, type MixKey } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Dial, Fader, GroupLabel, Meter, Pager } from "../components.tsx";
import { useFull } from "./full.ts";
import { knobPos, knobValue, meterFraction, secondsText, shownPage, simpleSweepLabel, sweepLabel, type PageDef } from "../logic.ts";
import { motionWanted, onMotionPref, setMotionOn } from "../motion.ts";
import { INST_COLOR, INST_NAME, InstName } from "../theme.tsx";
import { Icon } from "../icons.tsx";
import { MorphPage, MorphSpeed } from "../morph.tsx";

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
function MotionSwitch({ brief = false }: { brief?: boolean }) {
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
      {!brief && <p class="note">Still stops every movement on screen. The phone's reduce-motion setting does the same.</p>}
    </>
  );
}

const BUFFERS = [
  ["interactive", "Fast"],
  ["balanced", "Balanced"],
  ["playback", "Safe"],
] as const;

type MixPage = "master" | "levels" | "space" | "audio" | "drop" | "morph";
const MIX_PAGES: PageDef<MixPage>[] = [
  ["master", "Master"],
  ["levels", "Levels"],
  ["space", "Space"],
  ["audio", "Audio"],
];
/** P10 (spec 8.9): Advanced adds the Drop page; P11 (spec 8.11) the Morph page. */
const ADVANCED_PAGES: PageDef<MixPage>[] = [...MIX_PAGES, ["drop", "Drop"], ["morph", "Morph"]];
/** T1 review M4 (spec 9.2): Simple on a tablet with the height shows Master and Levels together on one page. */
const TABLET_SIMPLE_PAGES: PageDef<MixPage>[] = MIX_PAGES.filter(([k]) => k !== "levels");

const CLIFF_NAME = { gap: "Gap", hold: "Hold", none: "None" } as const;

/**
 * The Drop page (spec 8.9, Advanced): build length, cliffhanger, wind-down length and one Width knob, over the vibe's
 * recipe; stored in the song. A build or wind-down already running keeps its length.
 */
function DropPage({ engine }: { engine: Engine }) {
  const r = engine.dropRecipe();
  return (
    <div class="droppage">
      <GroupLabel thing="Build" split="bars" />
      <div class="seg">
        {DROP_BUILDS.map((n) => (
          <button key={n} class={r.build === n ? "on" : ""} data-dropbuild={n} aria-pressed={r.build === n} onClick={() => engine.setDrop({ build: n })}>
            {n}
          </button>
        ))}
      </div>
      <GroupLabel thing="Cliffhanger" />
      <div class="seg">
        {DROP_CLIFFS.map((c) => (
          <button key={c} class={r.cliff === c ? "on" : ""} data-dropcliff={c} aria-pressed={r.cliff === c} onClick={() => engine.setDrop({ cliff: c })}>
            {CLIFF_NAME[c]}
          </button>
        ))}
      </div>
      <div class="droplow">
        <div class="dropwind">
          <GroupLabel thing="Wind-down" split="bars" />
          <div class="seg two">
            {DROP_WINDS.map((n) => (
              <button key={n} class={r.wind === n ? "on" : ""} data-dropwind={n} aria-pressed={r.wind === n} onClick={() => engine.setDrop({ wind: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <Dial id="dropWidth" label="Width" value={r.width} min={0} max={1} color="var(--yellow)" onChange={(v) => engine.setDrop({ width: Math.round(v * 100) / 100 })} />
      </div>
    </div>
  );
}

/** The reverb decay dial (P7, spec 8.10): 1 to 20 seconds on an exponential curve. */
const DECAY = { label: "Tail", seconds: MIX_RANGES.reverbDecay };

export function MixTab({ ctx }: { ctx: Ctx }) {
  // T2 (spec 9.2): Advanced Mix on the desk shows every page at once where it fits; Simple keeps its own.
  const [full, ref] = useFull(ctx.advanced ? ctx : { ...ctx, desk: false }, "mix");
  return full ? <WholeMix ctx={ctx} sref={ref} /> : <PagedMix ctx={ctx} sref={ref} />;
}

/**
 * Changing the buffer reloads the page; the song is saved first and reopens (G5). Refused while playing, and asks for
 * a second tap when stopped.
 */
function useBuffer(ctx: Ctx): [LatencyHint | null, (h: LatencyHint) => void] {
  const [armed, setArmed] = useState<LatencyHint | null>(null);
  const choose = (h: LatencyHint): void => {
    if (h === ctx.hint) return;
    if (armed === h) void ctx.keeper.flush().then(() => (location.href = `?hint=${h}`));
    else setArmed(h);
  };
  return [armed, choose];
}

function Buffers({ ctx, armed, choose }: { ctx: Ctx; armed: LatencyHint | null; choose: (h: LatencyHint) => void }) {
  const { hint, pos } = ctx;
  return (
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
  );
}

/** The master's three dials (Advanced names). */
function MasterDials({ ctx }: { ctx: Ctx }) {
  const { engine } = ctx;
  const mix = engine.getMix();
  const set = (k: MixKey) => (v: number) => engine.setMix(k, v);
  return (
    <div class="dials n3">
      <Dial id="sweep" label="Filter" value={mix.sweep} min={-1} max={1} bipolar display={sweepLabel(mix.sweep)} color="var(--orange)" onChange={set("sweep")} />
      <Dial id="pump" label="Pump" value={mix.pump} min={0} max={0.95} display={String(Math.round(mix.pump * 100))} color="var(--teal)" onChange={set("pump")} />
      <Dial id="saturation" label="Saturate" value={mix.saturation} min={0} max={1} color="var(--coral)" onChange={set("saturation")} />
    </div>
  );
}

/** Reads every instrument's own level about 15 times a second while the whole Mix is open. Display only. */
function useInstrumentMeters(engine: Engine): Record<string, number> {
  const [m, setM] = useState<Record<string, number>>({});
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (t: number): void => {
      if (t - last > 66) {
        last = t;
        setM(Object.fromEntries(INSTRUMENTS.map((id) => [id, meterFraction(engine.instrumentLevel(id))])));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);
  return m;
}

/**
 * T2 (spec 9.2): the Mix panel whole, on the desk. The master meter on top; then two columns: the master and the space
 * over a fader with its live meter per instrument (lowest, in thumb reach), and the Drop, Morph and Audio settings.
 */
function WholeMix({ ctx, sref }: { ctx: Ctx; sref: { current: HTMLElement | null } }) {
  const { engine, pos } = ctx;
  const [armed, choose] = useBuffer(ctx);
  const meters = useInstrumentMeters(engine);
  return (
    <section ref={sref} class="mixtab whole" data-whole="mix">
      <MasterMeter engine={engine} />
      <div class="cols">
        <div class="col">
          <div class="grp" data-grp="master">
            <GroupLabel thing="Master" />
            <MasterDials ctx={ctx} />
          </div>
          <div class="grp" data-grp="space">
            <GroupLabel thing="Space" />
            <SpaceDials ctx={ctx} />
          </div>
          <div class="grp levels" data-grp="levels">
            <GroupLabel thing="Levels" />
            <div class="faders">
              {INSTRUMENTS.map((id) => (
                <Fader
                  key={id}
                  id={`level:${id}`}
                  label={INST_NAME[id]}
                  name={<InstName id={id} />}
                  value={ctx.song.patches[id].level}
                  meter={meters[id] ?? 0}
                  color={INST_COLOR[id]}
                  onChange={(v) => engine.setParam(id, "level", v)}
                />
              ))}
            </div>
          </div>
        </div>
        <div class="col">
          <div class="grp" data-grp="drop">
            <DropPage engine={engine} />
          </div>
          <div class="grp" data-grp="morph">
            <GroupLabel thing="Morph" />
            <MorphPage engine={engine} brief />
          </div>
          <div class="grp" data-grp="audio">
            <GroupLabel thing="Audio" split={pos.playing ? "Stop to change" : armed ? "Tap again to reload" : undefined} />
            <Buffers ctx={ctx} armed={armed} choose={choose} />
            <MotionSwitch brief />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Tail, Air and the lo-fi master (the Space page). */
function SpaceDials({ ctx }: { ctx: Ctx }) {
  const { engine } = ctx;
  const mix = engine.getMix();
  const lofi = mixValue(mix, "lofi") > 0;
  return (
    <div class="dials n2">
      <Dial
        id="reverbDecay"
        label="Tail s"
        value={knobPos(DECAY, mixValue(mix, "reverbDecay"))}
        min={0}
        max={1}
        display={secondsText(mixValue(mix, "reverbDecay"))}
        color="var(--teal)"
        onChange={(p) => engine.setMix("reverbDecay", knobValue(DECAY, p))}
      />
      <Dial id="air" label="Air" value={mixValue(mix, "air")} min={0} max={1} color="var(--blue)" onChange={(v) => engine.setMix("air", v)} />
      {/* P9 (spec 8.8): the lo-fi master as one on/off, a tile beside the dials (review M8: no group label over a
          button that names itself, and no empty band above it). */}
      <button
        class={`tog fxbtn${lofi ? " on" : " off"}`}
        style={{ "--c": "var(--coral)" }}
        role="switch"
        aria-checked={lofi}
        aria-label={`Lo-fi ${lofi ? "on" : "off"}`}
        id="lofi"
        data-lofi={lofi ? "on" : "off"}
        onClick={() => engine.setMix("lofi", lofi ? 0 : 1)}
      >
        <Icon thing="Master" />
        <span>Lo-fi</span>
      </button>
    </div>
  );
}

function PagedMix({ ctx, sref }: { ctx: Ctx; sref: { current: HTMLElement | null } }) {
  const { engine, pos } = ctx;
  const [armed, choose] = useBuffer(ctx);
  const [chosenPage, setPage] = useState<MixPage>("master");
  const together = !ctx.advanced && ctx.tablet && ctx.roomy;
  const pages = ctx.advanced ? ADVANCED_PAGES : together ? TABLET_SIMPLE_PAGES : MIX_PAGES;
  const page = shownPage(pages, chosenPage);
  const mix = engine.getMix();
  const set = (k: MixKey) => (v: number) => engine.setMix(k, v);
  return (
    <section ref={sref} class={`mixtab${together ? " together" : ""}`}>
      <MasterMeter engine={engine} />
      <Pager id="mix" pages={pages} page={page} onPage={setPage} />
      {page === "master" && (
        <div class={`dials ${ctx.advanced ? "n3" : "n4"}`}>
          <Dial id="sweep" label={ctx.advanced ? "Filter" : "Tone"} value={mix.sweep} min={-1} max={1} bipolar display={ctx.advanced ? sweepLabel(mix.sweep) : simpleSweepLabel(mix.sweep)} color="var(--orange)" onChange={set("sweep")} />
          <Dial id="pump" label="Pump" value={mix.pump} min={0} max={0.95} display={String(Math.round(mix.pump * 100))} color="var(--teal)" onChange={set("pump")} />
          <Dial id="saturation" label={ctx.advanced ? "Saturate" : "Grit"} value={mix.saturation} min={0} max={1} color="var(--coral)" onChange={set("saturation")} />
          {/* P11 (spec 8.11): Simple's one Morph dial; Advanced has it on the Morph page. */}
          {!ctx.advanced && <MorphSpeed engine={engine} label="Morph speed" />}
        </div>
      )}
      {(page === "levels" || (together && page === "master")) && (
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
      {page === "space" && (
        <>
          <SpaceDials ctx={ctx} />
          <p class="note">Tail is how long the reverb rings. Air is a soft breath of noise. Lo-fi wobbles, crunches and hisses.</p>
        </>
      )}
      {page === "drop" && <DropPage engine={engine} />}
      {page === "morph" && <MorphPage engine={engine} />}
      {page === "audio" && (
        <>
          <Buffers ctx={ctx} armed={armed} choose={choose} />
          <p class="note">If it crackles, try Safe. The page reloads; the song is kept.</p>
          {pos.playing && <p class="note">Stop to change it.</p>}
          {armed && !pos.playing && <p class="note">Tap again to reload.</p>}
          <MotionSwitch />
        </>
      )}
    </section>
  );
}
