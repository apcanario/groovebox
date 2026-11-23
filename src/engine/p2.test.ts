/** P2: Simple and Advanced. Macros (spec 8.3), Back with the eight-seed history, swing by hand, the C4 trim, the mode switch. */
import { describe, expect, it } from "vitest";
import oldSongJson from "./fixtures/p1b-default-song.json?raw";
import { MACROS, MACRO_KEYS, sectionScoped, targetPos, targetValue, type MacroInstrument, type MacroTarget } from "../music/macros.ts";
import { PAD_TRIM } from "../music/sound.ts";
import { loadMode, saveMode } from "../ui/mode.ts";
import { ARP_OCTAVES, ARP_RATES, LEAD_PAGES, KNOB_PAGES, LAYER_PATCH_KNOBS, PAD_KNOBS, seedHeard } from "../ui/logic.ts";
import { Engine } from "./index.ts";
import { targetNow } from "./macro.ts";
import { Sequencer, type StepResult } from "./sequencer.ts";
import {
  INSTRUMENTS,
  OLD_LAYER2_ENVELOPE,
  SEED_HISTORY,
  cloneSong,
  defaultPatch,
  defaultSong,
  migrateSong,
  parseSong,
  sectionSwing,
  validateSong,
  type Song,
} from "./song.ts";

const run = (seq: Sequencer, steps: number): StepResult[] => Array.from({ length: steps }, () => seq.next());

/** Layer 1's notes, step by step, for `bars` bars. */
function leadNotes(seq: Sequencer, bars: number): (string | null)[] {
  return run(seq, 16 * bars).map((r) => {
    const e = r.events.find((x) => x.inst === "layer1") as { notes: number[]; vel: number } | undefined;
    return e ? `${e.notes.join(",")}@${e.vel.toFixed(3)}` : null;
  });
}

function leadSong(): Song {
  const song = defaultSong();
  song.sections = [song.sections[1]];
  const s = song.sections[0];
  s.on = { drums: false, bass: false, synth: false, layer1: true, layer2: false };
  s.layer1.mode = "generative";
  // Lock below frozen: the lead drifts, so Back must restart it from the seed to repeat it.
  s.layer1.gen = { ...s.layer1.gen, lock: 0.6, hits: 11, density: 0.9 };
  return song;
}

