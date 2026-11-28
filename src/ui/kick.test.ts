/**
 * F2 slice b (spec 10.5): the kick quadrant's logic and where the kick's Advanced controls sit. The quadrant reads and
 * writes Length (the kick's decay) and Punch and nothing else; the Kick page holds the kick's voice; nothing of the
 * phone's drum pages is lost (the whole Drums panel's own test, tabs/full.test.ts, still sees every knob once).
 */
import { describe, expect, it } from "vitest";
import { defaultPatch } from "../engine/song.ts";
import { KICK_DEFAULTS } from "../music/kick.ts";
import { KIT_KNOBS, KNOB_PAGES, KICK_CLICK_KNOB, kickPad, kickPadMove, kickRootOn, knobText } from "./logic.ts";
import kickSrc from "./tabs/kick.tsx?raw";
import instSrc from "./tabs/InstrumentTab.tsx?raw";
import simpleSrc from "./tabs/SimpleTab.tsx?raw";
import { MACROS } from "../music/macros.ts";
import { KICK_KEYS } from "../music/kick.ts";
import { Engine } from "../engine/index.ts";
import { defaultSong } from "../engine/song.ts";
import { macroPosition } from "../engine/macro.ts";

describe("one Punch on the Simple Drums tab (F2 review S2)", () => {
  // The quadrant owns Punch (kickPunch) and Length (kickDecay); the voice owns Click, Root and Tune (the Pitch dial).
  const quadrant = ["kickPunch", "kickDecay"];
  const voice = [...KICK_KEYS.filter((k) => !quadrant.includes(k)), "pitch"];
  it("no Simple Drums macro moves a value the quadrant owns, except the Punch dial moving the quadrant's Punch end to end", () => {
    for (const m of MACROS.drums)
      for (const t of m.targets) {
        if (t.kind !== "patch") continue;
        if (m.id === "punch" && t.key === "kickPunch") {
          expect([t.from, t.to]).toEqual([0, 1]); // the same axis as the quadrant's up, end to end
          continue;
        }
        expect(quadrant, `${m.id} moves ${t.key}`).not.toContain(t.key);
        expect(voice, `${m.id} moves ${t.key}`).not.toContain(t.key);
      }
    const punch = MACROS.drums.find((m) => m.id === "punch")!;
    expect(punch.targets[0]).toMatchObject({ kind: "patch", key: "kickPunch" });
  });
  it("the Punch dial and the quadrant read one value: the dial reads where the quadrant set it, and moves it", () => {
    const e = new Engine(defaultSong());
    e.setParams("drums", { kickPunch: 0.8 });
    expect(macroPosition(e.getSong(), 1, "drums", "punch")).toBeCloseTo(0.8, 9);
    e.setMacro(1, "drums", "punch", 0.25);
    expect(kickPad(e.getSong().patches.drums).y).toBeCloseTo(0.25, 9);
    const decay = e.getSong().patches.drums.kickDecay;
    e.setMacro(1, "drums", "punch", 0.9);
    expect(e.getSong().patches.drums.kickDecay).toBe(decay); // the dot does not move sideways
    // A quadrant move lets the dial read the value again.
    e.setParams("drums", kickPadMove(0.5, 0.4));
    e.releaseMacros("drums", "kickPunch");
    expect(macroPosition(e.getSong(), 1, "drums", "punch")).toBeCloseTo(0.4, 9);
  });
  it("the quadrant releases the Punch dial when it moves", () => {
    expect(kickSrc as string).toMatch(/releaseMacros\("drums", "kickPunch"\)/);
  });
});

