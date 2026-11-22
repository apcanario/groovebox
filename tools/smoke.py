#!/usr/bin/env python3
"""Headless smoke test: serve a built folder, press Play, check that audio runs.

Usage: python3 tools/smoke.py dist [screenshot.png]
Exits 1 on any failure. Needs Python Playwright and Chrome or Chromium.
It checks that sound is produced and nothing throws. It cannot judge how it sounds.
"""
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

LAYERS = ["kick", "hats", "clap", "bass", "chords", "pad", "lead"]
PORT = 4179


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

            levels = []
            for _ in range(32):
                time.sleep(0.25)
                v = page.evaluate("window.__groovebox.level()")
                if v is not None and v > -200:
                    levels.append(v)
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
            page.click("#play")
            time.sleep(0.3)
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
