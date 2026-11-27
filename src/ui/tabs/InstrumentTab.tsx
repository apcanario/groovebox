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
import { Chips, Dial, GroupLabel, PagedChips, Pager, SendBar, Sheet, Toggle, XYPad } from "../components.tsx";
import { SoundPicker } from "./SimpleTab.tsx";
import { KIT_KNOBS, KNOB_PAGES, MOD_KNOBS, DRUM_EXTRAS, VOICE_KNOBS, drumKnob, patchName, patchOf, presetName, WAVE_LABEL, hzLabel, knobLabel, knobPos, knobText, knobValue, sectionLetter, shownPage, withFilterPage, type KnobSpec, type PageDef } from "../logic.ts";
import { INST_COLOR, INST_NAME, InstName } from "../theme.tsx";
import { Lane } from "../lanes.tsx";
import { FxPage, FxSlots } from "./fx.tsx";
import { instShapes, probeProps, useFull, type Full } from "./full.ts";

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

/** The filter XY pad alone (T2: on the desk the sends sit with the effects). */
export function FilterXY({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine } = ctx;
  const patch = ctx.song.patches[inst];
  const hz = engine.cutoffHz(inst, patch.cutoff);
  const readout = `${hz === null ? `${Math.round(patch.cutoff * 100)}%` : hzLabel(hz)} · ${Math.round(patch.resonance * 100)}%`;
  return (
    <XYPad
      id={inst}
      x={patch.cutoff}
      y={patch.resonance}
      xLabel="Cutoff"
      yLabel="Resonance"
      readout={readout}
      onChange={(x, y) => engine.setParams(inst, { cutoff: x, resonance: y })}
    />
  );
}