describe("the kick quadrant (spec 10.5)", () => {
  it("reads Length across and Punch up; a patch from before F2 reads the default Punch", () => {
    const p = { ...defaultPatch("drums"), kickDecay: 0.3 };
    expect(kickPad(p)).toEqual({ x: 0.3, y: KICK_DEFAULTS.kickPunch });
    expect(kickPad({ ...p, kickPunch: 0.9 })).toEqual({ x: 0.3, y: 0.9 });
  });
  it("sets Length and Punch and nothing else, clamped to 0..1", () => {
    expect(kickPadMove(0.25, 0.75)).toEqual({ kickDecay: 0.25, kickPunch: 0.75 });
    expect(kickPadMove(-1, 2)).toEqual({ kickDecay: 0, kickPunch: 1 });
    expect(kickPadMove(Number.NaN, 0.5)).toEqual({ kickDecay: 0, kickPunch: 0.5 });
    expect(Object.keys(kickPadMove(0.5, 0.5)).sort()).toEqual(["kickDecay", "kickPunch"]);
  });
  it("round-trips: where a move puts the dot is where it reads", () => {
    for (const [x, y] of [[0, 0], [1, 1], [0.4, 0.8]] as const) expect(kickPad({ ...defaultPatch("drums"), ...kickPadMove(x, y) })).toEqual({ x, y });
  });
  it("goes through the engine only: no Tone.js, no random", () => {
    const src: string = kickSrc;
    expect(src).not.toMatch(/from "tone"/);
    expect(src).not.toMatch(/Math\.random/);
    expect(src).toMatch(/engine\.setParams\("drums", kickPadMove/);
  });
});

describe("the Root switch and Click (spec 10.5)", () => {
  it("Root reads on from 0.5, off for a patch without it (the ten other vibes, songs from before F2)", () => {
    expect(kickRootOn(defaultPatch("drums"))).toBe(false);
    expect(kickRootOn({ ...defaultPatch("drums"), kickRoot: 1 })).toBe(true);
    expect(kickRootOn({ ...defaultPatch("drums"), kickRoot: 0 })).toBe(false);
  });
  it("Click shows 0..100", () => {
    expect(knobText(KICK_CLICK_KNOB, 0.35)).toBe("35");
  });
});

describe("the drum pages (F2)", () => {
  it("Kick is the kick's voice: level, decay, Tune and drive, then Click, Root and the quadrant", () => {
    const [kick, hats] = KNOB_PAGES.drums!;
    expect(kick.knobs.map((k) => k.key)).toEqual(["kickLevel", "kickDecay", "pitch", "drive"]);
    expect(kick.knobs.find((k) => k.key === "pitch")!.label).toBe("Tune");
    const src: string = instSrc;
    expect(src).toMatch(/page === "kick" && \(\s*<Knobs[^>]*knobs=\{knobPages\[0\]\.knobs\} cls="kickdials">\s*<ClickDial ctx=\{ctx\} \/>\s*<RootSwitch ctx=\{ctx\} \/>\s*\{!kickLow && <KickPad ctx=\{ctx\} \/>\}/);
    // Review M6: the Kick page's decay is the quadrant's Length, by name too.
    expect(kick.knobs.find((k) => k.key === "kickDecay")!.label).toBe("Length");
    // Review M6: with Root on, Tune is dimmed and reads "Root".
    expect(src).toMatch(/const rooted = inst === "drums" && k\.key === "pitch" && kickRootOn\(patch\);/);
    expect(src).toMatch(/display=\{rooted \? "Root" : knobText\(k, patch\[k\.key\]\)\}/);
    expect(src).toMatch(/dim=\{rooted\}/);
    // The clap moved to Hats, Swing to Kit: no page over six dials.
    expect(hats.knobs.map((k) => k.key)).toEqual(["clapLevel", "clapDecay", "hatLevel", "hatDecay", "openLevel", "openDecay"]);
    expect(src).toMatch(/page === "kit" && \(\s*<Knobs ctx=\{ctx\} inst=\{inst\} knobs=\{KIT_KNOBS\}>\s*<SwingDial ctx=\{ctx\} \/>/);
    expect(kick.knobs.length + 1).toBeLessThanOrEqual(6);
    expect(KIT_KNOBS.length + 1).toBeLessThanOrEqual(6);
  });
  it("the quadrant takes the Drums pad's place in Simple and on the desk; the filter pad stays reachable", () => {
    const simple: string = simpleSrc;
    expect(simple).toMatch(/inst === "drums" \? <KickPad ctx=\{ctx\} \/> : <SimpleXY/);
    const src: string = instSrc;
    // Desk (F2 review S4): at the foot of the column the drums' filter pad beside the quadrant, nothing in a sheet.
    expect(src).toMatch(/<div class="xypair">\s*<FilterXY ctx=\{ctx\} inst="drums" narrow \/>\s*<KickPad ctx=\{ctx\} \/>\s*<\/div>\s*<\/div>\s*<\/section>/);
    const sheet = src.slice(src.indexOf("function SoundButton"), src.indexOf("function WholeDrums"));
    expect(sheet).toContain("<Sheet");
    expect(sheet).not.toContain("FilterXY");
    // Phone and tablet pages: the filter pad and sends where they were (under every page, or the Filter page); where
    // they are under every page, the Kick page puts the quadrant in the filter pad's place, lowest (review M7).
    expect(src).toMatch(/const kickLow = roomy && page === "kick";/);
    expect(src).toMatch(/\{!kickLow && <KickPad ctx=\{ctx\} \/>\}/);
    expect(src).toMatch(/\(roomy \|\| page === "filter"\) && <FilterPanel ctx=\{ctx\} inst=\{inst\} pad=\{kickLow \? <KickPad ctx=\{ctx\} \/> : undefined\} \/>/);
  });
});
