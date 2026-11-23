/** P1b, the look: icons by the spec's table, DM Sans only, lane geometry, the playhead and the label flash. */
import { describe, expect, it } from "vitest";
import specText from "../../docs/SPEC.md?raw";
import indexHtml from "../../index.html?raw";
import styleCss from "../style.css?raw";
import { ICON_PATHS } from "./icon-paths.ts";
import { ICON_FOR } from "./icons.tsx";
import { flashLevel, laneRects, playhead } from "./logic.ts";

/** Every source file of the app (tests aside), as text. */
const SOURCES: Record<string, string> = {
  ...(import.meta.glob(["../**/*.{ts,tsx,css}", "!../**/*.test.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>),
  "index.html": indexHtml,
};
const read = (p: string): string => (p === "docs/SPEC.md" ? specText : p === "src/style.css" ? styleCss : SOURCES[p]);

describe("icons (spec 8.12)", () => {
  /** Rows of the spec's icon table: things in the first cell, icons in the second, in the same order. */
  function specTable(): [string, string][] {
    const spec = read("docs/SPEC.md");
    const start = spec.indexOf("| Thing | Icon |");
    expect(start).toBeGreaterThan(0);
    const rows = spec.slice(start).split("\n").slice(2);
    const out: [string, string][] = [];
    for (const row of rows) {
      if (!row.startsWith("|")) break;
      const [things, icons] = row.split("|").slice(1, 3).map((c) => c.split(",").map((x) => x.trim()));
      expect(things.length).toBe(icons.length);
      things.forEach((t, i) => out.push([t, icons[i]]));
    }
    return out;
  }

  it("every thing in the spec's table has the icon the table gives it", () => {
    const table = specTable();
    expect(table.length).toBeGreaterThanOrEqual(27);
    for (const [thing, icon] of table) expect(ICON_FOR[thing as keyof typeof ICON_FOR], thing).toBe(icon);
    expect(Object.keys(ICON_FOR).sort()).toEqual(table.map(([t]) => t).sort());
  });

  it("every icon ships as SVG path data, in the 960 grid of Material Symbols", () => {
    for (const icon of Object.values(ICON_FOR)) {
      const d = ICON_PATHS[icon];
      expect(d, icon).toMatch(/^[Mm][-\d.]+/);
    }
  });
});

describe("one typeface (spec 8.12)", () => {
  it("no second face anywhere: no Space Mono, no monospace, no font from the network", () => {
    const files = Object.keys(SOURCES);
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain("index.html");
    for (const p of files) {
      if (p.endsWith("look.test.ts")) continue;
      const text = SOURCES[p];
      expect(text, p).not.toMatch(/Space Mono|monospace|ui-monospace|--mono|fonts\.googleapis|fonts\.gstatic/);
    }
  });

  it("every font-family in the stylesheet is DM Sans", () => {
    const css = read("src/style.css");
    const families = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(families.length).toBeGreaterThan(0);
    for (const f of families) expect(f === "var(--body)" || f.startsWith('"DM Sans"'), f).toBe(true);
    expect(css).toMatch(/--body:\s*"DM Sans", sans-serif;/);
    // The face is the app's own file.
    expect(css).toMatch(/@font-face\s*{[^}]*font-family:\s*"DM Sans";[^}]*url\("\.\/assets\/dm-sans-latin-wght\.woff2"\)/);
  });

  it("sentence case: nothing is set in capitals by the stylesheet", () => {
    expect(read("src/style.css")).not.toMatch(/text-transform:\s*uppercase/);
  });
});

describe("lane geometry (spec 8.12)", () => {
  it("places each note by its step and length on the 16-step grid, cut at the bar's end", () => {
    const r = laneRects([
      { step: 0, len: 4, shift: 0, pitch: 60 },
      { step: 8, len: 2, shift: 0, pitch: 67 },
      { step: 14, len: 8, shift: 0, pitch: 64 },
    ]);
    expect(r).toHaveLength(3);
    expect(r[0].x).toBeCloseTo(0.375);
    expect(r[1].x).toBeCloseTo(50.375);
    expect(r[2].x + r[2].w).toBeLessThanOrEqual(100);
    expect(r[2].e).toBe(16);
    // Higher notes are drawn higher.
    expect(r[1].y).toBeLessThan(r[2].y);
    expect(r[2].y).toBeLessThan(r[0].y);
  });

  it("swing moves a note by its shift", () => {
    const [a] = laneRects([{ step: 3, len: 1, shift: 0.25, pitch: 60 }]);
    expect(a.s).toBeCloseTo(3.25);
  });

  it("drums: hats on top, clap in the middle, kick at the bottom", () => {
    const [hat, clap, kick] = laneRects([
      { step: 2, len: 1, shift: 0, voice: "hat" },
      { step: 4, len: 1, shift: 0, voice: "clap" },
      { step: 0, len: 1, shift: 0, voice: "kick" },
    ]);
    expect(hat.y).toBeLessThan(clap.y);
    expect(clap.y).toBeLessThan(kick.y);
    expect(kick.y + kick.h).toBeLessThanOrEqual(100);
  });

  it("pitched notes are a fifth of the lane tall and stay inside it", () => {
    const r = laneRects([
      { step: 0, len: 1, shift: 0, pitch: 48 },
      { step: 4, len: 1, shift: 0, pitch: 72 },
    ]);
    for (const n of r) {
      expect(n.h).toBe(20);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y + n.h).toBeLessThanOrEqual(100);
    }
    expect(r.map((n) => n.k)).toEqual(["48", "72"]);
  });
});

describe("the playhead keeps time", () => {
  it("sits on the step heard and sweeps toward the next one, never past it", () => {
    const stepMs = 60000 / 120 / 4; // 125 ms at 120 bpm
    expect(playhead(5, 0, stepMs, false)).toBe(5);
    expect(playhead(5, 62.5, stepMs, false)).toBeCloseTo(5.5);
    expect(playhead(5, 400, stepMs, false)).toBe(6); // a late frame waits for the next step
    expect(playhead(15, 125, stepMs, false)).toBe(16);
  });
  it("with motion off it jumps from step to step", () => {
    expect(playhead(7, 100, 125, true)).toBe(7);
  });
});

describe("a label brightens on each note it plays", () => {
  const notes = [
    { step: 0, shift: 0 },
    { step: 4, shift: 0 },
    { step: 0, shift: 0, held: true },
  ];
  it("full on the note, fading over a step and a half", () => {
    expect(flashLevel(notes, 4)).toBe(1);
    expect(flashLevel(notes, 4.75)).toBeCloseTo(0.5);
    expect(flashLevel(notes, 6)).toBe(0);
    expect(flashLevel(notes, 0.5)).toBeCloseTo(2 / 3);
  });
  it("a note held over from the bar before does not flash", () => {
    expect(flashLevel([{ step: 0, shift: 0, held: true }], 0)).toBe(0);
  });
});
