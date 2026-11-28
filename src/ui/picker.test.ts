import { describe, expect, it } from "vitest";
import css from "../style.css?raw";
import { STYLES, TOP_IDS, STYLE_IDS, vibeBpmRange, vibeStart } from "../music/styles.ts";
import type { Song } from "../engine/song.ts";
import type { Ctx } from "./App.tsx";
import { loadDrawn } from "./vibes.tsx";
import { bothHeight, groupHeight, pickerPlan, PICK_GAP, PICK_GROUP, PICK_ROW, swapHeight } from "./picker.ts";

const TOP = TOP_IDS.length;
const OTHER = STYLE_IDS.length - TOP_IDS.length;

describe("vibe picker plan (F1, spec 10.1)", () => {
  it("counts the vibes it plans for: the top vibes and the other ten", () => {
    expect(TOP).toBe(14);
    expect(OTHER).toBe(10);
  });

  it("measures a group as 48 px rows in two columns with 2 px gaps", () => {
    expect(groupHeight(0)).toBe(0);
    expect(groupHeight(1)).toBe(PICK_ROW);
    expect(groupHeight(14)).toBe(7 * PICK_ROW + 6 * PICK_GAP);
    expect(groupHeight(13)).toBe(groupHeight(14));
    expect(groupHeight(10)).toBe(5 * PICK_ROW + 4 * PICK_GAP);
  });

  it("shows both groups where they fit at 48 px a tile, and the More switch where they do not", () => {
    expect(pickerPlan(640, TOP, OTHER).both).toBe(false);
    expect(pickerPlan(740, TOP, OTHER).both).toBe(true);
    expect(pickerPlan(915, TOP, OTHER).both).toBe(true);
    expect(pickerPlan(1280, TOP, OTHER).both).toBe(true);
    expect(pickerPlan(800, TOP, OTHER).both).toBe(true);
    // At its edge: exactly the height both need.
    const need = bothHeight(TOP, OTHER);
    expect(pickerPlan(need, TOP, OTHER).both).toBe(true);
    expect(pickerPlan(need - 1, TOP, OTHER).both).toBe(false);
  });

  it("fits one group at a time with the More switch on the smallest phone, 360 x 640", () => {
    expect(swapHeight(TOP, OTHER)).toBeLessThanOrEqual(640);
  });

  it("keeps the larger group's height for a swapped group, so the More switch stays under the thumb", () => {
    expect(pickerPlan(640, TOP, OTHER).place).toBe(groupHeight(TOP));
    expect(pickerPlan(640, 4, 10).place).toBe(groupHeight(10));
  });

  it("needs no switch when there are no other vibes", () => {
    expect(pickerPlan(100, TOP, 0).both).toBe(true);
  });

  it("matches the stylesheet's sizes", () => {
    const rule = (sel: string): string => {
      const i = css.indexOf(`${sel} {`);
      expect(i).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf("}", i));
    };
    expect(rule(".sheet.vpick")).toContain("padding: 12px var(--pad)");
    expect(rule(".sheet.vpick")).toContain("gap: var(--group)");
    expect(rule(".vpick .vibegrid")).toContain("grid-auto-rows: var(--hit)");
    expect(rule(".vline")).toContain("min-height: 28px");
    expect(rule(".vline.swap")).toContain("min-height: var(--hit)");
    expect(rule(".vphead")).toContain("min-height: var(--hit)");
    expect(css).toMatch(/--hit: 48px;/);
    expect(css).toMatch(/--group: 10px;/);
    expect(css).toMatch(/--gap: 2px;/);
    expect(PICK_GROUP).toBe(10);
  });
});

describe("straight in (F1, spec 10.1)", () => {
  // F1 review M1: behaviour, not source text. The cold start itself is checked in the browser (smoke core's
  // walk_cold_start), the dice and "Surprise me" taps there too (walk_vibe_draws).
  type Fake = { ctx: Ctx; picked: { doc: Song; section: number }[]; plays: () => number; starts: () => number };
  const fake = (playing: boolean): Fake => {
    const picked: { doc: Song; section: number }[] = [];
    let plays = 0;
    let starts = 0;
    const ctx = {
      startAudio: () => {
        starts++;
        return Promise.resolve(true);
      },
      engine: { playing, play: () => void plays++ },
      keeper: {
        startVibeWith: async (pick: () => { doc: Song; section: number } | null) => {
          const got = pick();
          if (got) picked.push(got);
          return !!got;
        },
      },
    } as unknown as Ctx;
    return { ctx, picked, plays: () => plays, starts: () => starts };
  };

  it("the dice and Surprise me draw a top vibe from the bag, rolled inside its bpm range", async () => {
    for (let i = 0; i < 20; i++) {
      const f = fake(false);
      expect(await loadDrawn(f.ctx, false)).toBe(true);
      const { doc, section } = f.picked[0];
      expect(TOP_IDS).toContain(doc.style);
      const [lo, hi] = vibeBpmRange(STYLES[doc.style!]);
      expect(doc.bpm >= lo && doc.bpm <= hi, `${doc.style} ${doc.bpm}`).toBe(true);
      expect(section).toBe(vibeStart(doc.style!));
      // The dice does not start the transport.
      expect(f.starts()).toBe(0);
      expect(f.plays()).toBe(0);
    }
  });

  it("C28: Surprise me calls play() whether or not the transport already runs (play() returns early on a running one)", async () => {
    for (const playing of [false, true]) {
      const f = fake(playing);
      expect(await loadDrawn(f.ctx, true)).toBe(true);
      expect(f.starts(), `playing ${playing}`).toBe(1);
      expect(f.plays(), `playing ${playing}`).toBe(1);
    }
  });
});
