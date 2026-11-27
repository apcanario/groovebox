/**
 * The six punch pads (T3 slice b, spec 9.4): Cut, Filter, Stutter, Echo, Wash and Riser. On a phone they are the Punch
 * page of the Mix tab, two rows of three; on both tablet layouts they are the band over the pad grid (or the lanes).
 *
 * A pad is a pointer target, not a click: pressed when the first finger lands, let go when the last lifts or its pointer
 * is cancelled (pointer capture keeps a finger that slides off on its pad until it lifts), any number at once (spec 9.6).
 * Pads that leave the screen (a page change, a rotation) are let go. Stopped, a press does nothing: the engine ignores
 * it and the pad stays dark. The look comes from the engine on every render (each step) and on each touch: hatched
 * while waiting for its start line, filled while in, with a white inset line while a finger holds it.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import { PUNCH_PADS, type PunchPad } from "../engine/index.ts";
import type { Ctx } from "./App.tsx";
import { Icon } from "./icons.tsx";
import { PadPointers, punchLook } from "./logic.ts";

export const PUNCH_NAME: Record<PunchPad, "Cut" | "Filter" | "Stutter" | "Echo" | "Wash" | "Riser"> = {
  cut: "Cut",
  filter: "Filter",
  stutter: "Stutter",
  echo: "Echo",
  wash: "Wash",
  riser: "Riser",
};

const PUNCH_COLOR: Record<PunchPad, string> = {
  cut: "var(--coral)",
  filter: "var(--orange)",
  stutter: "var(--teal)",
  echo: "var(--blue)",
  wash: "var(--purple)",
  riser: "var(--yellow)",
};

/**
 * The word a pad shows. Simple keeps Advanced's words off the screen (P2: "Filter" is one; Simple's master filter dial
 * is Tone), so there the Filter pad reads Sweep, with the same icon; Advanced shows the spec's names.
 */
export function punchWord(pad: PunchPad, advanced: boolean): string {
  return !advanced && pad === "filter" ? "Sweep" : PUNCH_NAME[pad];
}

const HOW: Record<PunchPad, string> = {
  cut: "hold: drums and bass out, back on the next bar",
  filter: "hold: the filter sweeps down, opens on the next beat",
  stutter: "hold: the last half beat repeats",
  echo: "tap: the mix into the echo for a bar",
  wash: "tap: the mix into the reverb for a bar",
  riser: "hold: a noise riser sweeps up",
};

/** `band`: the tablet band (one row of six); otherwise the phone's Mix page (two rows of three). */
export function PunchPads({ ctx, band = false }: { ctx: Ctx; band?: boolean }) {
  const { engine } = ctx;
  const fingers = useRef(new PadPointers<PunchPad>());
  const [, touched] = useState(0);
  // Pads leaving the screen with a finger on them are let go, so none stays held.
  useEffect(
    () => () => {
      for (const pad of fingers.current.clear()) engine.punch(pad, false);
    },
    [engine],
  );
  const states = engine.punchState();
  const now = states.some((s) => s.start !== null) ? engine.audioNow() : 0;
  const press = (pad: PunchPad, e: PointerEvent): void => {
    e.preventDefault();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer knows: the press still counts.
    }
    if (fingers.current.down(pad, e.pointerId)) engine.punch(pad, true);
    touched((n) => n + 1);
  };
  const lift = (e: PointerEvent): void => {
    const pad = fingers.current.up(e.pointerId);
    if (pad) engine.punch(pad, false);
    touched((n) => n + 1);
  };
  return (
    <div class={`punchpads${band ? " punchslot" : ""}`} data-punch-slot={band ? "" : undefined} data-punchpads={band ? "band" : "page"}>
      {PUNCH_PADS.map((pad) => {
        const s = states.find((x) => x.pad === pad) ?? { held: false, start: null, end: null };
        const look = punchLook(s, now);
        const lit = look === "on" || look === "ending";
        return (
          <button
            key={pad}
            class={`tog punchpad ${lit ? "on" : "off"}${look === "pending" ? " pending" : ""}${s.held ? " held" : ""}`}
            style={{ "--c": PUNCH_COLOR[pad] }}
            data-punch={pad}
            data-look={look}
            aria-pressed={s.held || lit}
            data-word={punchWord(pad, ctx.advanced)}
            aria-label={`${punchWord(pad, ctx.advanced)}, ${HOW[pad]}`}
            onPointerDown={(e) => press(pad, e)}
            onPointerUp={lift}
            onPointerCancel={lift}
            onLostPointerCapture={lift}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Icon thing={PUNCH_NAME[pad]} />
            <b>{punchWord(pad, ctx.advanced)}</b>
          </button>
        );
      })}
    </div>
  );
}
