#!/usr/bin/env python3
"""The frame walk (P1): every tab and page, in both modes, at 360 x 640 and 412 x 915, with a screenshot
of each into shots/ (not committed). At every screen it checks the no-scroll rules of spec 8.6:

- the document does not scroll, and no tab body, page or sheet holds more than it shows;
- no control is cut off (outside the viewport or outside a clipping parent);
- no tile, chip, button, dial or pill has text that wraps, clips or overflows, or is drawn under 10 px;
- one row of sections, and the strip and transport bar directly above the tab bar, in the same place on every tab.

tools/smoke.py runs the same walk (without screenshots) while the transport plays.

Usage: python3 tools/shots.py [dist] [out_dir]    (builds first: npm run build)
Exits 1 on any failure.
"""
import os
import subprocess
import sys
import time

SIZES = [(360, 640), (412, 915)]
TABS = ["play", "chords", "drums", "bass", "synth", "layer1", "layer2", "mix"]
LAYER_MODES = ["generative", "arp", "pad"]

# Must match FIT_CONTROLS in src/ui/fit.ts.
CHECK = r"""() => {
  const bad = [];
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const se = document.scrollingElement;
  if (se.scrollHeight > vh + 1 || se.scrollWidth > vw + 1) bad.push(`document scrolls: ${se.scrollWidth}x${se.scrollHeight} in ${vw}x${vh}`);
  const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).trim().replace(/\s+/g, '.')} ${JSON.stringify(el.dataset)} "${(el.textContent || '').trim().slice(0, 24)}"`;
  const shown = (el) => el.getClientRects().length > 0;
  // Boxes that must hold what they contain (the saved-songs list is the one thing that scrolls).
  for (const el of document.querySelectorAll('html, body, #app, .shell, .body, .body section, .page, .sheet, .tabs, .hdr, .top, .secs')) {
    if (!shown(el)) continue;
    if (el.scrollHeight > el.clientHeight + 1) bad.push(`content does not fit: ${name(el)} ${el.scrollHeight} > ${el.clientHeight}`);
    const oy = getComputedStyle(el).overflowY;
    if (oy === 'auto' || oy === 'scroll') bad.push(`scrolls: ${name(el)}`);
  }
  // Controls: on screen, not clipped by a parent.
  const CONTROLS = 'button, a, input, [role=slider], [role=switch], [role=group], .pill, .dial, .send, .meter, .tile';
  for (const el of document.querySelectorAll(CONTROLS)) {
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) {
      bad.push(`control cut off by the screen: ${name(el)} at ${r.left.toFixed(0)},${r.top.toFixed(0)}..${r.right.toFixed(0)},${r.bottom.toFixed(0)}`);
      continue;
    }
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.closest('.songlist') && p.classList.contains('songlist')) break;
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const q = p.getBoundingClientRect();
      if (r.left < q.left - 0.5 || r.right > q.right + 0.5 || r.top < q.top - 0.5 || r.bottom > q.bottom + 0.5) {
        bad.push(`control cut off by ${name(p)}: ${name(el)}`);
        break;
      }
    }
  }
  // Text on every tile, chip, button, dial and pill: one line, inside its edge, at least 10 px.
  for (const c of document.querySelectorAll('button, .pill, .dial, .dial .val, .send, .meter, .tile, .sheet h2')) {
    if (!shown(c)) continue;
    const box = c.getBoundingClientRect();
    if (c.scrollWidth > c.clientWidth + 0.5) bad.push(`text overflows ${name(c)}: ${c.scrollWidth} > ${c.clientWidth}`);
    const tw = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim() || !shown(n.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((q) => q.width > 0);
      if (!rects.length) continue;
      const tops = new Set(rects.map((q) => Math.round(q.top)));
      if (tops.size > 1) bad.push(`text wraps in ${name(c)}: "${n.textContent.trim()}"`);
      const u = range.getBoundingClientRect();
      if (u.left < box.left - 0.5 || u.right > box.right + 0.5 || u.top < box.top - 0.5 || u.bottom > box.bottom + 0.5)
        bad.push(`text passes the edge of ${name(c)}: "${n.textContent.trim()}"`);
      const px = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (px < 9.99) bad.push(`text under 10 px (${px}) in ${name(c)}: "${n.textContent.trim()}"`);
    }
  }
  // The frame: one row of sections; strip, transport and tab bar stacked at the bottom.
  if (document.querySelectorAll('.secs').length !== 1) bad.push(`${document.querySelectorAll('.secs').length} section rows`);
  const strip = document.querySelector('.secs'), top = document.querySelector('.top'), tabs = document.querySelector('.tabs');
  const body = document.querySelector('.body'), hdr = document.querySelector('.hdr');
  if (strip && top && tabs && body && hdr) {
    const s = strip.getBoundingClientRect(), t = top.getBoundingClientRect(), b = tabs.getBoundingClientRect();
    const m = body.getBoundingClientRect(), h = hdr.getBoundingClientRect();
    if (!(h.bottom <= m.top + 0.5 && m.bottom <= s.top + 0.5 && s.bottom <= t.top + 0.5 && t.bottom <= b.top + 0.5))
      bad.push('frame order is not header, content, strip, transport, tab bar');
    if (t.top - s.bottom > 12 || b.top - t.bottom > 12) bad.push(`strip and transport are not directly above the tab bar (${(t.top - s.bottom).toFixed(0)}, ${(b.top - t.bottom).toFixed(0)} px apart)`);
    if (Math.abs(b.bottom - vh) > 1) bad.push(`tab bar is not at the bottom (${b.bottom} of ${vh})`);
  }
  return bad;
}"""

