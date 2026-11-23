/**
 * Instrument tabs. Drums, Bass and Synth (G3): pattern choice, patch dials (at most six per page),
 * filter XY pad and sends. Layer 1 and Layer 2 have their own tab (LayerTab, G4). Nothing scrolls
 * (P1): pages by chips at the top; the XY pad and sends sit lowest, under every page when the
 * screen is tall enough, else on a Filter page of their own.
 */
import { useState } from "preact/hooks";
import {
  BASS_PRESETS,
  DRUM_PRESETS,
  DRUM_VOICES,
  SEQ_STEPS,
  SYNTH_PRESETS,
  WAVES,
  DRUM_PATTERNS,
  eighthOn,
  sectionDrumGrid,
  type DrumVoice,
  type InstrumentId,
} from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Chips, Dial, Pager, SendBar, Toggle, XYPad } from "../components.tsx";
import { KNOB_PAGES, PRESET_LABEL, WAVE_LABEL, hzLabel, knobPos, knobText, knobValue, sectionLetter, shownPage, withFilterPage, type KnobSpec, type PageDef } from "../logic.ts";
import { INST_COLOR, INST_NAME } from "../theme.tsx";

const VOICE_NAME: Record<DrumVoice, string> = { kick: "Kick", clap: "Clap", hat: "Hat", open: "Open" };

function Knobs({ ctx, inst, knobs }: { ctx: Ctx; inst: InstrumentId; knobs: readonly KnobSpec[] }) {
  const patch = ctx.song.patches[inst];
  return (
    <div class={`dials n${knobs.length}`}>
      {knobs.map((k) => (
        <Dial
          key={k.key}
          id={`${inst}:${k.key}`}
          label={k.label}
          value={knobPos(k, patch[k.key])}
          min={0}
          max={1}
          display={knobText(k, patch[k.key])}
          color={INST_COLOR[inst]}
          onChange={(p) => ctx.engine.setParam(inst, k.key, knobValue(k, p))}
        />
      ))}
    </div>
  );
}

/** The filter XY pad and the two sends: the lowest controls of every instrument tab. */
export function FilterPanel({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine } = ctx;
  const patch = ctx.song.patches[inst];
  const hz = engine.cutoffHz(inst, patch.cutoff);
  const readout = `${hz === null ? `${Math.round(patch.cutoff * 100)}%` : hzLabel(hz)} · ${Math.round(patch.resonance * 100)}%`;
  return (
    <>
      <XYPad
        id={inst}
        x={patch.cutoff}
        y={patch.resonance}
        xLabel="Cutoff"
        yLabel="Resonance"
        readout={readout}
        onChange={(x, y) => engine.setParams(inst, { cutoff: x, resonance: y })}
      />
      <div class="sends">
        <SendBar label="Delay" value={patch.delay} color="var(--blue)" onChange={(v) => engine.setParam(inst, "delay", v)} />
        <SendBar label="Reverb" value={patch.reverb} color="var(--teal)" onChange={(v) => engine.setParam(inst, "reverb", v)} />
      </div>
    </>
  );
}

/** The instrument's on/off switch for the edited section. */
export function InstToggle({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine, song, edit, pending } = ctx;
  const on = song.sections[edit].on[inst];
  const queued = pending.toggles.some((t) => t.section === edit && t.instrument === inst);
  return (
    <Toggle
      on={on}
      pending={queued}
      color={INST_COLOR[inst]}
      label={`${INST_NAME[inst]} in section ${sectionLetter(edit)}`}
      id={inst}
      onToggle={() => engine.toggleInstrument(edit, inst)}
    />
  );
}

