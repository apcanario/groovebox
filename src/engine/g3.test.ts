/** G3: drum, bass and synth patterns from the tabs, sound mappings, and presets at house and DnB tempos. */
import { describe, expect, it } from "vitest";
import {
  BASS_PRESETS,
  BASS_RHYTHMS,
  DRUM_PATTERNS,
  DRUM_PRESETS,
  DRUM_VOICES,
  SYNTH_PRESETS,
  eighthOn,
  toggleEighth,
} from "../music/presets.ts";
import { drumDecay, envDepthHz, glideSeconds, kickHz, sixteenthSeconds, detuneCents, subGain, drumLevel } from "../music/sound.ts";
import { Sequencer, type StepResult } from "./sequencer.ts";
import { PATCH_KEYS, defaultPatch, defaultSong, sectionDrumGrid, validateSong, INSTRUMENTS } from "./song.ts";

const run = (seq: Sequencer, steps: number): StepResult[] => Array.from({ length: steps }, () => seq.next());
const TEMPOS = [118, 122, 128, 170, 174, 176];

describe("sound mappings", () => {
  it("kick pitch runs 35 to 80 Hz, about 49 Hz by default", () => {
    expect(kickHz(0)).toBeCloseTo(35);
    expect(kickHz(1)).toBeCloseTo(80);
    expect(kickHz(defaultPatch("drums").pitch)).toBeGreaterThan(46);
    expect(kickHz(defaultPatch("drums").pitch)).toBeLessThan(52);
    expect(kickHz(5)).toBeCloseTo(80);
  });
  it("drum decays grow with the dial and are capped by the tempo", () => {
    for (const v of DRUM_VOICES) {
      expect(drumDecay(v, 0, 122)).toBeLessThan(drumDecay(v, 0.5, 122));
      expect(drumDecay(v, 1, 174)).toBeLessThanOrEqual(drumDecay(v, 1, 122));
    }
    expect(drumDecay("kick", 1, 174)).toBeCloseTo((1.25 * 60) / 174);
    expect(drumDecay("hat", 1, 176)).toBeLessThanOrEqual(30 / 176);
  });
  it("glide never takes more than three quarters of the note", () => {
    expect(glideSeconds(0, 0.5)).toBe(0);
    expect(glideSeconds(1, 1)).toBeCloseTo(0.15);
    const note = 0.8 * sixteenthSeconds(176);
    expect(glideSeconds(1, note)).toBeCloseTo(0.75 * note);
  });
  it("the filter envelope opens from the cutoff and never past the instrument's top", () => {
    expect(envDepthHz(500, 0, 10000)).toBe(0);
    expect(envDepthHz(500, 0.5, 10000)).toBeCloseTo(500 * Math.pow(2, 2.5) - 500);
    expect(500 + envDepthHz(500, 1, 10000)).toBeLessThanOrEqual(10000);
    expect(8000 + envDepthHz(8000, 1, 10000)).toBe(10000);
    expect(envDepthHz(12000, 1, 10000)).toBe(0);
  });
  it("amount mappings are clamped and hit their defaults", () => {
    expect(detuneCents(2)).toBe(60);
    expect(subGain(0.75)).toBeCloseTo(0.9);
    expect(drumLevel(0.75)).toBe(1);
    expect(drumLevel(-1)).toBe(0);
  });
});

