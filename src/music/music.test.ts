import { describe, expect, it } from "vitest";
import { arpSequence, arpNote } from "./arp.ts";
import { buildChord, degreeChords } from "./chords.ts";
import { GenerativeLead, mutationChance, type LeadParams } from "./lead.ts";
import { BASS_PRESETS, BASS_RHYTHMS, DRUM_PATTERNS, DRUM_PRESETS, DRUM_VOICES, SYNTH_RHYTHMS } from "./presets.ts";
import { createRng, deriveSeed } from "./random.ts";
import { euclid } from "./rhythm.ts";
import { MOODS, NOTE_NAMES, inScale, midiToName, scaleNotesInRange, scalePitchClasses } from "./scales.ts";

describe("random", () => {
  it("same seed gives the same sequence", () => {
    const a = createRng(42);
    const b = createRng(42);
    const xs = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(xs);
  });
  it("different seeds differ", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
  it("stays in [0, 1) and int stays in range", () => {
    const r = createRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v >= 0 && v < 1).toBeTruthy();
      const n = r.int(5);
      expect(Number.isInteger(n) && n >= 0 && n < 5).toBeTruthy();
    }
  });
  it("derived seeds are stable and distinct per stream", () => {
    expect(deriveSeed(5, 1)).toBe(deriveSeed(5, 1));
    expect(deriveSeed(5, 1)).not.toBe(deriveSeed(5, 2));
  });
});

describe("scales", () => {
  it("scaleNotesInRange lists the scale's notes in a range, ascending and inclusive", () => {
    expect(scaleNotesInRange("A", "minor", 57, 69)).toEqual([57, 59, 60, 62, 64, 65, 67, 69]);
    expect(scaleNotesInRange("C", "major", 61, 61)).toEqual([]);
  });
  it("A minor is A B C D E F G", () => {
    expect(scalePitchClasses("A", "minor").map((p) => NOTE_NAMES[p])).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });
  it("house uses natural minor, deep dorian, dark phrygian", () => {
    expect(scalePitchClasses("A", "house")).toEqual(scalePitchClasses("A", "minor"));
    expect(scalePitchClasses("D", "deep").map((p) => NOTE_NAMES[p])).toEqual(["D", "E", "F", "G", "A", "B", "C"]);
    expect(scalePitchClasses("E", "dark").map((p) => NOTE_NAMES[p])).toEqual(["E", "F", "G", "A", "B", "C", "D"]);
  });
  it("names midi notes", () => {
    expect(midiToName(57)).toBe("A3");
    expect(midiToName(60)).toBe("C4");
  });
});

describe("chords", () => {
  it("A minor House i is A C E G B (a 9th chord)", () => {
    const c = buildChord("A", "house", 0);
    expect(c.notes.map(midiToName)).toEqual(["A3", "C4", "E4", "G4", "B4"]);
    expect(c.label).toBe("i");
    expect(midiToName(c.bass)).toBe("A1");
  });
  it("C major triads have the right qualities", () => {
    expect(degreeChords("C", "major").map((c) => c.label)).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
    expect(buildChord("C", "major", 4).notes.map(midiToName)).toEqual(["G4", "B4", "D5"]);
  });
  it("A minor labels", () => {
    expect(degreeChords("A", "minor").map((c) => c.label)).toEqual(["i", "ii°", "III", "iv", "v", "VI", "VII"]);
  });
  it("every button of every mood and key is in key", () => {
    for (const key of NOTE_NAMES)
      for (const mood of MOODS)
        for (const c of degreeChords(key, mood)) {
          for (const n of c.notes) expect(inScale(n, key, mood)).toBeTruthy();
          expect(inScale(c.bass, key, mood)).toBeTruthy();
          expect(c.bass % 12).toBe(c.notes[0] % 12);
        }
  });
  it("voicings: triads have 3 notes, House and Deep 5, Dark sits an octave lower", () => {
    expect(buildChord("A", "minor", 0).notes).toHaveLength(3);
    expect(buildChord("A", "deep", 3).notes).toHaveLength(5);
    expect(buildChord("A", "dark", 0).notes[0]).toBe(buildChord("A", "minor", 0).notes[0] - 12);
  });
  it("bass stays between E1 and D#2", () => {
    for (const key of NOTE_NAMES) for (const c of degreeChords(key, "minor")) expect(c.bass >= 28 && c.bass <= 39).toBeTruthy();
  });
});

