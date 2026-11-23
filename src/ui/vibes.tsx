/**
 * Vibes (P3, spec 8.2 and 8.6): the vibe picker that opens the app, and the vibe control at the top of the
 * Simple Play tab. A vibe loads as a new song (the jam it replaces stays in Songs) and, while playing, lands on
 * the next bar line. The list is whatever is in `src/styles/`.
 */
import { useState } from "preact/hooks";
import { STYLES, STYLE_IDS, stepVibe, vibeSong, vibeStart, vibeTiles, type VibeTile } from "../music/styles.ts";
import type { StyleFamily } from "../music/data.ts";
import type { Ctx } from "./App.tsx";
import { Icon } from "./icons.tsx";
import { stripWord } from "./logic.ts";

/** Room for the jam's name on "Continue last jam" at 10 px, at 360 px wide (spec 8.6: shortened, never cut off). */
const CONTINUE_WORD_PX = 110;

/** Each family's colour (spec 8.2: tiles coloured by family; as in docs/design/phase2/groovebox-6). */
export const FAMILY_COLOR: Record<StyleFamily, string> = {
  house: "var(--coral)",
  techno: "var(--purple)",
  breaks: "var(--yellow)",
  slow: "var(--teal)",
  other: "var(--blue)",
};

/** A vibe's name, or null for an unknown id (a song started before P3 has none). */
export function vibeName(id: string | undefined): string | null {
  return id && STYLES[id] ? STYLES[id].name : null;
}

/**
 * Load a vibe as a new song (spec 8.2): saved as a new song in Songs, on the next bar line while playing.
 * `play`: start the transport too (a picker tile; the arrows do not). Returns whether it was taken.
 */
export async function loadVibe(ctx: Ctx, id: string, play: boolean): Promise<boolean> {
  const doc = vibeSong(id);
  if (!doc) return false;
  // Start the audio inside the tap that asked for it: browsers only start audio from a gesture.
  const ready = play ? ctx.startAudio() : null;
  const ok = await ctx.keeper.startVibe(doc, vibeStart(id));
  if (ok && ready && (await ready) && !ctx.engine.playing) ctx.engine.play();
  return ok;
}

function Tile({ tile, on, onPick }: { tile: VibeTile; on: boolean; onPick: () => void }) {
  return (
    <button
      class={`vibe${on ? " on" : ""}`}
      style={{ "--c": FAMILY_COLOR[tile.family] }}
      data-vibe={tile.id}
      aria-pressed={on}
      aria-label={`${tile.name}: load it and play`}
      onClick={onPick}
    >
      <span>{tile.name}</span>
    </button>
  );
}

/**
 * The vibe picker (spec 8.2): every vibe as a tile in two columns on one screen, coloured by family, "Continue
 * last jam" first when there is one. A tile loads its vibe and plays. It never scrolls.
 */
export function VibePicker({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { engine, keeper, song } = ctx;
  const [busy, setBusy] = useState(false);
  const tiles = vibeTiles();
  const pending = engine.pendingLoad();
  const current = pending ? pending.style : song.style;
  // The first launch's untouched default song is no jam to continue.
  const canContinue = !keeper.scratch;
  const st = engine.recordInfo().state;
  const recording = st === "recording" || st === "finishing";
  const rows = Math.ceil(tiles.length / 2);
  // As in groovebox-6 (P3 review M5): the jam's vibe, or its name for a song with none.
  const jam = vibeName(song.style) ?? song.name;
  const pick = async (id: string): Promise<void> => {
    setBusy(true);
    try {
      if (await loadVibe(ctx, id, true)) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="vibes" role="dialog" aria-label="Pick a vibe">
      <div class="vibehead">
        <h2>Pick a vibe</h2>
        <button class="btn" id="vibe-close" onClick={onClose}>
          Close
        </button>
      </div>
      {canContinue && (
        <button class="btn vcont" id="vibe-continue" aria-label={`Continue last jam: ${jam}`} onClick={onClose}>
          <span>Continue last jam</span>
          <small>
            {vibeName(song.style) ?? stripWord(song.name, CONTINUE_WORD_PX)} · {song.bpm}
          </small>
        </button>
      )}
      <div class="vibegrid" style={{ gridTemplateRows: `repeat(${rows}, minmax(48px, 64px))` }}>
        {tiles.map((t) => (
          <Tile key={t.id} tile={t} on={t.id === current} onPick={() => !busy && !recording && void pick(t.id)} />
        ))}
      </div>
      <p class="note vnote">{recording ? "Stop recording to load a vibe." : "One tap loads a full groove on the next bar."}</p>
    </div>
  );
}

/**
 * The vibe control (spec 8.6), top of the Simple Play tab: the current vibe as one large button that opens
 * the picker, with an arrow each side that loads the previous or next vibe from the next bar line.
 */
export function VibeControl({ ctx, onOpen }: { ctx: Ctx; onOpen: () => void }) {
  const { engine, song } = ctx;
  const pending = engine.pendingLoad();
  const shown = pending ? pending.style : song.style;
  const name = vibeName(shown) ?? "Pick a vibe";
  const st = engine.recordInfo().state;
  const recording = st === "recording" || st === "finishing";
  // The next vibe is worked out when the keeper gets to this tap, from what is queued then, not from this
  // render (P3 review S1): two quick taps step twice and start one song each, the first replaced unheard.
  const step = (dir: 1 | -1): void => {
    void ctx.keeper.startVibeWith(() => {
      const id = stepVibe(engine.pendingLoad()?.style ?? engine.getSong().style, dir);
      const doc = id ? vibeSong(id) : null;
      return id && doc ? { doc, section: vibeStart(id) } : null;
    });
  };
  return (
    <div class="vibectl">
      <button class="btn varrow" id="vibe-prev" aria-label="Previous vibe, from the next bar" disabled={recording} onClick={() => step(-1)}>
        <Icon name="chevron_left" />
      </button>
      <button
        class={`tile vmain ${vibeName(shown) ? "on" : "off"}${pending ? " pending" : ""}`}
        id="vibe-open"
        style={{ "--c": shown && STYLES[shown] ? FAMILY_COLOR[STYLES[shown].family] : "var(--coral)" }}
        aria-label={`Vibe: ${name}${pending ? ", loading on the next bar" : ""}. Tap for all vibes`}
        onClick={onOpen}
      >
        <b>{name}</b>
        <span>{pending ? "Next bar" : `All ${STYLE_IDS.length} vibes`}</span>
      </button>
      <button class="btn varrow" id="vibe-next" aria-label="Next vibe, from the next bar" disabled={recording} onClick={() => step(1)}>
        <Icon name="chevron_right" />
      </button>
    </div>
  );
}
