/** P7 (spec 8.7, 8.10, C8): sound additions as logic: schema and migration, drums, drone and swoop, mappings, patches. */
import { describe, expect, it } from "vitest";
import oldSongJson from "./fixtures/p1b-default-song.json?raw";
import { createRng } from "../music/random.ts";
import { DRUM_PATTERNS, DRUM_PRESETS, toggleSixteenth } from "../music/presets.ts";
import {
  DRONE_SWOOP,
  FM_RATIOS,
  LFO_RATES,
  REVERB_LOOP_HZ,
  driftPeriod,
  fmRatio,
  lfoBeats,
  lofiAmount,
  loopLowpassGain,
  reverbImpulse,
  reverbPlan,
  swoopSeconds,
} from "../music/sound.ts";
import { PATCHES, PATCH_IDS, STYLES, patchFor, resolvePatch, vibeSong } from "../music/styles.ts";
import { KIT_KNOBS, KNOB_PAGES, LAYER_MODE_ORDER, LAYER_PATCH_KNOBS, MOD_KNOBS, PAD_KNOBS, knobPos, knobValue, patchOf, envSecondsText } from "../ui/logic.ts";
import { fadeWait } from "./mods.ts";
import { Engine } from "./index.ts";
import { Sequencer, droneNotes, type NoteEvent, type StepResult } from "./sequencer.ts";
import { buildChord } from "../music/chords.ts";
import { DRUM_VOICES } from "../music/presets.ts";
import {
  INSTRUMENTS,
  MIX_DEFAULTS,
  P7_PATCH_DEFAULTS,
  defaultSong,
  migrateP7,
  migrateSong,
  parseSong,
  validateSong,
  type LayerMode,
  type Song,
} from "./song.ts";

function run(seq: Sequencer, steps: number): StepResult[] {
  return Array.from({ length: steps }, () => seq.next());
}

/** A one-section song with only Layer 1 on, in `mode`, over `chords` of one bar each. */
function layerSong(mode: LayerMode, degrees: number[], bars: 1 | 4 = 1): Song {
  const song = defaultSong();
  song.sections = [song.sections[1]];
  const s = song.sections[0];
  s.on = { drums: false, bass: false, synth: false, layer1: true, layer2: false };
  s.chords = degrees.map((degree) => ({ degree, bars }));
  s.layer1.mode = mode;
  return song;
}

const layerEvents = (rs: StepResult[]) =>
  rs.flatMap((r, i) => r.events.filter((e): e is Extract<NoteEvent, { mode: LayerMode }> => e.inst === "layer1").map((e) => ({ i, e })));

describe("P7 schema", () => {
  it("a song saved before P7 validates, and migrates to every P7 patch key and silent Perc and Shaker rows", () => {
    const old = parseSong(oldSongJson);
    old.sections[0].drums.grid = { kick: new Array(16).fill(0), clap: new Array(16).fill(0), hat: new Array(16).fill(0), open: new Array(16).fill(0) } as never;
    expect(validateSong(old)).toEqual([]);
    const m = migrateP7(old);
    for (const id of INSTRUMENTS) for (const [k, v] of Object.entries(P7_PATCH_DEFAULTS)) expect(m.patches[id][k as keyof typeof P7_PATCH_DEFAULTS]).toBe(v);
    for (const v of DRUM_VOICES) expect(m.sections[0].drums.grid![v]).toHaveLength(16);
    expect(migrateP7(m)).toBe(m);
    expect(migrateSong(m)).toEqual(migrateSong(old));
  });

  it("accepts the FM and noise waves, chords of 4 and 8 bars, pad times to 20 s, Swoop, Drone and the P7 mix", () => {
    const s = defaultSong();
    s.patches.synth.wave = "fm";
    s.patches.layer1.wave = "noise";
    s.sections[0].chords = [{ degree: 0, bars: 8 }, { degree: 3, bars: 4 }];
    s.sections[0].layer2 = { ...s.sections[0].layer2, mode: "drone", drone: { fifth: false }, pad: { ...s.sections[0].layer2.pad, attack: 20, release: 20, swoop: 1 } };
    s.mix = { sweep: 0, pump: 0.5, saturation: 0, lofi: 1, air: 0.5, reverbDecay: 20 };
    expect(validateSong(s)).toEqual([]);
    s.mix.reverbDecay = 25;
    s.sections[0].chords = [{ degree: 0, bars: 3 as never }];
    s.sections[0].layer2.pad.attack = 21;
    const errs = validateSong(s).join(" ");
    expect(errs).toMatch(/reverbDecay/);
    expect(errs).toMatch(/bars/);
    expect(errs).toMatch(/pad.attack/);
  });
});

