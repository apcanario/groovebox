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
 *
 * T2 review S2: the same loop draws the whole Mix's fader meters (`.fmeter[data-meter]`, an instrument id each) about
 * 15 times a second, a transform each and nothing else; held still they stay empty.
 *
 * T3 (spec 9.5), in the same loop and nowhere else:
 * - `--m-<instrument>`: 0..1, the pulse of the pads of the playing section, from the instrument's own level meter, read
 *   with the fader meters (about 15 times a second); 0 when stopped or still.
 * - Dials moved by something other than a finger get a ghost pointer (`.ghost`, `--mv` its place 0..1 on the dial,
 *   `--mo` its opacity): the Mix's Filter dial while the Filter punch pad sweeps the master down, and an instrument's
 *   LFO dial as the synced filter LFO pulls the filter (`lfoPull`). Macros and Morph move the values themselves, so
 *   their dials' arcs follow on render. Still or stopped, no ghost.
 * - The playing step of the step rows and the drum grid is the `.now` cell, set on render with each step from the
 *   engine's position (a state, so it stays right when still).
 * The browser runs no frame while the tab is hidden, and under load it drops frames: nothing here schedules sound.
 *
 * T3 review S2: the master meter (`.meter[data-master]`) is drawn here too, with the fader meters: its fill and peak
 * line as transforms and its reading as text. It is a reading, not a movement, so it is drawn when still as well (as
 * it was before it moved here). This is the only animation loop in the app (a test reads every UI source for others).
 *
 * T3 review S3: the moving values are written at most every MOTION_MS (about 30 a second) and only those that changed.
 *
 * T3 review M7: the containers are looked up again only when the values change or every METER_MS (for one that
 * appeared), and held still the fader meters and the ghosts are cleared once and then left alone, so a still frame
 * between two steps does nearly nothing.
 *
 * T3 review M8, approximations (display only): the LFO ghost's phase is taken from the bar the screen shows plus the
 * playhead, not read from the engine's LFO; the Filter pad's ghost moves linearly in time over the sweep while the
 * filter falls exponentially in Hz toward FILTER_FLOOR (280 Hz, not the Filter dial's lowest point); a pad pressed again
 * keeps its first start, so its ghost jumps back to where that start puts it.
 */
import { FILTER_SWEEP_BEATS, INSTRUMENTS, type Engine, type InstrumentId, type LaneBar } from "../engine/index.ts";
import { flashLevel, lfoPull, masterMeterLook, meterScale, METER_MS, MOTION_MS, playhead, pulseLevel, punchSweep, sweepGhost } from "./logic.ts";

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
 * tabs, a lane outside the Now view, the record button's dot, the DROP button (P10) and Morph (a .tog, P11).
 */
export const MOVERS = ".nowlist, .grid, .secs, .tog, .rec, .lane:not(.nowlist .lane), .drop";

/** The dials that something other than a finger moves (spec 9.5): the Mix's Filter dial and each LFO dial. */
export const GHOSTS = '.dial[data-dial="sweep"], .dial[data-dial$=":lfoDepth"]';

/** One frame of the ghost pointers: a dial's ghost is set only when its place or opacity changes. */
function moveGhosts(engine: Engine, dials: HTMLElement[], key: WeakMap<HTMLElement, string>, live: boolean, beats: number): void {
  const beatSec = 60 / engine.bpm;
  let filter: number | null = null;
  for (const d of dials) {
    let mv = 0;
    let on = false;
    if (live && d.dataset.dial === "sweep") {
      if (filter === null) filter = punchSweep(engine.punchState().find((p) => p.pad === "filter"), engine.audioNow(), beatSec, FILTER_SWEEP_BEATS);
      on = filter > 0;
      mv = sweepGhost(Number(d.getAttribute("aria-valuenow")), filter);
    } else if (live) {
      const inst = d.dataset.dial!.split(":")[0];
      const depth = Number(d.getAttribute("aria-valuenow"));
      const rate = Number(document.querySelector(`.dial[data-dial="${inst}:lfoRate"]`)?.getAttribute("aria-valuenow") ?? NaN);
      on = depth > 0 && Number.isFinite(rate);
      mv = on ? lfoPull(beats, rate, depth) : 0;
    }
    const k = on ? `${mv.toFixed(3)}` : "off";
    if (key.get(d) === k) continue;
    key.set(d, k);
    d.style.setProperty("--mv", on ? mv.toFixed(3) : "0");
    d.style.setProperty("--mo", on ? "1" : "0");
    d.toggleAttribute("data-moved", on);
  }
}

/** One draw of the master meter: only what changed is written (T3 review S2). */
function drawMaster(m: HTMLElement, rms: number, peak: number, key: WeakMap<HTMLElement, string>): void {
  const look = masterMeterLook(rms, peak);
  const k = `${look.fill}|${look.pk}|${look.text}`;
  if (key.get(m) === k) return;
  key.set(m, k);
  const fill = m.querySelector<HTMLElement>(".fill");
  const pk = m.querySelector<HTMLElement>(".pk");
  const b = m.querySelector("b");
  if (fill && fill.style.transform !== look.fill) fill.style.transform = look.fill;
  if (pk && pk.style.transform !== look.pk) pk.style.transform = look.pk;
  // The text node Preact made is kept (its data changed), so a render of the same "–" never undoes the reading.
  const node = b?.firstChild;
  if (node && node.nodeType === 3) {
    if (node.nodeValue !== look.text) node.nodeValue = look.text;
  } else if (b && b.textContent !== look.text) b.textContent = look.text;
  m.setAttribute("aria-label", `Master level ${look.text}`);
}

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
  let meterAt = -Infinity;
  let moversAt = -Infinity;
  let wroteAt = -Infinity;
  let fullAt = -Infinity;
  /** What each property was last written as, so a frame writes only what changed (T3 review S3). */
  let written: string[] = [];
  /** Held still, the fader meters and the ghosts have been cleared since it went still. */
  let stillDone = false;
  const pulses = INSTRUMENTS.map(() => 0);
  let ghosts: HTMLElement[] = [];
  const ghostKey = new WeakMap<HTMLElement, string>();
  const masterKey = new WeakMap<HTMLElement, string>();
  const frame = (now: number): void => {
    raf = requestAnimationFrame(frame);
    const still = !wanted() || !!reduce?.matches;
    if (still !== wasStill) {
      root.classList.toggle("still", still);
      wasStill = still;
      meterAt = -Infinity;
      stillDone = false;
    }
    const playing = last.playing && engine.playing;
    // T3 review S3: at most about 30 writes a second; a frame between them does nothing.
    if (now - wroteAt < MOTION_MS - 4 && now - meterAt < METER_MS) return;
    if (now - meterAt >= METER_MS) {
      meterAt = now;
      for (const m of root.querySelectorAll<HTMLElement>(".meter[data-master]")) drawMaster(m, engine.level(), engine.peak(), masterKey);
      if (!still || !stillDone) {
        for (const m of root.querySelectorAll<HTMLElement>(".fmeter[data-meter]")) {
          const v = `scaleY(${meterScale(engine.instrumentLevel(m.dataset.meter as InstrumentId), still)})`;
          if (m.style.transform !== v) m.style.transform = v;
        }
        ghosts = [...root.querySelectorAll<HTMLElement>(GHOSTS)];
      } else ghosts = [];
      INSTRUMENTS.forEach((id, i) => (pulses[i] = pulseLevel(playing ? engine.instrumentLevel(id) : -Infinity, still)));
    }
    const stepMs = 60000 / engine.bpm / 4;
    const p16 = playing ? playhead(last.step, now - last.at, stepMs, still) : -1;
    const shown = lanes && lanes.bar === last.bar ? lanes : null;
    if (ghosts.length) moveGhosts(engine, ghosts, ghostKey, playing && !still, last.bar * 4 + Math.max(0, p16) / 4);
    if (still) stillDone = true;
    const parts = [p16.toFixed(3), ...pulses.map((m) => m.toFixed(2))];
    const flashes: number[] = [];
    for (const id of INSTRUMENTS) {
      const f = playing && !still && shown && shown.on[id] ? flashLevel(shown.notes[id], p16) : 0;
      flashes.push(f);
      parts.push(f.toFixed(2));
    }
    const key = parts.join(",");
    // Nothing changed: the containers are looked up again only now and then, for one that appeared since.
    if (key === prev && now - moversAt < METER_MS) return;
    // A container that appeared since the last frame gets the values even when they have not changed.
    moversAt = now;
    const movers = root.querySelectorAll<HTMLElement>(MOVERS);
    const same = movers.length === targets.length && targets.every((t, i) => t === movers[i]);
    if (key === prev && same) return;
    wroteAt = now;
    prev = key;
    // Every value is written again 15 times a second, in case a render replaced a container's inline style.
    if (!same || now - fullAt >= METER_MS) {
      targets = [...movers];
      written = [];
      fullAt = now;
    }
    const p = p16.toFixed(3);
    const bar = playing ? (p16 / 16).toFixed(4) : "0";
    const beat = playing && !still ? ((p16 % 4) / 4).toFixed(3) : "0";
    const names = ["--p16", "--p", "--beat", ...INSTRUMENTS.map((id) => `--f-${id}`), ...INSTRUMENTS.map((id) => `--m-${id}`)];
    const values = [p, bar, beat, ...flashes.map((f) => f.toFixed(2)), ...pulses.map((m) => m.toFixed(2))];
    for (let i = 0; i < names.length; i++) {
      if (written[i] === values[i]) continue;
      written[i] = values[i];
      for (const t of targets) t.style.setProperty(names[i], values[i]);
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
