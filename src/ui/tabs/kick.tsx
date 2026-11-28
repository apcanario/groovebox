/**
 * F2 (spec 10.5): the kick quadrant and the kick's Advanced voice controls. The quadrant takes the Drums XY pad's place
 * in both modes (up Punch, right Length); Advanced adds Click and the Root switch beside Tune (the Pitch dial as built).
 * Every move goes through the engine, which reads the kick's settings when a hit starts: the quadrant acts from the next
 * kick and never steps one that sounds, so it never clicks. No Tone.js here (CLAUDE.md).
 */
import type { Ctx } from "../App.tsx";
import { Dial, XYPad } from "../components.tsx";
import { KICK_CLICK_KNOB, kickPad, kickPadMove, kickRootOn, knobPos, knobText, simpleXYReadout } from "../logic.ts";
import { kickSetting } from "../../music/kick.ts";
import { INST_COLOR } from "../theme.tsx";

/** The kick quadrant: up is Punch, right is Length. Its readout is Length · Punch, 0..100, as the other pads read. */
export function KickPad({ ctx }: { ctx: Ctx }) {
  const { x, y } = kickPad(ctx.song.patches.drums);
  return (
    <XYPad
      id="kick"
      x={x}
      y={y}
      xLabel="Length"
      yLabel="Punch"
      readout={simpleXYReadout(x, y)}
      onChange={(nx, ny) => ctx.engine.setParams("drums", kickPadMove(nx, ny))}
    />
  );
}

/** Advanced: the click's level. */
export function ClickDial({ ctx }: { ctx: Ctx }) {
  const v = kickSetting(ctx.song.patches.drums, "kickClick");
  return (
    <Dial
      id="drums:kickClick"
      label={KICK_CLICK_KNOB.label}
      value={knobPos(KICK_CLICK_KNOB, v)}
      min={0}
      max={1}
      display={knobText(KICK_CLICK_KNOB, v)}
      color={INST_COLOR.drums}
      onChange={(p) => ctx.engine.setParam("drums", "kickClick", p)}
    />
  );
}

/** Advanced: the Root switch. On, the kick's body sits on the song's root; off, Tune sets it. */
export function RootSwitch({ ctx }: { ctx: Ctx }) {
  const on = kickRootOn(ctx.song.patches.drums);
  return (
    <button
      class={`rootsw${on ? " on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={on ? "Root: the kick is tuned to the song's root; tap for Tune" : "Root off: Tune sets the kick; tap to tune it to the song's root"}
      data-kickroot="drums"
      onClick={() => ctx.engine.setParam("drums", "kickRoot", on ? 0 : 1)}
    >
      <b>Root</b>
      <span>{on ? "On" : "Off"}</span>
    </button>
  );
}
