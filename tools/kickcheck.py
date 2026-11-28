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
    python3 tools/kickcheck.py dist sweep             the quadrant acts at once and never clicks: Punch, Length, Click, Tune and
                                                      Root each swept through the UI while the kick plays (check_sweep)
    python3 tools/kickcheck.py dist peak              the master under dropcheck.PEAK_DBFS through a drop with Pump at
                                                      full and the loudest kick (Punch 1, Click 1, Root on)
    python3 tools/kickcheck.py dist all               tune, axes, sweep, others and peak

The smoke runs them: tune, axes, sweep and others in its kick part, peak in drop-1 (Deep house's drop group).

What is measured: the kick's own sound, at its voice gain (after the drive and the C1 trim, before the drum channel),
read on the audio thread in blocks of BLOCK samples (the largest sample of each block). Every kick the sequencer starts
is logged with its audio time; a hit's level is its largest sample (dBFS), its length the time from its start to the
last block over LENGTH_DB under that peak, read only up to a guard block before the next kick's onset (a hit that rings
up to that point is said to be cut by the gap, and fails). A vibe's figures are the largest of each over the hits of BARS bars (every bar of an 8-bar phrase, from wherever it is entered) of its own
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
# A hit whose length reaches within this many blocks of the next kick's onset has been cut by the gap, not measured to
# its tail (E1 of the F2 review): such a vibe's length says nothing, so it fails.
SATURATE_BLOCKS = 2

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
    levels, lengths, saturated = [], [], 0
    for i, t in enumerate(hits):
        has_next = i + 1 < len(hits)
        nxt = hits[i + 1] if has_next else end
        if nxt > end:
            break
        # The segment ends a guard block before the block the next onset falls in (as one_hit slices), so a hit's
        # length is its own tail, never the gap to the next kick.
        lo = int((t - t0) / span)
        hi = min(len(b), int((nxt - t0) / span) - 1) if has_next else len(b)
        seg = b[lo:hi]
        if not seg:
            continue
        pk = max(seg)
        if pk <= 1e-6:
            continue
        floor = pk * 10 ** (-LENGTH_DB / 20)
        last = max(j for j, x in enumerate(seg) if x > floor)
        levels.append(20 * math.log10(pk))
        ln = (lo + last + 1) * span + t0 - t
        lengths.append(ln)
        # A tail that reaches within SATURATE_BLOCKS of the next onset is cut by it, not measured.
        if has_next and ln >= (nxt - t) - SATURATE_BLOCKS * span:
            saturated += 1
    if not levels:
        return {"level": None, "length": None, "hits": 0, "saturated": 0}
    return {"level": round(max(levels), 2), "length": round(max(lengths), 4), "hits": len(levels), "saturated": saturated}


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


def check_tune(page) -> list:
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


def check_axes(page) -> list:
    import numpy as np
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


def check_peak(page) -> list:
    """Pump at full, the loudest kick, a drop: the master stays under PEAK_DBFS (dropcheck.judge reads it)."""
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


# ---- The quadrant acts at once and never clicks: each axis swept while the kick plays ----------------------------

# The capture of RAW_READ split in two, so the UI can be used while it runs: RAW_START wraps the drums' trigger (every
# kick the sequencer starts from then on is logged) and starts the samples; RAW_STOP returns them with the hits.
RAW_START = """async () => {
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
  const hits = [], late = [], orig = d.trigger;
  d.trigger = function (voice, time, vel, bpm, gap) {
    if (voice === 'kick') { hits.push(time); late.push(ctx.currentTime - time); }
    return orig.call(this, voice, time, vel, bpm, gap);
  };
  d.gains.kick.connect(node);
  node.port.postMessage('go');
  window.__kickCap = { node, hits, late, orig, d };
  return ctx.currentTime;
}"""
RAW_STOP = """async () => {
  const c = window.__kickCap, ctx = c.d.channel.input.context;
  const data = await new Promise((res) => { c.node.port.onmessage = (m) => res(m.data); c.node.port.postMessage('stop'); });
  c.d.trigger = c.orig;
  c.d.gains.kick.disconnect(c.node);
  window.__kickCap = null;
  return { t0: data.t0, x: data.x, sr: ctx.sampleRate, hits: c.hits, late: c.late, beat: 60 / window.__groovebox.bpm };
}"""
NOW = "window.__groovebox.graph.instruments.drums.channel.input.context.currentTime"

