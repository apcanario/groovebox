#!/usr/bin/env python3
"""F0 (C24): the rubber-bass fix's Done-when tests, in headless Chrome against a build.

    python3 tools/basscheck.py dist stall [WAVE]    the main thread blocked inside bass note starts: the wave and the
                                                    sub stay in phase (correlation over CORR_MIN) for the whole note;
                                                    WAVE: the vibe's own (Rubber's square) by default, or fm or noise
    python3 tools/basscheck.py dist teardown        F0 review E1: Sustain 0, a long release, the wave changed in a note:
                                                    the old wave set is never disposed while its sub still sounds
    python3 tools/basscheck.py dist run             what the smoke's drop-5 part runs (walk_bass_run): stall for the
                                                    vibe's wave, fm and noise, teardown, and no startTogether give-up
    python3 tools/basscheck.py dist levels          every bass patch's level against tools/fixtures/bass_levels.json
                                                    (recorded from 059fc3b, before the fix), within dropcheck.LOUD_DB
    python3 tools/basscheck.py dist record-levels   writes that fixture from the build given (only ever the old one)
    python3 tools/basscheck.py dist probe           bundle 7b's probe (docs/reviews/bundle-7b.md): Minimal techno, IDM,
                                                    EDM, Electro, Progressive and Drum and bass, four reps each (the
                                                    layers' lead seeds moved by rep x 7919), a drop each: no level line
                                                    of dropcheck's judges may fail in the 24 runs. Only level lines
                                                    fail the probe (the row's Done-when); click and stuck-note lines
                                                    of judge_wind are printed and counted but do not fail it, so a
                                                    probe pass does not mean "no clicks"

Each exits 1 on a failure. One browser at a time, never beside a smoke (they share the machine's audio thread time).
It measures; it cannot judge how the bass sounds.
"""
import json
import math
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dropcheck import LOUD_DB, judge, judge_wind, one_drop  # noqa: E402

PORT = 4183
E = "window.__groovebox"
HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "fixtures", "bass_levels.json")

# The Done-when's line: the wave's and the sub's correlation over the whole note. A square and its sine sub at one pitch
# in phase read 0.82 to 0.90 (bundle 7b), a sine and its sub 1.0; out of phase by half a period, about -0.9.
CORR_MIN = 0.8
# How many note starts are blocked, and the window the correlation is read over (samples: 21 to 23 ms).
STALLS = 6
CORR_FFT = 1024
# A window is judged when both voices sound above this RMS, from the moment both of the note's attacks were made.
CORR_FLOOR = 1e-3
# An FM note's modulator envelope 20 ms in must be over this (it opens with the carrier's; 0 when gated out).
FM_MOD_MIN = 1e-3
# Each blocked note must give at least this many judged windows, so "the whole note" is read and not one corner of it.
CORR_WINDOWS = 3

# The probe's vibes, in bundle 7b's order, and its reps.
PROBE_VIBES = ["minimalTechno", "idm", "edm", "electro", "progressive", "drumAndBass"]
PROBE_REPS = 4
SEED_STEP = 7919

# The levels' song: Deep house in its groove section, the bass played by each patch in turn, Morph off.
LEVEL_SONG = "deepHouse"
LEVEL_BARS = 4


def wait_for(page, expr: str, timeout: float) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if page.evaluate(expr):
            return True
        time.sleep(0.02)
    return False


class App:
    """The build served on PORT and opened in one headless Chrome page, the first launch's picker closed."""

    def __init__(self, root: str):
        self.root = root

    def __enter__(self):
        self.errors: list[str] = []
        self.server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", self.root],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(1)
        self.pw = sync_playwright().start()
        chrome = "/usr/bin/google-chrome"
        kwargs = {"executable_path": chrome} if os.path.exists(chrome) else {}
        self.browser = self.pw.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"], **kwargs)
        page = self.browser.new_page(viewport={"width": 390, "height": 844})
        page.on("pageerror", lambda e: (self.errors.append(str(e)), print(f"PAGE ERROR: {e}")))
        page.goto(f"http://localhost:{PORT}/index.html")
        wait_for(page, f"!!{E}", 5.0)
        wait_for(page, "!!document.querySelector('.vibes')", 3.0)
        page.keyboard.press("Escape")
        wait_for(page, "!document.querySelector('.vibes')", 2.0)
        self.page = page
        return self

    def __exit__(self, *exc):
        try:
            self.browser.close()
            self.pw.stop()
        finally:
            self.server.terminate()
            self.server.wait()

    def play(self) -> None:
        play(self.page)


