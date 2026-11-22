/** Mix tab (G2): filter sweep, pump and saturation dials, and the audio buffer choice. Levels and meter come in G3. */
import type { MixState } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Dial } from "../components.tsx";
import { sweepLabel } from "../logic.ts";

const BUFFERS = [
  ["interactive", "Fast"],
  ["balanced", "Balanced"],
  ["playback", "Safe"],
] as const;

export function MixTab({ ctx }: { ctx: Ctx }) {
  const { engine, hint } = ctx;
  const mix = engine.getMix();
  const set = (k: keyof MixState) => (v: number) => engine.setMix(k, v);
  return (
    <section class="mixtab">
      <h1 class="head">
        <em>Mix</em>
      </h1>
      <div class="dials">
        <Dial id="sweep" label="Filter" value={mix.sweep} min={-1} max={1} bipolar display={sweepLabel(mix.sweep)} color="var(--orange)" onChange={set("sweep")} />
        <Dial id="pump" label="Pump" value={mix.pump} min={0} max={0.95} display={String(Math.round(mix.pump * 100))} color="var(--teal)" onChange={set("pump")} />
        <Dial id="saturation" label="Saturate" value={mix.saturation} min={0} max={1} color="var(--coral)" onChange={set("saturation")} />
      </div>
      <div class="label">Audio buffer · if it crackles, try a larger one (reloads)</div>
      <div class="seg">
        {BUFFERS.map(([h, name]) => (
          <a key={h} href={`?hint=${h}`} class={hint === h ? "on" : ""} data-hint={h}>
            {name}
          </a>
        ))}
      </div>
    </section>
  );
}