# Words Simple never shows (spec 8.1: plain words only): synth, generator and scale terms and abbreviations.
JARGON = ["Cutoff", "Resonance", "Euclid", "Envelope", "Env amt", "Filt env", "Attack", "Decay", "Release", "Sustain", "Hz",
          "Lock", "Hits", "Rotate", "Tension", "Density", "Detune", "Saw", "Tri", "4/4", "Filter", "DnB", "Saturate",
          "Major", "Minor", "Dorian", "Phrygian", "Degree"]

# Simple's visible words, line by line (the body, any sheet, the header and the transport), and any chord tile
# whose text is a lone digit 1 to 7: a scale degree by another name (P2 review E2, S4).
SIMPLE_TEXT = r"""() => {
  const lines = document.body.innerText.split('\n').map((t) => t.trim()).filter(Boolean);
  const degrees = [...document.querySelectorAll('.chordtab .degree, .chordtab .step')]
    .filter((el) => el.getClientRects().length && el.innerText.split('\n').some((t) => /^[1-7]$/.test(t.trim())))
    .map((el) => `${el.className} "${el.innerText.trim()}"`);
  return { lines, degrees };
}"""


def simple_words(page) -> list:
    """What on the screen Simple must not show: Advanced words, and chord tiles numbered as degrees."""
    got = page.evaluate(SIMPLE_TEXT)
    bad = [f"shows the word {w!r}" for w in JARGON if any(t == w or t.startswith(w + " ") for t in got["lines"])]
    return bad + [f"a chord tile shows a degree: {d}" for d in got["degrees"]]


# The strip's bottom and the transport bar's top (the Simple Play tab's strip is taller, upwards).
FRAME_Y = """() => [Math.round(document.querySelector('.secs').getBoundingClientRect().bottom), Math.round(document.querySelector('.top').getBoundingClientRect().top)]"""


def _settle(page) -> None:
    # Two frames: the render, then the text fit. Then every CSS transition ends (a chip's or mode button's wipe
    # takes 0.14 s), so a screenshot never catches one half done and shows a stray sliver (P2 review M8).
    page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    page.evaluate("""() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => null))),
      new Promise((r) => setTimeout(r, 500)),
    ])""")
    time.sleep(0.05)


class Walk:
    def __init__(self, page, failures: list, out_dir: str | None):
        self.page = page
        self.failures = failures
        self.out = out_dir
        self.count = 0
        self.frame_y: dict = {}

    def screen(self, size: tuple, label: str) -> None:
        _settle(self.page)
        where = f"{size[0]}x{size[1]} {label}"
        for b in self.page.evaluate(CHECK):
            self.failures.append(f"{where}: {b}")
        if label.startswith("simple"):
            for b in simple_words(self.page):
                self.failures.append(f"{where}: {b}")
        if self.out:
            self.page.screenshot(path=os.path.join(self.out, f"{size[0]}x{size[1]}-{label}.png"))
        self.count += 1

    def frame_check(self, size: tuple, label: str) -> None:
        y = tuple(self.page.evaluate(FRAME_Y))
        first = self.frame_y.setdefault(size, (y, label))
        if first[0] != y:
            self.failures.append(f"{size[0]}x{size[1]} {label}: strip and transport at y {y}, but {first[0]} on {first[1]}")

    def pages(self, size: tuple, label: str) -> None:
        keys = self.page.eval_on_selector_all(".body [data-page]", "els => els.map(e => e.dataset.page)")
        if not keys:
            self.screen(size, label)
            return
        for k in keys:
            self.page.click(f'[data-page="{k}"]')
            self.screen(size, f"{label}-{k.split(':')[1]}")
        self.page.click(f'[data-page="{keys[0]}"]')