def play(page) -> None:
    if not page.evaluate(f"{E}.playing"):
        page.click("#play")
        wait_for(page, f"{E}.playing", 3.0)


def bar_s(page) -> float:
    return 240.0 / page.evaluate(f"{E}.bpm")


# ---- 1. The main thread blocked during a note start ------------------------------------------------------------------

# The bass's live voice set: the wave's and the sub's own gain (before the sub's level, the filter and everything after)
# correlated window by window on the audio thread; and the wave's note start wrapped. A blocked note start: once the wave's
# attack is made, the main thread spins until the audio clock is half the note's period plus 4 ms past the note's time,
# then the sub's attack is made (bundle 7b E1: the sub's start reached the audio thread late; half a period is the worst
# such lateness, the one that turns the sub against the wave). Only notes after a gap in the bass are blocked (on the old
# build a note after a gap starts both oscillators again; one inside a legato line restarts neither), every other one,
# so the notes between are read unblocked, as the measure's own control.
STALL_RUN = """async ([stalls, fft, floor, timeoutS]) => {
  const e = window.__groovebox, b = e.graph.instruments.bass;
  const live = b.monos.live, sub = b.subs.live, ctx = live.synth.context;
  // The measure runs on the audio thread: one worklet with the wave on input 0 and the sub on input 1, summing each
  // window of `fft` samples exactly aligned, so no read from the main thread (blocked here on purpose) can tear them.
  const code = `registerProcessor('bass-corr', class extends AudioWorkletProcessor {
    constructor() { super(); this.n = 0; this.s = [0, 0, 0, 0, 0]; this.fft = ${fft}; }
    process(ins) {
      const a = ins[0][0], c = ins[1][0], s = this.s;
      for (let i = 0; i < 128; i++) {
        const x = a ? a[i] : 0, y = c ? c[i] : 0;
        s[0] += x; s[1] += y; s[2] += x * y; s[3] += x * x; s[4] += y * y;
        if (++this.n === this.fft) { this.port.postMessage({ end: (currentFrame + i + 1) / sampleRate, s: s.slice() }); this.n = 0; this.s = s.fill(0); }
      }
      return true;
    }
  });`;
  const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
  await ctx.rawContext.audioWorklet.addModule(url);  // Tone's own loader takes one module per context (continuity.ts)
  const node = ctx.createAudioWorkletNode('bass-corr', { numberOfInputs: 2, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' });
  live.gain.connect(node, 0, 0); sub.gain.connect(node, 0, 1);
  const wins = [];
  node.port.onmessage = (m) => {
    const [sa, sb, ab, aa, bb] = m.data.s, n = fft, ma = sa / n, mb = sb / n;
    const va = aa / n - ma * ma, vb = bb / n - mb * mb, cov = ab / n - ma * mb;
    wins.push({ end: m.data.end, ra: Math.sqrt(Math.max(va, 0)), rb: Math.sqrt(Math.max(vb, 0)), c: va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : null });
  };
  const notes = [];
  let lastEnd = -1, gaps = 0, blocked = 0;
  const orig = live.synth.triggerAttackRelease;
  live.synth.triggerAttackRelease = function (hz, dur, time, vel) {
    const r = orig.call(this, hz, dur, time, vel);
    const f = typeof hz === 'number' ? hz : Number(hz);
    const gap = time > lastEnd + 0.005;
    lastEnd = Math.max(lastEnd, time + dur + b.env.release);
    const n = { t: time, dur, hz: f, gap, blocked: false, issued: ctx.currentTime };
    // An FM voice's modulator: its envelope must open with the note (review S2: gated alone, the carrier would play).
    const mod = live.synth._modulator;
    if (mod) n.mod = mod.envelope.getValueAtTime(time + 0.02);
    if (gap && gaps++ % 2 === 1 && blocked < stalls) {
      const ms = (time + 0.5 / f + 0.004 - ctx.currentTime) * 1000, t0 = performance.now();
      while (performance.now() - t0 < ms) { /* the main thread blocked */ }
      n.blocked = true; n.spunMs = performance.now() - t0; n.subAt = ctx.currentTime;
      blocked++;
    }
    notes.push(n);
    return r;
  };
  const sr = ctx.sampleRate, span = fft / sr, until = performance.now() + timeoutS * 1000;
  while (performance.now() < until) {
    const done = notes.filter((n) => n.blocked);
    if (done.length >= stalls && ctx.currentTime > done.at(-1).t + done.at(-1).dur + 0.1) break;
    await new Promise((res) => setTimeout(res, 20));
  }
  live.synth.triggerAttackRelease = orig;
  live.gain.disconnect(node, 0, 0); sub.gain.disconnect(node, 0, 1); node.port.onmessage = null;
  // Each note's windows: those lying wholly inside the note from the moment both voices are open (its sub's attack made,
  // then one render quantum and the sub's attack time; a blocked note's sub attack is made late, so the windows before
  // hold the wave alone or the sub's ramp: an onset gap, reported in ms, not a phase), both voices sounding.
  for (const n of notes) {
    const from = Math.max(n.t, n.subAt ?? n.t) + b.subEnv.attack + 128 / sr;
    const w = wins.filter((x) => x.end - span >= from && x.end <= n.t + n.dur && x.ra > floor && x.rb > floor && x.c !== null);
    n.windows = w.length;
    n.min = w.length ? Math.min(...w.map((x) => x.c)) : null;
    n.median = w.length ? w.map((x) => x.c).sort((p, q) => p - q)[Math.floor(w.length / 2)] : null;
  }
  return { notes, reads: wins.length, sr, wave: b.wave };
}"""


