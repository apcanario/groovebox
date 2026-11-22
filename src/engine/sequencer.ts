/**
 * Step sequencer: turns the song into note events one sixteenth at a time and applies queued
 * switches on the bar line. Pure: no audio dependency, so it is unit-tested. The Tone layer only
 * renders what this returns, at audio-clock times computed ahead.
 */
import { arpNote } from "../music/arp.ts";
import { buildChord, type Chord } from "../music/chords.ts";
import { GenerativeLead } from "../music/lead.ts";
import { BASS_RHYTHMS, DRUM_PATTERNS, DRUM_VOICES, SYNTH_RHYTHMS, type DrumVoice } from "../music/presets.ts";
import { createRng, deriveSeed, type Rng } from "../music/random.ts";
import { scalePitchClasses, type KeyName, type Mood } from "../music/scales.ts";
import { SwitchQueue, type Pending } from "./queue.ts";
import {
  INSTRUMENTS,
  LAYER_IDS,
  LIMITS,
  MAX_SECTION_NAME,
  newSection,
  sectionDrumGrid,
  validChords,
  type ChordStep,
  type InstrumentId,
  type LayerInstrument,
  type LayerMode,
  type Section,
  type Song,
} from "./song.ts";

export const STEPS_PER_BAR = 16;

/**
 * One note or hit. `shift` is the swing delay in sixteenths: on odd steps of a swung section every
 * instrument carries the drum pattern's swing, so bass and synth stay with the hats.
 */
export type NoteEvent =
  | { inst: "drums"; voice: DrumVoice; vel: number; shift: number }
  | { inst: "bass"; midi: number; len: number; vel: number; shift: number }
  | { inst: "synth"; notes: number[]; len: number; vel: number; shift: number }
  | {
      inst: LayerInstrument;
      mode: LayerMode;
      notes: number[];
      len: number;
      vel: number;
      shift: number;
      env?: { attack: number; release: number };
    };

export interface StepResult {
  /** Bars since play, counting from 0. */
  bar: number;
  /** Position in the bar, 0..15. */
  step: number;
  /** Section playing at this step. */
  section: number;
  events: NoteEvent[];
  /** Switches that landed on this step (only ever on step 0). */
  applied: Pending | null;
  /** Instruments that stopped sounding at this step: their notes should be released. */
  stopped: InstrumentId[];
  /**
   * The key, mood or chord sequence of the playing section changed since the last step: held
   * chords and pads should let go, and this step restarts them on the new chord.
   */
  retrigger: boolean;
}

export interface ChordPosition {
  chord: Chord;
  /** True on the first step of this chord. */
  starts: boolean;
  /** Steps left in this chord, this one included. */
  remaining: number;
  /** Steps of this chord already played before this one. */
  elapsed: number;
}

/** Which chord of a section plays `sectionStep` steps after the section started. */
export function chordAt(song: Song, section: Section, sectionStep: number): ChordPosition {
  const lens = section.chords.map((c) => Math.round(c.bars * STEPS_PER_BAR));
  const total = lens.reduce((a, b) => a + b, 0);
  let pos = sectionStep % total;
  for (let i = 0; i < lens.length; i++) {
    if (pos < lens[i]) {
      return { chord: buildChord(song.key, song.mood, section.chords[i].degree), starts: pos === 0, remaining: lens[i] - pos, elapsed: pos };
    }
    pos -= lens[i];
  }
  throw new Error("unreachable");
}

export class Sequencer {
  song: Song;
  private queue = new SwitchQueue();
  private running = false;
  private current = 0;
  private globalStep = 0;
  private sectionStep = 0;
  private leads = new Map<LayerInstrument, GenerativeLead>();
  private arpIndex = new Map<LayerInstrument, number>();
  private arpRng = new Map<LayerInstrument, Rng>();
  /** Instruments that were sounding at the previous step. */
  private sounding = new Set<InstrumentId>();
  /** Set by a key, mood or chord change; consumed by the next step. */
  private retrigger = false;

  constructor(song: Song) {
    this.song = song;
  }

