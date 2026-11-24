/**
 * The DROP button (spec 8.9, 8.12): a full-width yellow tile with its icon and four bar segments. A press is never
 * immediate: armed, it shows as queued for the next bar (the hatched frame); during the build it fills from the left
 * with marching stripes while the segments and the number count the bars down; while the drop is on it is lit with a
 * slow wide band; during the wind-down it drains. It reads the engine's heard state on every render (each step).
 */
import type { Ctx } from "./App.tsx";
import { Icon } from "./icons.tsx";
import { dropLabel, dropSegments } from "./logic.ts";

export function DropButton({ ctx }: { ctx: Ctx }) {
  const { engine, pos } = ctx;
  const v = engine.dropShown();
  const counting = v.phase === "build" || v.phase === "wind" || (v.phase === "off" && v.intent === "on");
  const lit = dropSegments(v);
  return (
    <button
      id="drop"
      class={`drop ${v.phase}${v.intent !== "none" ? " pending" : ""}`}
      data-drop={v.phase}
      data-intent={v.intent}
      data-left={v.barsLeft}
      style={{ "--di": v.index, "--dl": Math.max(1, v.length), "--db": pos.bar % 4 }}
      aria-pressed={v.phase !== "off"}
      aria-label={dropLabel(v, pos.playing)}
      onClick={() => engine.drop()}
    >
      <i class="dfill" aria-hidden="true" />
      <i class="dring" aria-hidden="true" />
      <Icon thing="DROP" />
      <b>DROP</b>
      {counting && (
        <em class="dleft" data-nofit>
          {v.barsLeft}
        </em>
      )}
      <span class="segs" aria-hidden="true" data-nofit>
        {[0, 1, 2, 3].map((i) => (
          <i key={i} class={i < lit ? "lit" : ""} />
        ))}
      </span>
    </button>
  );
}
