/**
 * Instrument tabs. Drums, Bass and Synth (G3): the instrument's lane (P1b), pattern choice, patch dials (at most six per page),
 * filter XY pad and sends. Layer 1 and Layer 2 have their own tab (LayerTab, G4). Nothing scrolls
 * (P1): pages by chips at the top; the XY pad and sends sit lowest, under every page when the
 * screen is tall enough, else on a Filter page of their own.
 */
import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import {
  BASS_PRESETS,
  DRUM_PRESETS,
  DRUM_VOICES,
  SEQ_STEPS,
  SEQ_STEPS_16,
  SYNTH_PRESETS,
  WAVES,
  eighthOn,
  MAX_SWING,
  sectionDrumGrid,
  sectionSwing,
  type DrumVoice,
  type InstrumentId,
} from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Chips, Dial, GroupLabel, PagedChips, Pager, SendBar, Toggle, XYPad } from "../components.tsx";
import { SoundPicker } from "./SimpleTab.tsx";
import { KIT_KNOBS, KNOB_PAGES, MOD_KNOBS, presetName, WAVE_LABEL, hzLabel, knobLabel, knobPos, knobText, knobValue, sectionLetter, shownPage, withFilterPage, type KnobSpec, type PageDef } from "../logic.ts";
import { INST_COLOR, INST_NAME, InstName } from "../theme.tsx";
import { Lane } from "../lanes.tsx";
import { FxPage } from "./fx.tsx";

const VOICE_NAME: Record<DrumVoice, string> = { kick: "Kick", clap: "Clap", hat: "Hat", open: "Open", perc: "Perc", shaker: "Shaker" };

/** The sequencer's view (P7): eight steps of two sixteenths, or the 16-step grid shown half a bar at a time. */
type SeqView = "8" | "16a" | "16b";
const SEQ_VIEWS: readonly SeqView[] = ["8", "16a", "16b"];
const SEQ_VIEW_LABEL: Record<SeqView, string> = { "8": "8 steps", "16a": "1–8", "16b": "9–16" };