describe("macros (spec 8.3)", () => {
  it("every Simple instrument tab has four dials, named as in the spec's table", () => {
    expect(MACROS.drums.map((m) => m.label)).toEqual(["Punch", "Hats", "Swing", "Level"]);
    expect(MACROS.bass.map((m) => m.label)).toEqual(["Bright", "Weight", "Punch", "Level"]);
    expect(MACROS.synth.map((m) => m.label)).toEqual(["Bright", "Punch", "Space", "Level"]);
    for (const l of ["layer1", "layer2"] as const) expect(MACROS[l].map((m) => m.label)).toEqual(["Busy", "Evolve", "Bright", "Space"]);
  });

  it("each macro at minimum and at maximum changes every value it maps", () => {
    for (const inst of INSTRUMENTS)
      for (const m of MACROS[inst as MacroInstrument]) {
        // A macro with no targets would pass the loop below without testing anything (P2 review M2).
        expect(m.targets.length, `${inst} ${m.id}`).toBeGreaterThan(0);
        const e = new Engine(defaultSong());
        expect(e.setMacro(1, inst, m.id, 0)).toBe(true);
        const lo = e.getSong();
        expect(e.setMacro(1, inst, m.id, 1)).toBe(true);
        const hi = e.getSong();
        for (const t of m.targets) {
          const a = targetNow(lo, 1, inst, t);
          const b = targetNow(hi, 1, inst, t);
          expect(a, `${inst} ${m.id} ${JSON.stringify(t)}`).not.toBe(b);
          // The values are exactly the mapping's ends.
          expect(a).toBeCloseTo(targetValue(t, 0), 6);
          expect(b).toBeCloseTo(targetValue(t, 1), 6);
        }
        expect(validateSong(hi)).toEqual([]);
      }
  });

  it("every value a macro moves has a control in Advanced (spec 8.1; P2 review E1)", () => {
    // What Advanced shows, by instrument: the patch dial pages (Drums, Bass, Synth) or the layers' Sound page,
    // the Filter panel every instrument has (XY pad and sends), the Mix tab's level per instrument; per section,
    // the generative dials, the arp chips and gate, the pad dials and the Swing dial on the drums' Hats page.
    const filterPanel = ["cutoff", "resonance", "delay", "reverb"];
    const mixLevels = ["level"];
    for (const inst of INSTRUMENTS) {
      const patchDials = inst === "layer1" || inst === "layer2" ? LAYER_PATCH_KNOBS.map((k) => k.key) : (KNOB_PAGES[inst] ?? []).flatMap((p) => p.knobs.map((k) => k.key));
      const shown: Record<MacroTarget["kind"], string[]> = {
        patch: [...patchDials, ...filterPanel, ...mixLevels],
        gen: Object.values(LEAD_PAGES).flatMap((page) => page.map((k) => k.key)),
        arp: ["direction", "gate", ...(ARP_RATES.length ? ["rate"] : []), ...(ARP_OCTAVES.length ? ["octaves"] : [])],
        pad: PAD_KNOBS.map((k) => k.key),
        swing: inst === "drums" ? ["swing"] : [],
      };
      for (const m of MACROS[inst as MacroInstrument])
        for (const t of m.targets) {
          const key = "key" in t ? t.key : "swing";
          expect(shown[t.kind], `${inst} ${m.id} moves ${t.kind} ${key}, which Advanced does not show`).toContain(key);
        }
    }
  });

  it("the Simple XY pad lets a Bright dial read the cutoff again (P2 review S2)", () => {
    const e = new Engine(defaultSong());
    e.setMacro(1, "bass", "bright", 0.9);
    e.setMacro(1, "bass", "weight", 0.2);
    e.setMacro(1, "layer1", "bright", 0.9);
    e.setParams("bass", { cutoff: 0.3, resonance: 0.5 });
    expect(e.releaseMacros("bass", "cutoff")).toBe(true);
    // Bright now reads the cutoff the pad set; Weight (not on the cutoff) and the other instruments keep theirs.
    expect(e.macroPos(1, "bass", "bright")).toBeCloseTo(targetPos(MACROS.bass[0].targets[0], 0.3), 6);
    expect(e.macroPos(1, "bass", "weight")).toBe(0.2);
    expect(e.macroPos(1, "layer1", "bright")).toBe(0.9);
    expect(e.releaseMacros("bass", "cutoff")).toBe(false);
    expect(e.releaseMacros("layer1", "cutoff")).toBe(true);
    expect(e.getSong().macros).toEqual({ "bass.weight": 0.2 });
    expect(validateSong(e.getDocument())).toEqual([]);
  });

  it("a macro writes only ordinary values plus its own position: Advanced reads every move", () => {
    const e = new Engine(defaultSong());
    const before = e.getSong();
    e.setMacro(1, "synth", "bright", 0.8);
    const after = e.getSong();
    expect(after.patches.synth.cutoff).toBeCloseTo(targetValue(MACROS.synth[0].targets[0], 0.8), 6);
    expect(after.patches.synth.envAmount).toBeCloseTo(targetValue(MACROS.synth[0].targets[1], 0.8), 6);
    // Nothing else changed but the stored dial position.
    const strip = (s: Song): Song => ({ ...s, macros: undefined, patches: { ...s.patches, synth: { ...s.patches.synth, cutoff: 0, envAmount: 0 } } });
    expect(strip(after)).toEqual(strip(before));
    expect(after.macros).toEqual({ "synth.bright": 0.8 });
  });

  it("the dial's position is stored in the song; editing the values in Advanced does not move it", () => {
    const e = new Engine(defaultSong());
    e.setMacro(2, "bass", "weight", 0.3);
    expect(e.macroPos(2, "bass", "weight")).toBe(0.3);
    e.setParam("bass", "sub", 1);
    expect(e.macroPos(2, "bass", "weight")).toBe(0.3);
    // It survives a save and a load.
    const again = new Engine(cloneSong(e.getDocument()));
    expect(again.macroPos(2, "bass", "weight")).toBe(0.3);
  });

  it("a macro that acts on section values keeps its position per section", () => {
    const e = new Engine(defaultSong());
    e.setMacro(0, "layer1", "busy", 0.9);
    e.setMacro(1, "layer1", "busy", 0.1);
    expect(e.macroPos(0, "layer1", "busy")).toBe(0.9);
    expect(e.macroPos(1, "layer1", "busy")).toBe(0.1);
    const s = e.getSong();
    expect(s.sections[0].layer1.gen.hits).toBe(targetValue(MACROS.layer1[0].targets[0], 0.9));
    expect(s.sections[1].layer1.gen.hits).toBe(targetValue(MACROS.layer1[0].targets[0], 0.1));
    expect(sectionScoped(MACROS.layer1[0])).toBe(true);
    expect(sectionScoped(MACROS.layer1[2])).toBe(false);
  });

  it("an unmoved dial shows where its first value sits", () => {
    const song = defaultSong();
    const e = new Engine(song);
    for (const inst of INSTRUMENTS)
      for (const m of MACROS[inst as MacroInstrument]) {
        const t = m.targets[0];
        expect(e.macroPos(1, inst, m.id)).toBeCloseTo(targetPos(t, targetNow(song, 1, inst, t)), 6);
      }
  });

  it("Evolve is the inverse of Lock", () => {
    const e = new Engine(defaultSong());
    for (const p of [0, 0.25, 1]) {
      e.setMacro(1, "layer1", "evolve", p);
      expect(e.getSong().sections[1].layer1.gen.lock).toBeCloseTo(1 - p, 6);
    }
  });

  it("Evolve is heard on an arp: it widens the octaves the arp climbs (P2 review M3)", () => {
    const song = leadSong();
    song.sections[0].layer1.mode = "arp";
    song.sections[0].layer1.arp = { direction: "up", rate: 1, octaves: 1, gate: 0.5 };
    const notes = (pos: number): number[] => {
      const e = new Engine(cloneSong(song));
      e.setMacro(0, "layer1", "evolve", pos);
      const seq = new Sequencer(e.getSong());
      seq.start();
      return run(seq, 32).flatMap((r) => r.events.filter((x) => x.inst === "layer1").flatMap((x) => (x as unknown as { notes: number[] }).notes));
    };
    const lo = notes(0);
    const hi = notes(1);
    expect(Math.max(...hi) - Math.max(...lo)).toBe(24);
  });

  it("targets map back to their position (exp curves and whole numbers included)", () => {
    for (const defs of Object.values(MACROS))
      for (const m of defs)
        for (const t of m.targets as MacroTarget[])
          for (const p of [0, 1]) expect(targetPos(t, targetValue(t, p))).toBeCloseTo(p, 6);
  });

  it("a macro move is logged and replays to the same song", () => {
    const e = new Engine(defaultSong());
    // No take runs: nothing is logged, but the call is an ordinary engine op that replays as engine[op](...args).
    const ops: [number, "bass", "bright", number] = [1, "bass", "bright", 0.42];
    e.setMacro(...ops);
    const f = new Engine(defaultSong());
    (f as unknown as Record<string, (...a: unknown[]) => unknown>)["setMacro"](...ops);
    expect(f.getSong()).toEqual(e.getSong());
  });

  it("refuses unknown instruments, macros and positions", () => {
    const e = new Engine(defaultSong());
    const before = JSON.stringify(e.getSong());
    expect(e.setMacro(1, "bass", "busy", 0.5)).toBe(false);
    expect(e.setMacro(9, "bass", "bright", 0.5)).toBe(false);
    expect(e.setMacro(1, "bass", "bright", Number.NaN)).toBe(false);
    expect(JSON.stringify(e.getSong())).toBe(before);
  });

  it("the song schema checks stored positions", () => {
    const s = defaultSong();
    s.macros = { "bass.bright": 0.5 };
    s.sections[0].macros = { "drums.swing": 1 };
    expect(validateSong(s)).toEqual([]);
    s.macros = { "bass.nope": 0.5 };
    s.sections[0].macros = { "drums.swing": 2 };
    const errs = validateSong(s);
    expect(errs.some((x) => x.startsWith("macros.bass.nope"))).toBe(true);
    expect(errs.some((x) => x.startsWith("sections[0].macros.drums.swing"))).toBe(true);
    expect(MACRO_KEYS).toHaveLength(20);
  });
});