# The waves the smoke's stall check runs (review S2): the vibe's own (None: Rubber's square), FM and noise. FM and
# noise are no bass patch, so neither the levels fixture nor the vibe covers them.
STALL_WAVES = (None, "fm", "noise")


def stall(app: App, wave: str | None = None) -> list:
    failures: list[str] = []
    stall_check(app.page, failures, wave)
    return failures


def stall_check(page, failures: list, wave: str | None = None) -> None:
    """The main thread blocked inside STALLS bass note starts: the wave and the sub stay over CORR_MIN for the whole
    note, and the unblocked notes between (the control) too. `wave`: the bass's wave (None: the vibe's own)."""
    song = page.evaluate("window.__vibeSong('minimalTechno')")
    # Every section's bass on the Offbeat rhythm (four notes a bar with a gap after each), so blocked notes come often
    # and each is a note that starts after a gap; the Rubber square of the vibe, or the wave asked for.
    for s in song["sections"]:
        s["bass"]["rhythm"] = "offbeat"
        s["on"]["bass"] = True
    song["morph"] = {**(song.get("morph") or {}), "on": False}
    if wave:
        song["patches"]["bass"]["wave"] = wave
    if wave == "fm":
        # FM at index 0: the carrier alone, a sine at the note's pitch, so the line reads the carrier's timing against
        # the sub. With the vibe's index (0.3 of the dial, 3.6) the modulation itself moves the carrier's phase, and
        # the unblocked control read -0.975 on HEAD: the measure cannot judge timing there. The modulator still runs and
        # its envelope is checked to open at every note (FM_MOD_MIN).
        song["patches"]["bass"]["fmIndex"] = 0.0
    page.evaluate(f"(s) => {E}.loadSong(s, 1)", song)
    play(page)
    time.sleep(2 * bar_s(page))
    r = page.evaluate(STALL_RUN, [STALLS, CORR_FFT, CORR_FLOOR, 40])
    blocked = [n for n in r["notes"] if n["blocked"]]
    free = [n for n in r["notes"] if not n["blocked"] and n["windows"] >= CORR_WINDOWS]
    print(f"stall: wave {r['wave']}, {len(r['notes'])} bass notes, {r['reads']} windows of both voices ({CORR_FFT} samples at {r['sr']:.0f} Hz, on the audio thread)")
    if wave and r["wave"] != wave:
        failures.append(f"stall: the bass plays {r['wave']}, not the {wave} asked for")
    for n in blocked:
        late = (n["subAt"] - n["t"]) * 1000
        mn = "none" if n["min"] is None else f"{n['min']:+.3f}"
        md = "none" if n["median"] is None else f"{n['median']:+.3f}"
        print(f"  blocked note at {n['t']:.3f} s, {n['hz']:.1f} Hz, {n['dur'] * 1000:.0f} ms: main thread blocked {n['spunMs']:.1f} ms, "
              f"the sub's attack made {late:+.1f} ms past the note's time; correlation min {mn}, median {md} over {n['windows']} windows")
        if n["windows"] < CORR_WINDOWS:
            failures.append(f"stall: the note at {n['t']:.3f} s gave {n['windows']} windows with both voices sounding (at least {CORR_WINDOWS})")
        elif n["min"] <= CORR_MIN:
            failures.append(f"stall: the wave and the sub fell to a correlation of {n['min']:+.3f} in the blocked note at {n['t']:.3f} s "
                            f"({n['hz']:.1f} Hz; at most {CORR_MIN} is out of phase)")
    if len(blocked) < STALLS:
        failures.append(f"stall: {len(blocked)} note starts blocked, expected {STALLS}")
    if r["wave"] == "fm":
        mods = [n.get("mod") for n in r["notes"]]
        print(f"  FM modulator envelope 20 ms into each note: min {min((m for m in mods if m is not None), default=float('nan')):.3f}")
        if not mods or any(m is None or m <= FM_MOD_MIN for m in mods):
            failures.append(f"stall: the FM modulator's envelope did not open in every note ({mods})")
    lows = [n["min"] for n in free]
    print(f"  unblocked notes (control): {len(free)} read, correlation min {min(lows):+.3f}" if lows else "  unblocked notes: none read")
    if not free:
        failures.append("stall: no unblocked note was read (the measure has no control)")
    elif min(lows) <= CORR_MIN:
        failures.append(f"stall: an unblocked note read a correlation of {min(lows):+.3f} (the measure itself is off, or the voices drift)")


