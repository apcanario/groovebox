#!/usr/bin/env python3
"""Long-take test (G5): play the built app in headless Chrome, record N minutes (default 10) to MP3,
and sample memory every 30 s. Passes if the MP3 is valid, lasts the take's length, and memory stays flat.

Usage: python3 tools/record_long.py dist [minutes]
Needs Python Playwright, psutil and Chrome or Chromium. It cannot judge how the take sounds.

Memory read: the page's JS heap (Chrome DevTools), and the resident memory (PSS) of every Chrome process of
this run, which covers the page, the encoder worker, the audio thread and the GPU and browser processes.
Flat means: the JS heap (read after a forced collection) grows less than HEAP_LIMIT_MB from the first minute to
the end, and the process memory's low points (the encoder worker collects its garbage in a saw-tooth of up to
about 70 MB) grow less than LIMIT_MB from minutes 1 to 2.5 to the last two minutes. Held as samples, ten minutes
of stereo would be about 212 MB of float (106 MB as 16-bit). `--baseline` plays without a take, to show what
the app's own memory does.
"""
import os
import subprocess
import sys
import time

import psutil
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp3check import mp3_info  # noqa: E402

PORT = 4181
LIMIT_MB = 30.0
HEAP_LIMIT_MB = 10.0


def chrome_mb(marker: str) -> tuple[float, float]:
    """PSS of all Chrome processes of this run, and of its renderers alone, in MB."""
    total = rend = 0.0
    procs = []
    for p in psutil.process_iter(["cmdline"]):
        try:
            if marker in " ".join(p.info["cmdline"] or []):
                procs += [p, *p.children(recursive=True)]
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    for p in {q.pid: q for q in procs}.values():
        try:
            cmd = " ".join(p.cmdline())
            mem = p.memory_full_info()
            mb = getattr(mem, "pss", mem.rss) / 2**20
            total += mb
            if "--type=renderer" in cmd:
                rend += mb
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return total, rend


