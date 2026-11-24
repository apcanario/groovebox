#!/usr/bin/env python3
"""P7: the smoke test's cost measure on its own, run `runs` times (7 by default): the default song's groove with
everything on. Reports the median, minimum and maximum of the audio load and of the worst stall. The measure is noisy
(P7 review M1: within three runs the load moved about 5 points and the worst stall 10 to 28 ms), so compare builds
over 7 runs or more, and only by differences larger than their min-max spread.

Usage: python3 tools/cost.py dist [runs] [extras|none]

To compare with the build before a row, build the base into its own dist first and run both:
    git worktree add /tmp/base <base-sha>
    (cd /tmp/base && npm ci && npx vite build --outDir /tmp/base-dist)
    python3 tools/cost.py /tmp/base-dist 7
    python3 tools/cost.py dist 7
    git worktree remove /tmp/base
A base from before P7 has no P7 additions: the scene then plays the base scene alone ("P7 additions absent").
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
    runs = int(sys.argv[2]) if len(sys.argv) > 2 else 7
    # Optional: which P7 additions to switch on (comma-separated: drums,fm,noise,lfo,drone,drift,air,reverb,lofi, or all),
    # "none" for the base scene alone; all of them by default. P9: add "fx" to switch on the effect
    # slots (six active under the cap), or "fx10" to lift the cap and play all ten ("all,fx10": everything on and all
    # ten slots; "all": everything on, every slot off).
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
                wait_for(page, "!!window.__groovebox && !!document.querySelector('.vibes')", 5.0)
                page.keyboard.press("Escape")
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
        print(f"{len(loads)} runs: audio load median {loads[len(loads) // 2]:.1f}% (min {loads[0]:.1f}, max {loads[-1]:.1f}), "
              f"worst stall median {worst[len(worst) // 2]:.2f} ms (min {worst[0]:.2f}, max {worst[-1]:.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
