/** F1 (spec 10.1, 10.2): the launch bag of top vibes and the launch draw. */
import { describe, expect, it } from "vitest";
import { LIMITS, validateSong } from "../engine/song.ts";
import { NOTE_NAMES } from "../music/scales.ts";
import { STYLES, TOP_IDS, vibeBpmRange } from "../music/styles.ts";
import { BAG_KEY, drawFromBag, drawLaunch, type BagStorage } from "./vibeBag.ts";

class MapStorage implements BagStorage {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
}

const TOP_NAMES = [
  "Deep techno",
  "Melodic techno",
  "Minimal techno",
  "Dub techno",
  "Deep house",
  "Progressive",
  "Drum and bass",
  "2-step",
  "Breakbeat",
  "Lo-fi",
  "Ambient",
  "Drone",
  "Downtempo",
  "Synthwave",
];

describe("top vibes (spec 10.2)", () => {
  it("are the fourteen the spec names, marked top: true in their files", () => {
    expect(TOP_IDS.map((id) => STYLES[id].name).sort()).toEqual([...TOP_NAMES].sort());
  });

  it("each has a bpm range inside the app's limits that holds its own bpm, plus or minus 2 by default", () => {
    for (const id of TOP_IDS) {
      const def = STYLES[id];
      const [lo, hi] = vibeBpmRange(def);
      expect(lo, id).toBeGreaterThanOrEqual(LIMITS.bpm[0]);
      expect(hi, id).toBeLessThanOrEqual(LIMITS.bpm[1]);
      expect(lo <= def.bpm && def.bpm <= hi, id).toBe(true);
      if (!def.bpmRange) expect([lo, hi], id).toEqual([def.bpm - 2, def.bpm + 2]);
    }
  });
});

describe("the launch bag (spec 10.1)", () => {
  it("14 draws from a fresh bag give 14 different vibes and the 15th differs from the 14th", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const store = new MapStorage();
      const got = Array.from({ length: 15 }, (_, i) => drawFromBag(seed * 7919 + i, store)!.id);
      expect(new Set(got.slice(0, 14)).size, `seed ${seed}`).toBe(14);
      expect([...got.slice(0, 14)].sort()).toEqual([...TOP_IDS].sort());
      expect(got[14], `seed ${seed}`).not.toBe(got[13]);
    }
  });

  it("every bag after the first also holds each vibe once and never opens on the last draw", () => {
    const store = new MapStorage();
    const got = Array.from({ length: 14 * 6 }, () => drawFromBag(42, store)!.id);
    for (let b = 0; b < 6; b++) expect(new Set(got.slice(b * 14, b * 14 + 14)).size).toBe(14);
    for (let i = 1; i < got.length; i++) expect(got[i]).not.toBe(got[i - 1]);
  });

  it("is kept in storage: the same storage goes on with the same bag, whatever seed the launch passes", () => {
    const a = new MapStorage();
    const b = new MapStorage();
    drawFromBag(5, a);
    drawFromBag(5, b);
    expect(drawFromBag(111, a)).toEqual(drawFromBag(999, b));
    expect(JSON.parse(a.getItem(BAG_KEY)!).bag).toHaveLength(12);
  });

  it("is seeded only: the same seed and storage draw the same vibes", () => {
    const run = () => {
      const s = new MapStorage();
      return Array.from({ length: 20 }, () => drawFromBag(77, s)!.id);
    };
    expect(run()).toEqual(run());
  });

  it("without storage the draw is plain seeded random over the top vibes", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed++) {
      const got = drawFromBag(seed, null)!;
      expect(TOP_IDS).toContain(got.id);
      expect(drawFromBag(seed, null)).toEqual(got);
      seen.add(got.id);
    }
    expect(seen.size).toBe(TOP_IDS.length);
  });

  it("broken or refusing storage still draws a top vibe; a stale id leaves the bag", () => {
    const bad = new MapStorage();
    bad.setItem(BAG_KEY, "{not json");
    expect(TOP_IDS).toContain(drawFromBag(3, bad)!.id);
    const refusing: BagStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(TOP_IDS).toContain(drawFromBag(3, refusing)!.id);
    const stale = new MapStorage();
    stale.setItem(BAG_KEY, JSON.stringify({ seed: 9, bag: ["gone"], last: null }));
    expect(TOP_IDS).toContain(drawFromBag(3, stale)!.id);
  });
});

describe("the launch draw (spec 10.1)", () => {
  it("rolls a key and a whole bpm inside the vibe's range, and the song still loads", () => {
    const keys = new Set<string>();
    const bpms = new Map<string, Set<number>>();
    for (let seed = 0; seed < 600; seed++) {
      const got = drawLaunch(seed, null)!;
      const [lo, hi] = vibeBpmRange(STYLES[got.id]);
      expect(got.song.style).toBe(got.id);
      expect(NOTE_NAMES).toContain(got.song.key);
      expect(Number.isInteger(got.song.bpm)).toBe(true);
      expect(got.song.bpm, got.id).toBeGreaterThanOrEqual(lo);
      expect(got.song.bpm, got.id).toBeLessThanOrEqual(hi);
      expect(got.song.mood).toBe(STYLES[got.id].mood);
      expect(validateSong(got.song), got.id).toEqual([]);
      keys.add(got.song.key);
      bpms.set(got.id, (bpms.get(got.id) ?? new Set()).add(got.song.bpm));
    }
    expect(keys.size).toBe(NOTE_NAMES.length);
    // One vibe does not open the same twice: its bpm varies across draws.
    for (const id of TOP_IDS) expect(bpms.get(id)?.size ?? 0, id).toBeGreaterThan(1);
  });

  it("uses the bag when there is storage", () => {
    const s = new MapStorage();
    const ids = Array.from({ length: 14 }, () => drawLaunch(8, s)!.id);
    expect(new Set(ids).size).toBe(14);
  });

  it("through the bag too, rolls the key from the twelve and the bpm inside the vibe's range", () => {
    const s = new MapStorage();
    for (let i = 0; i < 14 * 4; i++) {
      const got = drawLaunch(8, s)!;
      const [lo, hi] = vibeBpmRange(STYLES[got.id]);
      expect(NOTE_NAMES, got.id).toContain(got.song.key);
      expect(Number.isInteger(got.song.bpm) && got.song.bpm >= lo && got.song.bpm <= hi, `${got.id} ${got.song.bpm}`).toBe(true);
    }
  });
});
