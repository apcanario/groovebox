/**
 * The event log (spec section 6): while record is armed, every engine edit the UI makes (knob moves,
 * mutes, section switches, and the pattern edits between them) is logged with its time in beats from
 * the start of the take. It is saved with the song. No audio dependency.
 *
 * A knob drag calls the engine many times a second. Moves of the same knob closer than COALESCE_BEATS
 * apart are merged into one event holding the last value, so a long jam's log stays small.
 */

/** The engine calls that are logged; each event replays as `engine[op](...args)`. */
export const LOG_OPS = [
  "setParam",
  "setParams",
  "setMix",
  "bpm",
  "switchSection",
  "toggleInstrument",
  "setKeyMood",
  "setChords",
  "setProgression",
  "setDrumPreset",
  "toggleDrumStep",
  "revertDrums",
  "setBassRhythm",
  "setSynthRhythm",
  "setLayerMode",
  "setArp",
  "setPad",
  "setDrone",
  "setGen",
  "newSeed",
  "prevSeed",
  "setSwing",
  "setMacro",
  "releaseMacros",
  "renameSection",
  "addSection",
  "copySection",
  "deleteSection",
] as const;
export type LogOp = (typeof LOG_OPS)[number];

export interface LogEvent {
  /** Beats from the start of the take (quarter notes), to a thousandth. */
  b: number;
  op: LogOp;
  a: unknown[];
}

/** Moves of one knob closer together than this merge into one event (a 32nd note). */
export const COALESCE_BEATS = 0.125;
/** A hard cap so a runaway log cannot grow without end (about an hour of constant knob moves). */
export const MAX_EVENTS = 200_000;

/**
 * The knob an event moves, for merging; null for events that never merge (a toggle twice is two
 * toggles). The value itself is left out of the key, the target is in it.
 */
export function coalesceKey(op: LogOp, a: readonly unknown[]): string | null {
  const keys = (v: unknown): string => (v && typeof v === "object" ? Object.keys(v).sort().join(",") : "");
  switch (op) {
    case "setParam":
      return `${op}:${String(a[0])}:${String(a[1])}`;
    case "setParams":
      return `${op}:${String(a[0])}:${keys(a[1])}`;
    case "setMix":
      return `${op}:${String(a[0])}`;
    case "bpm":
      return op;
    case "setSwing":
      return `${op}:${String(a[0])}`;
    case "setMacro":
      return `${op}:${String(a[0])}:${String(a[1])}:${String(a[2])}`;
    case "releaseMacros":
      return `${op}:${String(a[0])}:${String(a[1])}`;
    case "setArp":
    case "setPad":
    case "setGen":
      return `${op}:${String(a[0])}:${String(a[1])}:${keys(a[2])}`;
    default:
      return null;
  }
}

/** Collects one take's events. */
export class LogWriter {
  readonly events: LogEvent[] = [];
  private lastKey: string | null = null;
  private lastBeat = 0;
  dropped = 0;

  push(beat: number, op: LogOp, args: readonly unknown[]): void {
    // Beats never run backwards (the transport resets to 0 on Stop while the tail still records).
    const b = Math.max(this.lastBeat, Math.round(Math.max(0, beat) * 1000) / 1000);
    const a = JSON.parse(JSON.stringify(args)) as unknown[];
    const key = coalesceKey(op, a);
    const prev = this.events[this.events.length - 1];
    if (prev && key !== null && key === this.lastKey && b - prev.b < COALESCE_BEATS) {
      prev.a = a;
      return;
    }
    if (this.events.length >= MAX_EVENTS) {
      this.dropped++;
      return;
    }
    this.events.push({ b, op, a });
    this.lastKey = key;
    this.lastBeat = b;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Every problem with a would-be list of events; empty when valid. The song snapshot is checked by the song schema. */
export function checkEvents(events: unknown, at: string, errors: string[]): void {
  if (!Array.isArray(events)) return void errors.push(`${at}: must be a list`);
  if (events.length > MAX_EVENTS) errors.push(`${at}: more than ${MAX_EVENTS} events`);
  let last = 0;
  for (let i = 0; i < events.length; i++) {
    const e: unknown = events[i];
    if (!isObj(e)) {
      errors.push(`${at}[${i}]: not an object`);
      break;
    }
    if (typeof e.b !== "number" || !Number.isFinite(e.b) || e.b < last) {
      errors.push(`${at}[${i}].b: must be a beat, never before the one above`);
      break;
    }
    last = e.b;
    if (!(LOG_OPS as readonly unknown[]).includes(e.op)) {
      errors.push(`${at}[${i}].op: unknown`);
      break;
    }
    if (!Array.isArray(e.a)) {
      errors.push(`${at}[${i}].a: must be a list`);
      break;
    }
  }
}