/** Name of the instrument, the edited section, and its on/off switch. */
export function HeadRow({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { song, edit, pending } = ctx;
  const on = song.sections[edit].on[inst];
  const queued = pending.toggles.some((t) => t.section === edit && t.instrument === inst);
  return (
    <div class="headrow">
      <h1 class="head">
        <em style={{ color: INST_COLOR[inst] }}>{INST_NAME[inst]}</em>
        <span class="sub">
          {sectionLetter(edit)} · {queued ? (on ? "off at the next bar" : "on at the next bar") : song.sections[edit].name}
        </span>
      </h1>
      <InstToggle ctx={ctx} inst={inst} />
    </div>
  );
}

function Waves({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  return (
    <>
      <Chips
        name="wave"
        options={WAVES}
        value={ctx.song.patches[inst].wave}
        label={(w) => WAVE_LABEL[w]}
        onPick={(w) => ctx.engine.setParam(inst, "wave", w)}
      />
    </>
  );
}

function DrumBeat({ ctx }: { ctx: Ctx }) {
  const { engine, song, edit } = ctx;
  const [voice, setVoice] = useState<DrumVoice>("kick");
  const drums = song.sections[edit].drums;
  const row = sectionDrumGrid(song.sections[edit])[voice];
  const edited = drums.grid !== undefined;
  return (
    <>
      <Chips
        name="preset"
        options={DRUM_PRESETS}
        value={edited ? null : drums.preset}
        label={(p) => PRESET_LABEL[p]}
        onPick={(p) => engine.setDrumPreset(edit, p)}
      />
      <div class="chips" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        {DRUM_VOICES.map((v) => (
          <button key={v} class={`chip${voice === v ? " on" : ""}`} data-voice={v} aria-pressed={voice === v} onClick={() => setVoice(v)}>
            {VOICE_NAME[v]}
          </button>
        ))}
        <button
          class="chip"
          id="drums-revert"
          disabled={!edited}
          aria-label={edited ? `Back to the ${PRESET_LABEL[drums.preset]} preset` : "The beat is the preset"}
          onClick={() => engine.revertDrums(edit)}
        >
          Reset
        </button>
      </div>
      <div class="drumseq">
        {Array.from({ length: SEQ_STEPS }, (_, i) => {
          const lit = eighthOn(row, i);
          const now = ctx.pos.playing && edit === ctx.playing && Math.floor(ctx.pos.step / 2) === i;
          return (
            <button
              key={i}
              class={`cell${lit ? " on" : ""}${now ? " now" : ""}`}
              data-step={`${voice}:${i}`}
              aria-pressed={lit}
              aria-label={`${VOICE_NAME[voice]} step ${i + 1}`}
              onClick={() => engine.toggleDrumStep(edit, voice, i)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p class="note">
        {edited ? `${PRESET_LABEL[drums.preset]}, edited` : PRESET_LABEL[drums.preset]} · 8 steps · {DRUM_PATTERNS[drums.preset].swing > 0 ? "swung" : "straight"}
      </p>
    </>
  );
}

type InstPage = "beat" | "rhythm" | "sound" | "kick" | "hats" | "filter";

/** The pages of the Drums, Bass and Synth tabs, before the Filter page. */
function basePages(inst: InstrumentId): PageDef<InstPage>[] {
  if (inst === "drums") return [["beat", "Beat"], ["kick", KNOB_PAGES.drums![0].name], ["hats", KNOB_PAGES.drums![1].name]];
  return [["rhythm", "Rhythm"], ["sound", "Sound"]];
}

export function InstrumentTab({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine, edit, roomy } = ctx;
  const section = ctx.song.sections[edit];
  const [chosen, setPage] = useState<InstPage>(inst === "drums" ? "beat" : "rhythm");
  const pages = withFilterPage(basePages(inst), roomy);
  const page = shownPage(pages, chosen);
  const knobPages = KNOB_PAGES[inst] ?? [];
  return (
    <section class={`insttab${roomy ? " roomy" : ""}`} style={{ "--c": INST_COLOR[inst] }}>
      <HeadRow ctx={ctx} inst={inst} />
      <Pager id={inst} pages={pages} page={page} onPage={setPage} />
      {page !== "filter" && (
        <div class="page" data-shown={`${inst}:${page}`}>
          {page === "beat" && <DrumBeat ctx={ctx} />}
          {page === "kick" && <Knobs ctx={ctx} inst={inst} knobs={knobPages[0].knobs} />}
          {page === "hats" && <Knobs ctx={ctx} inst={inst} knobs={knobPages[1].knobs} />}
          {page === "rhythm" && inst === "bass" && (
            <Chips
              name="rhythm"
              options={BASS_PRESETS}
              value={section.bass.rhythm}
              label={(p) => PRESET_LABEL[p]}
              onPick={(p) => engine.setBassRhythm(edit, p)}
            />
          )}
          {page === "rhythm" && inst === "synth" && (
            <Chips
              name="rhythm"
              options={SYNTH_PRESETS}
              value={section.synth.rhythm}
              label={(p) => PRESET_LABEL[p]}
              onPick={(p) => engine.setSynthRhythm(edit, p)}
            />
          )}
          {page === "rhythm" && <Waves ctx={ctx} inst={inst} />}
          {page === "sound" && <Knobs ctx={ctx} inst={inst} knobs={knobPages[0].knobs} />}
        </div>
      )}
      {(roomy || page === "filter") && <FilterPanel ctx={ctx} inst={inst} />}
    </section>
  );
}
