import { describe, expect, it } from "vitest";
import { inScale } from "../music/scales.ts";
import { InFlight, SwitchQueue, type Pending } from "./queue.ts";
import { Sequencer, chordAt, type StepResult } from "./sequencer.ts";
import { DRUM_PATTERNS } from "../music/presets.ts";
import {
  INSTRUMENTS,
  PATCH_RANGES,
  clampPatchValue,
  cloneSong,
  defaultSong,
  parseSong,
  sectionDrumGrid,
  serializeSong,
  validateSong,
  type InstrumentId,
} from "./song.ts";

const run = (seq: Sequencer, steps: number): StepResult[] => Array.from({ length: steps }, () => seq.next());
const sounding = (r: StepResult, inst: InstrumentId): boolean => r.events.some((e) => e.inst === inst);

describe("song schema", () => {
  it("the default song is valid: four sections, A minor, House", () => {
    const s = defaultSong();
    expect(validateSong(s)).toEqual([]);
    expect(s.sections).toHaveLength(4);
    expect(s.key).toBe("A");
    expect(s.mood).toBe("house");
  });
  it("round-trips through JSON", () => {
    const s = defaultSong();
    expect(parseSong(serializeSong(s))).toEqual(s);
  });
  it("rejects bad documents with a reason per field", () => {
    const s = cloneSong(defaultSong()) as unknown as Record<string, unknown>;
    s.bpm = 200;
    s.key = "H";
    const errs = validateSong(s);
    expect(errs.some((e) => e.startsWith("bpm"))).toBeTruthy();
    expect(errs.some((e) => e.startsWith("key"))).toBeTruthy();
    expect(() => parseSong(JSON.stringify(s))).toThrow();
  });
  it("limits sections to 1..4 and chords to 1..8", () => {
    const s = defaultSong();
    s.sections.push(cloneSong(s).sections[0]);
    expect(validateSong(s).some((e) => e.startsWith("sections"))).toBeTruthy();
    const t = defaultSong();
    t.sections[0].chords = [];
    expect(validateSong(t).some((e) => e.includes("chords"))).toBeTruthy();
    const u = defaultSong();
    u.sections[0].chords = Array.from({ length: 9 }, () => ({ degree: 0, bars: 1 as const }));
    expect(validateSong(u).some((e) => e.includes("chords"))).toBeTruthy();
  });
  it("checks patches, layer settings and edited drum grids", () => {
    const s = defaultSong();
    s.patches.synth.cutoff = 2;
    s.sections[1].layer1.gen.length = 1;
    s.sections[2].drums.grid = { kick: [1], clap: [], hat: [], open: [] } as never;
    const errs = validateSong(s);
    expect(errs.some((e) => e.includes("patches.synth.cutoff"))).toBeTruthy();
    expect(errs.some((e) => e.includes("gen.length"))).toBeTruthy();
    expect(errs.some((e) => e.includes("drums.grid"))).toBeTruthy();
  });
  it("one patch per instrument, shared by all sections", () => {
    const s = defaultSong();
    for (const id of INSTRUMENTS) expect(s.patches[id]).toBeTruthy();
    for (const sec of s.sections) expect((sec as unknown as Record<string, unknown>).patches).toBe(undefined);
  });
});

describe("patch values", () => {
  it("clamps numbers to PATCH_RANGES and refuses unknown waves", () => {
    expect(clampPatchValue("attack", 0)).toBe(PATCH_RANGES.attack[0]);
    expect(clampPatchValue("cutoff", 2)).toBe(1);
    expect(clampPatchValue("level", -1)).toBe(0);
    expect(clampPatchValue("release", 1.5)).toBe(1.5);
    expect(clampPatchValue("resonance", Number.NaN)).toBe(null);
    expect(clampPatchValue("wave", "square")).toBe("square");
    expect(clampPatchValue("wave", "noise")).toBe("noise"); // P7
    expect(clampPatchValue("wave", "plink" as never)).toBe(null);
  });
});

describe("drum grids", () => {
  it("a section plays its edited grid instead of the preset's", () => {
    const song = defaultSong();
    const grid = { kick: Array(16).fill(0), clap: Array(16).fill(0), hat: Array(16).fill(0), open: Array(16).fill(0), perc: Array(16).fill(0), shaker: Array(16).fill(0) };
    grid.kick[3] = 1;
    song.sections[0].drums.grid = grid;
    expect(validateSong(song)).toEqual([]);
    expect(sectionDrumGrid(song.sections[0])).toBe(grid);
    expect(sectionDrumGrid(song.sections[1])).toBe(DRUM_PATTERNS[song.sections[1].drums.preset].grid);
    const seq = new Sequencer(song);
    seq.start();
    const bar = run(seq, 16);
    const hits = bar.flatMap((r) => r.events.filter((e) => e.inst === "drums").map((e) => [r.step, (e as { voice: string }).voice]));
    expect(hits).toEqual([[3, "kick"]]);
  });
});