describe("New idea and Back (spec 8.3)", () => {
  it("Back restores the previous lead note for note", () => {
    const seq = new Sequencer(leadSong());
    seq.start();
    const first = leadNotes(seq, 4);
    const seed = seq.song.sections[0].layer1.gen.seed;
    // A new idea mid-bar, played for a while.
    run(seq, 5);
    seq.newSeed(0, "layer1");
    const other = leadNotes(seq, 4);
    expect(other).not.toEqual(first);
    // Back at a bar line where the chords start again (bar 12; four chords of a bar each): the old seed,
    // and the same notes, velocities included, from the top of the loop.
    expect(seq.song.sections[0].chords).toHaveLength(4);
    run(seq, 16 * 12 - (64 + 5 + 64));
    expect(seq.prevSeed(0, "layer1")).toBe(seed);
    expect(leadNotes(seq, 4)).toEqual(first);
    expect(seq.song.sections[0].layer1.seeds).toBeUndefined();
    expect(seq.prevSeed(0, "layer1")).toBeNull();
  });

  it("Back through the engine, pressed mid-bar: the lead plays its old notes from the next bar line (P2 review M1)", () => {
    // The path the UI takes: Engine.newSeed and Engine.prevSeed, on the sequencer the engine plays.
    const e = new Engine(leadSong());
    const seq = (e as unknown as { seq: Sequencer }).seq;
    seq.start();
    const first = leadNotes(seq, 4);
    const seed = e.getSong().sections[0].layer1.gen.seed;
    run(seq, 3);
    expect(e.newSeed(0, "layer1")).not.toBe(seed);
    expect(leadNotes(seq, 4)).not.toEqual(first);
    // Bar 9 (the first of the chord loop's third pass), eighth step: Back mid-bar.
    run(seq, 16 * 8 + 7 - (64 + 3 + 64));
    expect(e.prevSeed(0, "layer1")).toBe(seed);
    expect(e.getSong().sections[0].layer1.gen.seed).toBe(seed);
    run(seq, 16 - 7);
    // From bar 10 (the chord loop's second bar) the lead plays what it played in bars 2 to 4, note for note.
    expect(leadNotes(seq, 3)).toEqual(first.slice(16));
    expect(e.prevSeed(0, "layer1")).toBeNull();
  });

  it("New idea and Back are heard on a random arp, and offered only where a seed is heard (P2 review S3)", () => {
    const song = leadSong();
    song.sections[0].layer1.mode = "arp";
    song.sections[0].layer1.arp = { direction: "random", rate: 1, octaves: 3, gate: 0.5 };
    const seq = new Sequencer(song);
    seq.start();
    const arpNotes = (): string => run(seq, 32).map((r) => (r.events.find((x) => x.inst === "layer1") as { notes: number[] } | undefined)?.notes.join(",") ?? "-").join(" ");
    run(seq, 32);
    const sameSeed = (() => {
      const c = new Sequencer(cloneSong(song));
      c.start();
      run(c, 32);
      return run(c, 32).map((r) => (r.events.find((x) => x.inst === "layer1") as { notes: number[] } | undefined)?.notes.join(",") ?? "-").join(" ");
    })();
    const seed = seq.song.sections[0].layer1.gen.seed;
    seq.newSeed(0, "layer1");
    expect(arpNotes()).not.toEqual(sameSeed);
    // Back returns the arp to its old seed at once: the notes it draws come from that seed again.
    expect(seq.prevSeed(0, "layer1")).toBe(seed);
    const back = arpNotes();
    const fresh = new Sequencer(cloneSong(song));
    fresh.start();
    expect(back).toEqual(run(fresh, 32).map((r) => (r.events.find((x) => x.inst === "layer1") as { notes: number[] } | undefined)?.notes.join(",") ?? "-").join(" "));
    // The buttons: a lead and a random arp use the seed; a pad and an ordered arp do not.
    const arp = { direction: "random" };
    expect(seedHeard({ mode: "generative", arp })).toBe(true);
    expect(seedHeard({ mode: "arp", arp })).toBe(true);
    expect(seedHeard({ mode: "arp", arp: { direction: "up" } })).toBe(false);
    expect(seedHeard({ mode: "pad", arp })).toBe(false);
  });

  it("keeps the last eight seeds per layer per section", () => {
    const seq = new Sequencer(defaultSong());
    const seeds = [seq.song.sections[1].layer1.gen.seed];
    for (let i = 0; i < 12; i++) seeds.push(seq.newSeed(1, "layer1")!);
    expect(seq.song.sections[1].layer1.seeds).toEqual(seeds.slice(-1 - SEED_HISTORY, -1));
    expect(seq.song.sections[1].layer2.seeds).toBeUndefined();
    expect(seq.song.sections[0].layer1.seeds).toBeUndefined();
    expect(validateSong(seq.song)).toEqual([]);
    const back: number[] = [];
    for (let s = seq.prevSeed(1, "layer1"); s !== null; s = seq.prevSeed(1, "layer1")) back.push(s);
    expect(back).toEqual(seeds.slice(-1 - SEED_HISTORY, -1).reverse());
  });

  it("the history is checked by the schema", () => {
    const s = defaultSong();
    s.sections[0].layer1.seeds = Array.from({ length: SEED_HISTORY + 1 }, (_, i) => i);
    expect(validateSong(s).some((x) => x.startsWith("sections[0].layer1.seeds"))).toBe(true);
  });
});