# ---- 1b. The wave set retired under its sub (F0 review E1) -------------------------------------------------------

# Sustain 0, Decay 0.1, Release 2, Long notes: the wave's envelope is silent once its decay ends, the sub's (sustain at
# least 0.6) is not. In a note, once the wave's decay is over, the wave is changed; the old pair's dispose calls are then
# watched until the old wave set is disposed: at that moment its sub (whose pitch is the wave's frequency signal) must
# be disposed already or silent. The build before the review's fix disposed the wave with the sub at 0.23, which froze
# the sub on a DC level for its whole release.
TEARDOWN_RUN = """async ([to, timeoutS]) => {
  const e = window.__groovebox, b = e.graph.instruments.bass, ctx = b.monos.live.synth.context;
  const live = b.monos.live.synth, orig = live.triggerAttackRelease;
  let note = null;
  live.triggerAttackRelease = function (hz, dur, time, vel) { note = note || { t: time, dur }; return orig.call(this, hz, dur, time, vel); };
  const until = performance.now() + timeoutS * 1000;
  while (performance.now() < until && !(note && ctx.currentTime > note.t + 0.2 && ctx.currentTime < note.t + note.dur - 0.05)) {
    if (note && ctx.currentTime >= note.t + note.dur - 0.05) note = null;
    await new Promise((r) => setTimeout(r, 5));
  }
  live.triggerAttackRelease = orig;
  if (!note) return { changed: false };
  const out = { changed: true, at: ctx.currentTime, note, subAtChange: b.subs.live.synth.envelope.getValueAtTime(ctx.now()),
                waveAtChange: live.envelope.getValueAtTime(ctx.now()), wave: null, sub: null };
  e.setParam('bass', 'wave', to);
  const ow = b.monos.old, os = b.subs.old;
  if (!ow || !os || ow.synth !== live) return { ...out, paired: false };
  out.paired = true;
  const wd = ow.synth.dispose.bind(ow.synth), sd = os.synth.dispose.bind(os.synth);
  os.synth.dispose = function () { out.sub = { t: ctx.currentTime }; return sd(); };
  ow.synth.dispose = function () {
    out.wave = { t: ctx.currentTime, subDisposed: !!out.sub, subLevel: out.sub ? 0 : os.synth.envelope.getValueAtTime(ctx.now()) };
    return wd();
  };
  while (performance.now() < until + 15000 && !(out.wave && out.sub)) await new Promise((r) => setTimeout(r, 20));
  return out;
}"""