describe("switch queue", () => {
  it("a second tap cancels a toggle", () => {
    const q = new SwitchQueue();
    q.queueToggle(0, "bass");
    q.queueToggle(0, "bass");
    expect(q.empty).toBe(true);
  });
  it("a second tap cancels a section switch; tapping the playing section cancels too", () => {
    const q = new SwitchQueue();
    q.queueSection(2, 0);
    q.queueSection(2, 0);
    expect(q.pending().section).toBe(null);
    q.queueSection(3, 0);
    q.queueSection(0, 0);
    expect(q.pending().section).toBe(null);
  });
  it("a later section tap replaces an earlier one", () => {
    const q = new SwitchQueue();
    q.queueSection(1, 0);
    q.queueSection(2, 0);
    expect(q.pending().section).toBe(2);
  });
});

describe("sequencer", () => {
  it("plays the default song: section A has drums and the pad layer, nothing else", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    const bar = run(seq, 16);
    expect(bar.some((r) => sounding(r, "drums"))).toBe(true);
    expect(bar.some((r) => sounding(r, "layer2"))).toBe(true);
    expect(bar.some((r) => sounding(r, "bass"))).toBe(false);
    expect(bar.every((r) => r.section === 0)).toBe(true);
  });

  it("a section switch lands on the next bar line, not before", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    run(seq, 5);
    seq.switchSection(1);
    expect(seq.pending().section).toBe(1);
    const rest = run(seq, 11);
    expect(rest.every((r) => r.section === 0)).toBe(true);
    const line = seq.next();
    expect(line.step).toBe(0);
    expect(line.bar).toBe(1);
    expect(line.section).toBe(1);
    expect(line.applied?.section).toBe(1);
    expect(seq.pending().section).toBe(null);
  });

  it("three toggles tapped inside one bar all land on the same bar line", () => {
    const seq = new Sequencer(defaultSong());
    seq.switchSection(1); // Groove: everything on
    seq.start();
    run(seq, 3);
    seq.toggleInstrument(1, "bass");
    run(seq, 4);
    seq.toggleInstrument(1, "synth");
    run(seq, 6);
    seq.toggleInstrument(1, "layer1");
    expect(seq.pending().toggles).toHaveLength(3);
    // Until the bar line all three still play.
    const before = run(seq, 3);
    expect(seq.song.sections[1].on.bass).toBe(true);
    expect(before.some((r) => sounding(r, "bass"))).toBe(true);
    const line = seq.next();
    expect(line.step).toBe(0);
    expect(line.applied?.toggles.map((t) => t.instrument)).toEqual(["bass", "synth", "layer1"]);
    expect(line.stopped).toEqual(["bass", "synth", "layer1"]);
    const after = [line, ...run(seq, 15)];
    for (const id of ["bass", "synth", "layer1"] as const) expect(after.some((r) => sounding(r, id))).toBe(false);
    expect(after.some((r) => sounding(r, "drums"))).toBe(true);
  });

  it("a toggle tapped twice inside a bar does nothing", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    run(seq, 2);
    seq.toggleInstrument(0, "bass");
    seq.toggleInstrument(0, "bass");
    run(seq, 14);
    const line = seq.next();
    expect(line.applied).toBe(null);
    expect(seq.song.sections[0].on.bass).toBe(false);
  });

  it("a section switch and toggles tapped in one bar land together", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    run(seq, 7);
    seq.toggleInstrument(0, "drums");
    seq.switchSection(2);
    run(seq, 9);
    const line = seq.next();
    expect(line.section).toBe(2);
    expect(line.applied?.toggles).toHaveLength(1);
    expect(seq.song.sections[0].on.drums).toBe(false);
  });

  it("toggling another section changes it at once, silently", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    run(seq, 3);
    seq.toggleInstrument(3, "synth");
    expect(seq.song.sections[3].on.synth).toBe(true);
    expect(seq.pending().toggles).toHaveLength(0);
  });

  it("when stopped, switches apply at once", () => {
    const seq = new Sequencer(defaultSong());
    seq.switchSection(2);
    expect(seq.section).toBe(2);
    seq.toggleInstrument(2, "bass");
    expect(seq.song.sections[2].on.bass).toBe(true);
  });

  it("each instrument toggles per section", () => {
    const seq = new Sequencer(defaultSong());
    for (const id of INSTRUMENTS) {
      const before = seq.song.sections.map((s) => s.on[id]);
      seq.toggleInstrument(1, id);
      const after = seq.song.sections.map((s) => s.on[id]);
      expect(after[1]).toBe(!before[1]);
      expect([after[0], after[2], after[3]]).toEqual([before[0], before[2], before[3]]);
    }
  });

  it("follows the section's chord sequence, and restarts it on a section switch", () => {
    const song = defaultSong();
    const seq = new Sequencer(song);
    seq.switchSection(1);
    seq.start();
    const bars = run(seq, 64);
    const roots = [0, 16, 32, 48].map((i) => (bars[i].events.find((e) => e.inst === "layer2") as { notes: number[] }).notes[0] % 12);
    expect(roots).toEqual([9, 5, 2, 4]); // A F D E
    expect(chordAt(song, song.sections[0], 16).chord.degree).toBe(0); // first chord lasts 2 bars
    expect(chordAt(song, song.sections[0], 32).chord.degree).toBe(5);
  });

  it("every note of every section is in key", () => {
    const song = defaultSong();
    for (let i = 0; i < song.sections.length; i++) {
      const s = cloneSong(song);
      for (const id of INSTRUMENTS) s.sections[i].on[id] = true;
      const seq = new Sequencer(s);
      seq.switchSection(i);
      seq.start();
      for (const r of run(seq, 16 * 16))
        for (const e of r.events) {
          if (e.inst === "drums") continue;
          const notes = e.inst === "bass" ? [e.midi] : e.notes;
          for (const n of notes) expect(inScale(n, s.key, s.mood)).toBeTruthy();
        }
    }
  });

  it("the same song plays the same notes twice (seeded)", () => {
    const play = (): string => {
      const seq = new Sequencer(defaultSong());
      seq.switchSection(1);
      seq.start();
      return JSON.stringify(run(seq, 16 * 32).map((r) => r.events));
    };
    expect(play()).toBe(play());
  });

  it("half-bar chords last eight steps", () => {
    const song = defaultSong();
    const sec = song.sections[0];
    sec.chords = [
      { degree: 0, bars: 0.5 },
      { degree: 3, bars: 0.5 },
      { degree: 4, bars: 1 },
    ];
    expect(chordAt(song, sec, 0).chord.degree).toBe(0);
    expect(chordAt(song, sec, 7).remaining).toBe(1);
    expect(chordAt(song, sec, 8).chord.degree).toBe(3);
    expect(chordAt(song, sec, 8).starts).toBe(true);
    expect(chordAt(song, sec, 16).chord.degree).toBe(4);
    expect(chordAt(song, sec, 32).chord.degree).toBe(0); // wraps after two bars
  });

  it("in a swung section every event on an odd step carries the same shift", () => {
    const song = defaultSong();
    const outro = song.sections[3]; // houseShuffle with the rolling bass
    for (const id of INSTRUMENTS) outro.on[id] = true;
    const swing = DRUM_PATTERNS[outro.drums.preset].swing;
    expect(swing).toBeGreaterThan(0);
    const seq = new Sequencer(song);
    seq.switchSection(3);
    seq.start();
    const steps = run(seq, 16 * 4);
    const odd = steps.filter((r) => r.step % 2 === 1).flatMap((r) => r.events);
    expect(odd.some((e) => e.inst === "bass")).toBe(true);
    for (const e of odd) expect(e.shift).toBe(swing);
    for (const r of steps.filter((r) => r.step % 2 === 0)) for (const e of r.events) expect(e.shift).toBe(0);
  });

  it("a song saved and reloaded plays note for note", () => {
    const play = (song: ReturnType<typeof defaultSong>): StepResult[] => {
      const seq = new Sequencer(song);
      const out: StepResult[] = [];
      for (let i = 0; i < song.sections.length; i++) {
        seq.stop();
        seq.switchSection(i);
        seq.start();
        out.push(...run(seq, 16 * 8));
      }
      return out;
    };
    const song = defaultSong();
    song.sections[1].layer1.gen.seed = 4242;
    song.sections[2].drums.grid = { ...DRUM_PATTERNS.houseShuffle.grid, kick: Array(16).fill(0.5) };
    expect(play(parseSong(serializeSong(song)))).toEqual(play(cloneSong(song)));
  });

  it("the pad starts on a bar where it is turned on mid-chord", () => {
    const song = defaultSong();
    song.sections[0].on.layer2 = false;
    const seq = new Sequencer(song);
    seq.start();
    run(seq, 4);
    seq.toggleInstrument(0, "layer2"); // first chord of Intro lasts two bars
    run(seq, 12);
    const line = seq.next();
    expect(sounding(line, "layer2")).toBe(true);
    const pad = line.events.find((e) => e.inst === "layer2") as { len: number };
    expect(pad.len).toBe(16);
  });
});