describe("euclid", () => {
  it("spreads hits evenly", () => {
    expect(euclid(4, 16).map(Number)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(euclid(3, 8).filter(Boolean)).toHaveLength(3);
    expect(euclid(5, 16).filter(Boolean)).toHaveLength(5);
  });
  it("rotates", () => {
    expect(euclid(4, 16, 1).map(Number)).toEqual([0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0]);
    expect(euclid(4, 16, 16)).toEqual(euclid(4, 16, 0));
  });
  it("clamps hits", () => {
    expect(euclid(0, 16).filter(Boolean)).toHaveLength(0);
    expect(euclid(20, 16).filter(Boolean)).toHaveLength(16);
  });
});

describe("presets", () => {
  it("every drum preset has 16 steps for every voice, velocities 0..1", () => {
    for (const p of DRUM_PRESETS)
      for (const v of DRUM_VOICES) {
        expect(DRUM_PATTERNS[p].grid[v]).toHaveLength(16);
        for (const x of DRUM_PATTERNS[p].grid[v]) expect(x >= 0 && x <= 1).toBeTruthy();
      }
  });
  it("bass and synth hits stay inside the bar", () => {
    for (const p of BASS_PRESETS) for (const h of BASS_RHYTHMS[p]) expect(h.step >= 0 && h.step < 16).toBeTruthy();
    for (const h of Object.values(SYNTH_RHYTHMS).flat()) expect(h.step >= 0 && h.step < 16).toBeTruthy();
  });
  it("four on the floor kicks on every beat; dnb does not", () => {
    expect(DRUM_PATTERNS.fourFloor.grid.kick.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0)).toEqual([0, 4, 8, 12]);
    expect(DRUM_PATTERNS.dnb.grid.kick[4]).toBe(0);
  });
});

describe("arp", () => {
  const p = { direction: "up", rate: 2, octaves: 2, gate: 0.5 } as const;
  it("goes up through the octaves", () => {
    expect(arpSequence([60, 64, 67], p)).toEqual([60, 64, 67, 72, 76, 79]);
  });
  it("down and updown", () => {
    expect(arpSequence([60, 64, 67], { ...p, direction: "down", octaves: 1 })).toEqual([67, 64, 60]);
    expect(arpSequence([60, 64, 67], { ...p, direction: "updown", octaves: 1 })).toEqual([60, 64, 67, 64]);
  });
  it("random draws only chord notes, from the seed", () => {
    const a = createRng(3);
    const b = createRng(3);
    const q = { ...p, direction: "random" } as const;
    const xs = Array.from({ length: 16 }, (_, i) => arpNote([60, 64, 67], q, i, a));
    expect(Array.from({ length: 16 }, (_, i) => arpNote([60, 64, 67], q, i, b))).toEqual(xs);
    for (const x of xs) expect([60, 64, 67, 72, 76, 79]).toContain(x);
  });
});