describe("presets at 118 to 128 and 170 to 176 bpm", () => {
  it("every drum voice's tail ends before its next hit, in every preset, at every tempo", () => {
    for (const bpm of TEMPOS) {
      const step = sixteenthSeconds(bpm);
      for (const p of DRUM_PRESETS) {
        for (const v of DRUM_VOICES) {
          const hits = DRUM_PATTERNS[p].grid[v].flatMap((x, i) => (x > 0 ? [i] : []));
          for (let i = 0; i < hits.length; i++) {
            const gap = ((hits[(i + 1) % hits.length] - hits[i] + 16) % 16 || 16) * step;
            expect(drumDecay(v, 0.5, bpm), `${p} ${v} at ${bpm}`).toBeLessThan(gap);
          }
        }
      }
    }
  });
  it("the mono bass never holds a note into its next hit, and glide fits every note", () => {
    for (const p of BASS_PRESETS) {
      const hits = BASS_RHYTHMS[p];
      hits.forEach((h, i) => {
        const next = hits[(i + 1) % hits.length].step;
        const gap = (next - h.step + 16) % 16 || 16;
        expect(h.len, `${p} step ${h.step}`).toBeLessThanOrEqual(gap);
        for (const bpm of TEMPOS) expect(glideSeconds(1, h.len * sixteenthSeconds(bpm))).toBeLessThan(h.len * sixteenthSeconds(bpm));
      });
    }
  });
  it("a 2-step and a drum and bass beat exist and play", () => {
    for (const preset of ["twoStep", "dnb"] as const) {
      const song = defaultSong();
      song.bpm = 174;
      song.sections[1].drums = { preset };
      song.sections[1].bass.rhythm = "dnbSub";
      const seq = new Sequencer(song);
      seq.switchSection(1);
      seq.start();
      const bar = run(seq, 16);
      const kicks = bar.filter((r) => r.events.some((e) => e.inst === "drums" && e.voice === "kick")).map((r) => r.step);
      expect(kicks.length).toBeGreaterThan(1);
      expect(kicks).not.toEqual([0, 4, 8, 12]); // broken, not four on the floor
      expect(bar.filter((r) => r.events.some((e) => e.inst === "bass")).map((r) => r.step)).toEqual([0, 10]);
      expect(validateSong(song)).toEqual([]);
    }
  });
});

