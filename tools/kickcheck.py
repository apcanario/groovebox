#!/usr/bin/env python3
"""F2: the kick's Done-when measures, in headless Chrome against a build.

    python3 tools/kickcheck.py dist record [COMMIT]   the ten other vibes' kick level and length, written to
                                                      tools/fixtures/kick_other_vibes.json (only ever from the old build)
    python3 tools/kickcheck.py dist others            the ten other vibes' kick against that fixture: level within
                                                      dropcheck.LOUD_DB, length within LENGTH_TOL_S

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
from dropcheck import LOUD_DB  # noqa: E402

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
    if len(sys.argv) < 3 or sys.argv[2] not in ("record", "others"):
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
            failures = check_others(app)
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
