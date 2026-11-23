/** G4: Layer 1 and Layer 2 modes through the sequencer: in key, lock, drift, mode switches, edits. */
import { describe, expect, it } from "vitest";
import { buildChord } from "../music/chords.ts";
import { GenerativeLead, LOCK_FROZEN, mutationChance, nextSeed } from "../music/lead.ts";
import { euclid } from "../music/rhythm.ts";
import { MOODS, NOTE_NAMES, inScale } from "../music/scales.ts";
import { PAD_TOP_HZ, padBrightnessHz, padMotionCents } from "../music/sound.ts";
import { Sequencer, type StepResult } from "./sequencer.ts";
import { LAYER_MODES, defaultSong, validateSong, type LayerMode, type Song } from "./song.ts";

const run = (seq: Sequencer, steps: number): StepResult[] => Array.from({ length: steps }, () => seq.next());

/** A one-section song with only Layer 1 on, in `mode`, over `chords` (one bar each). */
function layerSong(mode: LayerMode, degrees = [0], key: Song["key"] = "A", mood: Song["mood"] = "house"): Song {
  const song = defaultSong();
  song.key = key;
  song.mood = mood;
  song.sections = [song.sections[1]];
  const s = song.sections[0];
  s.on = { drums: false, bass: false, synth: false, layer1: true, layer2: false };
  s.chords = degrees.map((degree) => ({ degree, bars: 1 as const }));
  s.layer1.mode = mode;
  return song;
}

/** Layer 1's notes per step (null where it plays nothing), bar by bar. */
function bars(seq: Sequencer, n: number): (string | null)[][] {
  return Array.from({ length: n }, () =>
    run(seq, 16).map((r) => {
      const e = r.events.find((x) => x.inst === "layer1") as { notes: number[] } | undefined;
      return e ? e.notes.join(",") : null;
    }),
  );
}

describe("each layer mode plays in key", () => {
  it("over every chord of every mood, in every key, for Arp, Pad and Generative", () => {
    for (const mood of MOODS)
      for (const key of NOTE_NAMES)
        for (const mode of LAYER_MODES) {
          const song = layerSong(mode, [0, 1, 2, 3, 4, 5, 6], key, mood);
          const l = song.sections[0].layer1;
          l.gen = { ...l.gen, lock: 0, hits: 16, density: 1, tension: 1 };
          l.arp = { ...l.arp, direction: "random", octaves: 3, rate: 1 };
          const seq = new Sequencer(song);
          seq.start();
          let notes = 0;
          for (const r of run(seq, 16 * 7)) {
            for (const e of r.events) {
              if (e.inst !== "layer1") continue;
              for (const n of e.notes) {
                notes++;
                expect(inScale(n, key, mood), `${mode} ${key} ${mood} ${n}`).toBe(true);
              }
            }
          }
          expect(notes).toBeGreaterThan(6);
        }
  });

  it("tension in the middle and right stays in key too (generative, every degree)", () => {
    for (const mood of MOODS)
      for (const tension of [0, 0.5, 1]) {
        const song = layerSong("generative", [0, 1, 2, 3, 4, 5, 6], "C", mood);
        song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, lock: 0, hits: 16, density: 1, tension };
        const seq = new Sequencer(song);
        seq.start();
        for (const r of run(seq, 16 * 14))
          for (const e of r.events) if (e.inst === "layer1") for (const n of e.notes) expect(inScale(n, "C", mood)).toBe(true);
      }
  });
});