# What is judged, on the kick's own samples (its voice gain, before the drum channel and Pump):
#  - a step: the largest sample-to-sample jump over the peak of the hit it sits in, from STILL_SKIP_S after each logged
#    hit (past the sweep and the click) to the next. While an axis is swept it may not pass dropcheck.CLICK_FACTOR
#    times the same figure over the still stretches before and after the sweep (one end of the axis, then the other),
#    and over those still stretches it may not pass STILL_JUMP_MAX.
#  - a retrigger: the rise of the kick's envelope (the largest sample over the last STILL_ENV_S, longer than a period
#    of the lowest body, 35 Hz) over STILL_HOP_S, over the hit's peak, from STILL_RISE_SKIP_S after each logged hit: a
#    sounding kick only falls. While swept it may pass neither CLICK_FACTOR times the still figure nor STILL_RISE.
#  - every kick the sequencer starts sits a beat after the one before (Four floor), within STILL_GRID_S: a move that
#    starts a kick of its own fails.
#  - acts at once: when the finger lifts, the engine already holds the axis's end (the next hit's shape, or the drum
#    patch's Length), and the next kick plays it.
STILL_SKIP_S = 0.050
STILL_ENV_S = 0.030
STILL_HOP_S = 0.005
STILL_RISE_SKIP_S = 0.035
STILL_RISE = 0.10
STILL_GRID_S = 0.002
# The still kick's own largest jump past STILL_SKIP_S, over its peak: a sine body of 80 Hz (Tune's top) moves 0.011 of its
# peak a sample at 44.1 kHz, and the kick measures 0.004 to 0.007. The click's stereo noise, while it restarted the drive's
# oversampler, put a step of 0.07 to 0.22 into every hit (fixed in slice c): a click of the kick itself, moved or not.
STILL_JUMP_MAX = 0.02
# A hit's onset in the audio: its first sample over this fraction of its peak. A kick whose onset comes more than
# ONSET_LATE_S after its logged time reached the audio clock late (a main-thread stall, not the kick voice): unloaded,
# onsets sit 0.3 to 2.7 ms after the logged time. The axis's capture is then taken again once (said in the output); a
# kick late in the second capture too fails as late.
ONSET_FRACTION = 0.3
ONSET_LATE_S = 0.003
SWEEP_TRIES = 2
SWEEP_S = 2.4
SWEEP_STEPS = 48
HOLD_S = 1.3


