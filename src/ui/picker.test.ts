import { describe, expect, it } from "vitest";
import css from "../style.css?raw";
import vibesSource from "./vibes.tsx?raw";
import mainSource from "../main.tsx?raw";
import appSource from "./App.tsx?raw";
import { TOP_IDS, STYLE_IDS } from "../music/styles.ts";
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
  it("opens the launch jam from the bag on a cold start, not the picker", () => {
    expect(mainSource).toMatch(/drawLaunch\(Date\.now\(\), localBagStorage\(\)\)/);
    expect(mainSource).toMatch(/keeper\.openLaunch\(/);
    expect(appSource).toMatch(/const \[vibes, setVibes\] = useState\(false\)/);
    expect(appSource).toMatch(/const \[tab, setTab\] = useState<Tab>\("play"\)/);
  });

  it("has a dice on the vibe control and Surprise me in the picker, both drawing from the bag", () => {
    expect(vibesSource).toContain('id="vibe-dice"');
    expect(vibesSource).toContain('id="vibe-surprise"');
    expect(vibesSource).toMatch(/drawLaunch\(Date\.now\(\), localBagStorage\(\)\)/);
  });

  it("C28: the vibe pick no longer checks engine.playing", () => {
    expect(vibesSource).not.toMatch(/engine\.playing/);
  });
});
