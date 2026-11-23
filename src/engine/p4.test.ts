/** P4: a progression card plays from the next bar line, mood and chords together, from its first chord. */
import { describe, expect, it } from "vitest";
import { buildChord } from "../music/chords.ts";
import { PROGRESSIONS, PROGRESSION_IDS, progressionChords } from "../music/progressions.ts";
import { mergePending, SwitchQueue } from "./queue.ts";
import { Sequencer, type StepResult } from "./sequencer.ts";
import { defaultSong, type ChordStep } from "./song.ts";

const run = (seq: Sequencer, steps: number): StepResult[] => Array.from({ length: steps }, () => seq.next());
const synthNotes = (r: StepResult): number[] | null => {
  const e = r.events.find((x) => x.inst === "synth");
  return e && e.inst === "synth" ? e.notes : null;
};
const bassNote = (r: StepResult): number | null => {
  const e = r.events.find((x) => x.inst === "bass");
  return e && e.inst === "bass" ? e.midi : null;
};

/** A progression in a mood other than the default song's, so mood and chords both change. */
const card = PROGRESSIONS[PROGRESSION_IDS.find((id) => PROGRESSIONS[id].mood === "major" && PROGRESSIONS[id].chords[0][0] !== 0)!];
const chords: ChordStep[] = progressionChords(card);

function playing(): Sequencer {
  const song = defaultSong();
  // Bass and synth on, so the bar-line assertions below have events to check (P4 review S3).
  song.sections[1].on.bass = true;
  song.sections[1].on.synth = true;
  song.sections[1].bass.rhythm = "dub"; // a hit on the bar line
  song.sections[1].synth.rhythm = "sustained"; // held: the chord starts on the bar line
  const seq = new Sequencer(song);
  seq.switchSection(1);
  seq.start();
  return seq;
}

describe("setProgression (P4)", () => {
  it("while playing, waits for the next bar line and then starts the progression from its first chord", () => {
    const seq = playing();
    run(seq, 16 + 5); // into bar 2, chord 2 of the old sequence
    expect(seq.setProgression(1, card.mood, chords)).toBe(true);
    expect(seq.song.mood).toBe("house");
    expect(seq.pending().chords).toEqual({ section: 1, mood: card.mood, chords });
    const rest = run(seq, 16 - 5);
    // Nothing changes before the bar line: the old mood and chords play to the end of the bar.
    expect(seq.song.sections[1].chords).not.toEqual(chords);
    for (const r of rest) expect(r.applied).toBeNull();
    const [line] = run(seq, 1);
    expect(line.step).toBe(0);
    expect(line.applied?.chords?.mood).toBe(card.mood);
    expect(line.retrigger).toBe(true);
    expect(seq.song.mood).toBe(card.mood);
    expect(seq.song.sections[1].chords).toEqual(chords);
    // The first chord of the card, in the song's key, on the bar line.
    const first = buildChord(seq.song.key, card.mood, chords[0].degree);
    expect(bassNote(line)).toBe(first.bass);
    expect(synthNotes(line)).toEqual(first.notes);
    expect(seq.pending().chords).toBeUndefined();
  });

  it("the progression's chords then follow in order, each for its length", () => {
    const seq = playing();
    run(seq, 3);
    seq.setProgression(1, card.mood, chords);
    run(seq, 13);
    const steps = run(seq, chords.reduce((n, c) => n + c.bars * 16, 0));
    let at = 0;
    for (const c of chords) {
      const want = buildChord(seq.song.key, card.mood, c.degree).bass;
      const basses = steps.slice(at, at + c.bars * 16).map(bassNote).filter((n): n is number => n !== null);
      for (const b of basses) expect(b).toBe(want);
      at += c.bars * 16;
    }
  });

  it("tapped again before the bar line, the same card cancels; another card replaces it", () => {
    const seq = playing();
    run(seq, 2);
    const before = JSON.stringify(seq.song.sections[1].chords);
    seq.setProgression(1, card.mood, chords);
    seq.setProgression(1, card.mood, chords);
    expect(seq.pending().chords).toBeUndefined();
    const other = progressionChords(PROGRESSIONS[PROGRESSION_IDS[1]]);
    seq.setProgression(1, card.mood, chords);
    seq.setProgression(1, PROGRESSIONS[PROGRESSION_IDS[1]].mood, other);
    expect(seq.pending().chords?.chords).toEqual(other);
    run(seq, 15);
    expect(JSON.stringify(seq.song.sections[1].chords)).toBe(JSON.stringify(other));
    expect(JSON.stringify(other)).not.toBe(before);
  });

  it("when stopped, acts at once", () => {
    const seq = new Sequencer(defaultSong());
    expect(seq.setProgression(2, card.mood, chords)).toBe(true);
    expect(seq.song.mood).toBe(card.mood);
    expect(seq.song.sections[2].chords).toEqual(chords);
    expect(seq.pending().chords).toBeUndefined();
  });

  it("lands together with a section switch on the same bar line, the new section starting the card", () => {
    const seq = playing();
    run(seq, 4);
    seq.switchSection(2);
    seq.setProgression(2, card.mood, chords);
    run(seq, 12);
    const [line] = run(seq, 1);
    expect(line.section).toBe(2);
    expect(line.applied?.section).toBe(2);
    expect(seq.song.sections[2].chords).toEqual(chords);
  });

  it("is refused while a vibe waits for the bar line, which would replace the song and drop the card (P4 review S5)", () => {
    const seq = playing();
    run(seq, 3);
    const next = defaultSong();
    next.name = "Next";
    seq.queueSong(next, 0);
    expect(seq.setProgression(1, card.mood, chords)).toBe(false);
    expect(seq.pending().chords).toBeUndefined();
    run(seq, 14); // through the bar line
    expect(seq.song.name).toBe("Next");
    expect(seq.songQueued).toBe(false);
    expect(seq.setProgression(1, card.mood, chords)).toBe(true);
  });

  it("refuses an unknown mood or section and a bad sequence, changing nothing", () => {
    const seq = playing();
    const was = JSON.stringify(seq.song);
    expect(seq.setProgression(1, "polka", chords)).toBe(false);
    expect(seq.setProgression(9, card.mood, chords)).toBe(false);
    expect(seq.setProgression(1, card.mood, [])).toBe(false);
    expect(seq.setProgression(1, card.mood, [{ degree: 8, bars: 1 }])).toBe(false);
    expect(JSON.stringify(seq.song)).toBe(was);
    expect(seq.pending().chords).toBeUndefined();
  });

  it("the queue keeps, copies, re-indexes and merges a waiting progression", () => {
    const q = new SwitchQueue();
    q.queueChords({ section: 2, mood: "major", chords });
    expect(q.empty).toBe(false);
    const c = q.clone(false);
    expect(c.pending().chords?.section).toBe(2);
    q.remap((i) => (i === 2 ? 1 : i));
    expect(q.pending().chords?.section).toBe(1);
    q.remap(() => null);
    expect(q.pending().chords).toBeUndefined();
    const m = mergePending({ section: null, toggles: [], chords: { section: 0, mood: "minor", chords } }, { section: 1, toggles: [] });
    expect(m.chords?.mood).toBe("minor");
    expect(m.section).toBe(1);
    expect(c.flush().chords?.section).toBe(2);
    expect(c.empty).toBe(true);
  });
});
