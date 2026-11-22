/** Drums, Bass, Synth, Layer 1, Layer 2 (G2): name, on/off in the edited section, filter XY pad, sends. Full controls come in G3 and G4. */
import type { InstrumentId } from "../../engine/song.ts";
import type { Ctx } from "../App.tsx";
import { SendBar, Toggle, XYPad } from "../components.tsx";
import { hzLabel, sectionLetter } from "../logic.ts";
import { INST_COLOR, INST_NAME } from "../theme.tsx";

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
