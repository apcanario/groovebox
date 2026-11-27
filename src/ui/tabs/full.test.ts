import { describe, expect, it } from "vitest";
import { CHORD_SHAPES, FIT_SLACK, MIX_SHAPES, fitKey, instShapes, layerShapes, overflowing, type Shape } from "./full.ts";
import { DRUM_EXTRAS, KIT_KNOBS, KNOB_PAGES, MAX_CHORDS, METER_MS, VOICE_KNOBS, drumKnob, faderDrag, meterScale } from "../logic.ts";
import { DRUM_VOICES, LAYER_MODES, defaultSong, type Song } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import mixSrc from "./MixTab.tsx?raw";
import motionSrc from "../motion.ts?raw";
import styleCss from "../../style.css?raw";

describe("a whole panel takes pages when it overflows (T2, spec 9.1)", () => {
  it("fits when the content is no larger than the body, a pixel of rounding allowed", () => {
    expect(overflowing({ scrollHeight: 664, clientHeight: 664, scrollWidth: 673, clientWidth: 673 })).toBe(false);
    expect(overflowing({ scrollHeight: 665, clientHeight: 664, scrollWidth: 674, clientWidth: 673 })).toBe(false);
  });
  it("overflows when the content is taller or wider than the body", () => {
    expect(overflowing({ scrollHeight: 694, clientHeight: 664, scrollWidth: 673, clientWidth: 673 })).toBe(true);
    expect(overflowing({ scrollHeight: 664, clientHeight: 664, scrollWidth: 700, clientWidth: 673 })).toBe(true);
  });
});

