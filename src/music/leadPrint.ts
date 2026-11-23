/**
 * The five lead styles printed as text, from one seed over the same chords (P5's Done-when: the styles give
 * clearly different note patterns). `npm run leads` prints it; docs/reviews/P5-patterns.md holds a copy.
 * Pure, no audio dependency.
 */
import { buildChord } from "./chords.ts";
import { LEAD_STYLES, type LeadParams, type LeadStyle } from "./lead.ts";
import { Lead, type LeadEvent } from "./leadStyles.ts";
import { midiToName, scalePitchClasses, type KeyName, type Mood } from "./scales.ts";

/** One played note with where it starts, in steps from the first bar. */
export interface PlayedNote extends LeadEvent {
  at: number;
}

export interface Playback {
  key: KeyName;
  mood: Mood;
  /** Scale degrees, one bar each, looped. */
  degrees: number[];
}

/** A minor, i VI III VII, a bar each. */
export const PRINT_SONG: Playback = { key: "A", mood: "minor", degrees: [0, 5, 2, 6] };

/** Play a lead for `bars` bars over a looped progression. */
export function playLead(p: LeadParams, bars: number, song: Playback = PRINT_SONG): PlayedNote[] {
  const lead = new Lead(p.seed);
  const scale = scalePitchClasses(song.key, song.mood);
  const out: PlayedNote[] = [];
  for (let i = 0; i < bars * 16; i++) {
    const chord = buildChord(song.key, song.mood, song.degrees[Math.floor(i / 16) % song.degrees.length]);
    const e = lead.step(i % 16, p, { chordTones: chord.tones, scale });
    if (e) out.push({ ...e, at: i });
  }
  return out;
}

/** The knobs the print uses: the default song's Layer 1 lead, every P5 knob at its style's default. */
export const PRINT_BASE: Omit<LeadParams, "style"> = { lock: 0.75, hits: 7, rotate: 0, length: 5, tension: 0.35, density: 0.85, seed: 1234 };

const CELL = 5;

function cell(text: string): string {
  return text.length >= CELL ? text.slice(0, CELL) : text + " ".repeat(CELL - text.length);
}

/** One style as a grid: a line per bar, a cell per sixteenth. */
export function printStyle(style: LeadStyle, bars = 8, base: Omit<LeadParams, "style"> = PRINT_BASE): string {
  const notes = playLead({ ...base, style }, bars);
  const cells: string[] = Array.from({ length: bars * 16 }, () => ".");
  for (const n of notes) {
    let name = midiToName(n.midi);
    if (n.glideFrom !== undefined) name = "~" + name;
    if (n.accent) name += "!";
    if (n.repeat) name += String(n.repeat);
    cells[n.at] = name;
    for (let s = n.at + 1; s < Math.min(cells.length, n.at + Math.round(n.len)); s++) if (cells[s] === ".") cells[s] = "-";
  }
  const lines: string[] = [];
  const lens = notes.map((n) => n.len);
  const vels = notes.map((n) => n.vel);
  const pitches = new Set(notes.map((n) => n.midi));
  const lo = Math.min(...notes.map((n) => n.midi));
  const hi = Math.max(...notes.map((n) => n.midi));
  lines.push(
    `${style.toUpperCase()}: ${notes.length} notes in ${bars} bars, ${pitches.size} pitches (${midiToName(lo)}..${midiToName(hi)}), ` +
      `length ${Math.min(...lens).toFixed(1)}..${Math.max(...lens).toFixed(1)} steps, velocity ${Math.min(...vels).toFixed(2)}..${Math.max(...vels).toFixed(2)}, ` +
      `${notes.filter((n) => n.glideFrom !== undefined).length} slides, ${notes.filter((n) => n.accent).length} accents, ${notes.filter((n) => n.repeat).length} repeats`,
  );
  for (let b = 0; b < bars; b++) {
    const chord = buildChord(PRINT_SONG.key, PRINT_SONG.mood, PRINT_SONG.degrees[b % PRINT_SONG.degrees.length]);
    lines.push(`bar ${b + 1} ${cell(chord.label)}| ` + cells.slice(b * 16, b * 16 + 16).map(cell).join(""));
  }
  return lines.join("\n");
}

/** All five styles from one seed. */
export function printPatterns(bars = 8, base: Omit<LeadParams, "style"> = PRINT_BASE): string {
  const head = [
    `Seed ${base.seed}, ${PRINT_SONG.key} ${PRINT_SONG.mood}, chords ${PRINT_SONG.degrees.map((d) => buildChord(PRINT_SONG.key, PRINT_SONG.mood, d).label).join(" ")} a bar each.`,
    `Knobs: lock ${base.lock}, busy ${base.density}, tension ${base.tension} (Pulse: hits ${base.hits}, rotate ${base.rotate}, length ${base.length}); the rest at each style's defaults.`,
    `A cell is a sixteenth: a note name starts a note, - holds it, . is rest; ~ slides in from the note before, ! accent, 2 or 3 a quick repeat.`,
  ];
  return [...head, "", ...LEAD_STYLES.map((s) => printStyle(s, bars, base) + "\n")].join("\n");
}
