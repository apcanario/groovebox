/**
 * Effects on the instrument tabs (P9, spec 8.8). Simple: the instrument's two slots as two large on/off buttons,
 * each carrying its effect's icon and name; nothing to adjust. Advanced: the FX page, for one slot at a time (the
 * two slot chips at the top): the on/off, the picker of the twelve effects and the effect's three knobs. Every control
 * writes the song's slots through the engine, which crossfades, so a switch never clicks.
 */
import { useState } from "preact/hooks";
import { EFFECTS, EFFECT_DEFS, type EffectId, type FxKnobs, type InstrumentId } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Dial, GroupLabel, Sheet } from "../components.tsx";
import { Icon, type IconThing } from "../icons.tsx";
import { INST_COLOR } from "../theme.tsx";

const fxName = (e: EffectId): string => EFFECT_DEFS[e].name;

function slotsOf(ctx: Ctx, inst: InstrumentId) {
  return ctx.engine.getFx()[inst];
}

/** One slot's on/off: filled in the instrument's colour when on, dark with its colour's edge when off (spec 8.12). */
function FxButton({ ctx, inst, slot, onOff = false }: { ctx: Ctx; inst: InstrumentId; slot: number; onOff?: boolean }) {
  const s = slotsOf(ctx, inst)[slot];
  const name = fxName(s.effect);
  return (
    <button
      class={`tog fxbtn${s.on ? " on" : " off"}`}
      style={{ "--c": INST_COLOR[inst] }}
      role="switch"
      aria-checked={s.on}
      aria-label={`${name} ${s.on ? "on" : "off"}`}
      data-fx={`${inst}:${slot}`}
      onClick={() => ctx.engine.setFx(inst, slot, { on: !s.on })}
    >
      <Icon thing={name as IconThing} />
      <span>{onOff ? (s.on ? "On" : "Off") : name}</span>
    </button>
  );
}

/**
 * Simple (spec 8.3, 8.8): the instrument's two effects as two on/off buttons, in a row, stacked (`column`), or
 * without a box of their own (`bare`: they join the row they are put in).
 */
export function FxButtons({ ctx, inst, column = false, bare = false }: { ctx: Ctx; inst: InstrumentId; column?: boolean; bare?: boolean }) {
  const both = (
    <>
      <FxButton ctx={ctx} inst={inst} slot={0} />
      <FxButton ctx={ctx} inst={inst} slot={1} />
    </>
  );
  return bare ? both : <div class={`fxrow${column ? " column" : ""}`}>{both}</div>;
}

/** The sheet that picks a slot's effect from all twelve. */
function FxPicker({ ctx, inst, slot, onClose }: { ctx: Ctx; inst: InstrumentId; slot: number; onClose: () => void }) {
  const s = slotsOf(ctx, inst)[slot];
  return (
    <Sheet onClose={onClose}>
      <h2>Slot {slot + 1} effect</h2>
      <div class="fxgrid" style={{ "--chip": INST_COLOR[inst] }}>
        {EFFECTS.map((e) => (
          <button
            key={e}
            class={`chip${e === s.effect ? " on" : ""}`}
            data-fxeffect={e}
            aria-pressed={e === s.effect}
            onClick={() => {
              ctx.engine.setFx(inst, slot, { effect: e });
              onClose();
            }}
          >
            <Icon thing={fxName(e) as IconThing} />
            <span>{fxName(e)}</span>
          </button>
        ))}
      </div>
      <button class="btn wide" id="fx-close" onClick={onClose}>
        Close
      </button>
    </Sheet>
  );
}

/** One slot's row: its on/off, its effect (a tap opens the picker) and its three knobs. */
function FxSlotRow({ ctx, inst, slot }: { ctx: Ctx; inst: InstrumentId; slot: number }) {
  const [picking, setPicking] = useState(false);
  const s = slotsOf(ctx, inst)[slot];
  const def = EFFECT_DEFS[s.effect];
  const set = (i: number, v: number): void => {
    const k = [...s.knobs] as FxKnobs;
    k[i] = v;
    ctx.engine.setFx(inst, slot, { knobs: k });
  };
  return (
    <>
      <div class="dials n5 fxdials">
        <FxButton ctx={ctx} inst={inst} slot={slot} onOff />
        <button class="btn fxpick" data-fxpick={`${inst}:${slot}`} aria-label={`Effect of slot ${slot + 1}: ${def.name}. Tap to choose another`} onClick={() => setPicking(true)}>
          <span>Effect</span>
          <b>{def.name}</b>
        </button>
        {def.knobs.map((k, i) => (
          <Dial
            key={`${s.effect}:${i}`}
            id={`${inst}:fx${slot}:${i}`}
            label={k.label}
            value={s.knobs[i]}
            min={0}
            max={1}
            display={k.text(s.knobs[i])}
            color={INST_COLOR[inst]}
            onChange={(v) => set(i, v)}
          />
        ))}
      </div>
      {picking && <FxPicker ctx={ctx} inst={inst} slot={slot} onClose={() => setPicking(false)} />}
    </>
  );
}

/**
 * Advanced: the FX page of an instrument tab. The two slot chips choose the slot shown; under them its on/off, its
 * effect (a tap opens the picker of all twelve as a sheet, so the page fits a short phone) and its three knobs.
 */
export function FxPage({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const [slot, setSlot] = useState(0);
  const slots = slotsOf(ctx, inst);
  return (
    <>
      <div class="seg two fxslots">
        {slots.map((x, i) => (
          <button key={i} class={i === slot ? "on" : ""} data-fxslot={`${inst}:${i}`} aria-pressed={i === slot} onClick={() => setSlot(i)}>
            <span>
              Slot {i + 1} · {fxName(x.effect)}
            </span>
          </button>
        ))}
      </div>
      <FxSlotRow ctx={ctx} inst={inst} slot={slot} key={slot} />
    </>
  );
}

/** T2 (spec 9.2): the whole panel on the desk shows both slots at once, each a heading over its row. */
export function FxSlots({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  return (
    <div class="grp fxboth" data-grp="fx">
      {[0, 1].map((i) => (
        <div class="fxslot" key={i}>
          <GroupLabel thing="FX">Slot {i + 1}</GroupLabel>
          <FxSlotRow ctx={ctx} inst={inst} slot={i} />
        </div>
      ))}
    </div>
  );
}
