/**
 * Layer 1 and Layer 2 in Advanced (G4, laid out anew in P6 after docs/design/look/ phone 3): the name with Back and
 * New idea, the mode switch with the on/off switch, in Lead the style selector, the layer's lane across the width
 * (the step row: notes drawn by their length, the phrase's bar under them), then the page chips and the page (Lead:
 * Notes and Feel of six dials, Pulse's own three while the style is Pulse; Arp: direction, rate, octaves and gate;
 * Pad: four dials; Sound: the patch dials the modes share), and the filter XY pad and sends lowest.
 * Patterns belong to the edited section; the patch belongs to the instrument. Nothing scrolls (P1): on a short
 * screen the name row gives way (Back and New idea sit beside the lane) and the XY pad and sends get a Filter page.
 */
import { useState } from "preact/hooks";
import { ARP_DIRECTIONS, LAYER_MODES, VOICING_STEPS, WAVES, voicingShift, type ArpDirection, type LayerInstrument } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Chips, Dial, GroupLabel, Pager } from "../components.tsx";
import {
  ARP_DIRECTION_LABEL,
  ARP_OCTAVES,
  ARP_RATES,
  ARP_RATE_LABEL,
  LAYER_MODE_LABEL,
  LAYER_MODE_ORDER,
  LAYER_PATCH_KNOBS,
  MOD_KNOBS,
  PAD_KNOBS,
  WAVE_LABEL,
  knobPos,
  knobLabel,
  knobText,
  knobValue,
  sectionLetter,
  shownPage,
  withFilterPage,
  type PageDef,
} from "../logic.ts";
import { INST_COLOR } from "../theme.tsx";
import { FilterPanel, FilterXY, HeadRow, InstToggle } from "./InstrumentTab.tsx";
import { Icon } from "../icons.tsx";
import { Lane } from "../lanes.tsx";
import { SeedButtons, SoundPicker } from "./SimpleTab.tsx";
import { LeadDials, LeadStyles, leadStyleOf, type LeadPage } from "./lead.tsx";
import { FxPage, FxSlots } from "./fx.tsx";
import { useFull } from "./full.ts";
import { SendBar } from "../components.tsx";

