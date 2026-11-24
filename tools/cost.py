#!/usr/bin/env python3
"""P7: the smoke test's cost measure on its own, run `runs` times (7 by default): the default song's groove with
everything on. Reports the median, minimum and maximum of the audio load and of the worst stall. The measure is noisy
(P7 review M1: within three runs the load moved about 5 points and the worst stall 10 to 28 ms), so compare builds
over 7 runs or more, and only by differences larger than their min-max spread.

Usage: python3 tools/cost.py dist [runs] [extras|none|vibes [id,id...]]

P8: "vibes" plays each of the vibes, each on a fresh page (P8 review S7: no tails of the vibe before), as a tap on its
tile loads it (its groove, its patches, its effect slots and mix), and reports each one's audio load and worst stall
over six seconds, the median of `runs` (3 by default here), and Ambient into Drone as its own row.

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
from smoke import FIRST_SONG, PORT, SONG, measure_cost, trace_audio, wait_for  # noqa: E402


def load_of(renders: list) -> tuple:
    """Audio load (%) and worst stall (ms) of traced render callbacks."""
    if len(renders) < 3:
        return float("nan"), float("nan")
    t0 = min(x["ts"] for x in renders)
    t1 = max(x["ts"] + x["dur"] for x in renders)
    return 100.0 * sum(x["dur"] for x in renders) / (t1 - t0), max(x["dur"] for x in renders) / 1000.0


def play_vibe(browser, page, v: dict) -> tuple:
    """A tap on the vibe's tile, its landing, then its audio load and worst stall over six seconds."""
    if not page.locator(".vibes").count():
        page.click("#new-jam")
        wait_for(page, "!!document.querySelector('.vibes')", 3.0)
    page.click(f'[data-vibe="{v["id"]}"]')
    wait_for(page, f"window.__groovebox.getSong().style === {v['id']!r} && window.__groovebox.playing", 10.0)
    time.sleep(3.0)  # the landing, its patches and its reverb built
    return load_of(trace_audio(browser, page, lambda: time.sleep(6.0)))


def fresh_page(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto(f"http://localhost:{PORT}/index.html")
    wait_for(page, "!!window.__groovebox && !!document.querySelector('.vibes')", 5.0)
    return page


def vibes(root: str, runs: int, only: list | None = None) -> int:
    """P8: each vibe's own cost, loaded from the picker on a fresh page and playing its groove. P8 review S7: one page
    for all of them measured each vibe with the previous one's tails still ringing (Drone after Ambient's 8 to 20 s
    releases: 73 to 78% against about 50% on its own), so each vibe now gets its own page. The one transition that
    rings that long, Ambient into Drone (what the vibe arrow does), is measured as its own row: Drone loaded 10 s
    after Ambient landed."""
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", root],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    rows = {}
    try:
        with sync_playwright() as p:
            chrome = "/usr/bin/google-chrome"
            kwargs = {"executable_path": chrome} if os.path.exists(chrome) else {}
            browser = p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"], **kwargs)
            for _ in range(runs):
                page = fresh_page(browser)
                listed = page.evaluate("window.__vibes")
                page.close()
                for v in listed:
                    if only and v["id"] not in only:
                        continue
                    page = fresh_page(browser)
                    load, worst = play_vibe(browser, page, v)
                    page.close()
                    rows.setdefault(v["name"], []).append((load, worst))
                    print(f"cost {v['name']}: audio load {load:.1f}%, worst stall {worst:.2f} ms", flush=True)
                by_id = {v["id"]: v for v in listed}
                if (not only or "drone" in only) and "ambient" in by_id and "drone" in by_id:
                    page = fresh_page(browser)
                    page.click('[data-vibe="ambient"]')
                    wait_for(page, "window.__groovebox.getSong().style === 'ambient' && window.__groovebox.playing", 10.0)
                    time.sleep(10.0)  # Ambient's pads at full swell
                    load, worst = play_vibe(browser, page, by_id["drone"])
                    page.close()
                    rows.setdefault("Ambient > Drone", []).append((load, worst))
                    print(f"cost Ambient > Drone: audio load {load:.1f}%, worst stall {worst:.2f} ms", flush=True)
            browser.close()
    finally:
        server.terminate()
    print("vibe, median audio load %, worst stall ms (median), over", runs, "runs, each vibe on a fresh page")
    for name, r in rows.items():
        loads = sorted(x[0] for x in r)
        worst = sorted(x[1] for x in r)
        print(f"{name:16} {loads[len(loads) // 2]:5.1f}  (min {loads[0]:.1f}, max {loads[-1]:.1f})  {worst[len(worst) // 2]:6.2f}")
    return 0


def main() -> int:
    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    if len(sys.argv) > 3 and sys.argv[3] == "vibes":
        return vibes(root, int(sys.argv[2]), sys.argv[4].split(",") if len(sys.argv) > 4 else None)
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
