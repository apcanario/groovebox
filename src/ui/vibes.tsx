/**
 * Vibes (P3, spec 8.2 and 8.6; F1, spec 10.1): the vibe picker, a sheet opened from the vibe control's name and from
 * New jam, and the vibe control itself (the top of the Simple Play tab, the header on a tablet) with its dice. A vibe
 * loads as a new song (the jam it replaces stays in Songs) and, while playing, lands on the next bar line. The list
 * is whatever is in `src/styles/`.
 */
import { useEffect, useState } from "preact/hooks";
import { STYLES, STYLE_IDS, TOP_IDS, stepVibe, vibeSong, vibeStart, vibeTiles, type VibeTile } from "../music/styles.ts";
import type { StyleFamily } from "../music/data.ts";
import type { Song } from "../engine/song.ts";
import { drawLaunch, localBagStorage } from "../store/vibeBag.ts";
import type { Ctx } from "./App.tsx";
import { Icon } from "./icons.tsx";
import { pickerPlan } from "./picker.ts";

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
  return loadWith(ctx, () => ({ doc, section: vibeStart(id) }), play);
}

/**
 * The next vibe from the launch bag (F1, spec 10.1), with its key and bpm rolled in the same draw: the dice and
 * "Surprise me". The seed is the clock's; the generator is the seeded one. Null when there are no top vibes.
 */
export function drawVibe(): { doc: Song; section: number } | null {
  const got = drawLaunch(Date.now(), localBagStorage());
  return got ? { doc: got.song, section: vibeStart(got.id) } : null;
}

/** Load the next vibe from the bag as a new song (the dice, "Surprise me"), drawn when the keeper gets to it. */
export function loadDrawn(ctx: Ctx, play: boolean): Promise<boolean> {
  return loadWith(ctx, drawVibe, play);
}

async function loadWith(ctx: Ctx, pick: () => { doc: Song; section: number } | null, play: boolean): Promise<boolean> {
  // Start the audio inside the tap that asked for it: browsers only start audio from a gesture.
  const ready = play ? ctx.startAudio() : null;
  const ok = await ctx.keeper.startVibeWith(pick);
  // C28: no check of `playing` here; play() does nothing on a running transport.
  if (ok && ready && (await ready)) ctx.engine.play();
  return ok;
}

/**
 * A keyboard's Escape closes a picker (a desktop browser, and the scripts). C9 (P8, spec 8.6): the borrowing picker
 * has no title row and no Close, so 24 tiles and "This jam's vibe" fit at 360 x 640; "This jam's vibe" is the way back.
 */
function useEscape(onClose: () => void): void {
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
}

