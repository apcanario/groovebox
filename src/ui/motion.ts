/**
 * Motion (spec 8.12): one requestAnimationFrame loop drives every clock-tied movement by setting a few
 * custom properties on the containers that use them (MOVERS), not on the root, so a frame restyles those
 * subtrees and not the whole page (P1b review M7); the CSS turns them into transforms, opacity and
 * background position only. Display only: nothing here schedules sound, and under load the loop simply
 * drops frames. The root's own values (style.css) are the stopped ones.
 *
 * Properties set every frame:
 * - `--p16`: the playhead in sixteenths of the bar (0..16), -1 when stopped
 * - `--p`: the same as a fraction of the bar (0..1): the playhead, the moving band and the marching hatch
 * - `--beat`: the fraction of the current beat (0..1): the pulsing ring and the record dot
 * - `--f-<instrument>`: 0..1, how bright the instrument's label flashes for the note it just played
 *
 * With the system's reduce-motion setting, or the switch on the Mix tab, the root gets the class `still`:
 * the playhead jumps from step to step and nothing else moves.
 */
import { INSTRUMENTS, type Engine, type LaneBar } from "../engine/index.ts";
import { flashLevel, playhead } from "./logic.ts";

const KEY = "groovebox.motion";

/** The app's own motion switch (Mix tab), remembered on the phone. */
export function motionOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

const prefListeners = new Set<() => void>();

export function setMotionOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the switch still acts for this session.
  }
  memo = on;
  for (const fn of prefListeners) fn();
}

let memo: boolean | null = null;
/** Whether the app's switch wants motion (the system's reduce-motion setting is applied on top). */
export function motionWanted(): boolean {
  return wanted();
}
function wanted(): boolean {
  if (memo === null) memo = motionOn();
  return memo;
}

export function onMotionPref(fn: () => void): () => void {
  prefListeners.add(fn);
  return () => prefListeners.delete(fn);
}

/** The lanes the screen shows now; the loop reads them for the label flashes. */
let lanes: LaneBar | null = null;
export function showLanes(l: LaneBar): void {
  lanes = l;
}

/**
 * Every element that reads the motion properties, by its outermost container: the Now view (tiles, lanes,
 * playhead, flashes), the Song grid's cells, the section strip, the switches on the instrument and layer
 * tabs, a lane outside the Now view, the record button's dot, and the DROP button (P10).
 */
export const MOVERS = ".nowlist, .grid, .secs, .tog, .rec, .lane:not(.nowlist .lane), .drop";

/** Start the loop. Returns a function that stops it. */
export function startMotion(engine: Engine, root: HTMLElement = document.documentElement): () => void {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let last = { step: 0, bar: 0, playing: false, at: performance.now() };
  const off = engine.onPosition((p) => {
    last = { step: p.step, bar: p.bar, playing: p.playing, at: performance.now() };
  });
  let raf = 0;
  let wasStill: boolean | null = null;
  let prev = "";
  let targets: HTMLElement[] = [];
  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const still = !wanted() || !!reduce?.matches;
    if (still !== wasStill) {
      root.classList.toggle("still", still);
      wasStill = still;
    }
    const playing = last.playing && engine.playing;
    const stepMs = 60000 / engine.bpm / 4;
    const p16 = playing ? playhead(last.step, now - last.at, stepMs, still) : -1;
    const shown = lanes && lanes.bar === last.bar ? lanes : null;
    const parts = [p16.toFixed(3)];
    const flashes: number[] = [];
    for (const id of INSTRUMENTS) {
      const f = playing && !still && shown && shown.on[id] ? flashLevel(shown.notes[id], p16) : 0;
      flashes.push(f);
      parts.push(f.toFixed(2));
    }
    // A container that appeared since the last frame gets the values even when they have not changed.
    const movers = root.querySelectorAll<HTMLElement>(MOVERS);
    const same = movers.length === targets.length && targets.every((t, i) => t === movers[i]);
    const key = parts.join(",");
    if (key === prev && same) return;
    prev = key;
    if (!same) targets = [...movers];
    const p = p16.toFixed(3);
    const bar = playing ? (p16 / 16).toFixed(4) : "0";
    const beat = playing && !still ? ((p16 % 4) / 4).toFixed(3) : "0";
    for (const t of targets) {
      const s = t.style;
      s.setProperty("--p16", p);
      s.setProperty("--p", bar);
      s.setProperty("--beat", beat);
      INSTRUMENTS.forEach((id, i) => s.setProperty(`--f-${id}`, flashes[i].toFixed(2)));
    }
    root.classList.toggle("running", playing);
  };
  raf = requestAnimationFrame(frame);
  const offPref = onMotionPref(() => (prev = ""));
  return () => {
    cancelAnimationFrame(raf);
    off();
    offPref();
  };
}