describe("editing from the UI (G2)", () => {
  it("a key or mood change acts on the next step and restarts held chords in the new key", () => {
    const song = defaultSong();
    song.sections[1].synth.rhythm = "sustained";
    const seq = new Sequencer(song);
    seq.switchSection(1);
    seq.start();
    run(seq, 5);
    seq.setKeyMood("D", "deep");
    const r = seq.next();
    expect(r.retrigger).toBe(true);
    const synth = r.events.find((e) => e.inst === "synth") as { notes: number[] } | undefined;
    expect(synth).toBeDefined();
    for (const n of synth!.notes) expect(inScale(n, "D", "deep")).toBe(true);
    const pad = r.events.find((e) => e.inst === "layer2") as { notes: number[] } | undefined;
    expect(pad).toBeDefined();
    expect(seq.next().retrigger).toBe(false);
  });

  it("a key change in the middle of a long bass note restarts it at the new root", () => {
    const song = defaultSong();
    song.sections[1].bass.rhythm = "long";
    song.sections[1].chords = [{ degree: 0, bars: 1 }];
    const seq = new Sequencer(song);
    seq.switchSection(1);
    seq.start();
    run(seq, 3); // steps 0..2: the note from step 0 (7.5 steps) is still sounding
    seq.setKeyMood("D", "deep");
    const r = seq.next();
    expect(r.step).toBe(3);
    expect(r.retrigger).toBe(true);
    const bass = r.events.filter((e) => e.inst === "bass") as { midi: number; len: number }[];
    expect(bass).toHaveLength(1);
    expect(inScale(bass[0].midi, "D", "deep")).toBe(true);
    expect(bass[0].len).toBeCloseTo(4.5);
    // No restart once the note is over.
    song.sections[1].bass.rhythm = "dnbSub"; // hits at 0 (6 steps) and 10 (5.5 steps): steps 6..9 are silent
    run(seq, 3); // steps 4..6
    seq.setKeyMood("A", "house");
    const gap = seq.next();
    expect(gap.step).toBe(7);
    expect(gap.retrigger).toBe(true);
    expect(gap.events.some((e) => e.inst === "bass")).toBe(false);
  });

  it("chord edits are validated and restart only the playing section's chords", () => {
    const seq = new Sequencer(defaultSong());
    seq.switchSection(1);
    seq.start();
    run(seq, 3);
    expect(seq.setChords(1, [])).toBe(false);
    expect(seq.setChords(1, Array.from({ length: 9 }, () => ({ degree: 0, bars: 1 as const })))).toBe(false);
    expect(seq.setChords(1, [{ degree: 7, bars: 1 }])).toBe(false);
    expect(seq.setChords(1, [{ degree: 2, bars: 3 as unknown as 1 }])).toBe(false);
    expect(seq.setChords(2, [{ degree: 2, bars: 1 }])).toBe(true);
    expect(seq.next().retrigger).toBe(false);
    expect(seq.setChords(1, [{ degree: 3, bars: 2 }, { degree: 4, bars: 0.5 }])).toBe(true);
    expect(seq.next().retrigger).toBe(true);
    expect(seq.song.sections[1].chords).toEqual([{ degree: 3, bars: 2 }, { degree: 4, bars: 0.5 }]);
    expect(validateSong(seq.song)).toEqual([]);
  });

  it("rename refuses blank names and trims long ones", () => {
    const seq = new Sequencer(defaultSong());
    expect(seq.renameSection(0, "   ")).toBe(false);
    expect(seq.renameSection(0, "  Drop  ")).toBe(true);
    expect(seq.song.sections[0].name).toBe("Drop");
    seq.renameSection(1, "A very long section name");
    expect(seq.song.sections[1].name.length).toBeLessThanOrEqual(12);
  });

  it("add and copy stop at four sections; a copy lands right after its source", () => {
    const song = defaultSong();
    song.sections = song.sections.slice(0, 2);
    const seq = new Sequencer(song);
    expect(seq.copySection(0)).toBe(1);
    expect(seq.song.sections.map((s) => s.name)).toEqual(["Intro", "Intro 2", "Groove"]);
    expect(seq.addSection()).toBe(3);
    expect(seq.addSection()).toBe(-1);
    expect(seq.copySection(0)).toBe(-1);
    expect(validateSong(seq.song)).toEqual([]);
    const seeds = seq.song.sections[3];
    expect(seeds.layer1.gen.seed).toBeGreaterThan(102); // above every seed in use
  });

  it("a copy before the playing section keeps the same section playing and its queued switches", () => {
    const song = defaultSong();
    song.sections.pop();
    const seq = new Sequencer(song);
    seq.switchSection(2);
    seq.start();
    run(seq, 2);
    seq.switchSection(1);
    seq.toggleInstrument(2, "bass");
    expect(seq.copySection(0)).toBe(1);
    expect(seq.section).toBe(3);
    expect(seq.pending()).toEqual({ section: 2, toggles: [{ section: 3, instrument: "bass" }] });
    run(seq, 14);
    const line = seq.next();
    expect(line.section).toBe(2);
    expect(seq.song.sections[3].on.bass).toBe(true); // Break had bass off
  });

  it("delete refuses the last section and the playing one, and drops switches queued to it", () => {
    const seq = new Sequencer(defaultSong());
    seq.switchSection(1);
    seq.start();
    run(seq, 2);
    expect(seq.deleteSection(1)).toBe(false);
    seq.switchSection(3);
    expect(seq.deleteSection(3)).toBe(true);
    expect(seq.pending().section).toBe(null);
    seq.switchSection(2);
    expect(seq.deleteSection(0)).toBe(true);
    expect(seq.section).toBe(0);
    expect(seq.pending().section).toBe(1);
    expect(seq.song.sections.map((s) => s.name)).toEqual(["Groove", "Break"]);
    run(seq, 14);
    expect(seq.next().section).toBe(1);
    seq.stop();
    expect(seq.deleteSection(1)).toBe(true);
    expect(seq.section).toBe(0);
    expect(seq.deleteSection(0)).toBe(false);
  });
});

