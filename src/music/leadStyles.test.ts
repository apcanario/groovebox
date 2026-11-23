/** P5: the lead styles of spec 8.5. Every test runs each style from the same seeds over changing chords. */
import { describe, expect, it } from "vitest";
import { buildChord } from "./chords.ts";
import { GenerativeLead, LEAD_SHAPES, LEAD_STYLES, PHRASE_BARS, type LeadParams, type LeadStyle } from "./lead.ts";
import { STYLE_DEFAULTS, leadKnobs, leadWindow } from "./leadKit.ts";
import { DRIFT_MIN } from "./leadDrift.ts";
import { PHRASE_REST, phraseStyleBars } from "./leadPhrase.ts";
import { Lead } from "./leadStyles.ts";
import { PRINT_BASE, playLead, printPatterns, type Playback, type PlayedNote } from "./leadPrint.ts";
import { MOODS, inScale, scalePitchClasses } from "./scales.ts";

const BASE: LeadParams = { ...PRINT_BASE, variation: 0.5 };
const SONG: Playback = { key: "A", mood: "house", degrees: [0, 5, 3, 4] };
const SEEDS = [1, 77, 1234, 90210];

/** A note without its glide-in, which depends on the note before the phrase. */
const bare = (n: PlayedNote): string => `${n.at}:${n.midi}:${n.vel.toFixed(4)}:${n.len.toFixed(4)}:${n.accent ?? ""}:${n.repeat ?? ""}`;
const full = (ns: PlayedNote[]): string => ns.map((n) => `${bare(n)}:${n.glideFrom ?? ""}`).join(" ");

/** Every knob of spec 8.5 with its minimum and maximum, plus Pulse's own three. */
const KNOBS: [keyof LeadParams, unknown, unknown][] = [
  ["density", 0, 1], // Busy
  ["lock", 0, 1],
  ["shape", LEAD_SHAPES[0], LEAD_SHAPES[LEAD_SHAPES.length - 1]],
  ["range", 0, 1],
  ["register", 0, 1],
  ["tension", 0, 1],
  ["noteLength", 0, 1],
  ["phrase", PHRASE_BARS[0], PHRASE_BARS[PHRASE_BARS.length - 1]],
  ["variation", 0, 1],
  ["repeats", 0, 1],
  ["slide", 0, 1],
  ["accent", 0, 1],
];
const PULSE_OWN: [keyof LeadParams, unknown, unknown][] = [
  ["hits", 1, 16],
  ["rotate", 0, 15],
  ["length", 2, 16],
];

