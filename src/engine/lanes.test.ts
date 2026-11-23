/**
 * P1b: the lanes. The engine reports each instrument's current bar as notes (spec 8.12); every lane
 * must match what the instrument plays. These tests read a bar's lanes early in the bar (as the screen
 * does, a look-ahead behind the scheduler), then let the sequencer play the bar and compare note for note.
 */
import { describe, expect, it } from "vitest";
import { Sequencer, STEPS_PER_BAR, type LaneNote, type LaneNotes, type StepResult } from "./sequencer.ts";
import { defaultSong, INSTRUMENTS, type InstrumentId, type Song } from "./song.ts";

/** The notes a bar's step results hold, in the lanes' terms. */
function played(results: StepResult[]): LaneNotes {
  const out: LaneNotes = { drums: [], bass: [], synth: [], layer1: [], layer2: [] };
  for (const r of results) {
    for (const e of r.events) {
      if (e.inst === "drums") out.drums.push({ step: r.step, len: 1, shift: e.shift, vel: e.vel, voice: e.voice });
      else if (e.inst === "bass") out.bass.push({ step: r.step, len: e.len, shift: e.shift, vel: e.vel, pitch: e.midi });
      else for (const n of e.notes) out[e.inst].push({ step: r.step, len: e.len, shift: e.shift, vel: e.vel, pitch: n });
    }
  }
  return out;
}

/** What starts in the bar: step, swing, pitch or voice, velocity (lengths are compared separately). */
const starts = (notes: LaneNote[]): string[] =>
  notes.filter((n) => !n.held).map((n) => `${n.step}+${n.shift}:${n.voice ?? n.pitch}@${n.vel.toFixed(4)}`);

/** A song that uses every way an instrument can play: generative lead that mutates, random arp, pad, sustained synth. */
function busySong(): Song {
  const song = defaultSong();
  const g = song.sections[1];
  g.layer1.mode = "generative";
  g.layer1.gen = { ...g.layer1.gen, lock: 0.4, hits: 11, density: 0.9 };
  g.layer2.mode = "arp";
  g.layer2.arp = { ...g.layer2.arp, direction: "random", rate: 1 };
  const b = song.sections[2];
  b.layer1.mode = "pad";
  b.synth.rhythm = "sustained";
  return song;
}