describe("swing by hand (the drums' Swing dial)", () => {
  it("moves every instrument's odd steps, and a beat change keeps it", () => {
    const seq = new Sequencer(defaultSong());
    expect(sectionSwing(seq.song.sections[1])).toBe(0);
    expect(seq.setSwing(1, 0.3)).toBe(true);
    seq.switchSection(1);
    seq.start();
    const r = run(seq, 2);
    expect(r[0].events.every((e) => e.shift === 0)).toBe(true);
    expect(r[1].events.length).toBeGreaterThan(0);
    expect(r[1].events.every((e) => e.shift === 0.3)).toBe(true);
    seq.setDrumPreset(1, "houseShuffle");
    expect(sectionSwing(seq.song.sections[1])).toBe(0.3);
    // Clamped into range, as every knob is.
    expect(seq.setSwing(1, 0.9)).toBe(true);
    expect(sectionSwing(seq.song.sections[1])).toBe(0.5);
    expect(seq.setSwing(1, Number.NaN)).toBe(false);
  });
});

describe("C4: layer levels", () => {
  it("a pad plays its chord trimmed by 12 dB", () => {
    const song = leadSong();
    song.sections[0].layer1.mode = "pad";
    const seq = new Sequencer(song);
    seq.start();
    const pad = run(seq, 1)[0].events.find((e) => e.inst === "layer1")!;
    expect(pad.vel).toBeCloseTo(0.7 * PAD_TRIM, 6);
    expect(20 * Math.log10(PAD_TRIM)).toBeCloseTo(-12, 0);
  });
});

