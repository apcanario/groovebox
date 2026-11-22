#!/usr/bin/env python3
"""Headless smoke test: serve a built folder, press Play, check that audio runs and switches land on the bar.

Usage: python3 tools/smoke.py dist [screenshot.png]
Exits 1 on any failure. Needs Python Playwright and Chrome or Chromium.
It checks that sound is produced and nothing throws. It cannot judge how it sounds.
"""
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

LAYERS = ["drums", "bass", "synth", "layer1", "layer2"]
PORT = 4179


def wait_for(page, expr: str, timeout: float) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if page.evaluate(expr):
            return True
        time.sleep(0.02)
    return False


def main() -> int:
    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    shot = sys.argv[2] if len(sys.argv) > 2 else None
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--directory", root],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)
    failures: list[str] = []
    errors: list[str] = []
    try:
        with sync_playwright() as p:
            chrome = "/usr/bin/google-chrome"
            kwargs = {"executable_path": chrome} if os.path.exists(chrome) else {}
            browser = p.chromium.launch(
                args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"], **kwargs
            )
            page = browser.new_page(viewport={"width": 390, "height": 844})
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on(
                "response",
                lambda r: errors.append(f"{r.status} {r.url}")
                if r.status >= 400 and "localhost" in r.url
                else None,
            )
            page.goto(f"http://localhost:{PORT}/index.html")
            page.click("#play")
            time.sleep(0.5)

            # Section B (Groove) has every instrument on. The switch waits for the bar line.
            page.click('[data-section="1"]')
            if page.evaluate("window.__groovebox.pending().section") != 1:
                failures.append("section switch was not queued")
            if not wait_for(page, "window.__groovebox.position().section === 1", 4.0):
                failures.append("section switch did not land")
            landed = page.evaluate("window.__groovebox.landed.slice(-1)[0]")
            if not landed or landed["pending"]["section"] != 1:
                failures.append("section switch did not land on a bar line")

            # Three toggles tapped inside one bar land on the same bar line.
            wait_for(page, "window.__groovebox.position().step === 1", 3.0)
            for inst in ["bass", "synth", "layer1"]:
                page.click(f'[data-inst="{inst}"]')
                time.sleep(0.05)
            n = page.evaluate("window.__groovebox.pending().toggles.length")
            if n != 3:
                failures.append(f"expected 3 pending toggles, got {n}")
            if not wait_for(page, "window.__groovebox.pending().toggles.length === 0", 4.0):
                failures.append("toggles did not land")
            last = page.evaluate("window.__groovebox.landed.slice(-1)[0]")
            got = sorted(t["instrument"] for t in last["pending"]["toggles"]) if last else []
            if got != ["bass", "layer1", "synth"]:
                failures.append(f"toggles did not land together: {got}")
            on = page.evaluate("window.__groovebox.getSong().sections[1].on")
            if on["bass"] or on["synth"] or on["layer1"]:
                failures.append("toggled instruments are still on")
            print(f"three toggles landed together on bar {last['bar'] + 1 if last else '?'}")
            # Turn them back on for the solos.
            for inst in ["bass", "synth", "layer1"]:
                page.click(f'[data-inst="{inst}"]')
            wait_for(page, "window.__groovebox.pending().toggles.length === 0", 4.0)

            levels = []
            peaks = []
            for _ in range(32):
                time.sleep(0.25)
                v = page.evaluate("window.__groovebox.level()")
                if v is not None and v > -200:
                    levels.append(v)
                pk = page.evaluate("window.__groovebox.peak()")
                if pk is not None and pk > -200:
                    peaks.append(pk)
            if not page.evaluate("window.__groovebox.playing"):
                failures.append("transport did not start")
            if not levels:
                failures.append("no output level measured")
            else:
                lo, hi = min(levels), max(levels)
                print(f"master level: {lo:.1f} to {hi:.1f} dB")
                if hi < -40:
                    failures.append(f"output too quiet ({hi:.1f} dB)")
                if hi > -3:
                    failures.append(f"output too hot before the limiter ({hi:.1f} dB)")
            # The meter is a smoothed RMS; the peak reads raw samples after the limiter.
            if not peaks:
                failures.append("no output peak measured")
            else:
                top = max(peaks)
                print(f"output peak: {top:.1f} dBFS")
                if top >= 0:
                    failures.append(f"output clips ({top:.1f} dBFS)")

            solo = "(keep)=>{const e=window.__groovebox;for(const l of %r)e.setLayer(l,keep===null||l===keep)}" % LAYERS
            for layer in LAYERS:
                page.evaluate(solo, layer)
                time.sleep(0.6)
                peak = -999.0
                for _ in range(16):
                    time.sleep(0.125)
                    v = page.evaluate("window.__groovebox.level()")
                    if v is not None:
                        peak = max(peak, v)
                print(f"  solo {layer}: {peak:.1f} dB")
                if peak < -60:
                    failures.append(f"layer {layer} is silent ({peak:.1f} dB)")
            page.evaluate(solo, None)

            if shot:
                page.screenshot(path=shot)
            # Stop just after a bar line: nothing scheduled in the lookahead may start after Stop.
            wait_for(page, "window.__groovebox.position().step === 0", 3.0)
            page.click("#play")
            at_stop = page.evaluate("window.__groovebox.attacks()")
            time.sleep(1.0)
            after = page.evaluate("window.__groovebox.attacks()")
            if after != at_stop:
                failures.append(f"{after - at_stop} attacks started after Stop")
            else:
                print("no attacks after Stop")
            if page.evaluate("window.__groovebox.playing"):
                failures.append("transport did not stop")
            browser.close()
    finally:
        server.terminate()

    for e in errors:
        failures.append(f"page error: {e}")
    if failures:
        print("SMOKE FAILED")
        for f in failures:
            print(" -", f)
        return 1
    print("SMOKE PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
