#!/usr/bin/env python3
"""F2: the kick's Done-when measures, in headless Chrome against a build.

    python3 tools/kickcheck.py dist record [COMMIT]   the ten other vibes' kick level and length, written to
                                                      tools/fixtures/kick_other_vibes.json (only ever from the old build)
    python3 tools/kickcheck.py dist others            the ten other vibes' kick against that fixture: level within
                                                      dropcheck.LOUD_DB, length within LENGTH_TOL_S
    python3 tools/kickcheck.py dist tune              Root on in A, G and F# (and C, whose octaves miss 45 to 60 Hz):
                                                      the body's measured fundamental within TUNE_CENTS of the root, in
                                                      45 to 60 Hz where an octave of the root falls there
    python3 tools/kickcheck.py dist axes              Punch 0 against 1 changes the first 30 ms; Length (the Decay
                                                      dial) 0 against 1 changes the tail
    python3 tools/kickcheck.py dist peak              the master under dropcheck.PEAK_DBFS through a drop with Pump at
                                                      full and the loudest kick (Punch 1, Click 1, Root on)
    python3 tools/kickcheck.py dist all               tune, axes, others and peak

What is measured: the kick's own sound, at its voice gain (after the drive and the C1 trim, before the drum channel),
read on the audio thread in blocks of BLOCK samples (the largest sample of each block). Every kick the sequencer starts
is logged with its audio time; a hit's level is its largest sample (dBFS), its length the time from its start to the
last block over LENGTH_DB under that peak. A vibe's figures are the largest of each over the hits of BARS bars (every bar of an 8-bar phrase, from wherever it is entered) of its own
start section, Morph off: the loudest hit (as the smoke's peak reads) and the longest-ringing one (the median moved by
29 ms run to run in Trap, whose hits ring for two lengths). It measures; it cannot judge how the kick sounds.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from basscheck import App, bar_s, play, wait_for  # noqa: E402
from dropcheck import LOUD_DB, PEAK_DBFS, judge, one_drop, peak_db  # noqa: E402

E = "window.__groovebox"
HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "fixtures", "kick_other_vibes.json")

BLOCK = 32
BARS = 9
# A hit's length: from its start to the last block over this many dB under its own peak.
LENGTH_DB = 30.0
# How far a vibe's kick length may move from the fixture: half a sixteenth at 176 bpm is 43 ms; 10 ms is about a
# twentieth of the default 0.2 s kick and three render quanta.
LENGTH_TOL_S = 0.010

KICK_READ = """async ([bars, block]) => {
  const e = window.__groovebox, d = e.graph.instruments.drums, ctx = d.channel.input.context, raw = ctx.rawContext;
  const code = `registerProcessor('kick-blocks', class extends AudioWorkletProcessor {
    constructor() { super(); this.b = []; this.n = 0; this.m = 0; this.t0 = null; this.on = true;
      this.port.onmessage = () => { this.port.postMessage({ t0: this.t0, b: this.b }); this.b = []; this.t0 = null; }; }
    process(ins) {
      const a = ins[0][0];
      for (let i = 0; i < 128; i++) {
        if (this.t0 === null) this.t0 = (currentFrame + i) / sampleRate;
        const x = a ? Math.abs(a[i]) : 0;
        if (x > this.m) this.m = x;
        if (++this.n === ${block}) { this.b.push(this.m); this.n = 0; this.m = 0; }
      }
      return true;
    }
  });`;
  if (!raw.__kickBlocks) {
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
    raw.__kickBlocks = raw.audioWorklet.addModule(url);
  }
  await raw.__kickBlocks;
  const node = ctx.createAudioWorkletNode('kick-blocks', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' });
  const hits = [];
  const orig = d.trigger;
  d.trigger = function (voice, time, vel, bpm, gap) {
    if (voice === 'kick') hits.push({ t: time, vel });
    return orig.call(this, voice, time, vel, bpm, gap);
  };
  // Drop what the port holds, then read from the next bar line on.
  const got = () => new Promise((res) => { node.port.onmessage = (m) => res(m.data); node.port.postMessage(0); });
  d.gains.kick.connect(node);
  await new Promise((r) => setTimeout(r, 50));
  await got();
  const bar = 240 / e.bpm, until = ctx.currentTime + bars * bar + 0.8;
  while (ctx.currentTime < until) await new Promise((r) => setTimeout(r, 50));
  const data = await got();
  d.trigger = orig;
  d.gains.kick.disconnect(node);
  return { t0: data.t0, b: data.b, sr: ctx.sampleRate, hits };
}"""


def measure(page, block: int = BLOCK, bars: int = BARS) -> dict:
    """The kick's largest level (dBFS) and length (s) over `bars` bars of what plays now."""
    import math
    r = page.evaluate(KICK_READ, [bars, block])
    t0, b, sr = r["t0"], r["b"], r["sr"]
    span = block / sr
    hits = sorted(h["t"] for h in r["hits"] if r["t0"] is not None and h["t"] >= t0)
    end = t0 + len(b) * span
    levels, lengths = [], []
    for i, t in enumerate(hits):
        nxt = hits[i + 1] if i + 1 < len(hits) else end
        if nxt > end:
            break
        lo, hi = int((t - t0) / span), min(len(b), int((nxt - t0) / span) + 1)
        seg = b[lo:hi]
        if not seg:
            continue
        pk = max(seg)
        if pk <= 1e-6:
            continue
        floor = pk * 10 ** (-LENGTH_DB / 20)
        last = max(j for j, x in enumerate(seg) if x > floor)
        levels.append(20 * math.log10(pk))
        lengths.append((lo + last + 1) * span + t0 - t)
    if not levels:
        return {"level": None, "length": None, "hits": 0}
    return {"level": round(max(levels), 2), "length": round(max(lengths), 4), "hits": len(levels)}


# ---- Raw capture: the kick's own samples ------------------------------------------------------------------------

RAW_READ = """async (seconds) => {
  const e = window.__groovebox, d = e.graph.instruments.drums, ctx = d.channel.input.context, raw = ctx.rawContext;
  const code = `registerProcessor('kick-raw', class extends AudioWorkletProcessor {
    constructor() { super(); this.on = false; this.x = []; this.t0 = null;
      this.port.onmessage = (m) => { if (m.data === 'go') { this.on = true; this.x = []; this.t0 = null; }
        else { this.on = false; this.port.postMessage({ t0: this.t0, x: this.x }); } }; }
    process(ins) {
      if (!this.on) return true;
      const a = ins[0][0];
      if (this.t0 === null) this.t0 = currentFrame / sampleRate;
      for (let i = 0; i < 128; i++) this.x.push(a ? a[i] : 0);
      return true;
    }
  });`;
  if (!raw.__kickRaw) {
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
    raw.__kickRaw = raw.audioWorklet.addModule(url);
  }
  await raw.__kickRaw;
  const node = ctx.createAudioWorkletNode('kick-raw', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1, channelCountMode: 'explicit' });
  const hits = [];
  const orig = d.trigger;
  d.trigger = function (voice, time, vel, bpm, gap) {
    if (voice === 'kick') hits.push(time);
    return orig.call(this, voice, time, vel, bpm, gap);
  };
  d.gains.kick.connect(node);
  node.port.postMessage('go');
  const until = ctx.currentTime + seconds;
  while (ctx.currentTime < until) await new Promise((r) => setTimeout(r, 30));
  const data = await new Promise((res) => { node.port.onmessage = (m) => res(m.data); node.port.postMessage('stop'); });
  d.trigger = orig;
  d.gains.kick.disconnect(node);
  return { t0: data.t0, x: data.x, sr: ctx.sampleRate, hits, shape: e.kickState() };
}"""

# The tune: the fundamental read over the body, from SETTLE_S after the hit (the sweep is 45 ms) to BODY_S.
TUNE_CENTS = 30.0
TUNE_KEYS = ["A", "G", "F#", "C"]
SETTLE_S, BODY_S = 0.07, 0.25
# Punch's ends: the first FIRST_S of a hit must differ by at least FIRST_DIFF (the RMS of the difference over the RMS of
# Punch 0's) and in its count of zero crossings by at least FIRST_CROSSINGS. Length's ends: the tail at least
# LENGTH_MOVE_S apart. Length is the Decay dial as built, whose decay starts at the hit, so its short end also thins the
# first 30 ms (printed, not judged): the defaults must play the old kick, whose envelope had no hold.
FIRST_S = 0.030
FIRST_DIFF = 0.3
FIRST_CROSSINGS = 2
LENGTH_MOVE_S = 0.1


def kick_song(page, key: str = "A") -> None:
    """Deep house in its groove section, Four floor in every section (a kick on each beat), Morph off, in `key`."""
    song = page.evaluate("window.__vibeSong('deepHouse')")
    song["morph"] = {**(song.get("morph") or {}), "on": False}
    song["key"] = key
    for sec in song["sections"]:
        sec["drums"] = {"preset": "fourFloor"}
        sec["on"]["drums"] = True
    page.evaluate(f"(s) => {E}.loadSong(s, 1)", song)


def one_hit(page, settle: float = 0.3) -> tuple:
    """The samples of one whole kick (the second one heard, from its start to the next) and the shape it played."""
    import numpy as np
    time.sleep(settle)
    r = page.evaluate(RAW_READ, 1.6)
    x = np.asarray(r["x"], dtype=float)
    sr, t0 = r["sr"], r["t0"]
    hits = sorted(t for t in r["hits"] if t >= t0)
    for a, b in zip(hits, hits[1:]):
        i, j = int(round((a - t0) * sr)), int(round((b - t0) * sr))
        if i > int(0.05 * sr) and j <= len(x):
            return x[i:j], sr, r["shape"]
    raise SystemExit(f"no whole kick in the capture ({len(hits)} hits)")


def fundamental(x, sr: float, lo: float, hi: float) -> float:
    """Hz from the rising zero crossings (linearly interpolated) between `lo` and `hi` seconds."""
    seg = x[int(lo * sr):int(hi * sr)]
    ups = [i + seg[i] / (seg[i] - seg[i + 1]) for i in range(len(seg) - 1) if seg[i] <= 0 < seg[i + 1]]
    if len(ups) < 3:
        return float("nan")
    return (len(ups) - 1) / ((ups[-1] - ups[0]) / sr)


def crossings(x) -> int:
    return int(sum(1 for a, b in zip(x, x[1:]) if (a <= 0 < b) or (a > 0 >= b)))


def hit_length(x, sr: float) -> float:
    import numpy as np
    a = np.abs(x)
    pk = a.max()
    over = np.nonzero(a > pk * 10 ** (-LENGTH_DB / 20))[0]
    return (over[-1] + 1) / sr


def cents_to_class(hz: float, key: str) -> float:
    import math
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    c = 1200 * math.log2(hz / (440 * 2 ** ((names.index(key) - 9) / 12)))
    return c - 1200 * round(c / 1200)


def check_tune(app: App) -> list:
    page = app.page
    failures = []
    for key in TUNE_KEYS:
        kick_song(page, key)
        page.evaluate(f"{E}.setParams('drums', {{kickRoot: 1, kickDecay: 1}})")
        play(page)
        x, sr, shape = one_hit(page, 0.6)
        hz = fundamental(x, sr, SETTLE_S, BODY_S)
        c = cents_to_class(hz, key)
        band = any(45 <= hz * m <= 60 for m in (0.5, 1, 2))
        print(f"tune: {key}: body {hz:.2f} Hz ({c:+.1f} cents from {key}; the voice set {shape['last']['bodyHz']:.2f} Hz)")
        if not abs(c) <= TUNE_CENTS:
            failures.append(f"tune: in {key} the kick's fundamental is {hz:.2f} Hz, {c:+.1f} cents from the root (more than {TUNE_CENTS})")
        if band and not 45 <= hz <= 60:
            failures.append(f"tune: in {key} the kick sits at {hz:.2f} Hz, not in the root's octave between 45 and 60 Hz")
        page.click("#play")
        wait_for(page, f"!{E}.playing", 3.0)
    return failures


def check_axes(app: App) -> list:
    import numpy as np
    page = app.page
    failures = []
    kick_song(page)
    play(page)
    got = {}
    for name, vals in [("punch0", {"kickPunch": 0}), ("punch1", {"kickPunch": 1}), ("len0", {"kickPunch": 0.5, "kickDecay": 0}),
                       ("len1", {"kickPunch": 0.5, "kickDecay": 1})]:
        page.evaluate(f"(v) => {E}.setParams('drums', v)", vals)
        got[name] = one_hit(page)
    n = int(FIRST_S * got["punch0"][1])
    def first(k):
        return got[k][0][:n]
    def diff(a, b):
        return float(np.sqrt(np.mean((first(a) - first(b)) ** 2)) / max(np.sqrt(np.mean(first(a) ** 2)), 1e-9))
    dp, cp = diff("punch0", "punch1"), (crossings(first("punch0")), crossings(first("punch1")))
    print(f"axes: Punch 0 -> 1, first {FIRST_S * 1000:.0f} ms: difference {dp:.2f} of Punch 0's level, zero crossings {cp[0]} -> {cp[1]}")
    if dp < FIRST_DIFF:
        failures.append(f"axes: Punch's ends differ by {dp:.2f} over the first 30 ms (at least {FIRST_DIFF})")
    if cp[1] - cp[0] < FIRST_CROSSINGS:
        failures.append(f"axes: Punch 1 adds {cp[1] - cp[0]} zero crossings to the first 30 ms (at least {FIRST_CROSSINGS})")
    l0, l1 = hit_length(got["len0"][0], got["len0"][1]), hit_length(got["len1"][0], got["len1"][1])
    dl = diff("len0", "len1")
    print(f"axes: Length 0 -> 1: tail {l0:.3f} -> {l1:.3f} s; first {FIRST_S * 1000:.0f} ms differ by {dl:.2f}")
    if l1 - l0 < LENGTH_MOVE_S:
        failures.append(f"axes: Length's ends move the tail {l1 - l0:.3f} s (at least {LENGTH_MOVE_S})")
    page.click("#play")
    wait_for(page, f"!{E}.playing", 3.0)
    return failures


def check_peak(app: App) -> list:
    """Pump at full, the loudest kick, a drop: the master stays under PEAK_DBFS (dropcheck.judge reads it)."""
    page = app.page
    failures = []
    v = next(x for x in page.evaluate("window.__vibes") if x["id"] == "deepHouse")
    page.evaluate(f"(v) => {E}.loadAtBar(window.__vibeSong(v.id), v.start)", v)
    play(page)
    if not wait_for(page, f"{E}.getSong().style === 'deepHouse'", 10.0):
        return ["peak: Deep house did not load"]
    page.evaluate(f"{E}.setMix('pump', 0.95)")
    page.evaluate(f"{E}.setParams('drums', {{kickPunch: 1, kickClick: 1, kickRoot: 1}})")
    page.evaluate(f"{E}.setDrop({{build: 2}})")
    r = one_drop(page, v, failures, "deepHouse, Pump at full, Punch 1, Click 1")
    if not r:
        return failures + ["peak: the drop did not come on"]
    print(f"peak: the master's highest peak {peak_db(r['peak']):.2f} dBFS ({r['peak_at']}), under {PEAK_DBFS}")
    judge(r, "deepHouse, Pump at full, Punch 1, Click 1", failures)
    page.click("#play")
    wait_for(page, f"!{E}.playing", 3.0)
    return failures


def load_vibe(page, vid: str) -> None:
    song = page.evaluate(f"window.__vibeSong({vid!r})")
    song["morph"] = {**(song.get("morph") or {}), "on": False}
    start = page.evaluate(f"window.__vibes.find(v => v.id === {vid!r}).start")
    if not song["sections"][start]["on"]["drums"]:
        start = next(i for i, s in enumerate(song["sections"]) if s["on"]["drums"])
    page.evaluate(f"(s) => {E}.loadSong(s, {start})", song)


def other_vibes(page) -> list:
    return [v["id"] for v in page.evaluate("window.__vibes") if not v["top"]]


def others(app: App) -> dict:
    page = app.page
    out = {}
    for vid in other_vibes(page):
        load_vibe(page, vid)
        play(page)
        b = page.evaluate(f"{E}.position().bar")
        wait_for(page, f"{E}.position().bar >= {b + 1}", 2 * bar_s(page) + 2)
        m = measure(page)
        out[vid] = m
        print(f"  {vid}: kick {m['level']} dBFS, {m['length']} s ({m['hits']} hits)", flush=True)
        page.click("#play")
        wait_for(page, f"!{E}.playing", 3.0)
        time.sleep(0.6)
    return out


def check_others(app: App) -> list:
    with open(FIXTURE) as fh:
        fx = json.load(fh)
    now = others(app)
    failures = []
    for vid, was in fx["vibes"].items():
        m = now.get(vid)
        if not m or m["level"] is None:
            failures.append(f"others: {vid} played no kick")
            continue
        dl, dt = m["level"] - was["level"], m["length"] - was["length"]
        print(f"others: {vid} level {was['level']:.2f} -> {m['level']:.2f} dB ({dl:+.2f}; within {LOUD_DB}), "
              f"length {was['length']:.4f} -> {m['length']:.4f} s ({dt * 1000:+.1f} ms; within {LENGTH_TOL_S * 1000:.0f})")
        if abs(dl) > LOUD_DB:
            failures.append(f"others: {vid}'s kick measures {dl:+.2f} dB from the old voice (more than {LOUD_DB} dB)")
        if abs(dt) > LENGTH_TOL_S:
            failures.append(f"others: {vid}'s kick is {dt * 1000:+.1f} ms from the old voice's length (more than {LENGTH_TOL_S * 1000:.0f} ms)")
    for vid in now:
        if vid not in fx["vibes"]:
            failures.append(f"others: {vid} has no kick in the fixture")
    return failures


def main() -> int:
    modes = ("record", "others", "tune", "axes", "peak", "all")
    if len(sys.argv) < 3 or sys.argv[2] not in modes:
        print(__doc__)
        return 2
    root, what = sys.argv[1], sys.argv[2]
    t0 = time.time()
    with App(root) as app:
        if what == "record":
            out = others(app)
            with open(FIXTURE, "w") as fh:
                json.dump({"recorded_from": sys.argv[3] if len(sys.argv) > 3 else root, "bars": BARS, "block": BLOCK,
                           "length_db": LENGTH_DB, "vibes": out}, fh, indent=1)
                fh.write("\n")
            failures = [f"record: {v} played no kick" for v, m in out.items() if m["level"] is None]
            print(f"wrote {FIXTURE}")
        else:
            failures = []
            for m in ("tune", "axes", "others", "peak"):
                if what in (m, "all"):
                    failures += {"tune": check_tune, "axes": check_axes, "others": check_others, "peak": check_peak}[m](app)
        failures += [f"page error: {e}" for e in app.errors]
    print(f"{what}: {(time.time() - t0) / 60:.1f} min")
    if failures:
        print(f"KICKCHECK {what} FAILED")
        for f in failures:
            print(" -", f)
        return 1
    print(f"KICKCHECK {what} PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
