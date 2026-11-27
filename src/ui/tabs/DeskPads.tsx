/**
 * The pads of the tablet desk (T1 slice b, spec 9.2): the space the punch pads of T3 take, then the instruments-by-
 * sections grid as large pads. Each row is labelled with its instrument and what it plays (a tap opens its panel on the
 * right); a tap on a pad switches that instrument in that section at the next bar, as on the phone's Song grid. The pads
 * of the playing section show their notes for this bar with the playhead through them (spec 8.12); the column a switch
 * lands on carries an outline, a waiting toggle the hatched frame. Movement comes from the one motion loop (motion.ts,
 * `.grid` is a mover), so nothing here renders per frame.
 */
import { INSTRUMENTS, type InstrumentId, type LaneBar } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { padLabel, padView, rowPlays } from "../desk.ts";
import { Playhead } from "../lanes.tsx";
import { laneRects, sectionLetter } from "../logic.ts";
import { INST_COLOR, INST_NAME, InstName } from "../theme.tsx";
import { NowView } from "./PlayTab.tsx";
import { PunchPads } from "../punch.tsx";

/** The bar's notes inside a pad: the lane's drawing (laneRects) without its card, so the pad's own state shows. */
function PadNotes({ id, lanes }: { id: InstrumentId; lanes: LaneBar }) {
  const rects = laneRects(lanes.notes[id]);
  return (
    <span class="padnotes" data-notes={rects.length} aria-hidden="true">
      {rects.map((r, i) => (
        <i
          key={i}
          class="n"
          data-s={r.s}
          data-k={r.k}
          style={{ left: `${r.x}%`, width: `${r.w}%`, top: `${r.y}%`, height: `${r.h}%`, "--s": r.s, "--e": r.e }}
        />
      ))}
      <Playhead />
    </span>
  );
}

function RowHead({ ctx, id }: { ctx: Ctx; id: InstrumentId }) {
  const sub = rowPlays(ctx.song, ctx.engine.schedulerSection(), ctx.pending, id, ctx.pos.playing);
  return (
    <button
      class="rowhead deskrow"
      data-row={id}
      style={{ "--c": INST_COLOR[id], "--f": `var(--f-${id})` }}
      aria-label={`${INST_NAME[id]}: ${sub}. Tap to open its panel`}
      onClick={() => ctx.goTab(id)}
    >
      <i class="flash" aria-hidden="true" />
      <b>
        <InstName id={id} />
      </b>
      <span>{sub}</span>
    </button>
  );
}

/**
 * `lanes`: tablet portrait in Simple (T1 slice c, spec 9.3) shows the five instrument lanes of the phone's Now view under
 * the punch pads' space instead of the grid.
 */
export function DeskPads({ ctx, lanes = false }: { ctx: Ctx; lanes?: boolean }) {
  return (
    <section class={`deskpads${lanes ? " docklanes" : ""}`}>
      {/* T3 (spec 9.2 and 9.3): the six punch pads on top of the pads. */}
      <PunchPads ctx={ctx} band />
      {lanes ? <NowView ctx={ctx} /> : <DeskGrid ctx={ctx} />}
    </section>
  );
}

function DeskGrid({ ctx }: { ctx: Ctx }) {
  const { engine, song, pending, playing, lanes, pos } = ctx;
  const cols = song.sections.length;
  const input = {
    playing,
    notesFor: lanes.section < cols ? lanes.section : null,
    queued: pending.section,
    toggles: pending.toggles,
    running: pos.playing,
  };
  return (
      <div class="grid deskgrid" style={{ gridTemplateColumns: `var(--rowhead) repeat(${cols}, minmax(0, 1fr))` }}>
        {INSTRUMENTS.map((id) => [
          <RowHead key={id} ctx={ctx} id={id} />,
          ...song.sections.map((_, i) => {
            const v = padView(song, i, id, input);
            return (
              <button
                key={`${id}${i}`}
                class={`cell pad${v.on ? " on" : " off"}${v.pending ? " pending" : ""}${v.live ? " live" : ""}${v.next ? " nextcol" : ""}`}
                style={{ "--c": INST_COLOR[id] }}
                data-cell={`${i}:${id}`}
                data-live={v.live ? "" : undefined}
                aria-pressed={v.on}
                aria-label={padLabel(INST_NAME[id], sectionLetter(i), v)}
                onClick={() => engine.toggleInstrument(i, id)}
              >
                {v.notes && <PadNotes id={id} lanes={lanes} />}
              </button>
            );
          }),
        ])}
      </div>
  );
}
