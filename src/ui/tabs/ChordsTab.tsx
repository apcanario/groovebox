/** Chords tab, easy mode (spec section 3): mood, key, seven in-key degree buttons, the section's sequence. */
import { useEffect, useState } from "preact/hooks";
import { MOODS, MOOD_TABLE, NOTE_NAMES, degreeChords } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
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
} from "../logic.ts";

export function ChordsTab({ ctx }: { ctx: Ctx }) {
  const { engine, song, edit } = ctx;
  const section = song.sections[edit];
  const [sel, setSel] = useState<number | null>(null);
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

  return (
    <section class="chordtab">
      <h1 class="head">
        <em>Chords</em> · {sectionLetter(edit)} {section.name}
      </h1>

      <div class="label">Mood</div>
      <div class="row5">
        {MOODS.map((m) => (
          <button
            key={m}
            class={`chip${song.mood === m ? " on" : ""}`}
            data-mood={m}
            aria-pressed={song.mood === m}
            onClick={() => engine.setKeyMood(song.key, m)}
          >
            {MOOD_TABLE[m].label}
          </button>
        ))}
      </div>

      <div class="label">Key</div>
      <div class="row6">
        {NOTE_NAMES.map((k) => (
          <button
            key={k}
            class={`chip mono${song.key === k ? " on" : ""}`}
            data-key={k}
            aria-pressed={song.key === k}
            onClick={() => engine.setKeyMood(k, song.mood)}
          >
            {k}
          </button>
        ))}
      </div>

      <div class="label">
        {sel !== null ? `Tap a chord to replace chord ${sel + 1}` : full ? "Sequence full: select a chord to replace it" : "Tap a chord to add it"}
      </div>
      <div class="degrees">
        {chords.map((c) => (
          <button
            key={c.degree}
            class="degree"
            data-degree={c.degree}
            disabled={sel === null && full}
            onClick={() => tapDegree(c.degree)}
          >
            <b>{c.label}</b>
            <span>{chordName(c.bass % 12, c.label, NOTE_NAMES)}</span>
          </button>
        ))}
      </div>

      <div class="label">
        Sequence · {seq.length} of {MAX_CHORDS}
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
              <b>{chord.label}</b>
              <span>{lengthLabel(c.bars)}</span>
            </button>
          );
        })}
      </div>

      {sel !== null && (
        <div class="seqtools">
          <button class="btn" id="chord-left" aria-label="Move left" disabled={sel === 0} onClick={() => {
            commit(moveChord(seq, sel, -1));
            setSel(sel - 1);
          }}>
            ◀
          </button>
          <button class="btn" id="chord-right" aria-label="Move right" disabled={sel === seq.length - 1} onClick={() => {
            commit(moveChord(seq, sel, 1));
            setSel(sel + 1);
          }}>
            ▶
          </button>
          <button class="btn" id="chord-length" onClick={() => commit(cycleLength(seq, sel))}>
            {lengthLabel(seq[sel].bars)}
          </button>
          <button class="btn danger" id="chord-remove" aria-label="Remove" disabled={seq.length <= 1} onClick={() => {
            commit(removeChord(seq, sel));
            setSel(null);
          }}>
            ✕
          </button>
        </div>
      )}
    </section>
  );
}