describe("generative lock and length", () => {
  it("Lock fully right repeats the same loop for 32 bars (length 16: every bar the same)", () => {
    const song = layerSong("generative");
    song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, lock: 1, length: 16, hits: 9, density: 0.8 };
    const seq = new Sequencer(song);
    seq.start();
    const b = bars(seq, 32);
    expect(b[0].some((n) => n !== null)).toBe(true);
    for (const bar of b) expect(bar).toEqual(b[0]);
  });

  it("Lock at the dial's 100 (LOCK_FROZEN) freezes too", () => {
    expect(mutationChance(LOCK_FROZEN)).toBe(0);
    expect(mutationChance(LOCK_FROZEN - 0.01)).toBeGreaterThan(0);
  });

  it("Lock turned fully right after mutating keeps the current notes for 32 bars", () => {
    const song = layerSong("generative");
    song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, lock: 0, length: 16, hits: 16, density: 1 };
    const seq = new Sequencer(song);
    seq.start();
    const fresh = bars(seq, 1)[0];
    run(seq, 16 * 3); // new notes all the time
    seq.setGen(0, "layer1", { lock: 1 });
    const b = bars(seq, 32);
    expect(b[0]).not.toEqual(fresh); // the mutated notes, not the seed's
    for (const bar of b) expect(bar).toEqual(b[0]);
  });

  it("with Lock right, moving the other knobs and back keeps the same notes", () => {
    const song = layerSong("generative");
    song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, lock: 1, length: 16 };
    const seq = new Sequencer(song);
    seq.start();
    const before = bars(seq, 1)[0];
    const g = { ...song.sections[0].layer1.gen };
    seq.setGen(0, "layer1", { hits: 3, rotate: 5, length: 7, tension: 0.9, density: 0.2 });
    run(seq, 16 * 2);
    seq.setGen(0, "layer1", { hits: g.hits, rotate: g.rotate, length: g.length, tension: g.tension, density: g.density });
    expect(bars(seq, 1)[0]).toEqual(before);
  });

  for (const length of [5, 7]) {
    it(`a length of ${length} drifts against the bar and realigns after ${length} bars`, () => {
      const song = layerSong("generative");
      song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, lock: 1, length, hits: 16, density: 1, tension: 0.5 };
      const seq = new Sequencer(song);
      seq.start();
      const b = bars(seq, length + 1);
      for (let i = 1; i < length; i++) expect(b[i]).not.toEqual(b[0]);
      expect(b[length]).toEqual(b[0]); // 16 x length steps = 16 loops of `length`
    });
  }

  it("a section entered again keeps its lead's notes, from the top of its loop", () => {
    const song = defaultSong();
    for (const s of song.sections) {
      s.on = { drums: false, bass: false, synth: false, layer1: true, layer2: false };
      s.layer1.mode = "generative";
      s.chords = [{ degree: 0, bars: 1 }];
      s.layer1.gen = { ...s.layer1.gen, lock: 0, length: 16, hits: 16, density: 1 };
    }
    const seq = new Sequencer(song);
    seq.start();
    run(seq, 16 * 3); // mutate section A's loop
    seq.setGen(0, "layer1", { lock: 1 });
    const frozen = bars(seq, 1)[0];
    seq.switchSection(1);
    bars(seq, 2);
    seq.switchSection(0);
    bars(seq, 1); // the switch lands on this bar line
    expect(bars(seq, 1)[0]).toEqual(frozen);
    // Play starts every lead from its seed again.
    seq.stop();
    seq.start();
    expect(bars(seq, 1)[0]).not.toEqual(frozen);
  });

  it("new seed: a different, repeatable seed and new notes from the next step", () => {
    const song = layerSong("generative");
    song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, lock: 1, length: 16, hits: 16, density: 1 };
    const seed = song.sections[0].layer1.gen.seed;
    expect(nextSeed(seed)).toBe(nextSeed(seed));
    expect(nextSeed(seed)).not.toBe(seed);
    const seq = new Sequencer(song);
    seq.start();
    const before = bars(seq, 1)[0];
    expect(seq.newSeed(0, "layer1")).toBe(nextSeed(seed));
    expect(bars(seq, 1)[0]).not.toEqual(before);
    expect(validateSong(seq.song)).toEqual([]);
  });

  it("the 16-step row shows this bar's hits, and which of them play", () => {
    const song = layerSong("generative");
    song.sections[0].layer1.gen = { ...song.sections[0].layer1.gen, lock: 1, length: 5, hits: 7, rotate: 2, density: 0.6 };
    const seq = new Sequencer(song);
    const g = song.sections[0].layer1.gen;
    // Stopped: the bar the seed starts with.
    const fresh = seq.leadSteps(0, "layer1");
    expect(fresh.map((s) => s.hit)).toEqual(euclid(7, 16, 2));
    seq.start();
    for (let bar = 0; bar < 6; bar++) {
      const first = seq.next(); // step 0 sets the bar start
      const view = seq.leadSteps(0, "layer1");
      const rest = run(seq, 15);
      const plays = [first, ...rest].map((r) => r.events.some((e) => e.inst === "layer1"));
      expect(view.map((s) => s.plays)).toEqual(plays);
      expect(view.map((s) => s.hit)).toEqual(euclid(g.hits, 16, g.rotate));
    }
  });
});