function Arp({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { engine, song, edit } = ctx;
  const arp = song.sections[edit][id].arp;
  const rates = ARP_RATES.map(String);
  const octs = ARP_OCTAVES.map(String);
  return (
    <>
      <GroupLabel thing="Direction" />
      <Chips
        name="arpdir"
        options={ARP_DIRECTIONS}
        value={arp.direction}
        label={(d: ArpDirection) => ARP_DIRECTION_LABEL[d]}
        onPick={(d) => engine.setArp(edit, id, { direction: d })}
      />
      <div class="arprow">
        <div class="group">
          <GroupLabel thing="Rate" />
          <Chips
            name="arprate"
            options={rates}
            value={String(arp.rate)}
            label={(r) => ARP_RATE_LABEL[Number(r)]}
            onPick={(r) => engine.setArp(edit, id, { rate: Number(r) as 1 | 2 | 4 })}
          />
        </div>
        <div class="group">
          <GroupLabel thing="Octaves" />
          <Chips
            name="arpoct"
            options={octs}
            value={String(arp.octaves)}
            label={(o) => `${o} oct`}
            onPick={(o) => engine.setArp(edit, id, { octaves: Number(o) as 1 | 2 | 3 })}
          />
        </div>
      </div>
      <div class="dials n1">
        <Dial
          id={`${id}:arp:gate`}
          label="Gate"
          value={arp.gate}
          min={0.1}
          max={1}
          display={String(Math.round(arp.gate * 100))}
          color={INST_COLOR[id]}
          onChange={(v) => engine.setArp(edit, id, { gate: v })}
        />
      </div>
    </>
  );
}

/** P11: the voicing dial's value as inversions from the chord as written: "0", "+1", "-2". */
function voicingText(v: number | undefined): string {
  const s = voicingShift(v);
  return s > 0 ? `+${s}` : String(s);
}

/** Pad and Drone (P7): attack, release, brightness, motion and Swoop, and (P11) Voicing; a drone also picks root alone or root and fifth. */
function Pad({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { engine, song, edit } = ctx;
  const layer = song.sections[edit][id];
  const pad = layer.pad;
  const value = (k: (typeof PAD_KNOBS)[number]): number => (k.key === "swoop" ? (pad.swoop ?? 0) : pad[k.key]);
  return (
    <>
      {layer.mode === "drone" && (
        <>
          <GroupLabel thing="Drone" />
          <Chips
            name="dronefifth"
            options={["root", "fifth"] as const}
            value={layer.drone?.fifth === false ? "root" : "fifth"}
            label={(v) => (v === "root" ? "Root" : "Root + fifth")}
            onPick={(v) => engine.setDrone(edit, id, { fifth: v === "fifth" })}
          />
        </>
      )}
      <div class="dials n6 row">
        {PAD_KNOBS.map((k) => (
          <Dial
            key={k.key}
            id={`${id}:pad:${k.key}`}
            label={knobLabel(k)}
            value={knobPos(k, value(k))}
            min={0}
            max={1}
            display={knobText(k, value(k))}
            color={INST_COLOR[id]}
            onChange={(p) => engine.setPad(edit, id, { [k.key]: knobValue(k, p) })}
          />
        ))}
        {/* P11 (spec 8.11): voicing and register, an inversion a step (Morph moves it at phrase ends). */}
        <Dial
          id={`${id}:pad:voicing`}
          label="Voicing"
          value={pad.voicing ?? 0.5}
          min={0}
          max={1}
          step={1 / (2 * VOICING_STEPS)}
          display={voicingText(pad.voicing)}
          color={INST_COLOR[id]}
          onChange={(v) => engine.setPad(edit, id, { voicing: Math.round(v * 2 * VOICING_STEPS) / (2 * VOICING_STEPS) })}
        />
      </div>
    </>
  );
}

/** P7: the wave, the FM wave's dials, the synced filter LFO and the slow drift (the Mod page). */
function Mod({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const patch = ctx.song.patches[id];
  return (
    <>
      <GroupLabel thing="Wave" />
      <Chips
        name="wave"
        options={WAVES}
        value={patch.wave}
        label={(w) => WAVE_LABEL[w]}
        onPick={(w) => ctx.engine.setParam(id, "wave", w)}
      />
      <div class="dials n6 row">
        {MOD_KNOBS.map((k) => (
          <Dial
            key={k.key}
            id={`${id}:${k.key}`}
            label={knobLabel(k)}
            value={knobPos(k, patch[k.key])}
            min={0}
            max={1}
            display={knobText(k, patch[k.key])}
            color={INST_COLOR[id]}
            onChange={(p) => ctx.engine.setParam(id, k.key, knobValue(k, p))}
          />
        ))}
      </div>
    </>
  );
}

/** The patch dials shared by every mode: wave, envelope, drive. */
function Sound({ ctx, id, mode, whole = false }: { ctx: Ctx; id: LayerInstrument; mode: string; whole?: boolean }) {
  const roomy = ctx.roomy && !whole;
  const { engine, song } = ctx;
  const patch = song.patches[id];
  return (
    <>
      {/* P7: the Sound picker (C8) sits where the wave chips were; the waves are on the Mod page. */}
      <SoundPicker ctx={ctx} inst={id} />
      {roomy && (mode === "pad" || mode === "drone") && <p class="note">Attack and release: the Pad page. Wave: the Mod page.</p>}
      <div class="dials n5">
        {LAYER_PATCH_KNOBS.map((k) => (
          <Dial
            key={k.key}
            id={`${id}:${k.key}`}
            label={knobLabel(k)}
            value={knobPos(k, patch[k.key])}
            min={0}
            max={1}
            display={knobText(k, patch[k.key])}
            color={INST_COLOR[id]}
            onChange={(p) => engine.setParam(id, k.key, knobValue(k, p))}
          />
        ))}
      </div>
    </>
  );
}

type LayerPage = "pattern" | LeadPage | "sound" | "mod" | "fx" | "filter";

/** The mode switch (Lead, Arp, Pad), with the layer's on/off switch at its end where `toggle` is set. */
export function ModeRow({ ctx, id, toggle }: { ctx: Ctx; id: LayerInstrument; toggle: boolean }) {
  const { engine, edit } = ctx;
  const layer = ctx.song.sections[edit][id];
  return (
    <div class={`modes${toggle ? " withtog" : ""}`}>
      <div class="modegroup" role="radiogroup" aria-label="Mode">
        {LAYER_MODE_ORDER.filter((m) => (LAYER_MODES as readonly string[]).includes(m)).map((m) => (
          <button
            key={m}
            class={`mode${layer.mode === m ? " on" : ""}`}
            data-mode={`${id}:${m}`}
            role="radio"
            aria-checked={layer.mode === m}
            onClick={() => engine.setLayerMode(edit, id, m)}
          >
            <Icon thing={LAYER_MODE_LABEL[m]} />
            <span>{LAYER_MODE_LABEL[m]}</span>
          </button>
        ))}
      </div>
      {toggle && <InstToggle ctx={ctx} inst={id} />}
    </div>
  );
}

/**
 * Advanced Layer (P6, docs/design/look/ phone 3): the name with Back and New idea; the mode switch with the
 * on/off switch; in Lead, the style selector; the lane across the whole width with the phrase's bar under it;
 * the page chips (Lead: Notes, Feel, Pulse's own page when the style is Pulse; then Sound); the page; the XY pad
 * and sends lowest. On a short screen the name row gives way: Back and New idea sit beside the lane, and the
 * XY pad and sends get a Filter page.
 */
export function LayerTab({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const layer = ctx.song.sections[ctx.edit][id];
  const lead = layer.mode === "generative";
  const pulse = lead && leadStyleOf(ctx, id) === "pulse";
  // T2 (spec 9.2): on the desk every page at once where it fits; the shape is what changes the panel's content.
  const [full, ref] = useFull(ctx, `${id}:${layer.mode}:${pulse ? "pulse" : ""}`);
  return full ? <WholeLayer ctx={ctx} id={id} sref={ref} /> : <PagedLayer ctx={ctx} id={id} sref={ref} />;
}

/**
 * T2 (spec 9.2): a layer whole, on the desk. The mode switch with the on/off switch, in Lead the style selector, the
 * lane with Back and New idea; then two columns: the patch (Sound, Mod with the wave, both effect slots, the sends) and
 * what it plays (Lead: Notes, Feel and Pulse's own dials; Arp: direction, rate, octaves and gate; Pad and Drone: their
 * dials) over the XY pad, bottom right in thumb reach (spec 9.1). Where the panel is narrow the columns stack.
 */
function WholeLayer({ ctx, id, sref }: { ctx: Ctx; id: LayerInstrument; sref: { current: HTMLElement | null } }) {
  const { edit } = ctx;
  const layer = ctx.song.sections[edit][id];
  const lead = layer.mode === "generative";
  const pulse = lead && leadStyleOf(ctx, id) === "pulse";
  const patch = ctx.song.patches[id];
  return (
    <section
      ref={sref}
      class={`insttab layertab adv whole${lead ? " lead" : ""}`}
      data-whole={id}
      style={{ "--c": INST_COLOR[id], "--chip": INST_COLOR[id] }}
    >
      <ModeRow ctx={ctx} id={id} toggle />
      {lead && <LeadStyles ctx={ctx} id={id} />}
      <div class="lanerow">
        <Lane id={id} lanes={ctx.lanes} playhead section={edit} />
        <SeedButtons ctx={ctx} id={id} />
      </div>
      <div class="cols">
        <div class="col patchcol">
          <div class="grp" data-grp="sound">
            <Sound ctx={ctx} id={id} mode={layer.mode} whole />
          </div>
          <div class="grp" data-grp="mod">
            <Mod ctx={ctx} id={id} />
          </div>
          <FxSlots ctx={ctx} inst={id} />
          <div class="sends" data-grp="sends">
            <SendBar label="Delay" value={patch.delay} color="var(--blue)" onChange={(v) => ctx.engine.setParam(id, "delay", v)} />
            <SendBar label="Reverb" value={patch.reverb} color="var(--teal)" onChange={(v) => ctx.engine.setParam(id, "reverb", v)} />
          </div>
        </div>
        <div class="col playcol">
          {lead && (
            <>
              <div class="grp" data-grp="notes">
                <GroupLabel thing="Notes" />
                <LeadDials ctx={ctx} id={id} page="notes" />
              </div>
              <div class="grp" data-grp="feel">
                <GroupLabel thing="Feel" />
                <LeadDials ctx={ctx} id={id} page="feel" />
              </div>
              {pulse && (
                <div class="grp" data-grp="pulse">
                  <GroupLabel thing="Pulse" />
                  <LeadDials ctx={ctx} id={id} page="pulse" />
                </div>
              )}
            </>
          )}
          {layer.mode === "arp" && (
            <div class="grp" data-grp="pattern">
              <Arp ctx={ctx} id={id} />
            </div>
          )}
          {(layer.mode === "pad" || layer.mode === "drone") && (
            <div class="grp" data-grp="pattern">
              {layer.mode === "pad" && <GroupLabel thing="Pad" />}
              <Pad ctx={ctx} id={id} />
            </div>
          )}
          <FilterXY ctx={ctx} inst={id} />
        </div>
      </div>
    </section>
  );
}

function PagedLayer({ ctx, id, sref }: { ctx: Ctx; id: LayerInstrument; sref: { current: HTMLElement | null } }) {
  const { edit, roomy } = ctx;
  const [chosen, setPage] = useState<LayerPage>("notes");
  const layer = ctx.song.sections[edit][id];
  const lead = layer.mode === "generative";
  const pulse = lead && leadStyleOf(ctx, id) === "pulse";
  // On a short screen the first page chip names the edited section (the name row gives way), unless six chips or
  // more share the row (Lead): there the strip's Editing mark says it.
  // P9: with the FX page a Lead has six chips or more, so there too the strip's mark says it.
  const short = (label: string) => (roomy || lead ? label : `${label} · ${sectionLetter(edit)}`);
  const base: PageDef<LayerPage>[] = lead
    ? [["notes", short("Notes")], ["feel", "Feel"], ...(pulse ? [["pulse", "Pulse"] as PageDef<LayerPage>] : []), ["sound", "Sound"], ["mod", "Mod"], ["fx", "FX"]]
    : [["pattern", short(LAYER_MODE_LABEL[layer.mode])], ["sound", "Sound"], ["mod", "Mod"], ["fx", "FX"]];
  const pages = withFilterPage(base, roomy);
  // The chosen page while it exists; the first page of the mode otherwise (Notes stays chosen across modes).
  const page = shownPage(pages, chosen === "pattern" && lead ? "notes" : (chosen === "notes" || chosen === "feel" || chosen === "pulse") && !lead ? "pattern" : chosen);
  return (
    <section ref={sref} class={`insttab layertab adv${roomy ? " roomy" : ""}${lead ? " lead" : ""}`} style={{ "--c": INST_COLOR[id], "--chip": INST_COLOR[id] }}>
      {roomy && (
        <HeadRow ctx={ctx} inst={id}>
          <div class="seedpair">
            <SeedButtons ctx={ctx} id={id} />
          </div>
        </HeadRow>
      )}
      <ModeRow ctx={ctx} id={id} toggle />
      {lead && <LeadStyles ctx={ctx} id={id} />}
      {roomy ? (
        <Lane id={id} lanes={ctx.lanes} playhead section={edit} />
      ) : (
        <div class="lanerow">
          <Lane id={id} lanes={ctx.lanes} playhead section={edit} />
          <SeedButtons ctx={ctx} id={id} />
        </div>
      )}
      <Pager id={id} pages={pages} page={page} onPage={setPage} />
      {page !== "filter" && (
        <div class="page" data-shown={`${id}:${page}`}>
          {lead && (page === "notes" || page === "feel" || page === "pulse") && <LeadDials ctx={ctx} id={id} page={page} />}
          {page === "pattern" && layer.mode === "arp" && <Arp ctx={ctx} id={id} />}
          {page === "pattern" && (layer.mode === "pad" || layer.mode === "drone") && <Pad ctx={ctx} id={id} />}
          {page === "mod" && <Mod ctx={ctx} id={id} />}
          {page === "sound" && <Sound ctx={ctx} id={id} mode={layer.mode} />}
          {page === "fx" && <FxPage ctx={ctx} inst={id} />}
        </div>
      )}
      {(roomy || page === "filter") && <FilterPanel ctx={ctx} inst={id} />}
    </section>
  );
}
