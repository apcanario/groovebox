/**
 * Spec 10.2: the ten other vibes keep their sound; no row of phase 4 may change how they sound. The engine plays a
 * vibe from its song (`vibeSong`) and the section it starts in (`vibeStart`), so this pins both, for each of the ten,
 * to what they were before phase 4 (tools/fixtures/other_vibes_c6a7e01.json, recorded at c6a7e01, F1's base). A row
 * that means to change one re-records the fixture and says why in the changelog.
 */
import { describe, expect, it } from "vitest";
import raw from "../../tools/fixtures/other_vibes_c6a7e01.json?raw";
import { STYLE_IDS, STYLES, TOP_IDS, vibeSong, vibeStart } from "./styles.ts";

const BEFORE = JSON.parse(raw) as Record<string, { start: number; song: unknown }>;

describe("the ten other vibes (spec 10.2)", () => {
  it("are the ten vibes that are not top vibes", () => {
    expect(Object.keys(BEFORE)).toHaveLength(10);
    expect(STYLE_IDS.filter((id) => !TOP_IDS.includes(id)).sort()).toEqual(Object.keys(BEFORE).sort());
  });

  it("open the same song in the same section as before phase 4", () => {
    for (const [id, was] of Object.entries(BEFORE)) {
      expect(STYLES[id]?.top, id).not.toBe(true);
      expect(vibeStart(id), id).toBe(was.start);
      expect(JSON.parse(JSON.stringify(vibeSong(id))), id).toEqual(was.song);
    }
  });
});