def walk_frame(page, failures: list, out_dir: str | None = None) -> int:
    """Every tab and page, both modes, both sizes, with the song and every section renamed to the longest,
    widest names the app accepts (spec 8.6: user text fits too). Leaves the app in Simple on the Play tab at 390 x 844,
    with every layer back in the mode it had. Returns the number of screens checked."""
    w = Walk(page, failures, out_dir)
    sec = page.evaluate("window.__groovebox.position().section")
    # The longest names the app accepts, in wide letters: the engine cuts "W" * 64 to its own maximum, so
    # every section and the song carry the widest name they can (restored at the end).
    names = page.evaluate("(() => { const g = window.__groovebox.getSong(); return [g.name, ...g.sections.map(s => s.name)]; })()")
    page.evaluate("""(w) => { const e = window.__groovebox; e.renameSong(w);
      e.getSong().sections.forEach((_, i) => e.renameSection(i, w)); }""", "W" * 64)
    modes = {lid: page.evaluate(f"window.__groovebox.getSong().sections[{sec}].{lid}.mode") for lid in ["layer1", "layer2"]}
    for size in SIZES:
        page.set_viewport_size({"width": size[0], "height": size[1]})
        time.sleep(0.2)
        for mode in ["simple", "advanced"]:
            page.click(f'[data-appmode="{mode}"]')
            for tab in TABS:
                page.click(f'[data-tab="{tab}"]')
                label = f"{mode}-{tab}"
                w.frame_check(size, label)
                if tab in ("layer1", "layer2"):
                    for m in LAYER_MODES:
                        page.click(f'[data-mode="{tab}:{m}"]')
                        w.pages(size, f"{label}-{m}")
                    page.click(f'[data-mode="{tab}:{modes[tab]}"]')
                else:
                    w.pages(size, label)
            # The sheets: a held section, and Songs from the header.
            page.click('[data-tab="play"]')
            box = page.locator('[data-strip="0"]').bounding_box()
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.mouse.down()
            time.sleep(0.7)
            page.mouse.up()
            if page.locator("#section-close").count():
                w.screen(size, f"{mode}-section-sheet")
                page.click("#section-close")
            else:
                failures.append(f"{size}: holding a section did not open its sheet")
            page.click("#songs-open")
            w.screen(size, f"{mode}-songs-sheet")
            page.click("#songs-close")
    page.evaluate("""(n) => { const e = window.__groovebox; e.renameSong(n[0]);
      n.slice(1).forEach((s, i) => e.renameSection(i, s)); }""", names)
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    page.set_viewport_size({"width": 390, "height": 844})
    time.sleep(0.2)
    return w.count


def main() -> int:
    from playwright.sync_api import sync_playwright

    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    out = sys.argv[2] if len(sys.argv) > 2 else "shots"
    os.makedirs(out, exist_ok=True)
    port = 4181
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--directory", root],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(1)
    failures: list[str] = []
    try:
        with sync_playwright() as p:
            chrome = "/usr/bin/google-chrome"
            kwargs = {"executable_path": chrome} if os.path.exists(chrome) else {}
            browser = p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"], **kwargs)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(f"http://localhost:{port}/index.html")
            end = time.time() + 5
            while time.time() < end and not page.evaluate("!!window.__groovebox"):
                time.sleep(0.05)
            page.click("#play")
            time.sleep(0.5)
            page.click('[data-strip="1"]')  # Groove: every instrument on
            time.sleep(2.5)
            n = walk_frame(page, failures, out)
            failures += [f"page error: {e}" for e in errors]
            browser.close()
    finally:
        server.terminate()
    print(f"{n} screens saved to {out}/")
    if failures:
        print("SHOTS FAILED")
        for f in failures:
            print(" -", f)
        return 1
    print("SHOTS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