def teardown_check(page, failures: list) -> None:
    song = page.evaluate("window.__vibeSong('minimalTechno')")
    for s in song["sections"]:
        s["bass"]["rhythm"] = "long"
        s["on"]["bass"] = True
    song["morph"] = {**(song.get("morph") or {}), "on": False}
    p = song["patches"]["bass"]
    p.update(sustain=0.0, decay=0.1, release=2.0)
    to = "triangle" if p["wave"] != "triangle" else "sawtooth"
    page.evaluate(f"(s) => {E}.loadSong(s, 1)", song)
    play(page)
    time.sleep(2 * bar_s(page))
    r = page.evaluate(TEARDOWN_RUN, [to, 12])
    if not r.get("changed"):
        failures.append("teardown: no bass note long enough to change the wave in")
        return
    if not r.get("paired"):
        failures.append("teardown: the wave change left no previous wave set and sub (the measure cannot judge)")
        return
    print(f"teardown: wave changed to {to} {r['at'] - r['note']['t']:.3f} s into a {r['note']['dur']:.2f} s note "
          f"(wave envelope {r['waveAtChange']:.4f}, sub {r['subAtChange']:.3f})")
    w = r.get("wave")
    if not w:
        failures.append("teardown: the old wave set was never disposed (the old pair kept running)")
        return
    sub = r.get("sub")
    print(f"  old wave set disposed at +{w['t'] - r['at']:.2f} s, its sub "
          + ("disposed before it" if w["subDisposed"] else f"at envelope {w['subLevel']:.4f}")
          + (f", the sub disposed at +{sub['t'] - r['at']:.2f} s" if sub else ", the sub not disposed"))
    if not w["subDisposed"] and w["subLevel"] >= 1e-4:
        failures.append(f"teardown: the old wave set was disposed with its sub still sounding (envelope {w['subLevel']:.3f}): "
                        "the sub's pitch drops to 0 Hz and it sits on a DC level for the rest of its release")
    if not sub:
        failures.append("teardown: the old sub was never disposed")


def walk_bass_run(page, failures: list) -> None:
    """F0 review S1, S2, E1, M1: the stall for the vibe's wave, FM and noise; the teardown; no give-up of startTogether.
    Run by the smoke's drop-5 part (tools/smoke.py), and by `basscheck.py dist run`."""
    for wave in STALL_WAVES:
        stall_check(page, failures, wave)
    teardown_check(page, failures)
    st = page.evaluate(f"{E}.bassRunStats()")
    print(f"bass run: {st['giveUps']} voice sets whose oscillators gave up starting together")
    if st["giveUps"]:
        failures.append(f"bass run: {st['giveUps']} voice sets kept with their oscillators' starts possibly apart (startTogether gave up)")
    page.click("#play")
    wait_for(page, f"!{E}.playing", 3.0)


# ---- 2. Every bass patch's level ----------------------------------------------------------------------------------

# The bass's own sound (its scope, before its effects) over LEVEL_BARS bars: the energy of every read window, averaged.
LEVEL_READ = """async (seconds) => {
  const an = window.__groovebox.instrumentScope('bass'), n = an.fftSize, buf = new Float32Array(n);
  const end = performance.now() + seconds * 1000;
  let sum = 0, k = 0;
  while (performance.now() < end) {
    an.getFloatTimeDomainData(buf);
    let ss = 0;
    for (let i = 0; i < n; i++) ss += buf[i] * buf[i];
    sum += ss / n; k++;
    await new Promise((r) => setTimeout(r, 40));
  }
  return { db: 10 * Math.log10(Math.max(sum / Math.max(k, 1), 1e-12)), reads: k };
}"""


def levels(app: App) -> dict:
    page = app.page
    song = page.evaluate(f"window.__vibeSong({LEVEL_SONG!r})")
    song["morph"] = {**(song.get("morph") or {}), "on": False}
    start = page.evaluate(f"window.__vibes.find(v => v.id === {LEVEL_SONG!r}).start")
    page.evaluate(f"(s) => {E}.loadSong(s, {start})", song)
    ids = page.evaluate(f"{E}.patchIds('bass')")
    app.play()
    out = {}
    for pid in ids:
        if not page.evaluate(f"{E}.setPatch('bass', {pid!r})"):
            raise SystemExit(f"levels: the patch {pid} did not load")
        # From a bar line one bar on: the patch's notes, not the last one's tail.
        b = page.evaluate(f"{E}.position().bar")
        wait_for(page, f"{E}.position().bar >= {b + 2}", 4 * bar_s(page) + 2)
        r = page.evaluate(LEVEL_READ, LEVEL_BARS * bar_s(page))
        out[pid] = round(r["db"], 2)
        print(f"  bass patch {pid}: {r['db']:.2f} dB over {LEVEL_BARS} bars ({r['reads']} reads)", flush=True)
    return out


