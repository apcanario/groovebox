/**
 * Instrument tabs. Drums, Bass and Synth (G3): pattern choice, patch dials (at most six per page),
 * filter XY pad and sends. Layer 1 and Layer 2 get their mode controls in G4.
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
import { KNOB_PAGES, PRESET_LABEL, WAVE_LABEL, hzLabel, knobPos, knobText, knobValue, sectionLetter } from "../logic.ts";
import { INST_COLOR, INST_NAME } from "../theme.tsx";

const VOICE_NAME: Record<DrumVoice, string> = { kick: "Kick", clap: "Clap", hat: "Hat", open: "Open" };

function Knobs({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const pages = KNOB_PAGES[inst];
  const [page, setPage] = useState(0);
  if (!pages) return null;
  const patch = ctx.song.patches[inst];
  const knobs = pages[Math.min(page, pages.length - 1)].knobs;
  return (
    <>
      {pages.length > 1 && <Pager id={inst} pages={pages.map((p) => p.name)} page={page} onPage={setPage} />}
      <div class="dials">
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
    </>
  );
}

function Waves({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  return (
    <>
      <div class="label">Wave</div>
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
      <div class="label">Beat · {edited ? `${PRESET_LABEL[drums.preset]}, edited` : "preset"}</div>
      <Chips
        name="preset"
        options={DRUM_PRESETS}
        value={edited ? null : drums.preset}
        label={(p) => PRESET_LABEL[p]}
        onPick={(p) => engine.setDrumPreset(edit, p)}
      />
      <div class="label">Sequencer · 8 steps · {DRUM_PATTERNS[drums.preset].swing > 0 ? "swung" : "straight"}</div>
      <Chips name="voice" options={DRUM_VOICES} value={voice} label={(v) => VOICE_NAME[v]} onPick={setVoice} />
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
      {edited && (
        <button class="btn wide" id="drums-revert" onClick={() => engine.revertDrums(edit)}>
          Back to the {PRESET_LABEL[drums.preset]} preset
        </button>
      )}
    </>
  );
}

export function InstrumentTab({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine, song, edit, pending } = ctx;
  const patch = song.patches[inst];
  const section = song.sections[edit];
  const on = section.on[inst];
  const queued = pending.toggles.some((t) => t.section === edit && t.instrument === inst);
  const hz = engine.cutoffHz(inst, patch.cutoff);
  const readout = `${hz === null ? `${Math.round(patch.cutoff * 100)}%` : hzLabel(hz)} · ${Math.round(patch.resonance * 100)}%`;
  return (
    <section class="insttab">
      <div class="headrow">
        <h1 class="head">
          <em style={{ color: INST_COLOR[inst] }}>{INST_NAME[inst]}</em> · {sectionLetter(edit)} {section.name}
        </h1>
        <Toggle
          on={on}
          pending={queued}
          color={INST_COLOR[inst]}
          label={`${INST_NAME[inst]} in section ${sectionLetter(edit)}`}
          id={inst}
          onToggle={() => engine.toggleInstrument(edit, inst)}
        />
      </div>
      {queued && <p class="note">Switches {on ? "off" : "on"} on the next bar.</p>}
      {inst === "drums" && <DrumBeat ctx={ctx} />}
      {inst === "bass" && (
        <>
          <div class="label">Rhythm</div>
          <Chips
            name="rhythm"
            options={BASS_PRESETS}
            value={section.bass.rhythm}
            label={(p) => PRESET_LABEL[p]}
            onPick={(p) => engine.setBassRhythm(edit, p)}
          />
        </>
      )}
      {inst === "synth" && (
        <>
          <div class="label">Rhythm</div>
          <Chips
            name="rhythm"
            options={SYNTH_PRESETS}
            value={section.synth.rhythm}
            label={(p) => PRESET_LABEL[p]}
            onPick={(p) => engine.setSynthRhythm(edit, p)}
          />
        </>
      )}
      {(inst === "bass" || inst === "synth") && <Waves ctx={ctx} inst={inst} />}
      <Knobs ctx={ctx} inst={inst} key={inst} />
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
    </section>
  );
}