/** The filter XY pad and the two sends: the lowest controls of every instrument tab. */
export function FilterPanel({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine } = ctx;
  const patch = ctx.song.patches[inst];
  return (
    <>
      <FilterXY ctx={ctx} inst={inst} />
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
  return (
    <div class="headrow">
      <HeadName ctx={ctx} inst={inst} />
      {children ?? <InstToggle ctx={ctx} inst={inst} />}
    </div>
  );
}

/** The instrument's name and the edited section, or what its switch will do at the next bar. */
export function HeadName({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { song, edit, pending } = ctx;
  const on = song.sections[edit].on[inst];
  const queued = pending.toggles.some((t) => t.section === edit && t.instrument === inst);
  return (
      <h1 class="head">
        <em style={{ color: INST_COLOR[inst] }}>
          <InstName id={inst} />
        </em>
        <span class="sub">
          {sectionLetter(edit)} · {queued ? (on ? "off at the next bar" : "on at the next bar") : song.sections[edit].name}
        </span>
      </h1>
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
  // T2 (spec 9.2): Drums, Bass and Synth on the desk show every page at once where they fit, decided by size (full.ts).
  const f = useFull(ctx, inst, instShapes(inst));
  // The page chosen is kept here, above the whole/paged switch, so a rotation that crosses it keeps it (T2 review M2).
  const [chosen, setPage] = useState<InstPage>(inst === "drums" ? "beat" : "rhythm");
  if (!f.full) return <PagedInstrument ctx={ctx} inst={inst} sref={f.ref} chosen={chosen} setPage={setPage} />;
  return inst === "drums" ? <WholeDrums ctx={f.view} f={f} /> : <WholeInstrument ctx={f.view} inst={inst} f={f} />;
}

function Rhythms({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine, edit } = ctx;
  const section = ctx.song.sections[edit];
  return (
    <>
      <GroupLabel thing="Rhythm" />
      {inst === "bass" && (
        <PagedChips
          name="rhythm"
          what="rhythms"
          options={BASS_PRESETS}
          value={section.bass.rhythm}
          label={(p) => presetName("bass", p)}
          onPick={(p) => engine.setBassRhythm(edit, p)}
        />
      )}
      {inst === "synth" && (
        <PagedChips
          name="rhythm"
          what="rhythms"
          options={SYNTH_PRESETS}
          value={section.synth.rhythm}
          label={(p) => presetName("synth", p)}
          onPick={(p) => engine.setSynthRhythm(edit, p)}
        />
      )}
    </>
  );
}

/**
 * T2 (spec 9.2): Bass or Synth whole, on the desk. The name, the lane and the on/off switch in one row; then two
 * columns: the patch (Sound, both effect slots, the sends) and what it plays and how (the rhythm picker, Mod with the
 * wave, over the XY pad, bottom right in thumb reach, spec 9.1). Where the panel is narrow the columns stack.
 */
function WholeInstrument({ ctx, inst, f }: { ctx: Ctx; inst: InstrumentId; f: Full }) {
  const knobPages = KNOB_PAGES[inst] ?? [];
  const patch = ctx.song.patches[inst];
  return (
    <section ref={f.ref} {...probeProps(f)} class="insttab whole" data-whole={inst} style={{ "--c": INST_COLOR[inst], "--chip": INST_COLOR[inst] }}>
      <div class="headrow wholehead">
        <HeadName ctx={ctx} inst={inst} />
        <Lane id={inst} lanes={ctx.lanes} playhead />
        <InstToggle ctx={ctx} inst={inst} />
      </div>
      <div class="cols">
        <div class="col patchcol">
          <div class="grp" data-grp="sound">
            <SoundPicker ctx={ctx} inst={inst} />
            <Knobs ctx={ctx} inst={inst} knobs={knobPages[0].knobs} />
          </div>
          <FxSlots ctx={ctx} inst={inst} />
          <div class="sends" data-grp="sends">
            <SendBar label="Delay" value={patch.delay} color="var(--blue)" onChange={(v) => ctx.engine.setParam(inst, "delay", v)} />
            <SendBar label="Reverb" value={patch.reverb} color="var(--teal)" onChange={(v) => ctx.engine.setParam(inst, "reverb", v)} />
          </div>
        </div>
        <div class="col playcol">
          <div class="grp" data-grp="pattern">
            <Rhythms ctx={ctx} inst={inst} />
          </div>
          <div class="grp" data-grp="mod">
            <Waves ctx={ctx} inst={inst} />
            <Knobs ctx={ctx} inst={inst} knobs={MOD_KNOBS} />
          </div>
          <FilterXY ctx={ctx} inst={inst} />
        </div>
      </div>
    </section>
  );
}

/** A voice's level or decay beside its row of the grid: the full name for the ear, the short one on screen. */
function VoiceDial({ ctx, k, name }: { ctx: Ctx; k: KnobSpec; name: string }) {
  const v = ctx.song.patches.drums[k.key];
  return (
    <Dial
      id={`drums:${k.key}`}
      label={knobLabel(k)}
      name={name}
      value={knobPos(k, v)}
      min={0}
      max={1}
      display={knobText(k, v)}
      color={INST_COLOR.drums}
      onChange={(p) => ctx.engine.setParam("drums", k.key, knobValue(k, p))}
    />
  );
}

/** The drum sound picker in a sheet, opened from one button (T2: the whole Drums panel has no row to spare for it). */
function SoundButton({ ctx }: { ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const ids = ctx.engine.patchIds("drums");
  const now = patchOf("drums", ctx.song.patches.drums, ids);
  return (
    <>
      <button class="btn fxpick" id="drums-sound" aria-label="Drum sound: tap to choose another" onClick={() => setOpen(true)}>
        <span>Sound</span>
        <b>{now ? patchName(now) : "Edited"}</b>
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)}>
          <h2>Drum sound</h2>
          <SoundPicker ctx={ctx} inst="drums" />
          <button class="btn wide" id="sound-close" onClick={() => setOpen(false)}>
            Close
          </button>
        </Sheet>
      )}
    </>
  );
}

/**
 * T2 (spec 9.2): Drums whole, on the desk. Every voice's 16 steps as one grid, each voice two rows of eight (a half
 * bar each: 16 cells of 48 px do not fit across the panel), with the voice's level and decay beside its two rows; the
 * beat over the grid; the name and switch, the Drums lane (spec 8.12, T2 review M1), the sound, Reset, the kick's pitch and drive, the perc's pitch and swing,
 * both effect slots, the sends and the XY pad (lowest, in thumb reach) in the column on the right.
 */