function Knobs({ ctx, inst, knobs, children }: { ctx: Ctx; inst: InstrumentId; knobs: readonly KnobSpec[]; children?: ComponentChildren }) {
  const patch = ctx.song.patches[inst];
  return (
    <div class={`dials n${knobs.length}`}>
      {knobs.map((k) => (
        <Dial
          key={k.key}
          id={`${inst}:${k.key}`}
          label={knobLabel(k)}
          value={knobPos(k, patch[k.key])}
          min={0}
          max={1}
          display={knobText(k, patch[k.key])}
          color={INST_COLOR[inst]}
          onChange={(p) => ctx.engine.setParam(inst, k.key, knobValue(k, p))}
        />
      ))}
      {children}
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

/**
 * Name of the instrument, the edited section, and its on/off switch. `children` replace the switch on the right
 * (the Advanced Layer tab puts Back and New idea there and its switch in the mode row, as docs/design/look/).
 */
export function HeadRow({ ctx, inst, children }: { ctx: Ctx; inst: InstrumentId; children?: ComponentChildren }) {
  const { song, edit, pending } = ctx;
  const on = song.sections[edit].on[inst];
  const queued = pending.toggles.some((t) => t.section === edit && t.instrument === inst);
  return (
    <div class="headrow">
      <h1 class="head">
        <em style={{ color: INST_COLOR[inst] }}>
          <InstName id={inst} />
        </em>
        <span class="sub">
          {sectionLetter(edit)} · {queued ? (on ? "off at the next bar" : "on at the next bar") : song.sections[edit].name}
        </span>
      </h1>
      {children ?? <InstToggle ctx={ctx} inst={inst} />}
    </div>
  );
}

function Waves({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  return (
    <>
      <GroupLabel thing="Wave" />
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

/** The drum beats (the Beat page): picking one drops the section's sequencer edit. */
function DrumPresets({ ctx }: { ctx: Ctx }) {
  const { engine, song, edit } = ctx;
  const drums = song.sections[edit].drums;
  return (
    <>
      <GroupLabel thing="Beat">{drums.grid ? "Beat · edited in Steps" : "Beat"}</GroupLabel>
      <PagedChips
        name="preset"
        what="beats"
        options={DRUM_PRESETS}
        value={drums.grid ? null : drums.preset}
        label={(p) => presetName("beat", p)}
        onPick={(p) => engine.setDrumPreset(edit, p)}
      />
    </>
  );
}

/** The sequencer (the Steps page): a voice, the view (8 steps, or 16 half a bar at a time), Reset and the cells. */
function DrumBeat({ ctx }: { ctx: Ctx }) {
  const { engine, song, edit } = ctx;
  const [voice, setVoice] = useState<DrumVoice>("kick");
  const [view, setView] = useState<SeqView>("8");
  const drums = song.sections[edit].drums;
  const row = sectionDrumGrid(song.sections[edit])[voice];
  const edited = drums.grid !== undefined;
  const sixteen = view !== "8";
  const half = view === "16b" ? SEQ_STEPS_16 / 2 : 0;
  return (
    <>
      <GroupLabel thing="Sequencer">
        Sequencer · {edited ? "edited" : sixteen ? "16 steps" : "8 steps"} · {sectionSwing(song.sections[edit]) > 0 ? "swung" : "straight"}
      </GroupLabel>
      <div class="chips" style={{ gridTemplateColumns: `repeat(${DRUM_VOICES.length}, minmax(0, 1fr))` }}>
        {DRUM_VOICES.map((v) => (
          <button key={v} class={`chip${voice === v ? " on" : ""}`} data-voice={v} aria-pressed={voice === v} onClick={() => setVoice(v)}>
            {VOICE_NAME[v]}
          </button>
        ))}
      </div>
      <div class="chips" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {SEQ_VIEWS.map((v) => (
          <button key={v} class={`chip${view === v ? " on" : ""}`} data-seqview={v} aria-pressed={view === v} onClick={() => setView(v)}>
            {SEQ_VIEW_LABEL[v]}
          </button>
        ))}
        <button
          class="chip"
          id="drums-revert"
          disabled={!edited}
          aria-label={edited ? `Back to the ${presetName("beat", drums.preset)} preset` : "The beat is the preset"}
          onClick={() => engine.revertDrums(edit)}
        >
          Reset
        </button>
      </div>
      <div class="drumseq">
        {Array.from({ length: SEQ_STEPS }, (_, i) => {
          if (sixteen) {
            // P7: one sixteenth per cell, half a bar at a time.
            const k = half + i;
            const lit = (row[k] ?? 0) > 0;
            const now = ctx.pos.playing && edit === ctx.playing && ctx.pos.step === k;
            return (
              <button
                key={`s${k}`}
                class={`cell${lit ? " on" : ""}${now ? " now" : ""}`}
                data-step16={`${voice}:${k}`}
                aria-pressed={lit}
                aria-label={`${VOICE_NAME[voice]} sixteenth ${k + 1}`}
                onClick={() => engine.toggleDrumStep(edit, voice, k, true)}
              >
                {k + 1}
              </button>
            );
          }
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
    </>
  );
}

/** The edited section's swing, in hundredths of a sixteenth (P2: what the Simple Swing dial moves). */
function SwingDial({ ctx }: { ctx: Ctx }) {
  const { engine, song, edit } = ctx;
  const v = sectionSwing(song.sections[edit]);
  return (
    <Dial
      id="drums:swing"
      label="Swing"
      value={v}
      min={0}
      max={MAX_SWING}
      display={String(Math.round(v * 100))}
      color={INST_COLOR.drums}
      onChange={(x) => engine.setSwing(edit, x)}
    />
  );
}

type InstPage = "beat" | "steps" | "rhythm" | "sound" | "kick" | "hats" | "kit" | "mod" | "fx" | "filter";

/**
 * The pages of the Drums, Bass and Synth tabs, before the Filter page. P7: Drums gets Steps (the sequencer, 8 or 16
 * steps, Perc and Shaker), Kit (Perc and Shaker dials) and its sounds on the Beat page; Bass and Synth get Mod. P9: every
 * instrument gets FX; with six chips or more "Kick · Clap" is shortened to "Kick".
 */
function basePages(inst: InstrumentId): PageDef<InstPage>[] {
  if (inst === "drums") return [["beat", "Beat"], ["steps", "Steps"], ["kick", "Kick"], ["hats", KNOB_PAGES.drums![1].name], ["kit", "Kit"], ["fx", "FX"]];
  return [["rhythm", "Rhythm"], ["sound", "Sound"], ["mod", "Mod"], ["fx", "FX"]];
}

export function InstrumentTab({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine, edit, roomy } = ctx;
  const section = ctx.song.sections[edit];
  const [chosen, setPage] = useState<InstPage>(inst === "drums" ? "beat" : "rhythm");
  const pages = withFilterPage(basePages(inst), roomy);
  const page = shownPage(pages, chosen);
  const knobPages = KNOB_PAGES[inst] ?? [];
  return (
    <section class={`insttab${roomy ? " roomy" : ""}`} style={{ "--c": INST_COLOR[inst], "--chip": INST_COLOR[inst] }}>
      <HeadRow ctx={ctx} inst={inst} />
      <Lane id={inst} lanes={ctx.lanes} playhead />
      <Pager id={inst} pages={pages} page={page} onPage={setPage} />
      {page !== "filter" && (
        <div class="page" data-shown={`${inst}:${page}`}>
          {page === "beat" && <DrumPresets ctx={ctx} />}
          {page === "beat" && <SoundPicker ctx={ctx} inst={inst} />}
          {page === "steps" && <DrumBeat ctx={ctx} />}
          {page === "kick" && <Knobs ctx={ctx} inst={inst} knobs={knobPages[0].knobs} />}
          {page === "hats" && (
            <Knobs ctx={ctx} inst={inst} knobs={knobPages[1].knobs}>
              <SwingDial ctx={ctx} />
            </Knobs>
          )}
          {page === "rhythm" && <GroupLabel thing="Rhythm" />}
          {page === "rhythm" && inst === "bass" && (
            <PagedChips
              name="rhythm"
              what="rhythms"
              options={BASS_PRESETS}
              value={section.bass.rhythm}
              label={(p) => presetName("bass", p)}
              onPick={(p) => engine.setBassRhythm(edit, p)}
            />
          )}
          {page === "rhythm" && inst === "synth" && (
            <PagedChips
              name="rhythm"
              what="rhythms"
              options={SYNTH_PRESETS}
              value={section.synth.rhythm}
              label={(p) => presetName("synth", p)}
              onPick={(p) => engine.setSynthRhythm(edit, p)}
            />
          )}
          {page === "rhythm" && <Waves ctx={ctx} inst={inst} />}
          {page === "sound" && <SoundPicker ctx={ctx} inst={inst} />}
          {page === "sound" && <Knobs ctx={ctx} inst={inst} knobs={knobPages[0].knobs} />}
          {page === "kit" && <Knobs ctx={ctx} inst={inst} knobs={KIT_KNOBS} />}
          {page === "mod" && <Knobs ctx={ctx} inst={inst} knobs={MOD_KNOBS} />}
          {page === "fx" && <FxPage ctx={ctx} inst={inst} />}
        </div>
      )}
      {(roomy || page === "filter") && <FilterPanel ctx={ctx} inst={inst} />}
    </section>
  );
}