describe("layer edits", () => {
  it("a mode switch in the playing section lets go and restarts on the next step", () => {
    const song = layerSong("pad", [0]);
    const seq = new Sequencer(song);
    seq.start();
    run(seq, 5);
    expect(seq.setLayerMode(0, "layer1", "arp")).toBe(true);
    const r = seq.next();
    expect(r.restarted).toEqual(["layer1"]);
    expect(r.pads.layer1).toBeNull();
    seq.setLayerMode(0, "layer1", "pad");
    const p = seq.next();
    expect(p.restarted).toEqual(["layer1"]);
    const pad = p.events.find((e) => e.inst === "layer1") as { notes: number[]; len: number };
    expect(pad.notes.length).toBeGreaterThan(2); // the held chord starts again at once
    expect(pad.len).toBe(16 - 6); // steps 0..5 played, this is step 6
    expect(p.pads.layer1).toEqual(song.sections[0].layer1.pad);
  });

  it("the same mode, another section or a stopped sequencer restarts nothing", () => {
    const song = defaultSong();
    const seq = new Sequencer(song);
    seq.start();
    seq.setLayerMode(0, "layer1", song.sections[0].layer1.mode);
    seq.setLayerMode(2, "layer1", "pad");
    expect(seq.next().restarted).toEqual([]);
    seq.stop();
    seq.setLayerMode(0, "layer1", "arp");
    seq.start();
    expect(seq.next().restarted).toEqual([]);
  });

  it("arp rate, octaves, direction and gate take effect", () => {
    const song = layerSong("arp", [0]);
    const seq = new Sequencer(song);
    seq.start();
    expect(seq.setArp(0, "layer1", { rate: 4, octaves: 1, direction: "down", gate: 0.5 })).toBe(true);
    const evs = run(seq, 16).flatMap((r) => r.events.filter((e) => e.inst === "layer1").map((e) => ({ step: r.step, e })));
    expect(evs.map((x) => x.step)).toEqual([0, 4, 8, 12]);
    for (const { e } of evs) expect((e as { len: number }).len).toBeCloseTo(2);
    const chord = buildChord("A", "house", 0).notes;
    expect((evs[0].e as { notes: number[] }).notes[0]).toBe(Math.max(...chord));
  });

  it("refuses bad layer values and changes nothing", () => {
    const song = defaultSong();
    const seq = new Sequencer(song);
    const before = JSON.stringify(seq.song);
    expect(seq.setLayerMode(0, "layer1", "drone" as LayerMode)).toBe(false);
    expect(seq.setArp(0, "layer1", { rate: 3 as 1 })).toBe(false);
    expect(seq.setArp(0, "layer1", { octaves: 4 as 1 })).toBe(false);
    expect(seq.setArp(0, "layer1", { direction: "sideways" as "up" })).toBe(false);
    expect(seq.setArp(0, "layer1", { gate: Number.NaN })).toBe(false);
    expect(seq.setPad(0, "layer1", { brightness: Number.NaN })).toBe(false);
    expect(seq.setGen(0, "layer1", { hits: Number.POSITIVE_INFINITY })).toBe(false);
    expect(seq.setGen(9, "layer1", { hits: 3 })).toBe(false);
    expect(seq.newSeed(9, "layer1")).toBeNull();
    expect(JSON.stringify(seq.song)).toBe(before);
  });

  it("clamps and rounds knob values into the schema's ranges", () => {
    const seq = new Sequencer(defaultSong());
    seq.setGen(0, "layer1", { hits: 40, rotate: 7.6, length: 1, lock: 2, density: -1 });
    seq.setPad(0, "layer1", { attack: 100, motion: 3 });
    seq.setArp(0, "layer1", { gate: 0 });
    const l = seq.song.sections[0].layer1;
    expect(l.gen).toMatchObject({ hits: 16, rotate: 8, length: 2, lock: 1, density: 0 });
    expect(l.pad).toMatchObject({ attack: 8, motion: 1 });
    expect(l.arp.gate).toBe(0.1);
    expect(validateSong(seq.song)).toEqual([]);
  });

  it("pad settings reach the step result at once, so the engine ramps them", () => {
    const song = layerSong("pad", [0]);
    const seq = new Sequencer(song);
    seq.start();
    seq.next();
    seq.setPad(0, "layer1", { brightness: 0.9, motion: 0.5 });
    expect(seq.next().pads.layer1).toMatchObject({ brightness: 0.9, motion: 0.5 });
  });

  it("a lead preview never draws from the playing lead's generator", () => {
    const song = layerSong("generative");
    const seq = new Sequencer(song);
    seq.start();
    const a = bars(seq, 2);
    const seq2 = new Sequencer(layerSong("generative"));
    seq2.start();
    const b: (string | null)[][] = [];
    for (let i = 0; i < 2; i++) {
      seq2.leadSteps(0, "layer1");
      b.push(bars(seq2, 1)[0]);
    }
    expect(b).toEqual(a);
  });
});

describe("pad sound mappings", () => {
  it("brightness runs 300 Hz to the 10 kHz top; motion up to two octaves down", () => {
    expect(padBrightnessHz(0)).toBeCloseTo(300);
    expect(padBrightnessHz(1)).toBeCloseTo(PAD_TOP_HZ);
    expect(padBrightnessHz(2)).toBeCloseTo(PAD_TOP_HZ);
    expect(padMotionCents(0)).toBe(0);
    expect(padMotionCents(1)).toBe(2400);
  });
  it("rewind keeps the slots; reset goes back to the seed", () => {
    const p = { lock: 0, hits: 16, rotate: 0, length: 16, tension: 0.5, density: 1, seed: 7 };
    const ctx = { chordTones: [9, 0, 4], scale: [9, 11, 0, 2, 4, 5, 7] };
    const lead = new GenerativeLead(7);
    const first = Array.from({ length: 16 }, (_, s) => lead.step(s, p, ctx)?.midi);
    for (let i = 0; i < 48; i++) lead.step(i % 16, p, ctx);
    const frozen = { ...p, lock: 1 };
    const now = Array.from({ length: 16 }, (_, s) => lead.step(s, frozen, ctx)?.midi);
    lead.rewind();
    expect(Array.from({ length: 16 }, (_, s) => lead.step(s, frozen, ctx)?.midi)).toEqual(now);
    lead.reset();
    expect(Array.from({ length: 16 }, (_, s) => lead.step(s, p, ctx)?.midi)).toEqual(first);
  });
});