def main() -> int:
    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    minutes = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0
    # --baseline: play without recording, to see what the app's memory does on its own.
    baseline = "--baseline" in sys.argv
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--directory", root],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)
    failures: list[str] = []
    errors: list[str] = []
    rows = []
    try:
        with sync_playwright() as p:
            chrome = "/usr/bin/google-chrome"
            kwargs = {"executable_path": chrome} if os.path.exists(chrome) else {}
            marker = f"--groovebox-long-take={os.getpid()}"
            browser = p.chromium.launch(
                args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required", marker], **kwargs
            )
            page = browser.new_page(viewport={"width": 390, "height": 844})
            page.on("pageerror", lambda e: errors.append(str(e)))
            cdp = page.context.new_cdp_session(page)
            cdp.send("Performance.enable")

            def heap_mb() -> float:
                cdp.send("HeapProfiler.collectGarbage")
                m = {x["name"]: x["value"] for x in cdp.send("Performance.getMetrics")["metrics"]}
                return m["JSHeapUsedSize"] / 2**20

            page.goto(f"http://localhost:{PORT}/index.html")
            page.wait_for_function("!!window.__groovebox")
            page.click("#play")
            page.wait_for_function("window.__groovebox.playing")
            if not baseline:
                page.click("#rec")
            t0 = time.time()
            if not baseline and page.evaluate("window.__groovebox.recordInfo().state") != "recording":
                failures.append("the take did not start")
            total_s = minutes * 60
            nxt = 0.0
            while True:
                el = time.time() - t0
                if el >= nxt:
                    info = page.evaluate("window.__groovebox.recordInfo()")
                    disk = page.evaluate("navigator.storage.estimate().then(e => e.usage)")
                    tot, rend = chrome_mb(marker)
                    row = (el, info["seconds"], info["bytes"] / 2**20, heap_mb(), rend, tot, disk / 2**20)
                    rows.append(row)
                    print("t %6.0f s  take %7.1f s  mp3 %6.2f MB  js heap %6.1f MB  renderers %6.1f MB  chrome %6.1f MB  disk %6.2f MB" % row, flush=True)
                    nxt += 30
                if el >= total_s:
                    break
                time.sleep(min(1.0, max(0.05, nxt - el, 0.05)))
                # A page that stopped would make the test meaningless.
                if not page.evaluate("window.__groovebox.playing"):
                    failures.append("the transport stopped during the take")
                    break
            if baseline:
                browser.close()
                base, end = next((r for r in rows if r[0] >= 60), rows[0]), rows[-1]
                print(f"baseline, no take: js heap {end[3] - base[3]:+.1f} MB, renderers {end[4] - base[4]:+.1f} MB from {base[0]:.0f} s to {end[0]:.0f} s")
                return 0
            want = page.evaluate("window.__groovebox.recordInfo().seconds")
            wall = time.time() - t0
            page.click("#rec")
            page.wait_for_selector("#take-save", timeout=60000)
            with page.expect_download() as dl:
                page.click("#take-save")
            path = os.path.join(os.environ.get("TMPDIR", "/tmp"), f"groovebox-long-take-{os.getpid()}.mp3")
            dl.value.save_as(path)
            with open(path, "rb") as f:
                mp3 = mp3_info(f.read())
            log = page.evaluate("window.__groovebox.getLog()")
            browser.close()
    finally:
        server.terminate()

    print(f"MP3: {mp3['frames']} frames, {mp3['sample_rate']} Hz, {mp3['kbps']} kbps, {mp3['seconds']:.2f} s, "
          f"{mp3['bytes'] / 2**20:.2f} MB; take timer {want:.2f} s, wall clock {wall:.2f} s, log {log['seconds']:.2f} s")
    if mp3["error"]:
        failures.append(f"MP3 not valid: {mp3['error']}")
    if abs(mp3["seconds"] - want) > 0.5:
        failures.append(f"MP3 lasts {mp3['seconds']:.2f} s, the take {want:.2f} s")
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=60,
        )
        if probe.returncode == 0:
            print(f"ffprobe duration: {float(probe.stdout.strip()):.2f} s")
        dec = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "null", "-"], capture_output=True, text=True, timeout=300)
        print("ffmpeg decode: " + ("clean" if dec.returncode == 0 and not dec.stderr.strip() else dec.stderr.strip()[:300]))
        if dec.returncode != 0 or dec.stderr.strip():
            failures.append("ffmpeg reports decode errors")
    except FileNotFoundError:
        print("ffprobe/ffmpeg not installed: frame walk only")

    base = next((r for r in rows if r[0] >= 60), rows[0])
    end = rows[-1]
    early = [r for r in rows if 60 <= r[0] <= 150] or rows[:1]
    late = [r for r in rows if r[0] >= end[0] - 120] or rows[-1:]
    heap_growth = end[3] - base[3]
    rend_growth = min(r[4] for r in late) - min(r[4] for r in early)
    tot_growth = min(r[5] for r in late) - min(r[5] for r in early)
    print(f"memory from {base[0]:.0f} s to {end[0]:.0f} s: js heap {heap_growth:+.1f} MB; low points: renderers "
          f"{rend_growth:+.1f} MB, all chrome {tot_growth:+.1f} MB (limits {HEAP_LIMIT_MB:.0f} and {LIMIT_MB:.0f} MB; "
          f"the samples held would be {(end[1] - base[1]) * 44100 * 8 / 2**20:.0f} MB)")
    if heap_growth > HEAP_LIMIT_MB:
        failures.append(f"js heap grew {heap_growth:.1f} MB")
    if rend_growth > LIMIT_MB or tot_growth > LIMIT_MB:
        failures.append(f"process memory grew (renderers {rend_growth:.1f} MB, all {tot_growth:.1f} MB)")
    for e in errors:
        failures.append(f"page error: {e}")
    if failures:
        print("LONG TAKE FAILED")
        for f in failures:
            print(" -", f)
        return 1
    os.remove(path)
    print("LONG TAKE PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
