/**
 * Simple instrument tabs (spec 8.3, P2): one picker and four large macro dials on one screen, the
 * instrument's lane above them and the XY pad lowest. Layers: the mode switch, Busy, Evolve, Bright and
 * Space, Back and New idea. Plain words only (spec 8.1). Every control writes ordinary song and patch
 * values through the engine, so Advanced shows the result of every move.
 */
import { BASS_PRESETS, DRUM_PRESETS, MACROS, type InstrumentId, type LayerInstrument } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Dial, GroupLabel, PagedChips, XYPad } from "../components.tsx";
import { LeadStyles } from "./lead.tsx";
import { ModeRow } from "./LayerTab.tsx";
import { Icon } from "../icons.tsx";
import { Lane } from "../lanes.tsx";
import { MACRO_COLOR, patchName, patchOf, presetName, seedHeard, simpleXYReadout } from "../logic.ts";
import { INST_COLOR } from "../theme.tsx";
import { HeadRow } from "./InstrumentTab.tsx";

/** The four macro dials of an instrument (spec 8.3's table), for the edited section. */
function Macros({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const { engine, edit } = ctx;
  return (
    <div class="dials n4 macros">
      {MACROS[inst].map((m) => {
        const pos = engine.macroPos(edit, inst, m.id);
        return (
          <Dial
            key={m.id}
            id={`${inst}:macro:${m.id}`}
            label={m.label}
            value={pos}
            min={0}
            max={1}
            display={String(Math.round(pos * 100))}
            color={MACRO_COLOR[m.id]}
            onChange={(p) => engine.setMacro(edit, inst, m.id, p)}
          />
        );
      })}
    </div>
  );
}

/**
 * The filter XY pad in plain words: Tone across, Edge up. Its X axis is the cutoff a Bright dial also moves, so
 * a move here lets those dials read the value again (P2 review S2): one value, one answer on the screen.
 */
function SimpleXY({ ctx, inst }: { ctx: Ctx; inst: InstrumentId }) {
  const patch = ctx.song.patches[inst];
  return (
    <XYPad
      id={inst}
      x={patch.cutoff}
      y={patch.resonance}
      xLabel="Tone"
      yLabel="Edge"
      readout={simpleXYReadout(patch.cutoff, patch.resonance)}
      onChange={(x, y) => {
        ctx.engine.setParams(inst, { cutoff: x, resonance: y });
        ctx.engine.releaseMacros(inst, "cutoff");
      }}
    />
  );
}

/** The one picker of a Simple instrument tab: Beat (drums), Rhythm (bass), Sound (synth). */
function Picker({ ctx, inst }: { ctx: Ctx; inst: "drums" | "bass" | "synth" }) {
  const { engine, song, edit } = ctx;
  const section = song.sections[edit];
  if (inst === "drums")
    return (
      <>
        <GroupLabel thing="Beat">{section.drums.grid ? "Beat · changed in Advanced" : "Beat"}</GroupLabel>
        <PagedChips
          name="preset"
          what="beats"
          options={DRUM_PRESETS}
          value={section.drums.grid ? null : section.drums.preset}
          label={(p) => presetName("beat", p, true)}
          onPick={(p) => engine.setDrumPreset(edit, p)}
        />
      </>
    );
  if (inst === "bass")
    return (
      <>
        <GroupLabel thing="Rhythm" />
        <PagedChips
          name="rhythm"
          what="rhythms"
          options={BASS_PRESETS}
          value={section.bass.rhythm}
          label={(p) => presetName("bass", p, true)}
          onPick={(p) => engine.setBassRhythm(edit, p)}
        />
      </>
    );
  // C8 (P7): the Sound picker lists the synth's patch files (spec 8.2: pickers list whatever exists).
  return <SoundPicker ctx={ctx} inst="synth" simple />;
}

/** The Sound picker of an instrument (C8, P7): every patch file for it, a page at a time; the lit chip is the patch it matches. */
export function SoundPicker({ ctx, inst, simple = false }: { ctx: Ctx; inst: InstrumentId; simple?: boolean }) {
  const ids = ctx.engine.patchIds(inst);
  return (
    <>
      <GroupLabel thing="Sound" />
      <PagedChips
        name="patch"
        what="sounds"
        options={ids}
        value={patchOf(inst, ctx.song.patches[inst], ids)}
        label={(id) => patchName(id, simple)}
        onPick={(id) => ctx.engine.setPatch(inst, id)}
      />
    </>
  );
}

export function SimpleInstrumentTab({ ctx, inst }: { ctx: Ctx; inst: "drums" | "bass" | "synth" }) {
  return (
    <section class="insttab simple" style={{ "--c": INST_COLOR[inst], "--chip": INST_COLOR[inst] }} data-simple={inst}>
      <HeadRow ctx={ctx} inst={inst} />
      <Lane id={inst} lanes={ctx.lanes} playhead />
      <Picker ctx={ctx} inst={inst} />
      <Macros ctx={ctx} inst={inst} />
      <SimpleXY ctx={ctx} inst={inst} />
    </section>
  );
}

/** New idea (a new seed) and Back (the previous one): the same two buttons in both modes (spec 8.3). */
export function SeedButtons({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { engine, song, edit } = ctx;
  const layer = song.sections[edit][id];
  // A pad holds the chord, and an arp in order plays its chord's notes: a seed changes nothing they play.
  const inert = !seedHeard(layer);
  return (
    <>
      <button
        class="btn seedbtn"
        data-back={id}
        disabled={inert || !layer.seeds?.length}
        aria-label="Back: the notes this layer played before the last new idea"
        onClick={() => engine.prevSeed(edit, id)}
      >
        <Icon thing="Back" />
        <span>Back</span>
      </button>
      <button class="btn seedbtn idea" data-seed={id} disabled={inert} aria-label="New idea: new notes for this layer" onClick={() => engine.newSeed(edit, id)}>
        <Icon thing="New idea" />
        <span>New idea</span>
      </button>
    </>
  );
}

/**
 * Simple Layer (P6, docs/design/look/ phone 2): the mode switch; in Lead, the style picker (Hook, Phrase, Roll,
 * Drift, Pulse); the lane with the phrase's bar; Busy, Evolve, Bright and Space; Back and New idea; the XY pad lowest.
 */
export function SimpleLayerTab({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  const { edit, roomy } = ctx;
  const layer = ctx.song.sections[edit][id];
  return (
    <section
      class={`insttab layertab simple${roomy ? " roomy" : ""}${layer.mode === "generative" ? " lead" : ""}`}
      style={{ "--c": INST_COLOR[id], "--chip": INST_COLOR[id] }}
      data-simple={id}
    >
      {roomy && <HeadRow ctx={ctx} inst={id} />}
      <ModeRow ctx={ctx} id={id} toggle={!roomy} />
      {layer.mode === "generative" && <LeadStyles ctx={ctx} id={id} />}
      <Lane id={id} lanes={ctx.lanes} playhead section={edit} />
      <Macros ctx={ctx} inst={id} />
      <div class="seedrow">
        <SeedButtons ctx={ctx} id={id} />
      </div>
      <SimpleXY ctx={ctx} inst={id} />
    </section>
  );
}