describe("drum sequencer", () => {
  it("a step is lit when either of its sixteenths plays; toggling clears both or sets the first", () => {
    const row = [0, 0.3, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(eighthOn(row, 0)).toBe(true);
    expect(eighthOn(row, 1)).toBe(true);
    expect(eighthOn(row, 2)).toBe(false);
    expect(toggleEighth(row, 0, 1).slice(0, 2)).toEqual([0, 0]);
    expect(toggleEighth(row, 2, 0.9)[4]).toBe(0.9);
    expect(toggleEighth(row, 8, 1)).toEqual(row);
    expect(row[1]).toBe(0.3); // not mutated
  });
  it("the first edit opens the preset in the sequencer without touching the preset", () => {
    const song = defaultSong();
    const seq = new Sequencer(song);
    const preset = DRUM_PATTERNS.fourFloor.grid.kick.slice();
    expect(seq.toggleDrumStep(0, "kick", 1)).toBe(true);
    const grid = song.sections[0].drums.grid!;
    expect(grid.kick[2]).toBe(1);
    expect(grid.kick[0]).toBe(1); // the rest of the preset came along
    expect(grid.hat).toEqual(DRUM_PATTERNS.fourFloor.grid.hat);
    expect(grid.hat).not.toBe(DRUM_PATTERNS.fourFloor.grid.hat);
    expect(DRUM_PATTERNS.fourFloor.grid.kick).toEqual(preset);
    expect(validateSong(song)).toEqual([]);
    // Turning off step 0 removes the downbeat kick from what plays.
    seq.toggleDrumStep(0, "kick", 0);
    seq.start();
    const kicks = run(seq, 16).filter((r) => r.events.some((e) => e.inst === "drums" && e.voice === "kick")).map((r) => r.step);
    expect(kicks).toEqual([2, 4, 8, 12]);
  });
  it("an edit acts on the next step while playing", () => {
    const seq = new Sequencer(defaultSong());
    seq.start();
    run(seq, 5); // steps 0..4 played
    seq.toggleDrumStep(0, "clap", 3); // sixteenth 6
    const rest = run(seq, 3);
    expect(rest[1].step).toBe(6);
    expect(rest[1].events.some((e) => e.inst === "drums" && e.voice === "clap")).toBe(true);
  });
  it("a preset pick or a revert drops the edit; bad input is refused", () => {
    const song = defaultSong();
    const seq = new Sequencer(song);
    seq.toggleDrumStep(1, "hat", 0);
    expect(seq.revertDrums(1)).toBe(true);
    expect(song.sections[1].drums.grid).toBeUndefined();
    expect(seq.revertDrums(1)).toBe(false);
    seq.toggleDrumStep(1, "hat", 0);
    expect(seq.setDrumPreset(1, "dnb")).toBe(true);
    expect(song.sections[1].drums).toEqual({ preset: "dnb" });
    expect(sectionDrumGrid(song.sections[1])).toBe(DRUM_PATTERNS.dnb.grid);
    expect(seq.setDrumPreset(1, "polka" as never)).toBe(false);
    expect(seq.toggleDrumStep(1, "cowbell" as never, 0)).toBe(false);
    expect(seq.toggleDrumStep(1, "kick", 8)).toBe(false);
    expect(seq.toggleDrumStep(9, "kick", 0)).toBe(false);
  });
});

describe("bass and synth rhythms", () => {
  it("a bass rhythm change in the playing section restarts the held note once", () => {
    const song = defaultSong();
    song.sections[1].bass.rhythm = "long";
    const seq = new Sequencer(song);
    seq.switchSection(1);
    seq.start();
    run(seq, 3);
    expect(seq.setBassRhythm(1, "dnbSub")).toBe(true);
    const r = seq.next(); // step 3, inside dnbSub's first hit (0..6)
    expect(r.restarted).toEqual(["bass"]);
    const bass = r.events.filter((e) => e.inst === "bass");
    expect(bass).toHaveLength(1);
    expect((bass[0] as { len: number }).len).toBeCloseTo(3);
    expect(seq.next().restarted).toEqual([]);
  });
  it("switching the synth to held plays the chord at once for the rest of it", () => {
    const song = defaultSong();
    const seq = new Sequencer(song);
    seq.switchSection(1);
    seq.start();
    run(seq, 5);
    seq.setSynthRhythm(1, "sustained");
    const r = seq.next();
    expect(r.restarted).toEqual(["synth"]);
    const ev = r.events.find((e) => e.inst === "synth") as { len: number } | undefined;
    expect(ev?.len).toBe(11);
    // Then nothing until the next chord.
    expect(run(seq, 10).some((x) => x.events.some((e) => e.inst === "synth"))).toBe(false);
  });
  it("a rhythm change in another section, the same rhythm, or a stopped sequencer restarts nothing", () => {
    const song = defaultSong();
    const seq = new Sequencer(song);
    expect(seq.setSynthRhythm(2, "offbeat")).toBe(true); // stopped
    seq.switchSection(1);
    seq.start();
    seq.setBassRhythm(3, "long");
    seq.setSynthRhythm(1, "stabs"); // already stabs
    expect(seq.next().restarted).toEqual([]);
    expect(song.sections[3].bass.rhythm).toBe("long");
    expect(seq.setBassRhythm(1, "nope" as never)).toBe(false);
    expect(seq.setSynthRhythm(1, "nope" as never)).toBe(false);
    for (const p of SYNTH_PRESETS) expect(seq.setSynthRhythm(1, p)).toBe(true);
  });
  it("a restart on an instrument that is off reports nothing", () => {
    const song = defaultSong();
    const seq = new Sequencer(song); // section A: bass off
    seq.start();
    seq.setBassRhythm(0, "rolling");
    expect(seq.next().restarted).toEqual([]);
  });
});

describe("patch schema (G3 keys)", () => {
  it("every patch has every key in range, and an out-of-range one is refused", () => {
    const song = defaultSong();
    for (const id of INSTRUMENTS) for (const k of PATCH_KEYS) expect(typeof song.patches[id][k]).toBe("number");
    song.patches.drums.kickDecay = 2;
    delete (song.patches.bass as Partial<typeof song.patches.bass>).glide;
    const errors = validateSong(song);
    expect(errors).toContain("patches.drums.kickDecay: must be 0..1");
    expect(errors).toContain("patches.bass.glide: must be 0..1");
  });
});
