/**
 * Chords tab, easy mode (spec section 3) on two pages so nothing scrolls (P1): Chords (seven in-key
 * degree buttons, the section's sequence and its tools) and Key (mood and key).
 */
import { useEffect, useState } from "preact/hooks";
import { MOODS, MOOD_TABLE, NOTE_NAMES, degreeChords } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { Pager } from "../components.tsx";
import {
  MAX_CHORDS,
  addChord,
  chordName,
  cycleLength,
  lengthLabel,
  moveChord,
  removeChord,
  replaceChord,
  sectionLetter,
  SIMPLE_MOOD_LABEL,
  type PageDef,
} from "../logic.ts";

type ChordPage = "chords" | "key";

export function ChordsTab({ ctx }: { ctx: Ctx }) {
  const { engine, song, edit, advanced } = ctx;
  const section = song.sections[edit];
  const [sel, setSel] = useState<number | null>(null);
  const [page, setPage] = useState<ChordPage>("chords");
  // A different section, or a shorter sequence, clears the selection.
  useEffect(() => setSel(null), [edit]);
  useEffect(() => {
    if (sel !== null && sel >= section.chords.length) setSel(null);
  }, [sel, section.chords.length]);

  const chords = degreeChords(song.key, song.mood);
  const seq = section.chords;
  const commit = (next: typeof seq): void => {
    if (next !== seq) engine.setChords(edit, next);
  };
  const tapDegree = (d: number): void => {
    if (sel !== null) commit(replaceChord(seq, sel, d));
    else commit(addChord(seq, d));
  };
  const full = seq.length >= MAX_CHORDS;

  const mood = MOOD_TABLE[song.mood];
  const pages: PageDef<ChordPage>[] = [
    ["chords", `Chords · ${sectionLetter(edit)}`],
    // Simple shows no note or scale names (spec 8.1): the mood by how it feels.
    ["key", advanced ? `Key · ${song.key} ${mood.label}` : `Key · ${SIMPLE_MOOD_LABEL[song.mood]}`],
  ];
  const hint =
    sel !== null ? `Tap a chord to replace chord ${sel + 1}` : full ? "Sequence full: select a chord to replace it" : "Tap a chord to add it";

  return (
    <section class="chordtab">
      <Pager id="chords" pages={pages} page={page} onPage={setPage} />
      {page === "key" && (
        <div class="page">
          <div class="row5">
            {MOODS.map((m) => (
              <button
                key={m}
                class={`chip${song.mood === m ? " on" : ""}`}
                data-mood={m}
                aria-pressed={song.mood === m}
                onClick={() => engine.setKeyMood(song.key, m)}
              >
                {advanced ? MOOD_TABLE[m].label : SIMPLE_MOOD_LABEL[m]}
              </button>
            ))}
          </div>
          {!advanced && (
            <div class="row2">
              {([-1, 1] as const).map((d) => (
                <button
                  key={d}
                  class="btn"
                  data-transpose={d}
                  aria-label={d < 0 ? "Lower: the whole song a semitone down" : "Higher: the whole song a semitone up"}
                  onClick={() => engine.setKeyMood(NOTE_NAMES[(NOTE_NAMES.indexOf(song.key) + d + 12) % 12], song.mood)}
                >
                  {d < 0 ? "Lower" : "Higher"}
                </button>
              ))}
            </div>
          )}
          {advanced && <div class="row6">
            {NOTE_NAMES.map((k) => (
              <button
                key={k}
                class={`chip${song.key === k ? " on" : ""}`}
                data-key={k}
                aria-pressed={song.key === k}
                onClick={() => engine.setKeyMood(k, song.mood)}
              >
                {k}
              </button>
            ))}
          </div>}
          <p class="note">
            {section.name} · {seq.length} of {MAX_CHORDS} chords
          </p>
        </div>
      )}
      {page === "chords" && (
        <div class="page">
          <p class="note" id="chord-hint">
            {hint}
          </p>
          <div class="degrees">
            {chords.map((c) => (
              <button
                key={c.degree}
                class="degree"
                data-degree={c.degree}
                disabled={sel === null && full}
                onClick={() => tapDegree(c.degree)}
              >
                {/* Simple: the chord's number in the key, no degree or note names (spec 8.1). */}
                <b>{advanced ? c.label : c.degree + 1}</b>
                {advanced && <span>{chordName(c.bass % 12, c.label, NOTE_NAMES)}</span>}
              </button>
            ))}
          </div>
          <div class="seq">
            {seq.map((c, i) => {
              const chord = chords[c.degree];
              return (
                <button
                  key={i}
                  class={`step${sel === i ? " on" : ""}`}
                  data-seq={i}
                  aria-pressed={sel === i}
                  onClick={() => setSel(sel === i ? null : i)}
                >
                  <b>{advanced ? chord.label : c.degree + 1}</b>
                  <span>{lengthLabel(c.bars)}</span>
                </button>
              );
            })}
          </div>
          <div class="seqtools">
            <button
              class="btn"
              id="chord-left"
              aria-label="Move left"
              disabled={sel === null || sel === 0}
              onClick={() => {
                if (sel === null) return;
                commit(moveChord(seq, sel, -1));
                setSel(sel - 1);
              }}
            >
              Left
            </button>
            <button
              class="btn"
              id="chord-right"
              aria-label="Move right"
              disabled={sel === null || sel === seq.length - 1}
              onClick={() => {
                if (sel === null) return;
                commit(moveChord(seq, sel, 1));
                setSel(sel + 1);
              }}
            >
              Right
            </button>
            <button class="btn" id="chord-length" disabled={sel === null} onClick={() => sel !== null && commit(cycleLength(seq, sel))}>
              {sel !== null ? lengthLabel(seq[sel].bars) : "Length"}
            </button>
            <button
              class="btn danger"
              id="chord-remove"
              aria-label="Remove"
              disabled={sel === null || seq.length <= 1}
              onClick={() => {
                if (sel === null) return;
                commit(removeChord(seq, sel));
                setSel(null);
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