describe("pending shown until heard (lookahead)", () => {
  it("at 174 bpm a toggle stays pending on every drawn step until its bar line sounds", () => {
    // Simulate the transport: step k sounds at k * sixteenth and is scheduled 0.1 s before that
    // (Tone's lookahead); the UI draws each step when it sounds and reads what is pending then.
    const song = defaultSong();
    song.bpm = 174;
    const seq = new Sequencer(song);
    const inFlight = new InFlight();
    const sixteenth = 60 / song.bpm / 4;
    const lookahead = 0.1;
    seq.start();
    const scheduled: StepResult[] = [];
    const drawn: { bar: number; step: number; shown: Pending; on: boolean }[] = [];
    const tapAt = 2 * sixteenth + 0.01; // during bar 0, step 2
    let tapped = false;
    let k = 0;
    for (let t = 0; t < 2 * 16 * sixteenth; t += 0.001) {
      if (!tapped && t >= tapAt) {
        seq.toggleInstrument(0, "drums");
        tapped = true;
      }
      while (k * sixteenth - lookahead <= t) {
        const r = seq.next();
        if (r.applied) inFlight.land(r.bar, r.applied);
        scheduled.push(r);
        k++;
      }
      const d = Math.floor(t / sixteenth + 1e-9);
      if (drawn.length === d) {
        const r = scheduled[d];
        inFlight.reach(r.bar);
        drawn.push({ bar: r.bar, step: r.step, shown: inFlight.shown(seq.pending()), on: sounding(r, "drums") });
      }
    }
    // Bar 1's first step is scheduled before bar 0's last step sounds: the live queue is empty there.
    const last = drawn.find((x) => x.bar === 0 && x.step === 15)!;
    expect(seq.pending().toggles).toHaveLength(0);
    expect(last.shown.toggles).toEqual([{ section: 0, instrument: "drums" }]);
    for (const x of drawn.filter((x) => x.bar === 0 && x.step >= 3)) expect(x.shown.toggles).toHaveLength(1);
    // From the bar line on it is heard: no longer pending, and the drums are off.
    for (const x of drawn.filter((x) => x.bar === 1)) {
      expect(x.shown.toggles).toHaveLength(0);
      expect(x.on).toBe(false);
    }
  });

  it("a new tap during the lookahead shows on top of what is in flight", () => {
    const f = new InFlight();
    f.land(4, { section: 2, toggles: [{ section: 1, instrument: "bass" }] });
    const shown = f.shown({ section: null, toggles: [{ section: 2, instrument: "synth" }] });
    expect(shown.section).toBe(2);
    expect(shown.toggles).toHaveLength(2);
    f.reach(3);
    expect(f.shown({ section: null, toggles: [] }).toggles).toHaveLength(1);
    f.reach(4);
    expect(f.shown({ section: null, toggles: [] })).toEqual({ section: null, toggles: [] });
  });
});
