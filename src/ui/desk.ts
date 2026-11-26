/**
 * The desk's pads (T1 slice b, spec 9.2 and 8.12): what each large pad of the tablet landscape grid shows, and what each
 * row's label says. Pure: the pads read the song, the queue and the lanes the engine gives, and draw from this.
 */
import type { InstrumentId, Song } from "../engine/index.ts";
import { nowTile } from "./logic.ts";

export interface PadInput {
  /** The section heard now (its column is live: the moving band, the playhead). */
  playing: number;
  /** The section the lanes were read for (its pads show their notes); null when no lanes are shown. */
  notesFor: number | null;
  /** A section switch waiting for the next bar line, if any. */
  queued: number | null;
  /** Toggles waiting for the next bar line. */
  toggles: readonly { section: number; instrument: InstrumentId }[];
  /** The transport is running. */
  running: boolean;
}

export interface PadView {
  /** The instrument plays in this section. */
  on: boolean;
  /** A toggle of this pad waits for the next bar line: the hatched frame. */
  pending: boolean;
  /** The column heard now. */
  live: boolean;
  /** The column a section switch lands on at the next bar line (while playing): its outline. */
  next: boolean;
  /** The pad draws the instrument's notes for this bar. */
  notes: boolean;
}

/** One pad of the grid: section `sec`, instrument `id`. */
export function padView(song: Song, sec: number, id: InstrumentId, s: PadInput): PadView {
  const on = !!song.sections[sec]?.on[id];
  const pending = s.toggles.some((t) => t.section === sec && t.instrument === id);
  const live = sec === s.playing;
  const next = s.running && s.queued !== null && s.queued === sec && sec !== s.playing;
  return { on, pending, live, next, notes: s.notesFor === sec };
}

/**
 * A row's label (spec 9.2: the instrument and what it is playing): what it plays in the section the tap would change,
 * or "Next bar" while a toggle of it there waits for the bar line. The same words as the phone's Now tile.
 */
export function rowPlays(
  song: Song,
  target: number,
  pending: { toggles: { section: number; instrument: InstrumentId }[] },
  id: InstrumentId,
  running: boolean,
): string {
  return nowTile(song, target, pending, id, running).sub;
}

/** The pad's accessible name: instrument, section letter, on or off, and a waiting toggle. */
export function padLabel(name: string, letter: string, v: PadView): string {
  return `${name} in section ${letter}: ${v.on ? "on" : "off"}${v.pending ? ", switching on the next bar" : ""}${v.live ? ", playing" : ""}`;
}