describe("C4 for songs saved before P2 (P2 review S1)", () => {
  const old = (): Song => parseSong(oldSongJson);

  it("the fixture is the P1b default song: Layer 2 at level 0.22 with a pad's envelope", () => {
    const p = old().patches.layer2;
    expect(p.level).toBe(0.22);
    expect({ attack: p.attack, decay: p.decay, sustain: p.sustain, release: p.release }).toEqual(OLD_LAYER2_ENVELOPE);
  });

  it("an old song loads with Layer 2 at P2's level and envelope, as a new song has them", () => {
    const now = defaultPatch("layer2");
    for (const e of [new Engine(old()), (() => { const x = new Engine(); x.loadSong(old()); return x; })()]) {
      const p = e.getSong().patches.layer2;
      expect(p).toEqual({ ...old().patches.layer2, attack: now.attack, decay: now.decay, sustain: now.sustain, release: now.release, level: now.level });
      // Its pad sits where it did before P2, within 2 dB: level times the trim, against the old level untrimmed.
      expect(Math.abs(20 * Math.log10((p.level * PAD_TRIM) / 0.22))).toBeLessThan(2.1);
      expect(validateSong(e.getDocument())).toEqual([]);
      // Everything else is as saved.
      expect({ ...e.getSong(), patches: { ...e.getSong().patches, layer2: null } }).toEqual({ ...old(), patches: { ...old().patches, layer2: null } });
    }
  });

  it("an old song whose Layer 2 level was moved keeps it relative (+10 dB, at most 1)", () => {
    const s = old();
    s.patches.layer2.level = 0.1;
    expect(migrateSong(s).patches.layer2.level).toBeCloseTo(0.1 * (0.7 / 0.22), 6);
    s.patches.layer2.level = 0.5;
    expect(migrateSong(s).patches.layer2.level).toBe(1);
  });

  it("a song saved since P2 is left as it is, and a migrated song does not move again", () => {
    const now = defaultSong();
    expect(migrateSong(now)).toBe(now);
    const once = migrateSong(old());
    expect(migrateSong(once)).toBe(once);
    // A song whose envelope was moved off the old default by hand is not touched.
    const moved = old();
    moved.patches.layer2.attack = 0.5;
    expect(migrateSong(moved)).toBe(moved);
  });

  it("the start song of an old take's log migrates too", () => {
    const s = old();
    s.log = { recorded: new Date(0).toISOString(), seconds: 1, section: 0, start: old(), events: [] };
    expect(validateSong(s)).toEqual([]);
    const m = migrateSong(s);
    expect(m.log!.start.patches.layer2.level).toBe(0.7);
    expect(m.patches.layer2.level).toBe(0.7);
  });
});

describe("the Simple / Advanced switch (spec 8.1)", () => {
  it("starts in Simple and is remembered", () => {
    const store = new Map<string, string>();
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(loadMode(fake)).toBe("simple");
    saveMode("advanced", fake);
    expect(loadMode(fake)).toBe("advanced");
    saveMode("simple", fake);
    expect(loadMode(fake)).toBe("simple");
    const broken = { getItem: () => { throw new Error("blocked"); } };
    expect(loadMode(broken)).toBe("simple");
    expect(loadMode(null)).toBe("simple");
  });
});
