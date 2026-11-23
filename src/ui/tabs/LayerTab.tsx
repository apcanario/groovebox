/**
 * Layer 1 and Layer 2 (G4), laid out after docs/design/look/: title and on/off, the mode switch, the
 * layer's lane (P1b), Back and New idea (P2), the mode's controls (Lead: six dials; Arp: direction,
 * rate, octaves and gate; Pad: four dials), then the filter XY pad and the sends. A second page,
 * Sound (its switch below the sends), holds the patch dials the three modes share (wave, envelope, drive).
 * Patterns belong to the edited section; the patch belongs to the instrument. Nothing scrolls (P1):
 * the page chips sit at the top, and on a short screen the XY pad and sends get a Filter page.
 */
import { useState } from "preact/hooks";
import { ARP_DIRECTIONS, LAYER_MODES, WAVES, type ArpDirection, type LayerInstrument } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Chips, Dial, GroupLabel, Pager } from "../components.tsx";
import {
  ARP_DIRECTION_LABEL,
  ARP_OCTAVES,
  ARP_RATES,
  ARP_RATE_LABEL,
  GEN_KNOBS,
  LAYER_MODE_LABEL,
  LAYER_MODE_ORDER,
  LAYER_PATCH_KNOBS,
  PAD_KNOBS,
  WAVE_LABEL,
  genText,
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
import { FilterPanel, HeadRow, InstToggle } from "./InstrumentTab.tsx";
import { Icon } from "../icons.tsx";
import { Lane } from "../lanes.tsx";
import { SeedButtons } from "./SimpleTab.tsx";

function Generative({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { engine, song, edit } = ctx;
  const gen = song.sections[edit][id].gen;
  return (
    <>
      <div class="dials n6">
        {GEN_KNOBS.map((k) => (
          <Dial
            key={k.key}
            id={`${id}:gen:${k.key}`}
            label={k.label}
            value={gen[k.key]}
            min={k.min}
            max={k.max}
            step={k.step}
            display={genText(k, gen[k.key])}
            color={k.color}
            onChange={(v) => engine.setGen(edit, id, { [k.key]: v })}
          />
        ))}
      </div>
    </>
  );
}

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

function Pad({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { engine, song, edit } = ctx;
  const pad = song.sections[edit][id].pad;
  return (
    <div class="dials n4">
      {PAD_KNOBS.map((k) => (
        <Dial
          key={k.key}
          id={`${id}:pad:${k.key}`}
          label={knobLabel(k)}
          value={knobPos(k, pad[k.key])}
          min={0}
          max={1}
          display={knobText(k, pad[k.key])}
          color={INST_COLOR[id]}
          onChange={(p) => engine.setPad(edit, id, { [k.key]: knobValue(k, p) })}
        />
      ))}
    </div>
  );
}

/** The patch dials shared by every mode: wave, envelope, drive. */
function Sound({ ctx, id, mode }: { ctx: Ctx; id: LayerInstrument; mode: string }) {
  const { roomy } = ctx;
  const { engine, song } = ctx;
  const patch = song.patches[id];
  return (
    <>
      <GroupLabel thing="Wave" split={roomy && mode === "pad" ? "Attack and release: the Pad page" : undefined} />
      <Chips
        name="wave"
        options={WAVES}
        value={patch.wave}
        label={(w) => WAVE_LABEL[w]}
        onPick={(w) => engine.setParam(id, "wave", w)}
      />
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

type LayerPage = "pattern" | "sound" | "filter";

export function LayerTab({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { engine, edit, roomy } = ctx;
  const [chosen, setPage] = useState<LayerPage>("pattern");
  const layer = ctx.song.sections[edit][id];
  const base: PageDef<LayerPage>[] = [
    // On a short screen the name row gives way: the page chip names the edited section, as on Chords.
    ["pattern", roomy ? LAYER_MODE_LABEL[layer.mode] : `${LAYER_MODE_LABEL[layer.mode]} · ${sectionLetter(edit)}`],
    ["sound", "Sound"],
  ];
  const pages = withFilterPage(base, roomy);
  const page = shownPage(pages, chosen);
  return (
    <section class={`insttab layertab${roomy ? " roomy" : ""}`} style={{ "--c": INST_COLOR[id], "--chip": INST_COLOR[id] }}>
      {/* On a short screen the name row gives way: the on/off switch joins the mode row. */}
      {roomy && <HeadRow ctx={ctx} inst={id} />}
      <div class={`modes${roomy ? "" : " withtog"}`}>
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
        {!roomy && <InstToggle ctx={ctx} inst={id} />}
      </div>
      {/* The layer's lane, with Back and New idea beside it (spec 8.3: in both modes). */}
      <div class="lanerow">
        <Lane id={id} lanes={ctx.lanes} playhead />
        <SeedButtons ctx={ctx} id={id} />
      </div>
      <Pager id={id} pages={pages} page={page} onPage={setPage} />
      {page !== "filter" && (
        <div class="page" data-shown={`${id}:${page}`}>
          {page === "pattern" && layer.mode === "generative" && <Generative ctx={ctx} id={id} />}
          {page === "pattern" && layer.mode === "arp" && <Arp ctx={ctx} id={id} />}
          {page === "pattern" && layer.mode === "pad" && <Pad ctx={ctx} id={id} />}
          {page === "sound" && <Sound ctx={ctx} id={id} mode={layer.mode} />}
        </div>
      )}
      {(roomy || page === "filter") && <FilterPanel ctx={ctx} inst={id} />}
    </section>
  );
}