function WholeDrums({ ctx, f }: { ctx: Ctx; f: Full }) {
  const { engine, song, edit } = ctx;
  const section = song.sections[edit];
  const drums = section.drums;
  const grid = sectionDrumGrid(section);
  const edited = drums.grid !== undefined;
  const patch = song.patches.drums;
  const half = SEQ_STEPS_16 / 2;
  return (
    <section ref={f.ref} {...probeProps(f)} class="insttab whole drumwhole" data-whole="drums" style={{ "--c": INST_COLOR.drums, "--chip": INST_COLOR.drums }}>
      <div class="dleft">
        <PagedChips
          name="preset"
          what="beats"
          options={DRUM_PRESETS}
          value={edited ? null : drums.preset}
          label={(p) => presetName("beat", p)}
          onPick={(p) => engine.setDrumPreset(edit, p)}
        />
        <div class="dgrid">
          {DRUM_VOICES.map((v, n) => (
            <div class={`dvoice${n % 2 ? " alt" : ""}`} key={v} data-voice-pair={v}>
            {[0, 1].map((h) => (
              <div class="drow" key={`${v}${h}`} data-voice-row={`${v}:${h}`}>
                {Array.from({ length: half }, (_, i) => {
                  const k = h * half + i;
                  const lit = (grid[v][k] ?? 0) > 0;
                  const now = ctx.pos.playing && edit === ctx.playing && ctx.pos.step === k;
                  return (
                    <button
                      key={k}
                      class={`cell${lit ? " on" : ""}${now ? " now" : ""}${i % 4 === 0 ? " beat" : ""}`}
                      data-step16={`${v}:${k}`}
                      aria-pressed={lit}
                      aria-label={`${VOICE_NAME[v]} sixteenth ${k + 1}`}
                      onClick={() => engine.toggleDrumStep(edit, v, k, true)}
                    >
                      {k + 1}
                    </button>
                  );
                })}
                <VoiceDial ctx={ctx} k={drumKnob(VOICE_KNOBS[v][h])} name={h === 0 ? VOICE_NAME[v] : "Decay"} />
              </div>
            ))}
            </div>
          ))}
        </div>
      </div>
      <div class="dright">
        <div class="headrow">
          <HeadName ctx={ctx} inst="drums" />
          <InstToggle ctx={ctx} inst="drums" />
        </div>
        <Lane id="drums" lanes={ctx.lanes} playhead />
        <div class="dpick">
          <SoundButton ctx={ctx} />
          <button
            class="btn"
            id="drums-revert"
            disabled={!edited}
            aria-label={edited ? `Back to the ${presetName("beat", drums.preset)} preset` : "The beat is the preset"}
            onClick={() => engine.revertDrums(edit)}
          >
            Reset
          </button>
        </div>
        <Knobs ctx={ctx} inst="drums" knobs={DRUM_EXTRAS.map(drumKnob)}>
          <SwingDial ctx={ctx} />
        </Knobs>
        <FxSlots ctx={ctx} inst="drums" />
        <div class="sends" data-grp="sends">
          <SendBar label="Delay" value={patch.delay} color="var(--blue)" onChange={(x) => engine.setParam("drums", "delay", x)} />
          <SendBar label="Reverb" value={patch.reverb} color="var(--teal)" onChange={(x) => engine.setParam("drums", "reverb", x)} />
        </div>
        <FilterXY ctx={ctx} inst="drums" />
      </div>
    </section>
  );
}

function PagedInstrument({ ctx, inst, sref, chosen, setPage }: { ctx: Ctx; inst: InstrumentId; sref: { current: HTMLElement | null }; chosen: InstPage; setPage: (p: InstPage) => void }) {
  const { roomy } = ctx;
  const pages = withFilterPage(basePages(inst), roomy);
  const page = shownPage(pages, chosen);
  const knobPages = KNOB_PAGES[inst] ?? [];
  return (
    <section ref={sref} class={`insttab${roomy ? " roomy" : ""}`} style={{ "--c": INST_COLOR[inst], "--chip": INST_COLOR[inst] }}>
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
          {page === "rhythm" && <Rhythms ctx={ctx} inst={inst} />}
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