describe("Perc, Shaker, rolls and 16 steps (spec 8.7)", () => {
  it("Afro plays Perc and Shaker; Trap rolls its hats on the steps its rolls name, and only there", () => {
    expect(DRUM_PRESETS).toContain("afro");
    expect(DRUM_PRESETS).toContain("trap");
    const song = defaultSong();
    song.sections[1].drums = { preset: "afro" };
    const seq = new Sequencer(song);
    seq.switchSection(1);
    seq.start();
    const voices = new Set(run(seq, 16).flatMap((r) => r.events.filter((e) => e.inst === "drums").map((e) => (e as { voice: string }).voice)));
    expect(voices.has("perc") && voices.has("shaker")).toBe(true);

    song.sections[1].drums = { preset: "trap" };
    const t = new Sequencer(song);
    t.switchSection(1);
    t.start();
    const rolls = run(t, 16).flatMap((r) => r.events.filter((e) => e.inst === "drums" && e.repeat).map((e) => [r.step, (e as { repeat: number }).repeat]));
    expect(rolls).toEqual([[6, 2], [7, 3], [14, 2], [15, 4]]);
    expect(DRUM_PATTERNS.trap.rolls.hat![6]).toBe(2);
  });

  it("clearing a rolled step in the sequencer clears its roll; the 16-step toggle flips exactly one sixteenth", () => {
    const song = defaultSong();
    song.sections[0].drums = { preset: "trap" };
    const seq = new Sequencer(song);
    expect(seq.toggleDrumStep(0, "hat", 7, true)).toBe(true);
    expect(song.sections[0].drums.grid!.hat[7]).toBe(0);
    expect(song.sections[0].drums.grid!.hat[6]).toBeGreaterThan(0);
    seq.start();
    const rolled = run(seq, 16).flatMap((r) => r.events.filter((e) => e.inst === "drums" && e.repeat).map(() => r.step));
    expect(rolled).toEqual([6, 14, 15]);
    expect(seq.toggleDrumStep(0, "perc", 16, true)).toBe(false);
    expect(seq.toggleDrumStep(0, "perc", 9, false)).toBe(false);
    const row = toggleSixteenth(new Array(16).fill(0), 5, 0.8);
    expect(row.filter((x) => x > 0)).toEqual([0.8]);
    expect(row[5]).toBe(0.8);
    expect(toggleSixteenth(row, 5, 0.8)[5]).toBe(0);
  });

  it("every beat file has a row for every voice, read silent where the file has none", () => {
    for (const id of DRUM_PRESETS) for (const v of DRUM_VOICES) expect(DRUM_PATTERNS[id].grid[v], `${id}.${v}`).toHaveLength(16);
  });
});

describe("Drone and Swoop (spec 8.10)", () => {
  it("a drone holds root and fifth, starts once and glides at every chord change, never restarting", () => {
    const song = layerSong("drone", [0, 3, 5, 4]);
    const seq = new Sequencer(song);
    seq.start();
    const ev = layerEvents(run(seq, 64));
    const holds = ev.filter(({ e }) => e.hold);
    const glides = ev.filter(({ e }) => e.glide !== undefined);
    expect(holds.map(({ i }) => i)).toEqual([0]);
    expect(glides.map(({ i }) => i)).toEqual([16, 32, 48]);
    expect(glides.every(({ e }) => Math.abs(e.glide! - swoopSeconds(DRONE_SWOOP)) < 1e-9)).toBe(true);
    expect(holds[0].e.notes).toEqual(droneNotes(buildChord("A", "house", 0), undefined));
    expect(holds[0].e.notes).toHaveLength(2);
  });

  it("a drone's fifth is the chord's own (in key on a diminished chord), and Root alone is one note", () => {
    const dim = buildChord("C", "major", 6);
    expect(droneNotes(dim, { fifth: true })[1] % 12).toBe(5); // B dim: F, not F#
    expect(droneNotes(dim, { fifth: false })).toHaveLength(1);
  });

  it("a drone keeps holding over a section switch and a chord edit (kept), and lets go on a mode change", () => {
    const song = defaultSong();
    for (const s of song.sections) {
      s.on.layer1 = true;
      s.layer1.mode = "drone";
    }
    const seq = new Sequencer(song);
    seq.start();
    run(seq, 16);
    seq.switchSection(1);
    const r = seq.next(); // the bar line right after the switch
    expect(r.applied?.section).toBe(1);
    expect(r.kept).toContain("layer1");
    expect(r.events.some((e) => e.inst === "layer1" && "hold" in e && e.hold)).toBe(false);
    run(seq, 3);
    seq.setLayerMode(1, "layer1", "arp");
    const m = seq.next();
    expect(m.restarted).toContain("layer1");
    expect(m.kept).not.toContain("layer1");
  });

  it("a pad glides between chords only with Swoop above 0; Swoop back to 0 lets the held chord go", () => {
    const song = layerSong("pad", [0, 3, 0, 3]);
    const plain = new Sequencer(song);
    plain.start();
    let ev = layerEvents(run(plain, 64));
    expect(ev.every(({ e }) => !e.hold && e.glide === undefined)).toBe(true);
    song.sections[0].layer1.pad.swoop = 0.4;
    const seq = new Sequencer(song);
    seq.start();
    ev = layerEvents(run(seq, 32));
    expect(ev.filter(({ e }) => e.hold).map(({ i }) => i)).toEqual([0]);
    expect(ev.filter(({ e }) => e.glide !== undefined).map(({ i }) => i)).toEqual([16]);
    seq.setPad(0, "layer1", { swoop: 0 });
    const rs = run(seq, 16);
    expect(rs[0].letGo).toContain("layer1");
    expect(layerEvents(rs).some(({ e }) => e.hold || e.glide !== undefined)).toBe(false);
  });

  it("Drone is on the mode switch, and the pad page has at most six dials", () => {
    expect(LAYER_MODE_ORDER).toContain("drone");
    expect(PAD_KNOBS.map((k) => k.key)).toContain("swoop");
    for (const list of [PAD_KNOBS, MOD_KNOBS, KIT_KNOBS]) expect(list.length).toBeLessThanOrEqual(6);
  });
});

