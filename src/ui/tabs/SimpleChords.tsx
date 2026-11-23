/**
 * Simple Chords (P4, spec 8.4): no scales and no degrees. Pick a feel, then tap one of four progression cards;
 * More chords shows the next four. A card names its progression in plain words and shows its chords as coloured
 * blocks; tapped, it plays from the next bar line (mood and chords together, from its first chord). The cards are
 * those that suit the song's vibe; the vibe button in the title borrows another vibe's. Lower and Higher move the
 * whole song a semitone, with no note names. Nothing scrolls.
 */
import { createPortal } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import { FEELS, type Feel } from "../../music/data.ts";
import {
  FEEL_LABEL,
  PROGRESSIONS,
  cardPage,
  findProgression,
  isProgression,
  openingFeel,
  pageOf,
  progressionChords,
  progressionsFor,
} from "../../music/progressions.ts";
import { NOTE_NAMES, type ChordStep } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Icon } from "../icons.tsx";
import { CHORD_COLOR } from "../logic.ts";
import { BorrowPicker, vibeName } from "../vibes.tsx";

/** What the tab shows, kept while the app runs so a trip to another tab comes back to the same cards. */
interface View {
  /** The song's vibe when this view was made: a new vibe starts a new view. */
  style: string | undefined;
  /** A borrowed vibe, or undefined for the song's own. */
  vibe: string | undefined;
  feel: Feel;
  page: number;
}
let kept: View | null = null;

/** A block's height by its place in the key: the colours read as steps going up. */
function blockHeight(degree: number): string {
  return `${40 + degree * 10}%`;
}

function Card({ id, state, locked, onTap }: { id: string; state: "playing" | "pending" | null; locked: boolean; onTap: () => void }) {
  const p = PROGRESSIONS[id];
  const word = state === "pending" ? "Next bar" : state === "playing" ? "Playing" : null;
  return (
    <button
      class={`tile card${state ? ` ${state}` : ""}`}
      style={{ "--c": "var(--yellow)" }}
      data-prog={id}
      aria-pressed={state === "playing"}
      disabled={locked}
      aria-label={`${p.name}${word ? `, ${word.toLowerCase()}` : ""}: play from the next bar`}
      onClick={onTap}
    >
      <b>{p.name}</b>
      <span class="blocks" aria-hidden="true">
        {p.chords.map(([d, bars], i) => (
          <i key={i} style={{ flexGrow: bars, background: CHORD_COLOR[d], height: blockHeight(d) }} />
        ))}
      </span>
      {word && <small>{word}</small>}
    </button>
  );
}

export function SimpleChords({ ctx }: { ctx: Ctx }) {
  const { engine, song, edit, pending } = ctx;
  const section = song.sections[edit];
  const playingId = findProgression(song.mood, section.chords);
  const [view, setView] = useState<View>(() => {
    if (kept && kept.style === song.style) return kept;
    const feel = openingFeel(song.mood, section.chords);
    return { style: song.style, vibe: undefined, feel, page: pageOf(progressionsFor(song.style, feel), playingId) };
  });
  const [borrowing, setBorrowing] = useState(false);
  // A new vibe loaded (the arrows, New jam) starts from its own cards.
  useEffect(() => {
    if (view.style === song.style) return;
    const feel = openingFeel(song.mood, section.chords);
    setView({ style: song.style, vibe: undefined, feel, page: pageOf(progressionsFor(song.style, feel), playingId) });
  }, [song.style]);
  useEffect(() => {
    kept = view;
  }, [view]);

  const vibe = view.vibe ?? song.style;
  const list = progressionsFor(vibe, view.feel);
  const { shown, page, pages } = cardPage(list, view.page);
  // A vibe waiting for the bar line replaces the whole song there, so a card tapped now could never play (P4 review S5).
  const loading = engine.pendingLoad() !== null;
  const waiting = pending.chords && pending.chords.section === edit ? pending.chords : null;

  const pickFeel = (feel: Feel): void => setView({ ...view, feel, page: pageOf(progressionsFor(vibe, feel), playingId) });
  const play = (id: string): void => {
    const p = PROGRESSIONS[id];
    engine.setProgression(edit, p.mood, progressionChords(p));
  };
  const transpose = (d: -1 | 1): void => engine.setKeyMood(NOTE_NAMES[(NOTE_NAMES.indexOf(song.key) + d + 12) % 12], song.mood);
  const stateOf = (id: string): "playing" | "pending" | null => {
    if (waiting) {
      if (isProgression(PROGRESSIONS[id], waiting.mood, waiting.chords as ChordStep[])) return "pending";
    }
    return id === playingId ? "playing" : null;
  };
  const vibeWord = vibeName(vibe) ?? "Every vibe";
  const borrowed = view.vibe !== undefined && view.vibe !== song.style;

  return (
    <section class="chordtab simple">
      <div class="headrow">
        <h1 class="head">
          <em style={{ color: "var(--yellow)" }}>
            <Icon name="piano" />
            Chords
          </em>
        </h1>
        <button
          class={`btn cvibe${borrowed ? " borrowed" : ""}`}
          id="chord-vibe"
          aria-label={`Chords that suit ${vibeWord}${borrowed ? " (borrowed)" : ""}: tap to borrow another vibe's chords`}
          onClick={() => setBorrowing(true)}
        >
          <span>{vibeWord}</span>
          <Icon name="chevron_right" />
        </button>
      </div>
      <div class="feels" role="group" aria-label="Feel">
        {FEELS.map((f) => (
          <button key={f} class={`chip${view.feel === f ? " on" : ""}`} data-feel={f} aria-pressed={view.feel === f} onClick={() => pickFeel(f)}>
            {FEEL_LABEL[f]}
          </button>
        ))}
      </div>
      {/* The feel and the page on their own line over the cards (groovebox-3), never cut at 360 px. No section
          letter: beside chords a lone "B" reads as a key (P4 review M3); the strip shows the section. */}
      <div class="glabel cardline" id="chord-where">
        {FEEL_LABEL[view.feel]} · {page + 1} of {pages}
      </div>
      <div class="cards">
        {shown.map((id) => (
          <Card key={id} id={id} state={stateOf(id)} locked={loading} onTap={() => play(id)} />
        ))}
      </div>
      <div class="row3 cardtools">
        <button class="btn" data-transpose={-1} aria-label="Lower: the whole song a semitone down" onClick={() => transpose(-1)}>
          Lower
        </button>
        <button
          class="btn more"
          id="chord-more"
          data-page-of={`${page + 1}/${pages}`}
          disabled={pages < 2}
          aria-label={`More chords: page ${page + 1} of ${pages}, tap for the next`}
          onClick={() => setView({ ...view, page: page + 1 })}
        >
          More chords
        </button>
        <button class="btn" data-transpose={1} aria-label="Higher: the whole song a semitone up" onClick={() => transpose(1)}>
          Higher
        </button>
      </div>
      {/* Drawn over the whole app, outside the tab body (which clips what it holds), like the picker of New jam. */}
      {borrowing &&
        createPortal(
          <BorrowPicker
            ctx={ctx}
            onClose={() => setBorrowing(false)}
            borrow={{
              current: vibe,
              onPick: (id) => setView({ ...view, vibe: id, page: pageOf(progressionsFor(id ?? song.style, view.feel), playingId) }),
            }}
          />,
          document.body,
        )}
    </section>
  );
}