function Tile({ tile, on, onPick, off }: { tile: VibeTile; on: boolean; onPick: () => void; off?: boolean }) {
  return (
    <button
      class={`vibe${on ? " on" : ""}`}
      disabled={off}
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
 * Borrowing (P4, spec 8.4): the picker opened from Simple Chords to borrow another vibe's chords. A tile then picks
 * whose progressions the cards show and loads nothing; "This jam's vibe" goes back to the song's own.
 */
export interface Borrow {
  current: string | undefined;
  onPick: (id: string | undefined) => void;
}

/** The screen's height, re-read when it changes (display only). */
function useViewHeight(): number {
  const [h, setH] = useState(() => window.innerHeight);
  useEffect(() => {
    const read = (): void => setH(window.innerHeight);
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return h;
}

/**
 * The vibe picker (F1, spec 10.1), a sheet from the bottom: "Surprise me" beside the title, the top vibes in two
 * columns, a line, the other vibes. Where both groups do not fit at 48 px a tile (picker.ts), the line carries a
 * "More" switch that swaps the top group for the others and back. A tile loads its vibe and plays; on the next bar
 * line while playing. Tapping outside the sheet, or Escape, closes it. Signature's tile (F7) is not here yet.
 */
export function VibePicker({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { engine, song } = ctx;
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const height = useViewHeight();
  const tiles = vibeTiles();
  // F1 review M2: the top group in spec 10.2's order (TOP_IDS), the others in family order.
  const top = TOP_IDS.map((id) => tiles.find((t) => t.id === id)).filter((t): t is VibeTile => !!t);
  const others = tiles.filter((t) => !TOP_IDS.includes(t.id));
  const plan = pickerPlan(height, top.length, others.length);
  const pending = engine.pendingLoad();
  const current = pending ? pending.style : song.style;
  const st = engine.recordInfo().state;
  const recording = st === "recording" || st === "finishing";
  useEscape(onClose);
  const run = async (load: () => Promise<boolean>): Promise<void> => {
    if (busy || recording) return;
    setBusy(true);
    try {
      if (await load()) onClose();
    } finally {
      setBusy(false);
    }
  };
  const group = (list: VibeTile[], name: "top" | "other") => (
    <div class={`vibegrid v${name}`} data-group={name} style={plan.both ? undefined : { height: `${plan.place}px` }}>
      {list.map((t) => (
        <Tile key={t.id} tile={t} on={t.id === current} off={recording} onPick={() => void run(() => loadVibe(ctx, t.id, true))} />
      ))}
    </div>
  );
  const showOthers = !plan.both && more;
  return (
    <div class="shade" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet vpick" role="dialog" aria-label="Pick a vibe">
        <div class="vphead">
          <h2>{recording ? "Stop recording first" : "Vibes"}</h2>
          <button
            class="btn vsurprise"
            id="vibe-surprise"
            aria-label="Surprise me: a vibe from the bag, load it and play"
            disabled={recording}
            onClick={() => void run(() => loadDrawn(ctx, true))}
          >
            <Icon thing="New idea" />
            <span>Surprise me</span>
          </button>
        </div>
        {showOthers ? group(others, "other") : group(top, "top")}
        <div class={`vline${plan.both ? "" : " swap"}`}>
          <span>More vibes</span>
          <i aria-hidden="true" />
          {!plan.both && (
            <button
              class={`btn vmore${more ? " on" : ""}`}
              id="vibe-more"
              aria-pressed={more}
              aria-label={more ? "More: on, showing the other vibes; tap for the top vibes" : "More: show the other vibes"}
              onClick={() => setMore(!more)}
            >
              More
            </button>
          )}
        </div>
        {plan.both && group(others, "other")}
      </div>
    </div>
  );
}

/** The vibe picker borrowing chords (P4): the same tiles on one screen; a tap chooses whose cards Simple Chords shows. */
export function BorrowPicker({ ctx, onClose, borrow }: { ctx: Ctx; onClose: () => void; borrow: Borrow }) {
  const tiles = vibeTiles();
  const rows = Math.ceil(tiles.length / 2);
  const own = ctx.song.style;
  useEscape(onClose);
  const pick = (id: string | undefined): void => {
    borrow.onPick(id);
    onClose();
  };
  return (
    <div class="vibes" role="dialog" aria-label="Borrow a vibe's chords">
      <button class="btn vcont" id="borrow-own" aria-label={`This jam's vibe: ${vibeName(own) ?? "every vibe"}`} onClick={() => pick(undefined)}>
        <span>This jam's vibe</span>
        <small>{vibeName(own) ?? "Every vibe"}</small>
      </button>
      <div class="vibegrid" style={{ gridTemplateRows: `repeat(${rows}, minmax(48px, 64px))` }}>
        {tiles.map((t) => (
          <button
            key={t.id}
            class={`vibe${t.id === borrow.current ? " on" : ""}`}
            style={{ "--c": FAMILY_COLOR[t.family] }}
            data-borrow={t.id}
            aria-pressed={t.id === borrow.current}
            aria-label={`${t.name}: show its chords`}
            onClick={() => pick(t.id)}
          >
            <span>{t.name}</span>
          </button>
        ))}
      </div>
      <p class="note vnote">The cards show this vibe's chords. Nothing else changes.</p>
    </div>
  );
}

/**
 * The vibe control (spec 8.6, F1 spec 10.1), top of the Simple Play tab and in a tablet's header: the dice, which
 * draws the next vibe from the bag, then the current vibe as one large button that opens the picker, with an arrow
 * each side that loads the previous or next vibe. The dice and the arrows land on the next bar line while playing.
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
      <button class="btn varrow vdice" id="vibe-dice" aria-label="Dice: the next vibe from the bag, from the next bar" disabled={recording} onClick={() => void loadDrawn(ctx, false)}>
        <Icon thing="New idea" />
      </button>
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