describe("generative lead", () => {
  const params: LeadParams = { lock: 0.5, hits: 7, rotate: 0, length: 5, tension: 0.5, density: 0.8, seed: 1234 };
  const scale = scalePitchClasses("A", "house");
  const chords = [0, 5, 3, 4].map((d) => buildChord("A", "house", d));
  const play = (p: LeadParams, bars: number): (number | null)[] => {
    const lead = new GenerativeLead(p.seed);
    const out: (number | null)[] = [];
    for (let s = 0; s < bars * 16; s++) {
      const c = chords[Math.floor(s / 16) % chords.length];
      out.push(lead.step(s % 16, p, { chordTones: c.tones, scale })?.midi ?? null);
    }
    return out;
  };

  it("the same seed gives the same lead twice", () => {
    expect(play(params, 32)).toEqual(play(params, 32));
  });
  it("a different seed gives a different lead", () => {
    expect(play({ ...params, seed: 99 }, 8)).not.toEqual(play(params, 8));
  });
  it("reset replays from the start", () => {
    const lead = new GenerativeLead(params.seed);
    const ctx = { chordTones: chords[0].tones, scale };
    const a = Array.from({ length: 64 }, (_, s) => lead.step(s % 16, params, ctx)?.midi ?? null);
    lead.reset();
    expect(Array.from({ length: 64 }, (_, s) => lead.step(s % 16, params, ctx)?.midi ?? null)).toEqual(a);
  });
  it("every note is in key, for every mood and tension", () => {
    for (const mood of MOODS)
      for (const tension of [0, 0.5, 1]) {
        const sc = scalePitchClasses("C", mood);
        const lead = new GenerativeLead(5);
        const p = { ...params, tension, lock: 0, density: 1, hits: 16 };
        for (let s = 0; s < 256; s++) {
          const c = buildChord("C", mood, Math.floor(s / 16) % 7);
          const n = lead.step(s % 16, p, { chordTones: c.tones, scale: sc });
          if (n) expect(inScale(n.midi, "C", mood)).toBeTruthy();
        }
      }
  });
  it("tension left plays chord tones only, right plays none of them", () => {
    const lead = new GenerativeLead(8);
    const c = chords[0];
    const ctx = { chordTones: c.tones, scale };
    for (let s = 0; s < 128; s++) {
      const n = lead.step(s % 16, { ...params, tension: 0, lock: 0, density: 1, hits: 16 }, ctx);
      if (n) expect(c.tones).toContain(n.midi % 12);
    }
    const lead2 = new GenerativeLead(8);
    for (let s = 0; s < 128; s++) {
      const n = lead2.step(s % 16, { ...params, tension: 1, lock: 0, density: 1, hits: 16 }, ctx);
      if (n) expect(c.tones.includes(n.midi % 12)).toBe(false);
    }
  });
  it("hits and rotate decide where notes may fall", () => {
    const out = play({ ...params, hits: 4, rotate: 2, density: 1 }, 4);
    out.forEach((n, i) => {
      if (n !== null) expect([2, 6, 10, 14]).toContain(i % 16);
    });
  });
  it("lock fully right repeats the same loop bar after bar", () => {
    const p = { ...params, lock: 1, length: 16 };
    const lead = new GenerativeLead(p.seed);
    const ctx = { chordTones: chords[0].tones, scale };
    const bars = Array.from({ length: 32 }, () => Array.from({ length: 16 }, (_, s) => lead.step(s, p, ctx)?.midi ?? null));
    for (const b of bars) expect(b).toEqual(bars[0]);
  });
  it("lock left keeps changing notes", () => {
    const p = { ...params, lock: 0, length: 16, density: 1 };
    const lead = new GenerativeLead(p.seed);
    const ctx = { chordTones: chords[0].tones, scale };
    const bar = (): (number | null)[] => Array.from({ length: 16 }, (_, s) => lead.step(s, p, ctx)?.midi ?? null);
    expect(bar()).not.toEqual(bar());
  });
  it("mutation chance: none fully right, some in the middle, always fully left", () => {
    expect(mutationChance(1)).toBe(0);
    expect(mutationChance(0)).toBe(1);
    expect(mutationChance(0.5) > 0 && mutationChance(0.5) < 0.5).toBeTruthy();
  });
  it("a length of 5 drifts against the bar", () => {
    const p = { ...params, lock: 1, length: 5, hits: 16, density: 1 };
    const lead = new GenerativeLead(p.seed);
    const ctx = { chordTones: chords[0].tones, scale };
    const bars = Array.from({ length: 5 }, () => Array.from({ length: 16 }, (_, s) => lead.step(s, p, ctx)?.midi ?? null));
    expect(bars[1]).not.toEqual(bars[0]);
    // 5 bars of 16 steps = 80 steps = 16 loops of 5: it realigns at bar 6.
    const sixth = Array.from({ length: 16 }, (_, s) => lead.step(s, p, ctx)?.midi ?? null);
    expect(sixth).toEqual(bars[0]);
  });
});