def check_levels(app: App) -> list:
    with open(FIXTURE) as fh:
        fx = json.load(fh)
    now = levels(app)
    failures = []
    for pid, before in fx["levels"].items():
        if pid not in now:
            failures.append(f"levels: the patch {pid} of the fixture is not a bass patch now")
            continue
        d = now[pid] - before
        print(f"levels: {pid} {before:.2f} -> {now[pid]:.2f} dB ({d:+.2f}; within {LOUD_DB} dB)")
        if abs(d) > LOUD_DB:
            failures.append(f"levels: the bass patch {pid} measures {d:+.2f} dB from its level before the fix (more than {LOUD_DB} dB)")
    for pid in now:
        if pid not in fx["levels"]:
            failures.append(f"levels: the bass patch {pid} has no level in the fixture")
    return failures


# ---- 3. Bundle 7b's probe ------------------------------------------------------------------------------------------

def level_line(f: str) -> bool:
    """A line of dropcheck's judges about the master's level: the drop, one of its bars, a wind-down bar or the bars
    after it, each 'dB from the section'."""
    return "dB from the section" in f


def probe(app: App) -> list:
    page = app.page
    vibes = {v["id"]: v for v in page.evaluate("window.__vibes")}
    app.play()
    failures, runs = [], []
    for rep in range(PROBE_REPS):
        for vid in PROBE_VIBES:
            v = vibes[vid]
            song = page.evaluate(f"window.__vibeSong({vid!r})")
            for s in song["sections"]:
                for lid in ("layer1", "layer2"):
                    g = (s.get(lid) or {}).get("gen")
                    if g and isinstance(g.get("seed"), int):
                        g["seed"] += rep * SEED_STEP
            page.evaluate(f"(a) => {E}.loadAtBar(a[0], a[1])", [song, v["start"]])
            if not wait_for(page, f"{E}.getSong().style === {vid!r}", 10.0):
                failures.append(f"probe {vid} rep {rep}: did not load")
                continue
            page.evaluate(f"{E}.setDrop({{build: 2}})")
            label = f"{vid} rep {rep}"
            got: list[str] = []
            r = one_drop(page, v, got, label)
            if r:
                judge(r, label, got)
                judge_wind(r, label, got)
            lv = [f for f in got if level_line(f)]
            other = [f for f in got if not level_line(f)]
            loud = "none" if not r else f"{r['loud']:+.2f} dB, bars {' '.join(f'{x:+.2f}' for x in r['per_bar'])}, peak {20 * math.log10(max(r['peak'], 1e-9)):.2f} dBFS"
            runs.append((label, lv, other))
            print(f"probe {label}: drop {loud}; level lines failed {len(lv)}, other lines failed {len(other)}", flush=True)
            for f in got:
                print(f"   - {f}", flush=True)
            failures += lv
            if not r:
                failures.append(f"probe {label}: the drop did not come on")
    bad = sum(1 for _l, lv, _o in runs if lv)
    others = sum(1 for _l, _lv, o in runs if o)
    print(f"probe: {len(runs)} runs, {bad} with a level line failed, {others} with another line failed")
    if len(runs) != PROBE_REPS * len(PROBE_VIBES):
        failures.append(f"probe: {len(runs)} runs, expected {PROBE_REPS * len(PROBE_VIBES)}")
    return failures


def main() -> int:
    if len(sys.argv) < 3 or sys.argv[2] not in ("stall", "teardown", "run", "levels", "record-levels", "probe"):
        print(__doc__)
        return 2
    root, what = sys.argv[1], sys.argv[2]
    t0 = time.time()
    with App(root) as app:
        if what == "stall":
            failures = stall(app, sys.argv[3] if len(sys.argv) > 3 else None)
        elif what == "teardown":
            failures = []
            teardown_check(app.page, failures)
        elif what == "run":
            failures = []
            walk_bass_run(app.page, failures)
        elif what == "levels":
            failures = check_levels(app)
        elif what == "record-levels":
            out = levels(app)
            os.makedirs(os.path.dirname(FIXTURE), exist_ok=True)
            with open(FIXTURE, "w") as fh:
                json.dump({"recorded_from": sys.argv[3] if len(sys.argv) > 3 else root, "song": LEVEL_SONG, "bars": LEVEL_BARS,
                           "levels": out}, fh, indent=1)
                fh.write("\n")
            failures = []
            print(f"wrote {FIXTURE}")
        else:
            failures = probe(app)
        failures += [f"page error: {e}" for e in app.errors]
    print(f"{what}: {(time.time() - t0) / 60:.1f} min")
    if failures:
        print(f"BASSCHECK {what} FAILED")
        for f in failures:
            print(" -", f)
        return 1
    print(f"BASSCHECK {what} PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
