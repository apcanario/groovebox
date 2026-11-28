/**
 * F2 slice b (spec 10.3's Drums column, 10.5): Thump, the fourteen top vibes' kick settings, and the ten other vibes'
 * style files untouched.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import raw from "../../tools/fixtures/other_vibe_files_d6052fd.json?raw";
import { Sequencer, type StepResult } from "../engine/sequencer.ts";
import { defaultSong } from "../engine/song.ts";
import { KICK_KEYS } from "./kick.ts";
import { BEAT_NAMES, DRUM_PATTERNS, DRUM_PRESETS, DRUM_VOICES } from "./presets.ts";
import { STYLE_IDS, STYLES, TOP_IDS, vibeSong } from "./styles.ts";

const BEFORE = JSON.parse(raw) as { files: Record<string, string> };
const SOURCES = import.meta.glob("../styles/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const source = (id: string): string => SOURCES[`../styles/${id}.ts`];

describe("Thump (spec 10.5)", () => {
  it("is a beat named Thump that sits beside Four floor", () => {
    expect(DRUM_PRESETS).toContain("thump");
    expect(BEAT_NAMES.thump.name).toBe("Thump");
    expect(DRUM_PRESETS.indexOf("thump")).toBe(DRUM_PRESETS.indexOf("fourFloor") + 1);
  });

  it("holds the kick on steps 0, 4, 8 and 12 and nothing else", () => {
    const p = DRUM_PATTERNS.thump;
    for (const v of DRUM_VOICES) {
      const on = p.grid[v].flatMap((x, i) => (x > 0 ? [i] : []));
      expect(on, v).toEqual(v === "kick" ? [0, 4, 8, 12] : []);
    }
    expect(p.swing).toBe(0);
    expect(p.rolls).toEqual({});
  });

  it("plays the kick on steps 0, 4, 8 and 12 and nothing else, bar after bar", () => {
    const song = defaultSong();
    for (const s of song.sections) {
      s.drums = { preset: "thump" };
      for (const id of ["bass", "synth", "layer1", "layer2"] as const) s.on[id] = false;
      s.on.drums = true;
    }
    const seq = new Sequencer(song);
    seq.start();
    const bars: StepResult[] = Array.from({ length: 64 }, () => seq.next());
    const drums = bars.flatMap((r) => r.events.filter((e) => e.inst === "drums").map((e) => ({ step: r.step, e })));
    expect(drums.every(({ e }) => e.inst === "drums" && e.voice === "kick" && !e.repeat && e.shift === 0)).toBe(true);
    expect(drums.map(({ step }) => step)).toEqual(Array.from({ length: 4 }, () => [0, 4, 8, 12]).flat());
  });
});

describe("the fourteen top vibes' kick (spec 10.3's Drums column)", () => {
  it("are fourteen, each with a kick field on its drum patch, every setting present and in range, Root on", () => {
    expect(TOP_IDS).toHaveLength(14);
    for (const id of TOP_IDS) {
      const ref = STYLES[id].patches.drums;
      expect(typeof ref, id).toBe("object");
      const kick = typeof ref === "object" ? ref.kick : undefined;
      expect(kick, id).toBeDefined();
      for (const k of KICK_KEYS) {
        const v = kick![k];
        expect(typeof v === "number" && v >= 0 && v <= 1, `${id}.${k} = ${v}`).toBe(true);
      }
      // Spec 10.5: Tune follows the song's root by default in the top vibes.
      expect(kick!.kickRoot, id).toBe(1);
      // The song a launch opens carries them.
      const song = vibeSong(id)!;
      for (const k of KICK_KEYS) expect(song.patches.drums[k], `${id}.${k}`).toBe(kick![k]);
    }
  });

  it("follow the table's words: long, short, soft and hard kicks differ the way it says", () => {
    const punch = (id: string) => vibeSong(id)!.patches.drums.kickPunch!;
    const click = (id: string) => vibeSong(id)!.patches.drums.kickClick!;
    const decay = (id: string) => vibeSong(id)!.patches.drums.kickDecay;
    // Deep techno's long dark kick against Minimal techno's short dry one.
    expect(decay("deepTechno")).toBeGreaterThan(decay("minimalTechno"));
    expect(click("deepTechno")).toBe(0);
    expect(click("minimalTechno")).toBeGreaterThan(0);
    // The soft kicks (Dub techno, Lo-fi, Ambient) have no click and less punch than the old kick's 0.5.
    for (const id of ["dubTechno", "loFi", "ambient"]) {
      expect(click(id), id).toBe(0);
      expect(punch(id), id).toBeLessThan(0.5);
    }
    // Ambient's Thump is very soft.
    expect(vibeSong("ambient")!.patches.drums.kickLevel).toBeLessThan(0.5);
  });

  it("take Thump where the table names it, and only there", () => {
    const names: Record<string, boolean> = { deepTechno: true, melodicTechno: true, deepHouse: true, ambient: true };
    for (const id of STYLE_IDS) {
      const uses = STYLES[id].sections.some((s) => s.beat === "thump");
      expect(uses, id).toBe(names[id] === true);
    }
  });
});

describe("the ten other vibes (spec 10.2)", () => {
  it("have style files byte for byte as F2 found them, with no kick field", () => {
    const others = STYLE_IDS.filter((id) => !TOP_IDS.includes(id));
    expect(others.sort()).toEqual(Object.keys(BEFORE.files).sort());
    for (const id of others) {
      expect(createHash("sha256").update(source(id), "utf8").digest("hex"), id).toBe(BEFORE.files[id]);
      const ref = STYLES[id].patches.drums;
      expect(typeof ref === "object" && ref.kick !== undefined, id).toBe(false);
      // Their songs carry no kick setting: the kick plays its defaults, the old kick.
      for (const k of KICK_KEYS) expect(vibeSong(id)!.patches.drums[k], `${id}.${k}`).toBeUndefined();
    }
  });
});