  get section(): number {
    return this.current;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Start from bar 0 of the current section. Anything pending lands at once. */
  start(): void {
    this.applyPending(this.queue.flush());
    this.running = true;
    this.globalStep = 0;
    this.enterSection(this.current);
  }

  stop(): void {
    this.running = false;
    this.sounding.clear();
    this.retrigger = false;
  }

  /** Change the song's key and mood. Acts at once: held chords restart on the next step. */
  setKeyMood(key: KeyName, mood: Mood): void {
    this.song.key = key;
    this.song.mood = mood;
    if (this.running) this.retrigger = true;
  }

  /**
   * Replace a section's chord sequence. Acts at once; for the playing section, held chords restart
   * on the next step. Returns false (and changes nothing) for a sequence that is not 1..8 valid chords.
   */
  setChords(section: number, chords: ChordStep[]): boolean {
    const s = this.song.sections[section];
    if (!s || !validChords(chords)) return false;
    s.chords = chords.map((c) => ({ degree: c.degree, bars: c.bars }));
    if (this.running && section === this.current) this.retrigger = true;
    return true;
  }

  /** Rename a section. Empty or blank names are refused. */
  renameSection(index: number, name: string): boolean {
    const s = this.song.sections[index];
    const n = name.trim().slice(0, MAX_SECTION_NAME);
    if (!s || !n) return false;
    s.name = n;
    return true;
  }

  /** Append a new section (up to four): one chord on the tonic, drums, bass and synth on. Returns its index or -1. */
  addSection(): number {
    const sections = this.song.sections;
    if (sections.length >= LIMITS.sections[1]) return -1;
    const seed = 1 + sections.reduce((m, s) => Math.max(m, s.layer1.gen.seed, s.layer2.gen.seed), 0);
    sections.push(newSection(`Section ${String.fromCharCode(65 + sections.length)}`, seed));
    return sections.length - 1;
  }

  /** Insert a copy of a section right after it (up to four). Returns the copy's index or -1. */
  copySection(index: number): number {
    const sections = this.song.sections;
    const s = sections[index];
    if (!s || sections.length >= LIMITS.sections[1]) return -1;
    const copy = JSON.parse(JSON.stringify(s)) as Section;
    copy.name = `${s.name} 2`.slice(0, MAX_SECTION_NAME);
    sections.splice(index + 1, 0, copy);
    this.remap((i) => (i > index ? i + 1 : i));
    return index + 1;
  }

  /**
   * Delete a section. Refused for the last one left and for the section playing now; a switch
   * queued to it is dropped. Returns whether it was deleted.
   */
  deleteSection(index: number): boolean {
    const sections = this.song.sections;
    if (index < 0 || index >= sections.length || sections.length <= LIMITS.sections[0]) return false;
    if (this.running && index === this.current) return false;
    sections.splice(index, 1);
    if (!this.running && index === this.current) {
      this.current = Math.min(index, sections.length - 1);
      this.enterSection(this.current);
      this.queue.clear();
      return true;
    }
    this.remap((i) => (i === index ? null : i > index ? i - 1 : i));
    return true;
  }

  /** Move the playing index and every queued switch after sections were inserted or removed. */
  private remap(fn: (i: number) => number | null): void {
    this.current = fn(this.current) ?? this.current;
    this.queue.remap(fn);
  }

  load(song: Song): void {
    this.song = song;
    this.queue.clear();
    this.current = Math.min(this.current, song.sections.length - 1);
    this.enterSection(this.current);
  }

  /** Switch section: on the next bar line while running, at once when stopped. */
  switchSection(index: number): void {
    if (index < 0 || index >= this.song.sections.length) return;
    if (!this.running) {
      this.current = index;
      this.enterSection(index);
      return;
    }
    this.queue.queueSection(index, this.current);
  }

  /**
   * Turn an instrument on or off in a section. For the playing section, while running, it lands on
   * the next bar line; tapping again before then cancels. Other sections change at once (silently).
   */
  toggleInstrument(section: number, inst: InstrumentId): void {
    const s = this.song.sections[section];
    if (!s) return;
    if (this.running && section === this.current) this.queue.queueToggle(section, inst);
    else s.on[inst] = !s.on[inst];
  }

  pending(): Pending {
    return this.queue.pending();
  }

  /** Produce the events of the next sixteenth. */
  next(): StepResult {
    const step = this.globalStep % STEPS_PER_BAR;
    const bar = Math.floor(this.globalStep / STEPS_PER_BAR);
    let applied: Pending | null = null;
    if (step === 0 && !this.queue.empty) {
      applied = this.queue.flush();
      this.applyPending(applied);
    }
    const retrigger = this.retrigger;
    this.retrigger = false;
    const section = this.song.sections[this.current];
    const events: NoteEvent[] = [];
    const now = new Set<InstrumentId>(INSTRUMENTS.filter((id) => section.on[id]));
    const stopped = [...this.sounding].filter((id) => !now.has(id));
    const entered = new Set([...now].filter((id) => !this.sounding.has(id)));
    this.sounding = now;

    const pos = chordAt(this.song, section, this.sectionStep);
    const chordStart = pos.starts || retrigger;
    const shift = step % 2 === 1 ? DRUM_PATTERNS[section.drums.preset].swing : 0;

    if (now.has("drums")) {
      const grid = sectionDrumGrid(section);
      for (const voice of DRUM_VOICES) {
        const vel = grid[voice][step];
        if (vel > 0) events.push({ inst: "drums", voice, vel, shift });
      }
    }

    if (now.has("bass")) {
      for (const hit of BASS_RHYTHMS[section.bass.rhythm]) {
        if (hit.step === step) events.push({ inst: "bass", midi: pos.chord.bass, len: Math.min(hit.len, pos.remaining), vel: hit.vel, shift });
      }
      // A key, mood or chord edit cuts the held bass note (the engine releases it): a note that
      // started earlier in this chord and is still sounding goes on at the new root for the rest of its hit.
      if (retrigger) {
        const held = BASS_RHYTHMS[section.bass.rhythm].find(
          (h) => h.step < step && step - h.step <= pos.elapsed && h.step + h.len > step,
        );
        if (held) {
          const len = Math.min(held.step + held.len - step, pos.remaining);
          events.push({ inst: "bass", midi: pos.chord.bass, len, vel: held.vel, shift });
        }
      }
    }

    if (now.has("synth")) {
      const rhythm = section.synth.rhythm;
      if (rhythm === "sustained") {
        if (chordStart || entered.has("synth")) events.push({ inst: "synth", notes: pos.chord.notes, len: pos.remaining, vel: 0.7, shift });
      } else {
        for (const hit of SYNTH_RHYTHMS[rhythm]) {
          if (hit.step === step) events.push({ inst: "synth", notes: pos.chord.notes, len: hit.len, vel: hit.vel, shift });
        }
      }
    }

    for (const id of LAYER_IDS) {
      if (!now.has(id)) continue;
      const ev = this.layerEvent(id, section, step, pos, chordStart || entered.has(id), shift);
      if (ev) events.push(ev);
    }

    this.globalStep++;
    this.sectionStep++;
    return { bar, step, section: this.current, events, applied, stopped, retrigger };
  }

  private layerEvent(
    id: LayerInstrument,
    section: Section,
    step: number,
    pos: ChordPosition,
    fresh: boolean,
    shift: number,
  ): NoteEvent | null {
    const p = section[id];
    if (p.mode === "pad") {
      if (!fresh) return null;
      return {
        inst: id,
        mode: "pad",
        notes: pos.chord.notes.slice(0, 4),
        len: pos.remaining,
        vel: 0.7,
        shift,
        env: { attack: p.pad.attack, release: p.pad.release },
      };
    }
    if (p.mode === "arp") {
      if (step % p.arp.rate !== 0) return null;
      const i = this.arpIndex.get(id) ?? 0;
      this.arpIndex.set(id, i + 1);
      const midi = arpNote(pos.chord.notes, p.arp, i, this.arpRng.get(id)!);
      return { inst: id, mode: "arp", notes: [midi], len: p.arp.rate * p.arp.gate, vel: i % 4 === 0 ? 0.8 : 0.6, shift };
    }
    let lead = this.leads.get(id);
    if (!lead || lead.seedValue !== p.gen.seed) {
      lead = new GenerativeLead(p.gen.seed);
      this.leads.set(id, lead);
    }
    const note = lead.step(step, p.gen, {
      chordTones: pos.chord.tones,
      scale: scalePitchClasses(this.song.key, this.song.mood),
    });
    if (!note) return null;
    return { inst: id, mode: "generative", notes: [note.midi], len: 0.8, vel: note.vel, shift };
  }

  private applyPending(p: Pending): void {
    for (const t of p.toggles) {
      const s = this.song.sections[t.section];
      if (s) s.on[t.instrument] = !s.on[t.instrument];
    }
    if (p.section !== null && p.section < this.song.sections.length) {
      this.current = p.section;
      this.enterSection(p.section);
    }
  }

  /** A section starts from its first chord, and its layers restart from their seeds. */
  private enterSection(index: number): void {
    this.current = index;
    this.sectionStep = 0;
    const s = this.song.sections[index];
    this.leads.clear();
    for (const id of LAYER_IDS) {
      this.arpIndex.set(id, 0);
      this.arpRng.set(id, createRng(deriveSeed(s[id].gen.seed, 7)));
    }
  }
}