describe("P7 mappings", () => {
  it("Swoop runs 0.25 to 8 s, the drift 120 to 4 s, the LFO 4 bars to a sixteenth, FM ratios from the list", () => {
    expect(swoopSeconds(0)).toBeCloseTo(0.25);
    expect(swoopSeconds(1)).toBeCloseTo(8);
    expect(driftPeriod(0)).toBeCloseTo(120);
    expect(driftPeriod(1)).toBeCloseTo(4);
    expect(lfoBeats(0)).toBe(16);
    expect(lfoBeats(1)).toBe(0.25);
    expect(LFO_RATES.length).toBe(8);
    expect(fmRatio(0)).toBe(FM_RATIOS[0]);
    expect(fmRatio(1)).toBe(FM_RATIOS[FM_RATIOS.length - 1]);
  });

  it("a long reverb is a short impulse carried on by feedback that falls 60 dB over the decay", () => {
    expect(reverbPlan(3)).toEqual({ length: 3, feedback: 0 });
    for (const d of [8, 12, 20]) {
      const { length, feedback } = reverbPlan(d);
      expect(length).toBeLessThanOrEqual(3.2);
      expect(Math.pow(feedback, d / length)).toBeCloseTo(1e-3, 6);
    }
    const [l, r] = reverbImpulse(1, 1, 1000, createRng(5));
    const [l2] = reverbImpulse(1, 1, 1000, createRng(5));
    expect(l).toEqual(l2);
    expect(l).not.toEqual(r);
    expect(Math.max(...l.slice(990).map(Math.abs))).toBeLessThan(1.1e-3);
  });
});

describe("Sound pickers (C8)", () => {
  it("each instrument lists exactly its own patch files, and loading one sets its values but keeps the level", () => {
    const e = new Engine();
    for (const inst of INSTRUMENTS) {
      const ids = e.patchIds(inst);
      expect(ids).toEqual(PATCH_IDS.filter((id) => PATCHES[id].instrument === patchFor(inst)));
      expect(ids.length).toBeGreaterThan(0);
    }
    const level = e.getSong().patches.synth.level;
    expect(e.setPatch("synth", "glass")).toBe(true);
    const p = e.getSong().patches.synth;
    expect(p.wave).toBe("fm");
    expect(p.level).toBe(level);
    expect(patchOf("synth", p, e.patchIds("synth"))).toBe("glass");
    expect(e.setPatch("synth", "sub")).toBe(false); // a bass patch
    expect(e.setPatch("synth", "nope")).toBe(false);
    e.setPatch("bass", "wobble");
    expect(e.getSong().patches.bass.lfoDepth).toBeGreaterThan(0);
    e.setPatch("bass", "sub");
    expect(e.getSong().patches.bass.lfoDepth).toBe(0); // a patch without the LFO switches it off
    expect(resolvePatch("layer1", "breath").wave).toBe("noise");
  });
});

