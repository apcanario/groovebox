#!/usr/bin/env python3
"""Headless smoke test: serve a built folder, press Play, check that audio runs and switches land on the bar,
then walk the shell (every tab, section strip, Play grid, chords, XY pad, dials, section menu) with no page error
and no control under 48 px.

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
TABS = ["play", "chords", "drums", "bass", "synth", "layer1", "layer2", "mix"]

# Every visible control, with its size; anything under 48 px on either side is a failure.
SMALL = """() => {
  const bad = [];
  for (const el of document.querySelectorAll('button, a, input, [role=slider], [role=switch], [role=group]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.width < 47.5 || r.height < 47.5)
      bad.push(`${el.tagName.toLowerCase()}.${el.className} ${JSON.stringify(el.dataset)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
  }
  return bad;
}"""

# Controls whose right edge passes the viewport (clipped, or reachable only by a sideways swipe),
# and labels wider than their own button.
OFF_SCREEN = """() => {
  const bad = [];
  const w = document.documentElement.clientWidth;
  for (const el of document.querySelectorAll('button, a, input, [role=slider], [role=switch], [role=group]')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right > w + 0.5 || r.left < -0.5)
      bad.push(`${el.tagName.toLowerCase()}.${el.className} ${JSON.stringify(el.dataset)} at x ${r.left.toFixed(0)}..${r.right.toFixed(0)} of ${w}`);
  }
  for (const el of document.querySelectorAll('.tab, .pill')) {
    if (el.scrollWidth > el.clientWidth + 1)
      bad.push(`label overflows ${el.className} ${JSON.stringify(el.dataset)}: ${el.scrollWidth} > ${el.clientWidth}`);
  }
  return bad;
}"""

SONG = "window.__groovebox.getSong()"


def drag(page, selector: str, dx: float, dy: float, hold: float = 0.0) -> None:
    """Press in the middle of an element, move by (dx, dy) in steps, release."""
    box = page.locator(selector).bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    if hold:
        time.sleep(hold)
    for i in range(1, 11):
        page.mouse.move(x + dx * i / 10, y + dy * i / 10)
    page.mouse.up()


def check_sizes(page, where: str, failures: list) -> None:
    for b in page.evaluate(SMALL):
        failures.append(f"control under 48 px on {where}: {b}")
    for b in page.evaluate(OFF_SCREEN):
        failures.append(f"control off screen on {where}: {b}")


def narrow_pass(page, failures: list, width: int = 360, height: int = 740) -> None:
    """The smallest phone the spec plays on: every tab again, every control 48 px and on screen."""
    page.set_viewport_size({"width": width, "height": height})
    time.sleep(0.2)
    for tab in TABS:
        page.click(f'[data-tab="{tab}"]')
        time.sleep(0.15)
        check_sizes(page, f"tab {tab} at {width} px", failures)
    page.click('[data-tab="play"]')
    page.set_viewport_size({"width": 390, "height": 844})
    print(f"all {len(TABS)} tabs checked at {width} x {height}")


def walk_shell(page, failures: list) -> None:
    """The G2 shell, played with the mouse as one thumb would, while the transport runs."""
    for tab in TABS:
        page.click(f'[data-tab="{tab}"]')
        time.sleep(0.15)
        if not page.locator(".body section").count():
            failures.append(f"tab {tab} shows nothing")
        check_sizes(page, f"tab {tab}", failures)
    print(f"opened all {len(TABS)} tabs")

    # Chords, following the playing section (B): add a chord, replace one, change length, move, remove.
    playing = page.evaluate("window.__groovebox.position().section")
    page.click('[data-tab="chords"]')
    before = page.evaluate(f"{SONG}.sections[{playing}].chords")
    page.click('[data-degree="3"]')
    after = page.evaluate(f"{SONG}.sections[{playing}].chords")
    if len(after) != len(before) + 1 or after[-1]["degree"] != 3:
        failures.append(f"adding a chord failed: {before} -> {after}")
    page.click('[data-seq="0"]')
    check_sizes(page, "chords with a chord selected", failures)
    page.click('[data-degree="4"]')
    page.click("#chord-length")
    seq = page.evaluate(f"{SONG}.sections[{playing}].chords")
    if seq[0] != {"degree": 4, "bars": 2}:
        failures.append(f"replacing a chord or its length failed: {seq[0]}")
    page.click("#chord-right")
    page.click("#chord-remove")
    seq2 = page.evaluate(f"{SONG}.sections[{playing}].chords")
    if len(seq2) != len(seq) - 1 or seq2[0] != seq[1]:
        failures.append(f"move and remove failed: {seq} -> {seq2}")
    page.click('[data-mood="deep"]')
    page.click('[data-key="D"]')
    song = page.evaluate(SONG)
    if song["mood"] != "deep" or song["key"] != "D":
        failures.append("mood or key did not change")
    page.click('[data-mood="house"]')
    page.click('[data-key="A"]')
    print(f"chords edited in section {playing}: {[c['degree'] for c in seq2]}")

    # Section strip: edit section C silently while B plays.
    page.click('[data-strip="2"]')
    head = page.inner_text(".chordtab .head")
    if "Break" not in head:
        failures.append(f"strip did not select section C for editing: {head!r}")
    page.click('[data-degree="1"]')
    if page.evaluate(f"{SONG}.sections[2].chords.slice(-1)[0].degree") != 1:
        failures.append("chord edit did not reach the edited section")
    if page.evaluate("window.__groovebox.position().section") != playing:
        failures.append("editing another section changed the playing one")

    # Instrument tab on the edited (not playing) section: on/off acts at once; the XY pad moves the filter.
    page.click('[data-tab="synth"]')
    was = page.evaluate(f"{SONG}.sections[2].on.synth")
    page.click('[data-toggle="synth"]')
    if page.evaluate(f"{SONG}.sections[2].on.synth") == was:
        failures.append("instrument toggle on a silent section did not act at once")
    page.click('[data-toggle="synth"]')
    cut = page.evaluate(f"{SONG}.patches.synth.cutoff")
    drag(page, '[data-xy="synth"]', -80, 40)
    p = page.evaluate(f"{SONG}.patches.synth")
    if abs(p["cutoff"] - cut) < 0.05:
        failures.append("XY pad did not move the synth cutoff")
    drag(page, '[data-send="reverb"]', 30, 0)
    print(f"synth cutoff {cut:.2f} -> {p['cutoff']:.2f}, resonance {p['resonance']:.2f}")
    page.click('[data-strip="1"]')  # back to following

    # Mix dial: vertical drag.
    page.click('[data-tab="mix"]')
    drag(page, '[data-dial="sweep"]', 0, 60)
    sweep = page.evaluate("window.__groovebox.getMix().sweep")
    if sweep > -0.2:
        failures.append(f"dragging the filter dial down did not sweep low-pass ({sweep:.2f})")
    drag(page, '[data-dial="sweep"]', 0, -60)
    sweep = page.evaluate("window.__groovebox.getMix().sweep")
    if abs(sweep) > 0.02:
        failures.append(f"filter dial did not come back to open ({sweep:.2f})")

    # Buffer choice reloads and resets the song: refused while playing.
    for h in ["interactive", "playback"]:
        if not page.locator(f'[data-hint="{h}"]').is_disabled():
            failures.append(f"buffer choice {h} is not disabled while playing")

    # Tempo: drag up on the bpm pill.
    bpm = page.evaluate(f"{SONG}.bpm")
    drag(page, "#bpm", 0, -40)
    bpm2 = page.evaluate(f"{SONG}.bpm")
    if bpm2 <= bpm:
        failures.append(f"bpm drag did nothing ({bpm} -> {bpm2})")
    drag(page, "#bpm", 0, 40)

    # Section menu: long-press a column header, rename, delete, add back.
    page.click('[data-tab="play"]')
    drag(page, '[data-col="3"]', 0, 0, hold=0.8)
    if not page.locator("#section-name").count():
        failures.append("long-press on a column header did not open the section menu")
        return
    check_sizes(page, "section menu", failures)
    page.fill("#section-name", "Drop")
    page.click("#section-rename")
    if page.evaluate(f"{SONG}.sections[3].name") != "Drop":
        failures.append("rename failed")
    if page.evaluate("window.__groovebox.pending().section") is not None:
        failures.append("a long-press also switched section")
    drag(page, '[data-col="3"]', 0, 0, hold=0.8)
    page.click("#section-delete")
    n = page.evaluate(f"{SONG}.sections.length")
    if n != 3:
        failures.append(f"delete failed: {n} sections")
    page.click("#add-section")
    n = page.evaluate(f"{SONG}.sections.length")
    if n != 4 or page.locator('[data-col="3"]').count() != 1:
        failures.append(f"add section failed: {n} sections")
    print("section menu: rename, delete, add")

    # Copy section A while B plays: B moves to index 2, and positions scheduled before the copy
    # (carrying the old index) must still name Groove once drawn.
    drag(page, '[data-col="3"]', 0, 0, hold=0.8)
    page.click("#section-delete")
    drag(page, '[data-col="0"]', 0, 0, hold=0.8)
    page.click("#section-copy")
    names = page.evaluate(f"{SONG}.sections.map(s => s.name)")
    if len(names) != 4 or names[1] != names[0] + " 2":
        failures.append(f"copy did not land right after its source: {names}")
    bad = []
    for _ in range(20):
        sec = page.evaluate("window.__groovebox.position().section")
        name = page.evaluate(f"{SONG}.sections[window.__groovebox.position().section].name")
        if name != "Groove":
            bad.append((sec, name))
        time.sleep(0.03)
    if bad:
        failures.append(f"after a copy the playing position named another section: {bad[:3]}")
    if "playing" not in page.inner_text('[data-strip="2"]').lower():
        failures.append(f"section strip lost the playing section after a copy: {[page.inner_text(f'[data-strip="{i}"]') for i in range(4)]}")
    print(f"copied section A while Groove plays: {names}")


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
            page.click('[data-col="1"]')
            if "pending" not in (page.get_attribute('[data-col="1"]', "class") or ""):
                failures.append("queued section is not shown as pending")
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
                page.click(f'[data-cell="1:{inst}"]')
                time.sleep(0.05)
            if "pending" not in (page.get_attribute('[data-cell="1:bass"]', "class") or ""):
                failures.append("queued toggle is not shown as pending")
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
                page.click(f'[data-cell="1:{inst}"]')
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

            walk_shell(page, failures)
            narrow_pass(page, failures)
            if not page.evaluate("window.__groovebox.playing"):
                failures.append("the transport stopped during the shell walk")

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