def find_onsets(x, sr: float, t0: float, hits: list) -> list:
    """(logged time, onset time) of each logged hit in the capture: the onset is the first sample over ONSET_FRACTION of
    the hit's peak, looked for from 2 ms before its logged time up to the next logged hit."""
    import numpy as np
    n = len(x)
    a = np.abs(x)
    hs = sorted(h for h in hits if t0 <= h < t0 + n / sr)
    ends = hs[1:] + [t0 + n / sr]
    out = []
    for h, nx in zip(hs, ends):
        i0, j = max(0, int(round((h - t0) * sr)) - int(0.002 * sr)), min(n, int(round((nx - t0) * sr)))
        if j <= i0:
            continue
        pk = a[i0:j].max()
        if pk <= 1e-6:
            continue
        k = int(np.flatnonzero(a[i0:j] > ONSET_FRACTION * pk)[0])
        if os.environ.get("KICK_DEBUG") and k / sr - 0.002 > ONSET_LATE_S:
            q = int(0.001 * sr)
            print("   late onset: |x| over the peak per ms from 2 ms before the logged time: "
                  + " ".join(f"{a[i0 + m * q:i0 + (m + 1) * q].max() / pk:.2f}" for m in range(min(14, (j - i0) // q))), flush=True)
        out.append((h, t0 + (i0 + k) / sr))
    return out


def late_onsets(onsets: list) -> list:
    """(index, ms) of each hit whose onset in the audio came more than ONSET_LATE_S after its logged time."""
    return [(k + 1, (o - h) * 1000) for k, (h, o) in enumerate(onsets) if o - h > ONSET_LATE_S]


def still_figures(x, sr: float, t0: float, hits: list, lo: float, hi: float, inside: bool) -> tuple:
    """(largest jump, largest envelope rise), each over its hit's peak, over the samples whose time is in [lo, hi)
    (inside) or outside it (not inside), from the first hit on. `hits` are the onsets found in the audio
    (find_onsets), so the skips past the sweep and click are measured from where each kick really starts."""
    import numpy as np
    n = len(x)
    t = t0 + np.arange(n) / sr
    hs = sorted(h for h in hits if t0 <= h < t0 + n / sr)
    if len(hs) < 2:
        return float("nan"), float("nan")
    a = np.abs(x)
    peak = np.zeros(n)
    skip = np.ones(n, dtype=bool)
    rskip = np.ones(n, dtype=bool)
    bounds = hs + [t0 + n / sr]
    for h, nx in zip(bounds, bounds[1:]):
        i, j = int(round((h - t0) * sr)), int(round((nx - t0) * sr))
        i0 = max(0, i - int(0.002 * sr))
        peak[i0:j] = a[i0:j].max() if j > i0 else 0
        skip[i0:min(j, i + int(STILL_SKIP_S * sr))] = True
        skip[i + int(STILL_SKIP_S * sr):j] = False
        rskip[i0:min(j, i + int(STILL_RISE_SKIP_S * sr))] = True
        rskip[i + int(STILL_RISE_SKIP_S * sr):j] = False
    sel = (t >= lo) & (t < hi)
    if not inside:
        sel = ~sel
    first = int(round((hs[0] - t0) * sr))
    sel[:first] = False
    ok = peak > 1e-4
    jumps = np.zeros(n)
    jumps[1:] = np.abs(np.diff(x))
    m = sel & ~skip & ok
    jump = float((jumps[m] / peak[m]).max()) if m.any() else 0.0
    if os.environ.get("KICK_DEBUG") and m.any():
        k = int(np.flatnonzero(m)[np.argmax(jumps[m] / peak[m])])
        prev = max((h for h in hs if h <= t[k]), default=None)
        print(f"   worst jump at {t[k] - t0:.4f} s of the capture, {(t[k] - prev) * 1000 if prev else -1:.1f} ms after a logged hit", flush=True)
    w, hop = int(STILL_ENV_S * sr), int(STILL_HOP_S * sr)
    from numpy.lib.stride_tricks import sliding_window_view
    env = np.zeros(n)
    env[w - 1:] = sliding_window_view(a, w).max(axis=1)
    rise = np.zeros(n)
    rise[hop:] = env[hop:] - env[:-hop]
    m = sel & ~rskip & ok
    m[:w + hop] = False
    up = float((rise[m] / peak[m]).max()) if m.any() else 0.0
    if os.environ.get("KICK_DEBUG") and m.any():
        k = int(np.flatnonzero(m)[np.argmax(rise[m] / peak[m])])
        prev = max((h for h in hs if h <= t[k]), default=None)
        print(f"   worst rise at {t[k] - t0:.4f} s, {(t[k] - prev) * 1000 if prev else -1:.1f} ms after a logged hit; hits at "
              + ", ".join(f"{h - t0:.3f}" for h in hs), flush=True)
    return jump, max(up, 0.0)


def slow_drag(page, sel: str, frm: tuple, to: tuple, seconds: float = SWEEP_S, steps: int = SWEEP_STEPS) -> None:
    """Press at `frm` (fractions of the element's box, or pixels from its middle for a dial when `px`), move to `to` in
    `steps` moves spread over `seconds`, release."""
    box = page.locator(sel).bounding_box()
    pt = lambda f: (box["x"] + f[0] * box["width"], box["y"] + f[1] * box["height"])
    x0, y0 = pt(frm)
    x1, y1 = pt(to)
    page.mouse.move(x0, y0)
    page.mouse.down()
    for i in range(1, steps + 1):
        page.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps)
        time.sleep(seconds / steps)
    page.mouse.up()


def taps(page, sel: str, n: int, seconds: float = SWEEP_S) -> None:
    for _ in range(n):
        page.click(sel)
        time.sleep(seconds / n)


# Each axis: its name, how the UI sweeps it, and what the engine must hold once the finger lifts. A dial is pressed in
# its middle and dragged 1.5 drag spans (DRAG_SPAN_PX, 220 px) up, so it reaches its top from anywhere.
DIAL_UP = ((0.5, 0.5), (0.5, -2.8))
SWEEPS = [
    ("Punch", "simple", None, {"kickPunch": 0.0}, lambda p: slow_drag(p, '[data-xy="kick"]', (0.5, 0.98), (0.5, 0.02)),
     "s => s.settings.kickPunch > 0.95 && s.next.sweepRatio > 6.9"),
    ("Length", "simple", None, {"kickDecay": 0.0}, lambda p: slow_drag(p, '[data-xy="kick"]', (0.02, 0.5), (0.98, 0.5)),
     None),
    ("Click", "advanced", "drums:kick", {"kickClick": 0.0}, lambda p: slow_drag(p, '[data-dial="drums:kickClick"]', *DIAL_UP),
     "s => s.settings.kickClick > 0.95 && s.next.clickGain > 0"),
    ("Tune", "advanced", "drums:kick", {"kickRoot": 0, "pitch": 0.0}, lambda p: slow_drag(p, '[data-dial="drums:pitch"]', *DIAL_UP),
     "s => s.settings.kickRoot < 0.5 && s.next.bodyHz > 79"),
    ("Root", "advanced", "drums:kick", {"kickRoot": 0, "pitch": 1.0}, lambda p: taps(p, '[data-kickroot="drums"]', 11),
     "s => s.settings.kickRoot >= 0.5 && Math.abs(s.next.bodyHz - 55) < 0.01"),
]


def sweep_axis(page, name: str, mode: str, chip, start: dict, sweep, held) -> tuple:
    """One axis swept once: (failures, lateness). lateness lists what says a kick reached the audio clock late:
    scheduled after its time, or its onset in the audio more than ONSET_LATE_S after its logged time."""
    import numpy as np
    from dropcheck import CLICK_FACTOR
    failures = []
    page.click(f'[data-appmode="{mode}"]')
    page.click('[data-tab="drums"]')
    if chip:
        page.click(f'[data-page="{chip}"]')
    page.evaluate(f"(v) => {E}.setParams('drums', v)", start)
    time.sleep(0.3)
    page.evaluate(RAW_START)
    time.sleep(HOLD_S)
    lo = page.evaluate(NOW)
    before = page.evaluate(f"{E}.kickState()")
    decay0 = page.evaluate(f"{E}.getSong().patches.drums.kickDecay")
    sweep(page)
    hi = page.evaluate(NOW)
    # Acts at once: the engine holds the end the moment the finger lifts, well before the next kick.
    now = page.evaluate(f"{E}.kickState()")
    decay1 = page.evaluate(f"{E}.getSong().patches.drums.kickDecay")
    if held and not page.evaluate(f"(s) => ({held})(s)", now):
        failures.append(f"sweep: {name}: when the finger lifts the kick does not hold the axis's end ({now['settings']}, next {now['next']})")
    if name == "Length" and not (decay0 < 0.05 and decay1 > 0.95):
        failures.append(f"sweep: Length: the drum patch's Length moved {decay0:.2f} -> {decay1:.2f}, not end to end")
    if name != "Length" and now["next"] == before["next"]:
        failures.append(f"sweep: {name}: the next kick's shape did not move ({now['next']})")
    time.sleep(HOLD_S + 0.6)
    last = page.evaluate(f"{E}.kickState()")
    if last["last"] != now["next"]:
        failures.append(f"sweep: {name}: the next kick played {last['last']}, not what the engine held when the finger lifted ({now['next']})")
    r = page.evaluate(RAW_STOP)
    x, sr, t0, hits, beat = np.asarray(r["x"], dtype=float), r["sr"], r["t0"], r["hits"], r["beat"]
    ons = find_onsets(x, sr, t0, hits)
    starts = [o for _, o in ons]
    # The sounding kicks the sweep can step: from the hit before the sweep began to half a second after it.
    sj, sr_ = still_figures(x, sr, t0, starts, lo - beat, hi + 0.5, True)
    rj, rr = still_figures(x, sr, t0, starts, lo - beat, hi + 0.5, False)
    ahead = min((-v for v in r["late"]), default=float("nan"))
    print(f"sweep: {name}: jump {sj:.4f} of the hit's peak (still {rj:.4f}: {sj / max(rj, 1e-9):.2f} times), "
          f"envelope rise {sr_:.3f} (still {rr:.3f}); {len(hits)} kicks, each scheduled {ahead * 1000:.0f} ms ahead or more, "
          f"onsets {min(((o - h) * 1000 for h, o in ons), default=float('nan')):.1f} to {max(((o - h) * 1000 for h, o in ons), default=float('nan')):.1f} ms after their logged time", flush=True)
    lateness = [f"kick {k} started {ms:.0f} ms late (main thread)" for k, ms in late_onsets(ons)]
    # A kick the sequencer hands over after its time (ctx.currentTime trails the render, so this misses some: the
    # onsets above catch the rest).
    if ahead < 0:
        lateness.append(f"a kick was scheduled {-ahead * 1000:.0f} ms after its time (the main thread stalled while it moved)")
    if not (rj > 0 and sj == sj):
        failures.append(f"sweep: {name}: no kicks measured ({len(hits)} logged)")
    else:
        if rj > STILL_JUMP_MAX:
            failures.append(f"sweep: {name}: a step in the still kick (jump {rj:.4f} of its peak, over {STILL_JUMP_MAX}): it clicks unmoved")
        elif sj > CLICK_FACTOR * rj:
            failures.append(f"sweep: {name}: a step in a sounding kick (jump {sj:.4f} of its peak, {sj / rj:.1f} times the still kick's, over {CLICK_FACTOR})")
        # The still kick only falls: a rise there is a retrigger of the kick itself, moved or not, and judged on its own
        # so that it cannot raise the swept stretch's bar.
        if rr > STILL_RISE:
            failures.append(f"sweep: {name}: the still kick rose by {rr:.2f} of its peak (over {STILL_RISE}): it retriggers unmoved")
        elif sr_ > max(STILL_RISE, CLICK_FACTOR * rr):
            failures.append(f"sweep: {name}: a sounding kick rose by {sr_:.2f} of its peak (a retrigger; over {max(STILL_RISE, CLICK_FACTOR * rr):.2f})")
    hs = sorted(hits)
    off = [b - a for a, b in zip(hs, hs[1:]) if abs((b - a) - beat) > STILL_GRID_S]
    if off:
        failures.append(f"sweep: {name}: kicks {', '.join(f'{g * 1000:.0f} ms' for g in off)} apart, not a beat ({beat * 1000:.0f} ms): a move started one")
    if len(hs) < int((hi - lo + 2 * HOLD_S) / beat) - 1:
        failures.append(f"sweep: {name}: {len(hs)} kicks while the kick played, too few")
    return failures, lateness


def check_sweep(page) -> list:
    """F2 Done-when: the quadrant acts at once and never clicks. Deep house in A, Four floor, Morph off: each axis
    (Punch and Length on the Simple Drums quadrant; Click, Tune with Root off, and the Root switch on the Advanced Kick
    page) swept from one end to the other through the UI while the kick plays, its samples captured throughout.

    Steps and rises are measured from each kick's onset as found in the audio, not from its logged time. A kick that
    reached the audio clock late (a main-thread stall: another browser or a busy machine) makes the axis's capture be
    taken again, once, and said; late again, it fails as late. The sweep needs a quiet machine: the smoke runs one part
    at a time with no other browser."""
    page.set_viewport_size({"width": 390, "height": 844})
    failures = []
    kick_song(page, "A")
    play(page)
    for axis in SWEEPS:
        name = axis[0]
        for attempt in range(1, SWEEP_TRIES + 1):
            got, lateness = sweep_axis(page, *axis)
            if not lateness:
                failures += got
                break
            if attempt < SWEEP_TRIES:
                print(f"sweep: {name}: {'; '.join(lateness)}: capture taken again (try {attempt + 1} of {SWEEP_TRIES})", flush=True)
                continue
            failures += [f"sweep: {name}: {msg}, in {SWEEP_TRIES} captures" for msg in lateness] + got
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
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


def others(page) -> dict:
    out = {}
    for vid in other_vibes(page):
        load_vibe(page, vid)
        play(page)
        b = page.evaluate(f"{E}.position().bar")
        wait_for(page, f"{E}.position().bar >= {b + 1}", 2 * bar_s(page) + 2)
        m = measure(page)
        out[vid] = m
        print(f"  {vid}: kick {m['level']} dBFS, {m['length']} s ({m['hits']} hits, {m['saturated']} cut by the next kick)", flush=True)
        page.click("#play")
        wait_for(page, f"!{E}.playing", 3.0)
        time.sleep(0.6)
    return out


def check_others(page) -> list:
    with open(FIXTURE) as fh:
        fx = json.load(fh)
    now = others(page)
    failures = []
    for vid, was in fx["vibes"].items():
        m = now.get(vid)
        if not m or m["level"] is None:
            failures.append(f"others: {vid} played no kick")
            continue
        if m.get("saturated"):
            failures.append(f"others: {vid}: {m['saturated']} of {m['hits']} hits ring to within {SATURATE_BLOCKS} blocks of the next kick: the length is the gap, not the tail")
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
    modes = ("record", "others", "tune", "axes", "sweep", "peak", "all")
    if len(sys.argv) < 3 or sys.argv[2] not in modes:
        print(__doc__)
        return 2
    root, what = sys.argv[1], sys.argv[2]
    t0 = time.time()
    with App(root) as app:
        if what == "record":
            out = others(app.page)
            with open(FIXTURE, "w") as fh:
                json.dump({"recorded_from": sys.argv[3] if len(sys.argv) > 3 else root, "bars": BARS, "block": BLOCK,
                           "length_db": LENGTH_DB, "vibes": out}, fh, indent=1)
                fh.write("\n")
            failures = [f"record: {v} played no kick" for v, m in out.items() if m["level"] is None]
            failures += [f"record: {v}: {m['saturated']} hits cut by the next kick (the length is the gap)" for v, m in out.items() if m.get("saturated")]
            print(f"wrote {FIXTURE}")
        else:
            failures = []
            for m in ("tune", "axes", "sweep", "others", "peak"):
                if what in (m, "all"):
                    failures += {"tune": check_tune, "axes": check_axes, "sweep": check_sweep, "others": check_others,
                                 "peak": check_peak}[m](app.page)
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