describe("lanes (P1b)", () => {
  it("every lane matches what its instrument plays, bar after bar, read early and late in the bar", () => {
    const seq = new Sequencer(busySong());
    seq.switchSection(1);
    seq.start();
    let checked = 0;
    let carried: StepResult[] = []; // steps of this bar the scheduler already took
    for (let bar = 0; bar < 12; bar++) {
      const ahead = 1 + (bar % 3); // the scheduler leads the screen by one to three steps
      const first = [...carried];
      while (first.length < ahead) first.push(seq.next());
      const early = seq.lanes(bar);
      expect(early.bar).toBe(bar);
      // Switches queued mid-bar land on the next bar line; they do not change this bar.
      if (bar === 4) seq.switchSection(2);
      if (bar === 7) seq.toggleInstrument(2, "layer2");
      if (bar === 9) seq.switchSection(1);
      const all = [...first];
      while (all.length < STEPS_PER_BAR) all.push(seq.next());
      const heard = played(all);
      // The scheduler crosses into the next bar while the screen still shows this one.
      carried = [seq.next()];
      const late = seq.lanes(bar);
      for (const id of INSTRUMENTS) {
        if (!early.on[id]) continue;
        expect(starts(early.notes[id]), `bar ${bar} ${id}`).toEqual(starts(heard[id]));
        expect(starts(late.notes[id]), `bar ${bar} ${id}, read late`).toEqual(starts(heard[id]));
        checked += heard[id].length;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("a lane read early equals the bar as played, for every instrument and every bar", () => {
    const seq = new Sequencer(busySong());
    seq.switchSection(1);
    seq.start();
    for (let bar = 0; bar < 10; bar++) {
      const a = seq.next();
      const view = seq.lanes(bar);
      if (bar === 3) seq.switchSection(2);
      if (bar === 6) seq.toggleInstrument(2, "drums");
      const all = [a];
      for (let i = 1; i < STEPS_PER_BAR; i++) all.push(seq.next());
      const heard = played(all);
      for (const id of INSTRUMENTS) if (view.on[id]) expect(view.notes[id].filter((n) => !n.held)).toEqual(heard[id]);
    }
  });

  it("a note held over the bar line shows from step 0 of the next bar", () => {
    const song = busySong();
    const seq = new Sequencer(song);
    seq.switchSection(2); // Break: chord of two bars at the end, sustained synth, pad on Layer 1
    seq.start();
    let sawHeld = false;
    for (let bar = 0; bar < 6; bar++) {
      seq.next();
      const view = seq.lanes(bar);
      for (const id of ["synth", "layer1"] as InstrumentId[]) {
        if (!view.on[id]) continue;
        const first = view.notes[id].filter((n) => n.step === 0);
        expect(first.length, `bar ${bar} ${id}`).toBeGreaterThan(0);
        if (first.some((n) => n.held)) sawHeld = true;
      }
      for (let i = 1; i < STEPS_PER_BAR; i++) seq.next();
    }
    expect(sawHeld).toBe(true);
  });

  it("an instrument that is off still has notes: what it would play, with on false", () => {
    const seq = new Sequencer(busySong());
    seq.start(); // Intro: bass, synth and Layer 1 off
    seq.next();
    const view = seq.lanes(0);
    expect(view.on.bass).toBe(false);
    expect(view.on.drums).toBe(true);
    for (const id of ["bass", "synth", "layer1"] as const) expect(view.notes[id].length, id).toBeGreaterThan(0);
  });

  it("an off lane equals what the instrument plays when it is switched on for that bar (generative, arp, pad)", () => {
    // Section 1: the generative Layer 1 and the arp on Layer 2 off; section 2: the pad on Layer 1 off.
    const song = (): Song => {
      const s = busySong();
      s.sections[1].on.layer1 = false;
      s.sections[1].on.layer2 = false;
      s.sections[2].on.layer1 = false;
      return s;
    };
    const cases: [number, "layer1" | "layer2", string][] = [
      [1, "layer1", "generative"],
      [1, "layer2", "arp"],
      [2, "layer1", "pad"],
    ];
    let compared = 0;
    for (const [section, id, mode] of cases) {
      for (let bar = 1; bar <= 5; bar++) {
        const ghost = new Sequencer(song());
        const twin = new Sequencer(song());
        for (const s of [ghost, twin]) {
          s.switchSection(section);
          s.start();
        }
        expect(song().sections[section][id].mode).toBe(mode);
        // Both play the same bars up to `bar`; the twin's toggle is queued in the bar before, so it lands on bar's line.
        for (let i = 0; i < bar * STEPS_PER_BAR; i++) {
          if (i === (bar - 1) * STEPS_PER_BAR + 3) twin.toggleInstrument(section, id);
          expect(ghost.next().events).toEqual(twin.next().events);
        }
        ghost.next();
        const view = ghost.lanes(bar);
        expect(view.on[id], `${mode} bar ${bar}`).toBe(false);
        const heardBar = [twin.next()];
        for (let i = 1; i < STEPS_PER_BAR; i++) heardBar.push(twin.next());
        const heard = played(heardBar)[id];
        expect(heard.length, `${mode} bar ${bar}: the twin plays`).toBeGreaterThan(0);
        expect(starts(view.notes[id]), `${mode} bar ${bar}`).toEqual(starts(heard));
        compared += heard.length;
      }
    }
    expect(compared).toBeGreaterThan(20);
  });

  it("when stopped, the lanes are the first bar Play starts with", () => {
    const song = busySong();
    const seq = new Sequencer(song);
    seq.switchSection(1);
    const view = seq.lanes();
    expect(view.playing).toBe(false);
    seq.start();
    const bar: StepResult[] = [];
    for (let i = 0; i < STEPS_PER_BAR; i++) bar.push(seq.next());
    const heard = played(bar);
    for (const id of INSTRUMENTS) expect(view.notes[id].filter((n) => !n.held), id).toEqual(heard[id]);
  });

  it("reading the lanes changes nothing the sequencer plays", () => {
    const a = new Sequencer(busySong());
    const b = new Sequencer(busySong());
    for (const s of [a, b]) {
      s.switchSection(1);
      s.start();
    }
    for (let i = 0; i < 64; i++) {
      if (i % 5 === 0) a.lanes(Math.floor(i / 16));
      expect(a.next().events).toEqual(b.next().events);
    }
  });
});
