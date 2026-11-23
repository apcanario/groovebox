/**
 * The lead's controls (P6, spec 8.5), shared by the Simple and Advanced Layer tabs: the style selector (Hook,
 * Phrase, Roll, Drift, Pulse) and the Advanced dial pages, Notes and Feel of six each and Pulse's own three. A dial
 * shows the knob as the lead plays it: an unset knob reads its style's default until it is turned. Every move goes
 * through the engine's setGen for the edited section, so it lands on the next step, ramped by the lead itself.
 */
import { LEAD_STYLES, type LayerInstrument } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Chips, Dial } from "../components.tsx";
import { LEAD_PAGES, LEAD_STYLE_LABEL, leadDialSet, leadDialText, leadDialValue } from "../logic.ts";
import { leadKnobs } from "../../music/leadKit.ts";

export type LeadPage = keyof typeof LEAD_PAGES;

/** The style the lead plays: the stored one, or Pulse for a song that never chose (as the engine does). */
export function leadStyleOf(ctx: Ctx, id: LayerInstrument) {
  return leadKnobs(ctx.song.sections[ctx.edit][id].gen).style;
}

/** The style selector: one chip per style, the playing one filled. */
export function LeadStyles({ ctx, id }: { ctx: Ctx; id: LayerInstrument }) {
  return (
    <Chips
      name="leadstyle"
      options={LEAD_STYLES}
      value={leadStyleOf(ctx, id)}
      label={(s) => LEAD_STYLE_LABEL[s]}
      onPick={(s) => ctx.engine.setGen(ctx.edit, id, { style: s })}
    />
  );
}

/** One page of lead dials for the edited section. */
export function LeadDials({ ctx, id, page }: { ctx: Ctx; id: LayerInstrument; page: LeadPage }) {
  const { engine, song, edit } = ctx;
  const gen = song.sections[edit][id].gen;
  const dials = LEAD_PAGES[page];
  return (
    <div class={`dials n${dials.length} lead`}>
      {dials.map((d) => {
        const v = leadDialValue(d, gen);
        return (
          <Dial
            key={d.key}
            id={`${id}:gen:${d.key}`}
            label={d.label}
            value={v}
            min={d.min}
            max={d.max}
            step={d.step}
            display={leadDialText(d, v)}
            color={d.color}
            onChange={(x) => engine.setGen(edit, id, leadDialSet(d, x))}
          />
        );
      })}
    </div>
  );
}
