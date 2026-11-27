/**
 * Morph (spec 8.11, 8.12): the on/off button beside DROP on the Play tab, and the Morph page of the Mix tab (Advanced:
 * a switch per thing it may move, Speed and Depth). On, its icon turns slowly (a quarter turn a bar). A tap acts from
 * the next bar line; Morph never moves a control a hand moved in the last 16 bars.
 */
import { MORPH_THINGS, type Engine, type MorphThing } from "../engine/index.ts";
import type { Ctx } from "./App.tsx";
import { Dial } from "./components.tsx";
import { Icon } from "./icons.tsx";
import { morphHelp } from "./logic.ts";

export function MorphButton({ ctx }: { ctx: Ctx }) {
  const { engine, pos } = ctx;
  const on = engine.morphPlan().on;
  return (
    <button
      id="morph"
      class={`tog morph ${on ? "on" : "off"}`}
      style={{ "--c": "var(--purple)", "--mb": pos.bar % 4 }}
      role="switch"
      aria-checked={on}
      aria-label={`Morph ${on ? "on" : "off"}: the jam changes by itself, slowly`}
      data-morph={on ? "on" : "off"}
      onClick={() => engine.setMorph({ on: !on })}
    >
      <span class="mword">
        <Icon thing="Morph" />
        <b>Morph</b>
      </span>
      <small>{on ? "On" : "Off"}</small>
    </button>
  );
}

/** What each switch of the Morph page moves, in plain words. */
export const MORPH_NAME: Record<MorphThing, string> = {
  sound: "Sound",
  leads: "Leads",
  voicing: "Voicing",
  instruments: "Drop-outs",
  sections: "Sections",
};

/** The Speed dial (Simple shows it on the Mix tab's Master page; Advanced on the Morph page). */
export function MorphSpeed({ engine, label = "Speed" }: { engine: Engine; label?: string }) {
  const p = engine.morphPlan();
  return <Dial id="morphSpeed" label={label} value={p.speed} min={0} max={1} color="var(--purple)" onChange={(v) => engine.setMorph({ speed: Math.round(v * 100) / 100 })} />;
}

/** The Morph page (Advanced): a switch per thing it may move, the speed and the depth. */
export function MorphPage({ engine, brief = false }: { engine: Engine; brief?: boolean }) {
  const p = engine.morphPlan();
  return (
    <div class="morphpage">
      <div class="morphthings">
        {MORPH_THINGS.map((k) => (
          <button
            key={k}
            class={`tog fxbtn ${p.moves[k] ? "on" : "off"}`}
            style={{ "--c": "var(--purple)" }}
            role="switch"
            aria-checked={p.moves[k]}
            aria-label={`Morph moves ${MORPH_NAME[k].toLowerCase()}: ${p.moves[k] ? "on" : "off"}`}
            data-morphthing={k}
            onClick={() => engine.setMorph({ moves: { [k]: !p.moves[k] } })}
          >
            <span>{MORPH_NAME[k]}</span>
          </button>
        ))}
      </div>
      <div class="dials n2">
        <MorphSpeed engine={engine} />
        <Dial id="morphDepth" label="Depth" value={p.depth} min={0} max={1} color="var(--purple)" onChange={(v) => engine.setMorph({ depth: Math.round(v * 100) / 100 })} />
      </div>
      {!brief && <p class="note" id="morph-help">{morphHelp(p.moves.sections, p.recipe.sections)}</p>}
    </div>
  );
}
