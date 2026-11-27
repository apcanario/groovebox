/**
 * Chords tab. Advanced: the G2 editor (spec 8.4), easy mode of section 3 on two pages so nothing scrolls (P1):
 * Chords (seven in-key degree buttons, the section's sequence and its tools) and Key (mood and key). Simple
 * (P4): a feel, four progression cards, More chords, Lower and Higher, and the vibe button (SimpleChords.tsx).
 */
import { useEffect, useState } from "preact/hooks";
import { MOODS, MOOD_TABLE, NOTE_NAMES, degreeChords } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { GroupLabel, Pager } from "../components.tsx";
import { useFull } from "./full.ts";
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
  type PageDef,
} from "../logic.ts";
import { SimpleChords } from "./SimpleChords.tsx";

type ChordPage = "chords" | "key";

export function ChordsTab({ ctx }: { ctx: Ctx }) {
  // T2 (spec 9.2): Advanced Chords on the desk shows the editor and the progression library side by side where they fit.
  const [full, ref] = useFull(ctx, "chords", ctx.advanced);
  if (!ctx.advanced) return <SimpleChords ctx={ctx} />;
  if (!full) return <ChordEditor ctx={ctx} sref={ref} />;
  return (
    <section ref={ref} class="chordtab whole" data-whole="chords">
      <div class="cols">
        <div class="col">
          <ChordEditor ctx={ctx} whole />
        </div>
        <div class="col">
          <SimpleChords ctx={ctx} title="Library" />
        </div>
      </div>
    </section>
  );
}

/**
 * The G2 degree editor (Advanced, spec 8.4). Whole (T2, on the desk): the Key page over the Chords page, no page chips.
 */
function ChordEditor({ ctx, sref, whole = false }: { ctx: Ctx; sref?: { current: HTMLElement | null }; whole?: boolean }) {
  const { engine, song, edit } = ctx;
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
    ["key", `Key · ${song.key} ${mood.label}`],
  ];
  const hint =
    sel !== null ? `Tap a chord to replace chord ${sel + 1}` : full ? "Sequence full: select a chord to replace it" : "Tap a chord to add it";

  return (
    <section ref={sref} class="chordtab">
      {!whole && <Pager id="chords" pages={pages} page={page} onPage={setPage} />}
      {whole && <GroupLabel thing="Key">{pages[1][1]}</GroupLabel>}
      {(whole || page === "key") && (
        <div class="page keypage">
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
          <div class="row6">
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
          </div>
          <p class="note">
            {section.name} · {seq.length} of {MAX_CHORDS} chords
          </p>
        </div>
      )}
      {whole && <GroupLabel thing="Chords">{pages[0][1]}</GroupLabel>}
      {(whole || page === "chords") && (
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
                <b>{c.label}</b>
                <span>{chordName(c.bass % 12, c.label, NOTE_NAMES)}</span>
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
                  <b>{chord.label}</b>
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
