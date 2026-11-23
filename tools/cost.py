#!/usr/bin/env python3
"""P7: the smoke test's cost measure on its own, run `runs` times: the default song's groove with everything on.

Usage: python3 tools/cost.py dist [runs]
"""
import os
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from smoke import FIRST_SONG, PORT, SONG, measure_cost, wait_for  # noqa: E402


def main() -> int:
    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    runs = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    # Optional: which P7 additions to switch on (comma-separated: drums,fm,noise,lfo,drone,drift,air,reverb,lofi),
    # "none" for the base scene alone; all of them by default.
    extras = True if len(sys.argv) <= 3 else (False if sys.argv[3] == "none" else sys.argv[3].split(","))
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", root],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    out = []
    try:
        with sync_playwright() as p:
            chrome = "/usr/bin/google-chrome"
            kwargs = {"executable_path": chrome} if os.path.exists(chrome) else {}
            browser = p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"], **kwargs)
            for _ in range(runs):
                page = browser.new_page(viewport={"width": 390, "height": 844})
                page.goto(f"http://localhost:{PORT}/index.html")
                wait_for(page, "!!window.__groovebox", 5.0)
                page.click("#vibe-close")
                FIRST_SONG[:] = [page.evaluate(SONG)]
                page.click("#play")
                page.evaluate("window.__groovebox.switchSection(1)")
                wait_for(page, "window.__groovebox.position().section === 1", 4.0)
                out.append(measure_cost(browser, page, "everything on" if extras is True else f"extras {extras}", extras))
                page.close()
            browser.close()
    finally:
        server.terminate()
    loads = sorted(o["load"] for o in out if "load" in o)
    worst = sorted(o["worst_ms"] for o in out if "worst_ms" in o)
    if loads:
        print(f"median of {len(loads)}: audio load {loads[len(loads) // 2]:.1f}%, worst stall {worst[len(worst) // 2]:.2f} ms (max {worst[-1]:.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
