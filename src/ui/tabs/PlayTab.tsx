/**
 * Play tab (spec 8.6). Simple, "Now": the five instruments of the playing section as five lanes (spec
 * 8.12): a label block on the left (name and what it plays; a tap turns it on or off at the next bar, a
 * hold opens its tab) and the bar it plays to its right, with one playhead across all five.
 * Advanced, "Song": instruments by sections over the section strip, which is its column labels, with DROP and Morph
 * between them at the same screen position as in Simple (P10d).
 */
import { INSTRUMENTS, type InstrumentId } from "../../engine/song.ts";
import type { Ctx } from "../App.tsx";
import { useLongPress } from "../components.tsx";
import { nowTile, sectionLetter } from "../logic.ts";
import { INST_COLOR, INST_NAME, InstName } from "../theme.tsx";
import { Lane, Playhead } from "../lanes.tsx";
import { VibeControl } from "../vibes.tsx";
import { DropButton } from "../drop.tsx";
import { MorphButton } from "../morph.tsx";

function NowTile({ ctx, id }: { ctx: Ctx; id: InstrumentId }) {
  const { engine, song, pending, pos } = ctx;
  // Read the section the tap toggles (the scheduler's), not the one heard, which lags it at a switch.
  const { on, queued, sub } = nowTile(song, engine.schedulerSection(), pending, id, pos.playing);
  const press = useLongPress(
    () => engine.toggleInstrumentInPlaying(id),
    () => ctx.goTab(id),
  );
  return (
    <button
      class={`tile now-tile${on ? " on" : " off"}${queued ? " pending" : ""}`}
      style={{ "--c": INST_COLOR[id], "--f": `var(--f-${id})` }}
      data-now={id}
      aria-pressed={on}
      aria-label={`${INST_NAME[id]}: ${on ? "on" : "off"}${queued ? ", switching on the next bar" : ""}. Tap to switch at the next bar, hold to open`}
      {...press}
    >
      <i class="flash" aria-hidden="true" />
      <b>
        <InstName id={id} />
      </b>
      <span>{sub}</span>
    </button>
  );
}

/** The five lanes (spec 8.12); also the tablet portrait dock's in Simple (spec 9.3, T1 slice c). */
export function NowView({ ctx }: { ctx: Ctx }) {
  return (
    <div class="nowlist">
      {INSTRUMENTS.map((id) => [<NowTile key={id} ctx={ctx} id={id} />, <Lane key={`${id}-lane`} id={id} lanes={ctx.lanes} />])}
      <div class="phcol" aria-hidden="true">
        <Playhead />
      </div>
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
          <InstName id={id} />
        </button>,
        ...song.sections.map((s, i) => {
          const p = isPending(i, id);
          return (
            <button
              key={`${id}${i}`}
              class={`cell${s.on[id] ? " on" : " off"}${p ? " pending" : ""}${i === playing ? " live" : ""}`}
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
  const drop = (
    <div class="droprow">
      <DropButton ctx={ctx} />
      {/* P11 (spec 8.6, 8.11): the Morph switch beside DROP. */}
      <MorphButton ctx={ctx} />
    </div>
  );
  return (
    <section class={`playtab ${ctx.advanced ? "song" : "nowview"}`}>
      {ctx.advanced ? (
        <SongView ctx={ctx} />
      ) : (
        <>
          <VibeControl ctx={ctx} onOpen={ctx.openVibes} />
          <NowView ctx={ctx} />
        </>
      )}
      {/* P10 (spec 8.9): between the instruments and the section strip, full width. P10d (spec 8.6): in Advanced too,
          under the grid, so DROP and Morph sit in the same place in both modes. */}
      {drop}
    </section>
  );
}