describe("Ambient uses what spec 8.10 adds", () => {
  it("long chords, a drone, Swoop, long attacks, drift, the air and a long reverb", () => {
    const def = STYLES.ambient;
    const song = vibeSong("ambient")!;
    expect(def.sections.flatMap((s) => s.chords.map(([, b]) => b)).every((b) => b >= 4)).toBe(true);
    expect(song.sections.some((s) => s.layer2.mode === "drone")).toBe(true);
    expect(song.sections.some((s) => (s.layer1.pad.swoop ?? 0) > 0)).toBe(true);
    expect(Math.max(...song.sections.map((s) => s.layer2.pad.attack))).toBeGreaterThanOrEqual(8);
    expect(song.patches.layer2.drift).toBeGreaterThan(0);
    expect(song.mix!.air).toBeGreaterThan(0);
    expect(song.mix!.reverbDecay).toBeGreaterThanOrEqual(10);
    expect(validateSong(song)).toEqual([]);
  });
});

describe("P7 review fixes", () => {
  it("S1: the default reverb falls 60 dB when G1's Tone.Reverb({decay: 3.2}) did (about 1.9 s), not over 3.2 s", () => {
    // Tone.Reverb: exponentialApproachValueAtTime over decay - preDelay, a time constant of ln(rampTime + 1) / ln(200).
    const tau = Math.log(3.2 - 0.01 + 1) / Math.log(200);
    const g1 = tau * Math.log(1000);
    expect(Math.abs(MIX_DEFAULTS.reverbDecay - g1)).toBeLessThan(0.1);
  });

  it("S2: the impulse is at full level 1 ms in (no 10 ms dip on every pass of the loop), and the loop darkens", () => {
    const rate = 44100;
    const one = { next: () => 1 };
    const [l] = reverbImpulse(1, 1.9, rate, one);
    const k = (3 * Math.LN10) / 1.9;
    const i = Math.round(0.001 * rate);
    expect(l[i]).toBeGreaterThan(0.99 * Math.exp((-k * i) / rate));
    expect(l[Math.round(0.0005 * rate)]).toBeGreaterThan(0.4);
    expect(loopLowpassGain(REVERB_LOOP_HZ, rate, 0)).toBeCloseTo(1, 6);
    expect(loopLowpassGain(REVERB_LOOP_HZ, rate, 500)).toBeGreaterThan(0.99);
    expect(loopLowpassGain(REVERB_LOOP_HZ, rate, 12000)).toBeLessThan(0.5);
  });

  it("S3: attack and release reach 20 s on the Synth and on the layers in every mode, shown in seconds", () => {
    const synth = KNOB_PAGES.synth!.flatMap((p) => p.knobs);
    for (const list of [synth, LAYER_PATCH_KNOBS])
      for (const key of ["attack", "release"]) {
        const k = list.find((x) => x.key === key)!;
        expect(k.seconds![1]).toBe(20);
        expect(k.text).toBe(envSecondsText);
      }
    // Ambient's synth (attack 3 s, release 8 s) sits inside its dials: a touch does not snap it down.
    const attack = synth.find((x) => x.key === "attack")!;
    const release = synth.find((x) => x.key === "release")!;
    expect(knobValue(attack, knobPos(attack, 3))).toBeCloseTo(3, 6);
    expect(knobValue(release, knobPos(release, 8))).toBeCloseTo(8, 6);
    // A punchy attack still reads as a time, not 0.0 (P2 review E1: Advanced shows what Punch set).
    expect(envSecondsText(0.003)).toBe(".003");
    expect(envSecondsText(0.075)).toBe(".075");
    expect(envSecondsText(0.25)).toBe("0.25");
    expect(envSecondsText(3)).toBe("3.0");
    expect(envSecondsText(12)).toBe("12");
  });

  it("S5: a fade scheduled past now is waited for from its start, not from now", () => {
    expect(fadeWait(10.5, 10, 0.1, 0.03)).toBeCloseTo(0.5 + 0.1 + 0.03 + 0.05, 9);
    expect(fadeWait(undefined, 10, 0.1, 0.03)).toBeCloseTo(0.18, 9);
    expect(fadeWait(9, 10, 0.1, 0.03)).toBeCloseTo(0.18, 9);
  });

  it("M4: the lo-fi master is on or off, never between (its 8 ms wet path would comb-filter)", () => {
    expect(lofiAmount(0)).toBe(0);
    expect(lofiAmount(0.3)).toBe(1);
    expect(lofiAmount(0.5)).toBe(1);
    expect(lofiAmount(1)).toBe(1);
  });
});
