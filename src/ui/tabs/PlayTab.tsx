/**
 * Play tab (spec 8.6). Simple, "Now": the five instruments of the playing section as tiles; a tap
 * turns one on or off at the next bar, a hold opens its tab (P1b turns the tiles into lanes).
 * Advanced, "Song": instruments by sections, sitting on the section strip, which is its column labels.
 */
import { INSTRUMENTS, type InstrumentId, type Song } from "../../engine/song.ts";
import type { Ctx } from "../App.tsx";
import { useLongPress } from "../components.tsx";
import { LAYER_MODE_TITLE, PRESET_LABEL, sectionLetter } from "../logic.ts";
import { INST_COLOR, INST_NAME } from "../theme.tsx";

/** What an instrument plays in a section, in a word or two. */
function plays(song: Song, sec: number, id: InstrumentId): string {
  const s = song.sections[sec];
  if (id === "drums") return s.drums.grid ? `${PRESET_LABEL[s.drums.preset]}, edited` : PRESET_LABEL[s.drums.preset];
  if (id === "bass") return PRESET_LABEL[s.bass.rhythm];
  if (id === "synth") return PRESET_LABEL[s.synth.rhythm];
  return LAYER_MODE_TITLE[s[id].mode];
}

function NowTile({ ctx, id }: { ctx: Ctx; id: InstrumentId }) {
  const { engine, song, pending, playing, pos } = ctx;
  const on = song.sections[playing].on[id];
  const queued = pending.toggles.some((t) => t.section === playing && t.instrument === id);
  const press = useLongPress(
    () => engine.toggleInstrumentInPlaying(id),
    () => ctx.goTab(id),
  );
  const sub = queued && pos.playing ? "Next bar" : plays(song, playing, id);
  return (
    <button
      class={`tile now-tile${on ? " on" : ""}${queued ? " pending" : ""}`}
      style={{ "--c": INST_COLOR[id] }}
      data-now={id}
      aria-pressed={on}
      aria-label={`${INST_NAME[id]}: ${on ? "on" : "off"}${queued ? ", switching on the next bar" : ""}. Tap to switch at the next bar, hold to open`}
      {...press}
    >
      <b>{INST_NAME[id]}</b>
      <span>{sub}</span>
    </button>
  );
}

function NowView({ ctx }: { ctx: Ctx }) {
  return (
    <div class="nowlist">
      {INSTRUMENTS.map((id) => (
        <NowTile key={id} ctx={ctx} id={id} />
      ))}
    </div>
  );
}

function SongView({ ctx }: { ctx: Ctx }) {
  const { engine, song, pending, playing } = ctx;
  const cols = song.sections.length;
  const isPending = (sec: number, id: InstrumentId): boolean =>
    pending.toggles.some((t) => t.section === sec && t.instrument === id);
  return (
    <div class="grid" style={{ gridTemplateColumns: `var(--rowhead) repeat(${cols}, minmax(0, 1fr))` }}>
      {INSTRUMENTS.map((id) => [
        <button key={id} class="rowhead" data-row={id} style={{ "--c": INST_COLOR[id] }} onClick={() => ctx.goTab(id)}>
          {INST_NAME[id]}
        </button>,
        ...song.sections.map((s, i) => {
          const p = isPending(i, id);
          return (
            <button
              key={`${id}${i}`}
              class={`cell${s.on[id] ? " on" : ""}${p ? " pending" : ""}${i === playing ? " live" : ""}`}
              style={{ "--c": INST_COLOR[id] }}
              data-cell={`${i}:${id}`}
              aria-pressed={s.on[id]}
              aria-label={`${INST_NAME[id]} in section ${sectionLetter(i)}: ${s.on[id] ? "on" : "off"}${p ? ", switching on the next bar" : ""}`}
              onClick={() => engine.toggleInstrument(i, id)}
            />
          );
        }),
      ])}
    </div>
  );
}

export function PlayTab({ ctx }: { ctx: Ctx }) {
  return <section class={`playtab ${ctx.advanced ? "song" : "nowview"}`}>{ctx.advanced ? <SongView ctx={ctx} /> : <NowView ctx={ctx} />}</section>;
}