describe("the Mix panel's faders on the desk (T2, spec 9.2)", () => {
  it("move by the drag from where they were, never to the touch point (T2 review M3)", () => {
    // A touch that does not move changes nothing, wherever it lands.
    expect(faderDrag(0.3, 250, 250, 300)).toBe(0.3);
    expect(faderDrag(0.3, 110, 110, 300)).toBe(0.3);
    // Up is louder: half the track is half the range.
    expect(faderDrag(0.3, 250, 100, 300)).toBe(0.8);
    expect(faderDrag(0.3, 250, 280, 300)).toBe(0.2);
    expect(faderDrag(0.9, 250, 0, 300)).toBe(1);
    expect(faderDrag(0.1, 250, 900, 300)).toBe(0);
    expect(faderDrag(0.4, 250, 0, 0)).toBe(0.4);
  });
  it("show their meters from the one motion loop, about 15 times a second, empty when held still (T2 review S2)", () => {
    expect(METER_MS).toBeGreaterThanOrEqual(50);
    expect(meterScale(-30, false)).toBe(0.5);
    expect(meterScale(-Infinity, false)).toBe(0);
    expect(meterScale(-30, true)).toBe(0);
    // No second animation loop: the Mix tab draws no meter of its own beyond the master meter's.
    const mix: string = mixSrc;
    expect(mix.match(/requestAnimationFrame\(/g)?.length ?? 0).toBeLessThanOrEqual(2);
    expect(mix).not.toMatch(/instrumentLevel/);
    const motion: string = motionSrc;
    expect(motion).toMatch(/\.fmeter\[data-meter\]/);
  });
});

/** A context with the given edited section's content, for the shapes (only what they read). */
function ctxWith(f: (s: Song) => void, toggles: { section: number; instrument: string }[] = []): Ctx {
  const song = defaultSong();
  f(song);
  return { song, edit: 0, pending: { toggles } } as unknown as Ctx;
}

/**
 * What a probe of each shape of a panel draws that can change its size: the section's name, the chord count, the
 * instrument's switch and whether it waits for the next bar, and for a layer its mode and kind of lead style.
 */
function signature(panel: string, shapes: Shape[], ctx: Ctx): string[] {
  return shapes.map((sh) => {
    const v = sh(ctx);
    const sec = v.song.sections[v.edit];
    const own = panel === "chords" ? null : (panel as "drums" | "layer1");
    const layer = panel === "layer1" || panel === "layer2" ? sec[panel] : null;
    return JSON.stringify({
      name: sec.name,
      chords: panel === "chords" ? sec.chords.length : null,
      on: own ? sec.on[own] : null,
      waits: own ? v.pending.toggles.filter((t) => t.section === v.edit && t.instrument === own).length : null,
      mode: layer?.mode ?? null,
      pulse: layer?.mode === "generative" ? layer.gen.style === "pulse" : null,
    });
  });
}

describe("whole or paged is decided by the body's size alone (T2 review E2)", () => {
  // Two jams that differ in everything a panel's height could follow: chords, mode, style, name, a switch waiting.
  const a = ctxWith((s) => {
    s.sections[0].chords = s.sections[0].chords.slice(0, 1);
    s.sections[0].name = "A";
    s.sections[0].layer1.mode = "arp";
    s.sections[0].layer2.mode = "pad";
  });
  const b = ctxWith(
    (s) => {
      s.sections[0].chords = Array.from({ length: MAX_CHORDS }, () => ({ degree: 3, bars: 2 as const }));
      s.sections[0].name = "Breakdown";
      s.sections[0].layer1.mode = "generative";
      s.sections[0].layer1.gen = { ...s.sections[0].layer1.gen, style: "drift" };
      s.sections[0].layer2.mode = "drone";
      s.sections[0].on.bass = false;
    },
    [{ section: 0, instrument: "drums" }],
  );
  const panels: [string, Shape[]][] = [
    ["chords", CHORD_SHAPES],
    ["drums", instShapes("drums")],
    ["bass", instShapes("bass")],
    ["synth", instShapes("synth")],
    ["layer1", layerShapes("layer1")],
    ["layer2", layerShapes("layer2")],
  ];
  it("every panel is measured at the same worst case whatever the jam holds", () => {
    for (const [panel, shapes] of panels) expect(signature(panel, shapes, a)).toEqual(signature(panel, shapes, b));
    expect(MIX_SHAPES).toHaveLength(1);
  });
  it("chords are measured full, a layer in every mode and both kinds of lead style", () => {
    expect(signature("chords", CHORD_SHAPES, a).map((t) => JSON.parse(t).chords)).toEqual([MAX_CHORDS]);
    for (const id of ["layer1", "layer2"] as const) {
      const got = signature(id, layerShapes(id), a).map((t) => {
        const g = JSON.parse(t);
        return g.mode === "generative" ? `generative:${g.pulse ? "pulse" : "other"}` : g.mode;
      });
      expect(new Set(got)).toEqual(new Set([...LAYER_MODES.filter((m) => m !== "generative"), "generative:pulse", "generative:other"]));
    }
  });
  it("the decision is kept by panel and body size, and asks for real room to spare", () => {
    expect(fitKey("chords", 744, 370)).toBe("chords|744x370");
    expect(FIT_SLACK).toBeGreaterThanOrEqual(8);
    const css: string = styleCss;
    expect(css).toMatch(new RegExp(`section\\[data-probe\\] \\{\\s*margin-bottom: ${FIT_SLACK}px;`));
    // No CSS width floor decides it (T2 review E1): the panel is measured.
    expect(css).not.toMatch(/\.(mixtab|chordtab)\.whole \{\s*min-width/);
    expect(css).not.toMatch(/\.insttab\.drumwhole \{[^}]*min-width/);
  });
});

describe("the whole Drums panel on the desk holds every drum knob of the phone's pages, once (T2, spec 9.2)", () => {
  it("gives every voice its level and decay, and the rest to the column", () => {
    expect(Object.keys(VOICE_KNOBS).sort()).toEqual([...DRUM_VOICES].sort());
    const shown = [...Object.values(VOICE_KNOBS).flat(), ...DRUM_EXTRAS];
    const pages = [...(KNOB_PAGES.drums ?? []).flatMap((p) => p.knobs), ...KIT_KNOBS].map((k) => k.key);
    expect([...shown].sort()).toEqual([...pages].sort());
    expect(new Set(shown).size).toBe(shown.length);
    for (const k of shown) expect(drumKnob(k).key).toBe(k);
  });
});
