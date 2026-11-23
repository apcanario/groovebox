/**
 * Lanes (spec 8.12, the loud idea): each instrument's bar drawn as notes on a 16-step grid with a faint
 * line every beat, in the instrument's colour (greyed when it is off), with one playhead that sweeps
 * across in time. The notes come from the engine (Engine.lanes); the playhead and the brightening of the
 * note under it move by the custom properties of the motion loop (motion.ts), so no render runs per frame.
 */
import type { InstrumentId, LaneBar } from "../engine/index.ts";
import { laneRects, phraseSegments } from "./logic.ts";
import { INST_COLOR } from "./theme.tsx";

/** The faint line on every beat (steps 4, 8 and 12). */
function BeatLines() {
  return (
    <>
      <i class="bl" style={{ left: "25%" }} />
      <i class="bl" style={{ left: "50%" }} />
      <i class="bl" style={{ left: "75%" }} />
    </>
  );
}

/** The playhead: a full-width track moved by --p, holding a 2 px line at its left edge. */
export function Playhead() {
  return (
    <div class="ph" aria-hidden="true">
      <i />
    </div>
  );
}

/**
 * The step row of a lead (P6, spec 8.5): one segment per bar of the phrase along the lane's foot, the bar playing
 * lit. Notes are drawn by their length above it, so a long note reads as a long bar.
 */
function PhraseBar({ phrase }: { phrase: { bar: number; of: number } }) {
  const segs = phraseSegments(phrase)!;
  return (
    <div class="phr" data-phrase={`${phrase.bar + 1}/${phrase.of}`} aria-hidden="true">
      {segs.map((on, i) => (
        <i key={i} class={on ? "on" : ""} />
      ))}
    </div>
  );
}

/**
 * One instrument's lane. `playhead`: draw its own playhead (instrument tabs); the Play tab draws one for all.
 * `section`: on a layer's tab, the section edited; its lead's phrase bar shows when that section is the one drawn.
 */
export function Lane({ id, lanes, playhead = false, section }: { id: InstrumentId; lanes: LaneBar; playhead?: boolean; section?: number }) {
  const on = lanes.on[id];
  const rects = laneRects(lanes.notes[id]);
  const phrase = section !== undefined && section === lanes.section && (id === "layer1" || id === "layer2") ? lanes.phrase[id] : null;
  return (
    <div
      class={`lane${on ? " on" : " off"}`}
      style={{ "--c": INST_COLOR[id] }}
      data-lane={id}
      data-notes={rects.length}
      aria-label={`${id} lane: ${rects.length} notes this bar${phrase ? `, bar ${phrase.bar + 1} of ${phrase.of} of the phrase` : ""}${on ? "" : ", off"}`}
      role="img"
    >
      <BeatLines />
      {rects.map((r, i) => (
        <i
          key={i}
          class="n"
          data-n={i}
          data-s={r.s}
          data-k={r.k}
          style={{ left: `${r.x}%`, width: `${r.w}%`, top: `${r.y}%`, height: `${r.h}%`, "--s": r.s, "--e": r.e }}
        />
      ))}
      {phrase && <PhraseBar phrase={phrase} />}
      {playhead && <Playhead />}
    </div>
  );
}
