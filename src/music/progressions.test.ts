/** P4: the progression library (spec 8.4). The test walks every progression in every key. */
import { describe, expect, it } from "vitest";
import { BASS_RANGE, CHORD_RANGE, buildChord } from "./chords.ts";
import { FEELS, type ProgressionDef } from "./data.ts";
import {
  CARDS_PER_PAGE,
  LAUNCH_VIBES,
  PROGRESSIONS,
  PROGRESSION_IDS,
  cardPage,
  checkProgression,
  findProgression,
  openingFeel,
  pageOf,
  progressionChords,
  progressionsFor,
  readProgressions,
} from "./progressions.ts";
import { MOOD_TABLE, NOTE_NAMES, scalePitchClasses, type Mood } from "./scales.ts";
import { STYLES, STYLE_IDS } from "./styles.ts";

const all = PROGRESSION_IDS.map((id) => [id, PROGRESSIONS[id]] as const);

describe("the progression library", () => {
  it("holds at least 120 progressions", () => {
    expect(PROGRESSION_IDS.length).toBeGreaterThanOrEqual(120);
  });

  it("gives every one of the 24 vibes at least four progressions for every feel", () => {
    expect(LAUNCH_VIBES.length).toBe(24);
    const short: string[] = [];
    for (const v of LAUNCH_VIBES) for (const f of FEELS) if (progressionsFor(v, f).length < 4) short.push(`${v}/${f}: ${progressionsFor(v, f).length}`);
    expect(short).toEqual([]);
  });

  it("tags only vibes of the launch set, and every style that exists is in it", () => {
    for (const id of STYLE_IDS) expect(LAUNCH_VIBES as readonly string[]).toContain(id);
    for (const [id, p] of all) for (const v of p.vibes) expect(LAUNCH_VIBES as readonly string[], id).toContain(v);
  });

  it.each(all)("%s loads: 2 to 8 chords, a known mood with its own voicing, a plain name that fits", (id, p) => {
    expect(checkProgression(p), id).toEqual([]);
    expect(p.chords.length).toBeGreaterThanOrEqual(2);
    expect(p.chords.length).toBeLessThanOrEqual(8);
    expect(p.voicing).toBe(MOOD_TABLE[p.mood].voicing);
    expect(p.name.length).toBeLessThanOrEqual(14);
  });

  it.each(all)("%s is in its mood's scale (it holds by construction: only degrees 0..6 are stored) and transposes to all twelve keys inside the instruments' ranges", (_id, p) => {
    // These scale assertions cannot fail while only degrees are stored: buildChord builds every chord from the scale.
    // The real guard is checkProgression refusing a degree outside 0..6 (tested below). When row L1 adds borrowed
    // chords, ProgressionDef gets a `borrowed` mark and this test its "or marked as borrowing" branch.
    for (const key of NOTE_NAMES) {
      const scale = scalePitchClasses(key, p.mood);
      for (const [degree] of p.chords) {
        const c = buildChord(key, p.mood, degree);
        for (const n of c.notes) {
          expect(scale, `${p.name} in ${key}`).toContain(n % 12);
          expect(n).toBeGreaterThanOrEqual(CHORD_RANGE.lo);
          expect(n).toBeLessThanOrEqual(CHORD_RANGE.hi);
        }
        expect(scale).toContain(c.bass % 12);
        expect(c.bass).toBeGreaterThanOrEqual(BASS_RANGE.lo);
        expect(c.bass).toBeLessThanOrEqual(BASS_RANGE.hi);
        // Transposing moves the chord, not its shape: same root offset from the key, same tones.
        expect((c.bass - NOTE_NAMES.indexOf(key) + 120) % 12).toBe((buildChord("C", p.mood, degree).bass + 120) % 12);
      }
    }
  });

  it("holds every section progression of every vibe, tagged with that vibe, so Simple shows it Playing and can go back to it", () => {
    const missing: string[] = [];
    for (const id of STYLE_IDS) {
      const style = STYLES[id];
      style.sections.forEach((s, i) => {
        const chords = s.chords.map(([degree, bars]) => ({ degree, bars }));
        const found = findProgression(style.mood as Mood, chords);
        if (!found) missing.push(`${id} section ${i}: ${style.mood} ${JSON.stringify(s.chords)} not in the library`);
        else if (!PROGRESSIONS[found].vibes.includes(id)) missing.push(`${id} section ${i}: ${found} is not tagged ${id}`);
      });
    }
    expect(missing).toEqual([]);
  });

  it("has no two progressions alike, and names neutral and unique", () => {
    const keys = all.map(([, p]) => `${p.mood}:${JSON.stringify(p.chords)}`);
    expect(new Set(keys).size).toBe(keys.length);
    const names = all.map(([, p]) => p.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("refuses a broken progression file, naming it", () => {
    const bad = (p: Partial<ProgressionDef>) => ({ "../data/progressions/bad.ts": { default: { ...PROGRESSIONS[PROGRESSION_IDS[0]], ...p } } });
    expect(() => readProgressions(bad({ chords: [[0, 1]] }))).toThrow(/bad\.ts.*chords: 2 to 8/);
    expect(() => readProgressions(bad({ chords: [[0, 1], [7, 1]] }))).toThrow(/degrees/);
    expect(() => readProgressions(bad({ mood: "house", voicing: "triads" }))).toThrow(/voicing/);
    expect(() => readProgressions(bad({ feels: ["sleepy" as never] }))).toThrow(/feels/);
    expect(() => readProgressions(bad({ vibes: ["polka"] }))).toThrow(/vibes/);
  });

  it("is found from a section's chords and mood, and pages four cards at a time with wrapping", () => {
    const [id, p] = all[0];
    expect(findProgression(p.mood, progressionChords(p))).toBe(id);
    expect(findProgression(p.mood, progressionChords(p).slice(0, 1))).toBeNull();
    const list = progressionsFor("deepHouse", "warm");
    const first = cardPage(list, 0);
    expect(first.shown.length).toBe(Math.min(CARDS_PER_PAGE, list.length));
    expect(cardPage(list, first.pages).shown).toEqual(first.shown);
    // A song with no vibe gets every vibe's cards of the feel.
    expect(progressionsFor(undefined, "warm").length).toBeGreaterThanOrEqual(list.length);
  });

  it("opens on the playing progression's feel and page, else the mood's feel and the first page", () => {
    const list = progressionsFor("deepHouse", "warm");
    const last = list[list.length - 1];
    const p = PROGRESSIONS[last];
    expect(openingFeel(p.mood, progressionChords(p))).toBe(p.feels[0]);
    expect(pageOf(list, last)).toBe(Math.floor((list.length - 1) / CARDS_PER_PAGE));
    expect(pageOf(list, null)).toBe(0);
    expect(openingFeel("deep", [{ degree: 0, bars: 1 }])).toBe(MOOD_TABLE.deep.feel);
  });
});