describe("lead styles (P5)", () => {
  for (const style of LEAD_STYLES) {
    describe(style, () => {
      const p: LeadParams = { ...BASE, style };

      it("the same seed gives the same notes", () => {
        for (const seed of SEEDS) expect(full(playLead({ ...p, seed }, 32, SONG))).toEqual(full(playLead({ ...p, seed }, 32, SONG)));
      });

      it("a different seed gives different notes", () => {
        expect(full(playLead({ ...p, seed: 5 }, 16, SONG))).not.toEqual(full(playLead({ ...p, seed: 6 }, 16, SONG)));
      });

      it("is always in key, for every mood, tension, range and register", () => {
        for (const mood of MOODS)
          for (const seed of SEEDS)
            for (const [tension, range, register] of [
              [0, 0, 0],
              [0.5, 0.5, 0.5],
              [1, 1, 1],
              [1, 0, 1],
            ]) {
              const q = { ...p, seed, tension, range, register, lock: 0.3, slide: 0.6, repeats: 0.5 };
              const notes = playLead(q, 32, { key: "C#", mood, degrees: [0, 3, 6, 2, 5, 1, 4] });
              for (const n of notes) {
                expect(inScale(n.midi, "C#", mood)).toBe(true);
                if (n.glideFrom !== undefined) expect(inScale(n.glideFrom, "C#", mood)).toBe(true);
              }
            }
      });

      it("follows the chords: at Tension 0 every note is a chord tone of the chord under it", () => {
        for (const seed of SEEDS) {
          for (const n of playLead({ ...p, seed, tension: 0 }, 16, SONG)) {
            const chord = buildChord(SONG.key, SONG.mood, SONG.degrees[Math.floor(n.at / 16) % 4]);
            expect(chord.tones).toContain(n.midi % 12);
          }
        }
      });

      it("plays with varied velocity", () => {
        for (const seed of SEEDS) {
          const vels = new Set(playLead({ ...p, seed, accent: 0 }, 16, SONG).map((n) => n.vel.toFixed(3)));
          expect(vels.size).toBeGreaterThan(1);
        }
      });

      const knobs = style === "pulse" ? [...KNOBS, ...PULSE_OWN] : KNOBS;
      for (const [key, min, max] of knobs) {
        it(`${key === "density" ? "Busy" : key}: its minimum and maximum give different notes`, () => {
          for (const seed of SEEDS) {
            const lo = playLead({ ...p, seed, [key]: min }, 32, SONG);
            const hi = playLead({ ...p, seed, [key]: max }, 32, SONG);
            expect(full(lo), `seed ${seed}`).not.toEqual(full(hi));
          }
        });
      }

      it("clones play the same notes from where they were copied", () => {
        const lead = new Lead(42);
        const scale = scalePitchClasses("A", "house");
        const ctx = (i: number) => ({ chordTones: buildChord("A", "house", SONG.degrees[Math.floor(i / 16) % 4]).tones, scale });
        const q = { ...p, seed: 42, lock: 0.2 };
        for (let i = 0; i < 40; i++) lead.step(i % 16, q, ctx(i));
        const copy = lead.clone();
        for (let i = 40; i < 120; i++) expect(copy.step(i % 16, q, ctx(i))).toEqual(lead.step(i % 16, q, ctx(i)));
      });
    });
  }

  it("Hook repeats exactly for a whole phrase when Variation is 0", () => {
    for (const seed of [...SEEDS, 3, 4, 5, 6]) {
      for (const lock of [0, 0.5]) {
        const notes = playLead({ ...BASE, style: "hook", seed, variation: 0, lock, phrase: 4 }, 16, { key: "A", mood: "house", degrees: [0] });
        for (let phrase = 0; phrase < 4; phrase++) {
          const bar = (b: number) => notes.filter((n) => Math.floor(n.at / 16) === phrase * 4 + b).map((n) => bare({ ...n, at: n.at % 16 }));
          // The motif is one or two bars long: bar 1 comes back in bar 3, bar 2 in bar 4.
          expect(bar(2), `seed ${seed} lock ${lock} phrase ${phrase}`).toEqual(bar(0));
          expect(bar(3), `seed ${seed} lock ${lock} phrase ${phrase}`).toEqual(bar(1));
          expect(bar(0).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("Hook plays a motif of 3 to 6 notes", () => {
    for (const seed of SEEDS)
      for (const density of [0, 1]) {
        const notes = playLead({ ...BASE, style: "hook", seed, density, variation: 0, phrase: 4 }, 4, { key: "A", mood: "house", degrees: [0] });
        const perBar = [0, 1, 2, 3].map((b) => notes.filter((n) => Math.floor(n.at / 16) === b).length);
        const motif = perBar[0] + perBar[1] === perBar[2] + perBar[3] && perBar[0] !== perBar[1] ? perBar[0] + perBar[1] : perBar[0];
        expect(Math.min(perBar[0], perBar[0] + perBar[1])).toBeGreaterThan(0);
        expect(motif).toBeLessThanOrEqual(6);
        expect(perBar[0] + perBar[1]).toBeGreaterThanOrEqual(3);
      }
  });

  it("Hook changes only at the end of a phrase, also with Lock at 0", () => {
    const notes = playLead({ ...BASE, style: "hook", seed: 9, variation: 0, lock: 0, phrase: 2 }, 16, { key: "A", mood: "house", degrees: [0] });
    const phrases = Array.from({ length: 8 }, (_, i) => notes.filter((n) => Math.floor(n.at / 32) === i).map((n) => bare({ ...n, at: n.at % 32 })).join(" "));
    expect(new Set(phrases).size).toBeGreaterThan(1); // Lock 0: a new hook each phrase
  });

  it("Phrase ends each phrase on a chord tone and rests between phrases", () => {
    for (const seed of [...SEEDS, 11, 12, 13])
      for (const phrase of PHRASE_BARS)
        for (const noteLength of [0, 0.5, 1])
          for (const slide of [0, 1]) {
            const q: LeadParams = { ...BASE, style: "phrase", seed, phrase, noteLength, slide, tension: 1, density: 1 };
            const notes = playLead(q, 16, SONG);
            const steps = 16 * phraseStyleBars(phrase);
            for (let start = 0; start < 16 * 16; start += steps) {
              const inside = notes.filter((n) => n.at >= start && n.at < start + steps);
              expect(inside.length).toBeGreaterThan(0);
              const last = inside[inside.length - 1];
              const chord = buildChord(SONG.key, SONG.mood, SONG.degrees[Math.floor(last.at / 16) % 4]);
              expect(chord.tones, `seed ${seed} phrase ${phrase}`).toContain(last.midi % 12);
              // Rest: the last note ends at least PHRASE_REST steps before the next phrase.
              expect(last.at + last.len).toBeLessThanOrEqual(start + steps - PHRASE_REST + 1e-9);
            }
          }
  });

  it("Phrase at 1 bar plays as 2, its parts half a bar each", () => {
    expect(phraseStyleBars(1)).toBe(2);
    expect(phraseStyleBars(2)).toBe(2);
    expect(phraseStyleBars(4)).toBe(4);
    for (const seed of SEEDS) {
      const one = playLead({ ...BASE, style: "phrase", seed, phrase: 1, lock: 1 }, 8, SONG);
      const two = playLead({ ...BASE, style: "phrase", seed, phrase: 2, lock: 1 }, 8, SONG);
      expect(full(one)).toEqual(full(two));
    }
  });

  it("Phrase answers itself: A, A varied, A, B", () => {
    const notes = playLead({ ...BASE, style: "phrase", seed: 1234, phrase: 4, variation: 1 }, 4, { key: "A", mood: "house", degrees: [0] });
    const bar = (b: number) => notes.filter((n) => Math.floor(n.at / 16) === b).map((n) => bare({ ...n, at: n.at % 16 }));
    expect(bar(2)).toEqual(bar(0)); // A again
    expect(bar(1)).not.toEqual(bar(0)); // A varied
    expect(bar(3)).not.toEqual(bar(0)); // B
  });

  it("Roll plays at least 12 of 16 steps with Busy at maximum", () => {
    for (const seed of [...SEEDS, 2, 3, 4, 5, 6, 7, 8])
      for (const variation of [0, 1]) {
        const notes = playLead({ ...BASE, style: "roll", seed, density: 1, variation, lock: 0.3 }, 16, SONG);
        for (let b = 0; b < 16; b++) expect(notes.filter((n) => Math.floor(n.at / 16) === b).length, `seed ${seed} bar ${b}`).toBeGreaterThanOrEqual(12);
      }
  });

  it("Roll has slides, accents and octave jumps at its defaults", () => {
    const notes = playLead({ ...PRINT_BASE, style: "roll" }, 16, SONG);
    expect(notes.some((n) => n.glideFrom !== undefined)).toBe(true);
    expect(notes.some((n) => n.accent)).toBe(true);
    expect(notes.some((n, i) => i > 0 && Math.abs(n.midi - notes[i - 1].midi) >= 12)).toBe(true);
  });

  it("Drift's notes last at least two beats", () => {
    for (const seed of [...SEEDS, 2, 3])
      for (const noteLength of [0, 0.5, 1])
        for (const density of [0, 1])
          for (const phrase of PHRASE_BARS) {
            const notes = playLead({ ...BASE, style: "drift", seed, noteLength, density, phrase, lock: 0.2 }, 16, SONG);
            expect(notes.length).toBeGreaterThan(0);
            for (const n of notes) expect(n.len).toBeGreaterThanOrEqual(DRIFT_MIN);
          }
    expect(DRIFT_MIN).toBe(8); // two beats of four sixteenths
  });

  it("Drift is sparse and moves by step", () => {
    for (const seed of SEEDS) {
      const notes = playLead({ ...BASE, style: "drift", seed, tension: 0.5 }, 16, { key: "A", mood: "house", degrees: [0] });
      expect(notes.length).toBeLessThanOrEqual(16 * 2); // at most two notes a bar
      const leaps = notes.slice(1).map((n, i) => Math.abs(n.midi - notes[i].midi));
      // A step is a scale degree, at most two semitones (a repeated note counts as one).
      expect(leaps.filter((l) => l <= 2).length / leaps.length).toBeGreaterThanOrEqual(0.75);
    }
    // Over changing chords, every range, and any Tension above 0 (at 0 every note is a chord tone).
    for (const seed of SEEDS)
      for (const range of [0, 0.35, 1])
        for (const tension of [0.1, 0.35, 1]) {
          const notes = playLead({ ...BASE, style: "drift", seed, range, tension, lock: 1, variation: 0 }, 32, SONG);
          const leaps = notes.slice(1).map((n, i) => Math.abs(n.midi - notes[i].midi));
          expect(leaps.filter((l) => l <= 2).length / leaps.length).toBeGreaterThanOrEqual(0.75);
        }
  });

  it("Drift rests long: at Busy 0.85 or less every four bars hold a rest of half a bar, and no note overlaps the next", () => {
    for (const seed of [...SEEDS, 2, 3])
      for (const density of [0, 0.5, 0.85])
        for (const noteLength of [0, 0.5, 1])
          for (const phrase of PHRASE_BARS) {
            const notes = playLead({ ...BASE, style: "drift", seed, density, noteLength, phrase, slide: 0, lock: 1 }, 32, SONG);
            for (let i = 1; i < notes.length; i++) expect(notes[i].at).toBeGreaterThanOrEqual(notes[i - 1].at + notes[i - 1].len);
            const sounding = new Array<boolean>(32 * 16).fill(false);
            for (const n of notes) for (let s = n.at; s < Math.min(sounding.length, n.at + n.len); s++) sounding[s] = true;
            // Every four bars hold a rest of half a bar or more.
            for (let start = 0; start + 64 <= sounding.length; start += 64) {
              let run = 0;
              let longest = 0;
              for (let s = start; s < start + 64; s++) longest = Math.max(longest, (run = sounding[s] ? 0 : run + 1));
              expect(longest, `seed ${seed} busy ${density} length ${noteLength} phrase ${phrase} bar ${start / 16 + 1}`).toBeGreaterThanOrEqual(8);
            }
          }
  });

  it("Pulse at its defaults plays exactly what G4 played", () => {
    for (const seed of SEEDS)
      for (const lock of [0, 0.5, 1]) {
        const p: LeadParams = { lock, hits: 9, rotate: 1, length: 7, tension: 0.4, density: 0.8, seed };
        const scale = scalePitchClasses("A", "house");
        const g4 = new GenerativeLead(seed);
        const now = new Lead(seed);
        for (let i = 0; i < 256; i++) {
          const ctx = { chordTones: buildChord("A", "house", SONG.degrees[Math.floor(i / 16) % 4]).tones, scale };
          const a = g4.step(i % 16, p, ctx);
          const b = now.step(i % 16, p, ctx);
          expect(b && { midi: b.midi, vel: b.vel, len: b.len }).toEqual(a && { ...a, len: 0.8 });
          if (b) expect(b.glideFrom === undefined && !b.accent && !b.repeat).toBe(true);
        }
      }
  });

  it("knobs a song does not set take the style's defaults; Pulse's window is G4's A4..E6", () => {
    const k = leadKnobs({ ...PRINT_BASE });
    expect(k.style).toBe("pulse");
    expect(leadWindow(k.range, k.register)).toEqual({ lo: 69, hi: 88 });
    for (const style of LEAD_STYLES) expect(leadKnobs({ ...PRINT_BASE, style }).phrase).toBe(STYLE_DEFAULTS[style].phrase);
    // Range: half an octave to three octaves.
    expect(leadWindow(0, 0.5).hi - leadWindow(0, 0.5).lo).toBe(6);
    expect(leadWindow(1, 0.5).hi - leadWindow(1, 0.5).lo).toBe(36);
    expect(leadWindow(0.3, 0).lo).toBeLessThan(leadWindow(0.3, 1).lo);
  });

  it("the five styles give clearly different note patterns from the same seed", () => {
    const patterns = new Map<LeadStyle, PlayedNote[]>(LEAD_STYLES.map((s) => [s, playLead({ ...PRINT_BASE, style: s }, 8)]));
    const onsets = (ns: PlayedNote[]) => new Set(ns.map((n) => n.at));
    for (const a of LEAD_STYLES)
      for (const b of LEAD_STYLES) {
        if (a >= b) continue;
        const x = onsets(patterns.get(a)!);
        const y = onsets(patterns.get(b)!);
        const shared = [...x].filter((s) => y.has(s)).length;
        // Fewer than two thirds of all their onsets in common.
        expect(shared / new Set([...x, ...y]).size, `${a} vs ${b}`).toBeLessThan(2 / 3);
      }
    const text = printPatterns();
    for (const s of LEAD_STYLES) expect(text).toContain(s.toUpperCase());
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (env?.LEAD_PATTERNS) console.log("\n" + text);
  });
});
