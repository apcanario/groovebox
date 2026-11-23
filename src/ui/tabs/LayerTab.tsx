/**
 * Layer 1 and Layer 2 (G4), laid out after docs/design/layer1-tab.jpg: title and on/off, the mode
 * switch, the mode's controls (Generative: the 16-step row, new seed and six dials; Arp: direction,
 * rate, octaves and gate; Pad: four dials), then the filter XY pad and the sends. A second page,
 * Sound (its switch below the sends), holds the patch dials the three modes share (wave, envelope, drive).
 * Patterns belong to the edited section; the patch belongs to the instrument.
 */
import { useState } from "preact/hooks";
import { ARP_DIRECTIONS, LAYER_MODES, WAVES, type ArpDirection, type LayerInstrument } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Chips, Dial, Pager, SendBar, Toggle, XYPad } from "../components.tsx";
import {
  ARP_DIRECTION_LABEL,
  ARP_OCTAVES,
  ARP_RATES,
  ARP_RATE_LABEL,
  GEN_KNOBS,
  LAYER_MODE_LABEL,
  LAYER_MODE_ORDER,
  LAYER_MODE_TITLE,
  LAYER_PATCH_KNOBS,
  PAD_KNOBS,
  WAVE_LABEL,
  genText,
  hzLabel,
  knobPos,
  knobText,
  knobValue,
  leadCellClass,
  sectionLetter,
} from "../logic.ts";
import { INST_COLOR, INST_NAME } from "../theme.tsx";

function Generative({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { engine, song, edit, pos, playing } = ctx;
  const gen = song.sections[edit][id].gen;
  const steps = engine.leadSteps(edit, id);
  const live = pos.playing && edit === playing;
  return (
    <>
      <div class="leadrow">
        <div class="steps" id={`steps-${id}`} aria-label="Lead pattern, this bar">
          {steps.map((s, i) => (
            <div key={i} class={leadCellClass(s.hit, s.plays, live && pos.step === i)} data-lead={i} />
          ))}
        </div>
        <button class="btn seed" data-seed={id} aria-label="New seed: new notes" onClick={() => engine.newSeed(edit, id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
          </svg>
        </button>
      </div>
      <div class="dials">
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
      <div class="label">Direction</div>
      <Chips
        name="arpdir"
        options={ARP_DIRECTIONS}
        value={arp.direction}
        label={(d: ArpDirection) => ARP_DIRECTION_LABEL[d]}
        onPick={(d) => engine.setArp(edit, id, { direction: d })}
      />
      <div class="arprow">
        <div>
          <div class="label">Rate</div>
          <Chips
            name="arprate"
            options={rates}
            value={String(arp.rate)}
            label={(r) => ARP_RATE_LABEL[Number(r)]}
            onPick={(r) => engine.setArp(edit, id, { rate: Number(r) as 1 | 2 | 4 })}
          />
        </div>
        <div>
          <div class="label">Octaves</div>
          <Chips
            name="arpoct"
            options={octs}
            value={String(arp.octaves)}
            label={(o) => o}
            onPick={(o) => engine.setArp(edit, id, { octaves: Number(o) as 1 | 2 | 3 })}
          />
        </div>
      </div>
      <div class="dials">
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
    <div class="dials">
      {PAD_KNOBS.map((k) => {
        const spec = { key: "attack" as const, label: k.label, seconds: k.seconds };
        return (
          <Dial
            key={k.key}
            id={`${id}:pad:${k.key}`}
            label={k.label}
            value={knobPos(spec, pad[k.key])}
            min={0}
            max={1}
            display={knobText(spec, pad[k.key])}
            color={INST_COLOR[id]}
            onChange={(p) => engine.setPad(edit, id, { [k.key]: knobValue(spec, p) })}
          />
        );
      })}
    </div>
  );
}

/** The patch dials shared by every mode: wave, envelope, drive. */
function Sound({ ctx, id, mode }: { ctx: Ctx; id: LayerInstrument; mode: string }) {
  const { engine, song } = ctx;
  const patch = song.patches[id];
  return (
    <>
      <div class="label">Wave</div>
      <Chips
        name="wave"
        options={WAVES}
        value={patch.wave}
        label={(w) => WAVE_LABEL[w]}
        onPick={(w) => engine.setParam(id, "wave", w)}
      />
      {mode === "pad" && <p class="note">In Pad mode the Pad page's attack and release shape the chord.</p>}
      <div class="dials">
        {LAYER_PATCH_KNOBS.map((k) => (
          <Dial
            key={k.key}
            id={`${id}:${k.key}`}
            label={k.label}
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

export function LayerTab({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { engine, song, edit, pending } = ctx;
  const [page, setPage] = useState(0);
  const patch = song.patches[id];
  const section = song.sections[edit];
  const layer = section[id];
  const on = section.on[id];
  const queued = pending.toggles.some((t) => t.section === edit && t.instrument === id);
  const hz = engine.cutoffHz(id, patch.cutoff);
  const readout = `${hz === null ? `${Math.round(patch.cutoff * 100)}%` : hzLabel(hz)} · ${Math.round(patch.resonance * 100)}%`;
  const color = INST_COLOR[id];
  return (
    <section class="insttab layertab" style={{ "--c": color }}>
      <div class="headrow">
        <h1 class="head">
          <em style={{ color }}>{INST_NAME[id]}</em> · {LAYER_MODE_TITLE[layer.mode]}
        </h1>
        <Toggle
          on={on}
          pending={queued}
          color={color}
          label={`${INST_NAME[id]} in section ${sectionLetter(edit)}`}
          id={id}
          onToggle={() => engine.toggleInstrument(edit, id)}
        />
      </div>
      {queued && <p class="note">Switches {on ? "off" : "on"} on the next bar.</p>}
      <div class="modes" role="radiogroup" aria-label="Mode">
        {LAYER_MODE_ORDER.filter((m) => (LAYER_MODES as readonly string[]).includes(m)).map((m) => (
          <button
            key={m}
            class={`mode${layer.mode === m ? " on" : ""}`}
            data-mode={`${id}:${m}`}
            role="radio"
            aria-checked={layer.mode === m}
            onClick={() => engine.setLayerMode(edit, id, m)}
          >
            {LAYER_MODE_LABEL[m]}
          </button>
        ))}
      </div>
      {page === 0 && layer.mode === "generative" && <Generative ctx={ctx} id={id} />}
      {page === 0 && layer.mode === "arp" && <Arp ctx={ctx} id={id} />}
      {page === 0 && layer.mode === "pad" && <Pad ctx={ctx} id={id} />}
      {page === 1 && <Sound ctx={ctx} id={id} mode={layer.mode} />}
      <XYPad
        id={id}
        x={patch.cutoff}
        y={patch.resonance}
        xLabel="Cutoff"
        yLabel="Resonance"
        readout={readout}
        onChange={(x, y) => engine.setParams(id, { cutoff: x, resonance: y })}
      />
      <div class="sends">
        <SendBar label="Delay" value={patch.delay} color="var(--blue)" onChange={(v) => engine.setParam(id, "delay", v)} />
        <SendBar label="Reverb" value={patch.reverb} color="var(--teal)" onChange={(v) => engine.setParam(id, "reverb", v)} />
      </div>
      {/* Below the sends, so the first screen keeps the design's order: modes, pattern, XY pad, sends. */}
      <Pager id={id} pages={[LAYER_MODE_LABEL[layer.mode], "Sound"]} page={page} onPage={setPage} />
    </section>
  );
}
