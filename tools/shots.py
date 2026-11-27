#!/usr/bin/env python3
"""The frame walk (P1): every tab and page, in both modes, at 360 x 640 and 412 x 915, with a screenshot
of each into shots/ (not committed). At every screen it checks the no-scroll rules of spec 8.6:

- the document does not scroll, and no tab body, page or sheet holds more than it shows;
- no control is cut off (outside the viewport or outside a clipping parent);
- no tile, chip, button, dial or pill has text that wraps, clips or overflows, or is drawn under 10 px;
- one row of sections, and the strip and transport bar directly above the tab bar, in the same place on every tab;
- no control under 48 px on either side (SMALL, shared with tools/smoke.py).

Screenshots left from an earlier run are deleted first, so shots/ holds only the current build.

After the walk, the live walk (P10c M5) loads Ambient and saves, at both sizes, Morph on, the Morph page with Sections
off and on, the Drop page and DROP in build, on and wind-down (LIVE_SCREENS); a missing one fails the run.

T1: the tablet walk (walk_tablet) saves six tablet sizes in both modes: the desk at 1280 x 800, 1024 x 768 and 880 x 620
and the dock at 800 x 1280, 768 x 1024 and 600 x 960, every rail panel and page, with the same checks and the layout's own (DESK,
DOCK); the smoke's core part runs it too, without screenshots.

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
LAYER_MODES = ["generative", "arp", "pad", "drone"]
# Lead styles the frame walk shows (P6): all five, Pulse with its own page.
LEAD_WALK = ["hook", "phrase", "roll", "drift", "pulse"]

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
      // A fixed layer (a sheet's shade, such as the effect picker's, made inside a page) is laid over the screen:
      // the boxes it sits in do not clip it.
      if (cs.position === 'fixed') break;
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


# Bundle 7b player (C26): on every tab, every page chip's label sits inside the chip's padding (the CHECK allows 0.5 px
# past the edge, unchanged); the Mix tab's row also at one text size (MIX_CHIPS below).
PAGE_CHIPS = r"""() => {
  const bad = [];
  for (const c of [...document.querySelectorAll('.pager button')].filter((c) => c.getClientRects().length)) {
    const cs = getComputedStyle(c), r = c.getBoundingClientRect();
    const inL = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const inR = r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
    for (const s of c.querySelectorAll('span')) {
      const range = document.createRange();
      range.selectNodeContents(s);
      const t = range.getBoundingClientRect();
      if (t.width && (t.left < inL || t.right > inR))
        bad.push(`page chip "${s.textContent.trim()}" is closer than its padding to the chip edge (${(t.left - inL).toFixed(1)} px left, ${(inR - t.right).toFixed(1)} px right)`);
    }
  }
  return bad;
}"""


# P10c S1 (C23): the Mix tab's page chips. Every label sits inside its chip's padding (not on the border: the CHECK
# above allows 0.5 px past the edge, unchanged), and the whole row draws at one text size.
MIX_CHIPS = r"""() => {
  const bad = [];
  const chips = [...document.querySelectorAll('.mixtab .pager button')].filter((c) => c.getClientRects().length);
  const sizes = new Map();
  for (const c of chips) {
    const cs = getComputedStyle(c), r = c.getBoundingClientRect();
    const inL = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const inR = r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
    for (const s of c.querySelectorAll('span')) {
      const range = document.createRange();
      range.selectNodeContents(s);
      const t = range.getBoundingClientRect();
      if (!t.width) continue;
      const word = s.textContent.trim();
      sizes.set(word, getComputedStyle(s).fontSize);
      if (t.left < inL || t.right > inR)
        bad.push(`Mix chip label "${word}" is closer than its padding to the chip edge (${(t.left - inL).toFixed(1)} px left, ${(inR - t.right).toFixed(1)} px right)`);
    }
  }
  if (new Set(sizes.values()).size > 1) bad.push(`Mix chips at more than one text size: ${[...sizes].map(([w, s]) => w + ' ' + s).join(', ')}`);
  return bad;
}"""

# P10c M4 (C23): on the Simple Mix tab's Master page the Morph speed dial shares its row with another dial.
MORPH_SPEED_ROW = r"""() => {
  const m = document.querySelector('.mixtab [data-dial="morphSpeed"]');
  if (!m) return ['no Morph speed dial on the Simple Mix Master page'];
  const top = m.getBoundingClientRect().top;
  const others = [...document.querySelectorAll('.mixtab .dial')].filter((d) => d !== m && Math.abs(d.getBoundingClientRect().top - top) < 1);
  return others.length ? [] : ['the Morph speed dial sits alone on its row of the Simple Mix Master page'];
}"""


# P10d (C23 M1): where DROP and Morph sit on the Play tab, and what is around them. The tab's content (the grid or the
# vibe control) starts under the header, its bottom (the grid or the lanes) sits on DROP's row, and DROP's row on the strip.
PLAY_PLACE = r"""() => {
  const r = (s) => { const e = document.querySelector(s); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; };
  const d = r('#drop'), m = r('#morph'), hdr = r('.hdr'), secs = r('.secs');
  const top = r('.playtab .grid') || r('.playtab .vibectl'), low = r('.playtab .grid') || r('.playtab .nowlist');
  if (!d || !m || !hdr || !secs || !top || !low) return null;
  return { drop: d.top, morph: m.top, dropBottom: d.bottom, hdr: hdr.bottom, first: top.top, last: low.bottom, strip: secs.top };
}"""


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
        self.chips = 0
        self.frame_y: dict = {}
        self.place: dict = {}

    def screen(self, size: tuple, label: str) -> None:
        _settle(self.page)
        where = f"{size[0]}x{size[1]} {label}"
        for b in self.page.evaluate(CHECK):
            self.failures.append(f"{where}: {b}")
        for b in self.page.evaluate(SMALL):
            self.failures.append(f"{where}: control under 48 px: {b}")
        if label.startswith("simple"):
            for b in simple_words(self.page):
                self.failures.append(f"{where}: {b}")
        for b in self.page.evaluate(PAGE_CHIPS):
            self.failures.append(f"{where}: {b}")
        if "-mix" in label:
            for b in self.page.evaluate(MIX_CHIPS):
                self.failures.append(f"{where}: {b}")
        if label == "simple-mix-master":
            for b in self.page.evaluate(MORPH_SPEED_ROW):
                self.failures.append(f"{where}: {b}")
        if self.out:
            self.page.screenshot(path=os.path.join(self.out, f"{size[0]}x{size[1]}-{label}.png"))
        self.count += 1
        self.chip_pages(size, label)

    def chip_pages(self, size: tuple, label: str) -> None:
        """P8 (spec 8.7: every name fits its tile): a picker that pages its chips behind More is turned through every
        page, back to the first, and each page's text checked, so every beat, rhythm and patch name is drawn once."""
        names = self.page.eval_on_selector_all("[data-more]", "els => els.filter(e => e.getClientRects().length).map(e => e.dataset.more)")
        for name in names:
            sel = f'[data-more="{name}"]'
            pages = int((self.page.get_attribute(sel, "data-page-of") or "1/1").split("/")[1])
            for _ in range(pages):
                self.page.click(sel)
                _settle(self.page)
                for b in self.page.evaluate(CHECK):
                    self.failures.append(f"{size[0]}x{size[1]} {label} {name} page {self.page.get_attribute(sel, 'data-page-of')}: {b}")
                self.chips += 1

    def play_place(self, size: tuple, label: str) -> None:
        """P10d: DROP's and Morph's top edges are the same in Simple and Advanced and on every visit to the Play tab at
        this size, and there is no empty band on the tab: its content starts under the header (the body's padding) and
        reaches down to DROP's row (the gap between groups), and DROP's row sits on the strip."""
        _settle(self.page)
        where = f"{size[0]}x{size[1]} {label}"
        f = self.page.evaluate(PLAY_PLACE)
        if not f:
            self.failures.append(f"{where}: no DROP and Morph on the Play tab")
            return
        first = self.place.setdefault(size, (f, label))
        for k, name in (("drop", "DROP"), ("morph", "Morph")):
            if abs(f[k] - first[0][k]) > 0.5:
                self.failures.append(f"{where}: {name}'s top edge is at {f[k]:.1f} px, but at {first[0][k]:.1f} px on {first[1]}")
        if f["first"] - f["hdr"] > 8.5:
            self.failures.append(f"{where}: an empty band of {f['first'] - f['hdr']:.0f} px between the header and the Play tab's content")
        if not 0 <= f["drop"] - f["last"] <= 10.5:
            self.failures.append(f"{where}: {f['drop'] - f['last']:.0f} px between the grid or the lanes and DROP (0 to 10)")
        if abs(f["strip"] - f["dropBottom"]) > 0.5:
            self.failures.append(f"{where}: DROP's row is not on the strip ({f['strip'] - f['dropBottom']:.0f} px between them)")

    def frame_check(self, size: tuple, label: str) -> None:
        y = tuple(self.page.evaluate(FRAME_Y))
        first = self.frame_y.setdefault(size, (y, label))
        if first[0] != y:
            self.failures.append(f"{size[0]}x{size[1]} {label}: strip and transport at y {y}, but {first[0]} on {first[1]}")

    def lead_values(self, size: tuple, sec: int, lid: str) -> None:
        """P6: every word a lead dial can show (each Shape, Register at low, middle and high, each Phrase) fits its
        dial on the Notes and Feel pages; the knobs go back to what they were."""
        keys = ["shape", "register", "range", "phrase"]
        saved = self.page.evaluate(f"(() => {{ const g = window.__groovebox.getSong().sections[{sec}].{lid}.gen; return {keys!r}.map(k => g[k] ?? null); }})()")
        shapes = self.page.evaluate("window.__groovebox.leadLists().shapes")  # read from the app, never copied (P6 review M6)
        tries = [("notes", {"shape": sh, "register": reg, "range": 1}) for sh in shapes for reg in (0.1, 0.5, 0.9)]
        tries += [("feel", {"phrase": ph}) for ph in (1, 2, 4, 8)]
        for pg, vals in tries:
            self.page.click(f'[data-page="{lid}:{pg}"]')
            self.page.evaluate(f"(v) => window.__groovebox.setGen({sec}, '{lid}', v)", vals)
            _settle(self.page)
            for b in self.page.evaluate(CHECK):
                self.failures.append(f"{size[0]}x{size[1]} {lid} lead {vals}: {b}")
        self.page.evaluate(f"(v) => window.__groovebox.setGen({sec}, '{lid}', Object.fromEntries({keys!r}.map((k, i) => [k, v[i]])))", saved)
        self.page.click(f'[data-page="{lid}:notes"]')

    def pages(self, size: tuple, label: str) -> None:
        keys = self.page.eval_on_selector_all(".body [data-page]", "els => els.map(e => e.dataset.page)")
        if not keys:
            self.screen(size, label)
            return
        for k in keys:
            self.page.click(f'[data-page="{k}"]')
            self.screen(size, f"{label}-{k.split(':')[1]}")
        self.page.click(f'[data-page="{keys[0]}"]')


def close_picker(page) -> None:
    """The vibe picker opens the app (P3): close it, keeping the song that opened."""
    page.wait_for_selector(".vibes", timeout=5000)
    page.keyboard.press("Escape")  # C9: the picker has no Close; Escape keeps the song that opened


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
                        if m == "generative":
                            # P6: Lead in every style (Notes and Feel pages), Pulse with its own page too.
                            style = page.evaluate(f"window.__groovebox.getSong().sections[{sec}].{tab}.gen.style ?? null")
                            for st in LEAD_WALK:
                                page.click(f'[data-leadstyle="{st}"]')
                                w.pages(size, f"{label}-{m}-{st}")
                            if mode == "advanced":
                                w.lead_values(size, sec, tab)
                            page.evaluate(f"(s) => window.__groovebox.setGen({sec}, '{tab}', {{style: s}})", style)
                        else:
                            w.pages(size, f"{label}-{m}")
                    page.click(f'[data-mode="{tab}:{modes[tab]}"]')
                else:
                    w.pages(size, label)
                if tab == "play":
                    w.play_place(size, label)
                if mode == "simple" and tab == "chords":
                    # P4: the vibe picker borrowing chords, from the title's vibe button.
                    page.click("#chord-vibe")
                    w.screen(size, "simple-chords-borrow")
                    page.keyboard.press("Escape")
            if mode == "advanced":
                # P9 review M8: the effect picker sheet, from the Drums FX page (closed by picking what was there).
                page.click('[data-tab="drums"]')
                page.click('[data-page="drums:fx"]')
                page.click('[data-fxslot="drums:0"]')
                cur = page.evaluate("window.__groovebox.getFx().drums[0].effect")
                page.click('[data-fxpick="drums:0"]')
                if page.locator("[data-fxeffect]").count():
                    w.screen(size, "advanced-fx-picker")
                    page.click(f'[data-fxeffect="{cur}"]')
                else:
                    failures.append(f"{size}: the effect picker did not open")
            # The sheets: a held section, and Songs from the header.
            page.click('[data-tab="play"]')
            # P10d: back on the Play tab after every other tab and page, DROP and Morph are where they were.
            w.play_place(size, f"{mode}-play-after-every-tab")
            box = page.locator('[data-strip="0"]').bounding_box()
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            page.mouse.down()
            # C26 (bundle 7b player): hold until the sheet opens (the long-press timer is 500 ms), at most 3 s, rather
            # than a fixed 0.7 s, which a busy machine's late timer could beat (failed once at 412 x 915).
            _wait(page, "!!document.querySelector('#section-close')", 3.0)
            page.mouse.up()
            if page.locator("#section-close").count():
                w.screen(size, f"{mode}-section-sheet")
                page.click("#section-close")
            else:
                failures.append(f"{size}: holding a section did not open its sheet")
            page.click("#songs-open")
            w.screen(size, f"{mode}-songs-sheet")
            page.click("#songs-close")
            # P3: the vibe picker, from New jam in the header (it opens the app too).
            page.click("#new-jam")
            w.screen(size, f"{mode}-vibe-picker")
            page.keyboard.press("Escape")
    page.evaluate("""(n) => { const e = window.__groovebox; e.renameSong(n[0]);
      n.slice(1).forEach((s, i) => e.renameSection(i, s)); }""", names)
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    page.set_viewport_size({"width": 390, "height": 844})
    time.sleep(0.2)
    # P8 review M2: the paged pickers were really turned. Advanced shows the beat, bass rhythm and synth rhythm
    # pickers at each size, each paged four names and More at a time (the beats alone 7 pages); if the More chip's
    # mark changed, the walk would check first pages only and pass, so the pages turned must reach that sum.
    data = page.evaluate("window.__data")
    least = len(SIZES) * sum(-(-len(data[k]) // 4) for k in ("beats", "bass", "synth"))
    if w.chips < least:
        failures.append(f"the frame walk turned {w.chips} picker pages, expected at least {least} (beats, bass and synth rhythms at each size)")
    print(f"frame walk: {w.chips} picker pages turned (at least {least})")
    return w.count


E = "window.__groovebox"
# P10c M5 (C23): the live states the frame walk cannot reach without a vibe, each saved at both sizes. Morph on
# (Ambient opens with it on), the Morph page with Sections off and on, and DROP in its three states.
LIVE_DROP = ["build", "on", "wind"]
LIVE_SCREENS = (
    [f"{m}-play-ambient-morph-on" for m in ("simple", "advanced")]
    + ["advanced-mix-morph-ambient-sections-off", "advanced-mix-morph-ambient-sections-on", "advanced-mix-drop-ambient"]
    + [f"{m}-play-ambient-drop-{s}" for s in LIVE_DROP for m in ("simple", "advanced")]
)


def _wait(page, expr: str, timeout: float) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if page.evaluate(expr):
            return True
        time.sleep(0.05)
    return False


# P10d: the Play button, sampled on every animation frame for `seconds` from just after a tap: what it shows (its label
# and its lit class) and the transport's state.
PLAY_SAMPLES = r"""(ms) => new Promise((done) => {
  const out = [], end = performance.now() + ms;
  const look = () => { const b = document.querySelector('#play');
    out.push([b.getAttribute('aria-label'), b.classList.contains('on'), window.__groovebox.playing]);
    if (performance.now() < end) requestAnimationFrame(look); else done(out); };
  look();
})"""


def sample_play(page, failures: list, where: str, want: bool, seconds: float | None = None) -> None:
    """P10d: tap the Play button and watch it for 2 s (Play) or 1 s (Stop). From the first frame the transport is in the
    state the tap asked for (on a first tap the audio starts first), every frame must show it (Stop while it plays, Play
    while it is stopped), and the transport must still be in that state at the end. From the first frame the button shows
    the asked word, it must keep it (review M2)."""
    page.click("#play")
    got = page.evaluate(PLAY_SAMPLES, int(1000 * (seconds or (2.0 if want else 1.0))))
    word = "Stop" if want else "Play"
    first = next((i for i, g in enumerate(got) if g[2] == want), len(got))
    wrong = [g for g in got[first:] if g[0] != word or g[1] != want or g[2] != want]
    if wrong:
        failures.append(f"{where}: after the tap the Play button showed {wrong[0][0]!r} (lit {wrong[0][1]}, transport running "
                        f"{wrong[0][2]}) in {len(wrong)} of {len(got)} frames; it must show {word!r} throughout")
    if not got or got[-1][2] != want:
        failures.append(f"{where}: the transport is not {'running' if want else 'stopped'} after the tap")
    # P10d review M2: and once the button first shows the asked word, it never goes back, whatever the transport is
    # doing (the audio starting on a first tap, the transport's 50 ms start). Before that first show, the button may
    # still read the other word: dimmed while the audio starts on a first tap.
    shown = next((i for i, g in enumerate(got) if g[0] == word), None)
    if shown is None:
        failures.append(f"{where}: after the tap the Play button never showed {word!r} in {len(got)} frames")
    else:
        back = [g for g in got[shown:] if g[0] != word or g[1] != want]
        if back:
            failures.append(f"{where}: the Play button showed {word!r}, then {back[0][0]!r} (lit {back[0][1]}) in {len(back)} "
                            f"of {len(got) - shown} later frames; once it shows {word!r} it must keep it")


def walk_play_button(page, failures: list, label: str) -> None:
    """P10d: in Simple and Advanced, Stop then Play sampled, then a Stop tapped during a drop's build and Play again. Leaves
    the transport running, in Simple, on the Play tab."""
    if not page.evaluate(f"{E}.playing"):
        sample_play(page, failures, f"{label}: Play", True)
    bar_s = 240.0 / page.evaluate(f"{E}.bpm")
    for mode in ("simple", "advanced"):
        page.click(f'[data-appmode="{mode}"]')
        page.click('[data-tab="play"]')
        where = f"{label} {mode}"
        sample_play(page, failures, f"{where}: Stop", False)
        sample_play(page, failures, f"{where}: Play", True)
        page.click("#drop")
        if not _wait(page, f"{E}.dropShown().phase === 'build'", bar_s * 2 + 2):
            failures.append(f"{where}: DROP never reached its build")
        sample_play(page, failures, f"{where}: Stop during the drop", False)
        sample_play(page, failures, f"{where}: Play after the drop", True)
    page.click('[data-appmode="simple"]')


def walk_live(page, failures: list, out_dir: str | None) -> int:
    """Ambient playing, at both sizes: Morph on in Simple and Advanced Play, the Morph page with Sections off and on
    (P10c M3: its help text says what is true in each), the Drop page, and DROP in build, on and wind-down. Each screen
    gets the frame walk's checks; a screen whose DROP state is not the one named is a failure, and so is a missing
    screenshot. Returns the number of screens checked."""
    w = Walk(page, failures, out_dir)
    page.evaluate(f"(id) => {E}.loadAtBar(window.__vibeSong(id), 1)", "ambient")
    if not _wait(page, f"{E}.getSong().style === 'ambient'", 10.0):
        failures.append("live walk: Ambient did not load")
        return 0
    if not page.evaluate(f"{E}.playing"):
        page.click("#play")
    if not _wait(page, f"{E}.morphPlan().on", 5.0):
        failures.append("live walk: Morph is not on in Ambient")
    bar_s = 240.0 / page.evaluate(f"{E}.bpm")
    # Four bars each way, so every screen of a state is taken well inside it (Ambient plays at 64 bpm: 15 s).
    page.evaluate(f"{E}.setDrop({{build: 4, wind: 4}})")

    def each_size(fn) -> None:
        for size in SIZES:
            page.set_viewport_size({"width": size[0], "height": size[1]})
            time.sleep(0.2)
            fn(size)

    def play_screens(size: tuple, what: str, drop: str | None = None) -> None:
        for mode in ("simple", "advanced"):
            page.click(f'[data-appmode="{mode}"]')
            page.click('[data-tab="play"]')
            w.screen(size, f"{mode}-play-ambient-{what}")
            w.play_place(size, f"{mode}-play-ambient-{what}")
            got = page.evaluate("(() => { const b = document.querySelector('#drop'); return b ? b.dataset.drop : null; })()")
            if drop and got != drop:
                failures.append(f"{size[0]}x{size[1]} live walk: DROP shows {got!r} on the {mode} {what} screen, not {drop!r}")
            if what == "morph-on" and page.evaluate("(() => { const m = document.querySelector('#morph'); return m ? m.dataset.morph : null; })()") != "on":
                failures.append(f"{size[0]}x{size[1]} live walk: Morph does not show on, on the {mode} Play tab")

    def mix_screens(size: tuple) -> None:
        page.click('[data-appmode="advanced"]')
        page.click('[data-tab="mix"]')
        page.click('[data-page="mix:morph"]')
        was = page.evaluate(f"{E}.morphPlan().moves.sections")
        for on in (False, True):
            if page.evaluate(f"{E}.morphPlan().moves.sections") != on:
                page.click('[data-morphthing="sections"]')
            w.screen(size, f"advanced-mix-morph-ambient-sections-{'on' if on else 'off'}")
            text = page.evaluate("(document.querySelector('#morph-help') || {}).textContent || ''")
            bars = page.evaluate(f"{E}.morphPlan().recipe.sections")
            claims = f"every {bars} bars" in text
            if claims != on:
                failures.append(f"{size[0]}x{size[1]} live walk: with Sections {'on' if on else 'off'} the Morph help says: {text!r}")
        if page.evaluate(f"{E}.morphPlan().moves.sections") != was:
            page.click('[data-morphthing="sections"]')
        page.click('[data-page="mix:drop"]')
        w.screen(size, "advanced-mix-drop-ambient")

    each_size(lambda s: play_screens(s, "morph-on"))
    each_size(mix_screens)
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    for state, press in (("build", True), ("on", False), ("wind", True)):
        if press:
            page.click("#drop")
        if not _wait(page, f"{E}.dropShown().phase === {state!r}", bar_s * 6 + 2):
            failures.append(f"live walk: DROP never reached {state!r} (it shows {page.evaluate(f'{E}.dropShown().phase')!r})")
            continue
        each_size(lambda s, st=state: play_screens(s, f"drop-{st}", st))
    _wait(page, f"{E}.dropShown().phase === 'off'", bar_s * 6 + 2)
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    page.set_viewport_size({"width": 390, "height": 844})
    if out_dir:
        for size in SIZES:
            for label in LIVE_SCREENS:
                f = f"{size[0]}x{size[1]}-{label}.png"
                if not os.path.exists(os.path.join(out_dir, f)):
                    failures.append(f"live walk: no screenshot {f}")
    return w.count


# T1 (spec 9.1 to 9.3): the four tablet sizes of the row, each with the layout it must show, in both modes.
TABLET_SIZES = [((1280, 800), "landscape"), ((1024, 768), "landscape"), ((800, 1280), "portrait"), ((768, 1024), "portrait")]
# T1 review E2 and S1: the table's edge (a 7-inch tablet, the dock at its least height) and a narrow wide tablet (the desk
# with DROP over the transport bar), walked the same way.
TABLET_SIZES += [((600, 960), "portrait"), ((880, 620), "landscape")]
PANELS = ["chords", "drums", "bass", "synth", "layer1", "layer2", "mix"]
TABLET_SCREENS = {
    o: [f"{m}-{o}-{t}" for m in ("simple", "advanced") for t in ("chords", "drums", "mix")]
    + [f"{m}-{o}-{s}" for m in ("simple", "advanced") for s in ("pad-next-bar", "section-next-bar")]
    for o in ("landscape", "portrait")
}

# The desk's own layout: five labelled rows by every section, the punch pads' space above the grid, the strip under the
# grid's columns as their labels, DROP and the transport bar side by side under the strip (under 960 px wide, DROP with
# Morph over the transport bar), the playing column's pads drawing their notes, both halves on screen side by side and
# nothing under the bottom edge.
DESK = r"""() => {
  const bad = [];
  const q = (s) => document.querySelector(s), r = (el) => el.getBoundingClientRect();
  const grid = q('.deskgrid'), slot = q('.punchslot'), secs = q('.secs'), drop = q('#drop'), play = q('#play');
  const pads = q('.shell .pads'), inst = q('.shell .inst'), rail = q('.rail');
  if (!grid || !slot || !secs || !drop || !play || !pads || !inst || !rail) return ['the desk is missing a part (grid, punch space, strip, DROP, Play, halves or rail)'];
  const e = window.__groovebox, song = e.getSong(), n = song.sections.length;
  const heads = [...grid.querySelectorAll('.deskrow')];
  if (heads.length !== 5) bad.push(`${heads.length} labelled rows, not 5`);
  for (const h of heads) if (h.querySelectorAll('b, span').length < 2 || !h.querySelector('span').textContent.trim()) bad.push(`row ${h.dataset.row} does not say what it plays`);
  const cells = [...grid.querySelectorAll('[data-cell]')];
  if (cells.length !== 5 * n) bad.push(`${cells.length} pads, not ${5 * n}`);
  const g = r(grid), sl = r(slot), st = r(secs), d = r(drop), pl = r(play), ph = r(pads), ih = r(inst);
  if (sl.height < 47.5 || sl.bottom > g.top + 0.5) bad.push(`no space of 48 px for the punch pads above the grid (${sl.height.toFixed(0)} px)`);
  if (st.top < g.bottom - 0.5) bad.push('the strip is not under the grid');
  for (let i = 0; i < n; i++) {
    const t = q(`[data-strip="${i}"]`), c = q(`[data-cell="${i}:drums"]`);
    if (!t || !c) continue;
    const a = r(t), b = r(c);
    if (Math.abs(a.left - b.left) > 1 || Math.abs(a.right - b.right) > 1) bad.push(`section ${i}'s strip tile is not under its column`);
  }
  // Under 960 px wide (T1 review S1) DROP with Morph sits directly over the transport bar; from 960 px, beside it.
  if (innerWidth < 960) {
    if (d.bottom > pl.top + 0.5 || pl.top - d.bottom > 12) bad.push('DROP with Morph is not directly over the transport bar');
  } else if (Math.abs(d.top - pl.top) > 1 || d.right > pl.left + 0.5) bad.push('DROP and the transport bar are not side by side');
  if (d.top < st.bottom - 0.5) bad.push('DROP is not under the strip');
  if (!(ph.right <= ih.left + 0.5 && Math.abs(ph.top - ih.top) < 1)) bad.push('the pads and the instrument are not side by side');
  if (r(rail).bottom > ih.top + 80 + 0.5) bad.push('the rail is not on top of the instrument half');
  const live = cells.filter((c) => c.dataset.live !== undefined);
  if (live.length !== 5) bad.push(`${live.length} pads in the playing column, not 5`);
  if (e.playing && live.length && !live.every((c) => c.querySelector('.padnotes'))) bad.push('the playing column\'s pads do not draw their notes');
  return bad;
}"""

# T1 slice c (spec 9.3): tablet portrait, the dock. The chosen panel on top under the header; the dock below it, top to
# bottom: the punch pads' space (48 px at least), the five lanes (Simple) or the labelled grid with the strip as its
# column labels (Advanced), DROP with Morph beside it, the strip, the transport bar and the rail of seven as the tab bar
# on the bottom edge. The vibe control sits in the header.
DOCK = r"""() => {
  const bad = [];
  const q = (s) => document.querySelector(s), r = (el) => el.getBoundingClientRect();
  const vh = document.documentElement.clientHeight;
  const hdr = q('.hdr'), inst = q('.shell .inst'), dock = q('.shell .pads.dock'), slot = q('.dock .punchslot');
  const drop = q('.dock #drop'), morph = q('.dock .droprow .morph'), secs = q('.dock .secs'), top = q('.dock .top'), rail = q('.dock .rail');
  if (!hdr || !inst || !dock || !slot || !drop || !morph || !secs || !top || !rail) return ['the dock is missing a part (panel, punch space, DROP, Morph, strip, transport or rail)'];
  if (!hdr.querySelector('.vibectl') || !hdr.querySelector('.vibectl').getClientRects().length) bad.push('the header has no vibe control');
  const e = window.__groovebox, n = e.getSong().sections.length;
  const adv = document.querySelector('[data-appmode="advanced"]').getAttribute('aria-checked') === 'true';
  const view = q(adv ? '.dock .deskgrid' : '.dock .nowlist');
  if (!view) return [`the dock has no ${adv ? 'pad grid' : 'lanes'}`];
  if (q(adv ? '.dock .nowlist' : '.dock .deskgrid')) bad.push(`the dock shows the ${adv ? 'lanes' : 'grid'} in ${adv ? 'Advanced' : 'Simple'}`);
  const h = r(hdr), ih = r(inst), dk = r(dock), sl = r(slot), v = r(view), d = r(drop), m = r(morph), st = r(secs), t = r(top), rl = r(rail);
  if (ih.top < h.bottom - 0.5 || ih.bottom > dk.top + 0.5) bad.push('the panel is not between the header and the dock');
  if (ih.height < 300) bad.push(`the panel has ${ih.height.toFixed(0)} px`);
  if (!inst.querySelector('.body button, .body .dial, .body [role=slider]')) bad.push('the panel shows no control');
  if (sl.height < 47.5 || sl.bottom > v.top + 0.5) bad.push(`no space of 48 px for the punch pads above the ${adv ? 'grid' : 'lanes'} (${sl.height.toFixed(0)} px)`);
  if (adv) {
    const heads = [...view.querySelectorAll('.deskrow')];
    if (heads.length !== 5) bad.push(`${heads.length} labelled rows, not 5`);
    for (const x of heads) if (!x.querySelector('span')?.textContent.trim()) bad.push(`row ${x.dataset.row} does not say what it plays`);
    const cells = [...view.querySelectorAll('[data-cell]')];
    if (cells.length !== 5 * n) bad.push(`${cells.length} pads, not ${5 * n}`);
    for (let i = 0; i < n; i++) {
      const a = q(`[data-strip="${i}"]`), c = q(`[data-cell="${i}:drums"]`);
      if (a && c && (Math.abs(r(a).left - r(c).left) > 1 || Math.abs(r(a).right - r(c).right) > 1)) bad.push(`section ${i}'s strip tile is not under its column`);
    }
    const live = cells.filter((c) => c.dataset.live !== undefined);
    if (live.length !== 5) bad.push(`${live.length} pads in the playing column, not 5`);
    if (e.playing && live.length && !live.every((c) => c.querySelector('.padnotes'))) bad.push("the playing column's pads do not draw their notes");
  } else {
    if (view.querySelectorAll('[data-now]').length !== 5 || view.querySelectorAll('.lane').length !== 5) bad.push('the dock does not show five instruments with their lanes');
  }
  for (const x of view.querySelectorAll('[data-now], .deskrow')) if (r(x).height < 47.5) bad.push(`a row of the dock is ${r(x).height.toFixed(0)} px tall`);
  if (v.bottom > d.top + 0.5 || Math.abs(d.top - m.top) > 1 || d.right > m.left + 0.5) bad.push('DROP with Morph beside it is not under the pads');
  if (d.bottom > st.top + 0.5) bad.push('DROP is not above the strip');
  if (st.bottom > t.top + 0.5) bad.push('the strip is not above the transport bar');
  if (t.bottom > rl.top + 0.5) bad.push('the transport bar is not above the rail');
  if (Math.abs(rl.bottom - vh) > 1) bad.push(`the rail is not on the bottom edge (${rl.bottom.toFixed(0)} of ${vh})`);
  if (rail.querySelectorAll('[data-tab]').length !== 7) bad.push(`the rail has ${rail.querySelectorAll('[data-tab]').length} tabs, not 7`);
  return bad;
}"""


# T2 (spec 9.2): on the desk at 1280 x 800 these Advanced panels show every page at once: no page chips, the panel whole.
# Slice b: Drums (every voice by 16 steps as one grid), Mix (faders with meters) and Chords (editor beside the library).
PAGELESS = {"chords", "drums", "bass", "synth", "layer1", "layer2", "mix"}
PAGELESS_AT = (1280, 800)
WHOLE = r"""(panel) => {
  const chips = [...document.querySelectorAll('.shell .inst .body [data-page]')].filter((c) => c.getClientRects().length);
  const bad = [];
  if (chips.length) bad.push(`the Advanced ${panel} panel still has pages (${chips.map((c) => c.dataset.page).join(', ')})`);
  else if (!document.querySelector(`.shell .inst [data-whole="${panel}"]`)) bad.push(`the Advanced ${panel} panel is not shown whole`);
  return bad;
}"""


# What must hold while a pad and a panel's dial are used (T1 review S2): the panel shown, the layout, the panel's dials.
SCREEN_HELD = """() => ({ panel: document.querySelector('.shell .inst')?.dataset.panel ?? null,
  size: document.documentElement.dataset.size, dial: !!document.querySelector('.shell .inst .body .dial') })"""


def tablet_layout(page, orient: str) -> list:
    """The layout checks of the tablet layout shown: the desk (landscape) or the dock (portrait)."""
    return page.evaluate(DESK if orient == "landscape" else DOCK)


def beside(page, failures: list, where: str, pad_for) -> None:
    """T1: the pads and one instrument used without changing screen, at the size and mode shown, with the Drums panel
    open: a pad (pad_for(section) is its selector) queues and is put back, and a drag on the panel's dial moves the song;
    the panel and the layout stay (T1 review S2), and the pads keep playing: the transport runs and moves on and the
    level stays up throughout (T1 review E1)."""
    screen0 = page.evaluate(SCREEN_HELD)

    def held(when: str, dial: bool) -> None:
        now = page.evaluate(SCREEN_HELD)
        if (now["panel"], now["size"]) != (screen0["panel"], screen0["size"]):
            failures.append(f"{where}: {when} changed the screen (panel {screen0['panel']} to {now['panel']}, layout {screen0['size']} to {now['size']})")
        if dial and not now["dial"]:
            failures.append(f"{where}: {when} closed the panel's dials")

    # The pads keep playing (T1 review E1), judged by the transport and the level, not by new notes: a slow
    # vibe's section (Ambient's A and D: a held synth and a drone) starts no note for 16 s. The level floor is
    # walk_rotate's: 20 dB under the quietest reading of the second before, never under -80 dB.
    base = []
    for _ in range(10):
        time.sleep(0.1)
        v = page.evaluate(f"{E}.level()")
        if v is not None and v > -200:
            base.append(v)
    floor = max(-80.0, (min(base) if base else -60.0) - 20.0)
    p0 = page.evaluate(f"{E}.position()")
    sec = page.evaluate(f"{E}.schedulerSection()")
    sel = pad_for(sec)
    page.click(sel)
    if not page.locator(f"{sel}.pending").count():
        failures.append(f"{where}: a pad tap beside an open panel did not queue")
    held("a pad tap", False)
    page.click(sel)
    # Advanced Drums opens on its step grid: the Kit page has dials.
    if page.locator('.inst [data-page="drums:kit"]').count():
        page.click('.inst [data-page="drums:kit"]')
    dial = page.locator(".inst .body .dial").first
    if not dial.count():
        failures.append(f"{where}: the Drums panel shows no dial beside the pads")
    else:
        song0 = page.evaluate(f"JSON.stringify({E}.getSong())")
        b = dial.bounding_box()
        moved = False
        # Up, then down: a dial at its top or bottom moves the other way.
        for dy in (-40, 40):
            page.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
            page.mouse.down()
            page.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2 + dy, steps=4)
            page.mouse.up()
            moved = moved or page.evaluate(f"JSON.stringify({E}.getSong())") != song0
        if not moved:
            failures.append(f"{where}: a drag on the panel's dial changed nothing")
        held("a drag on the panel's dial", True)
    low = []
    end = time.time() + 0.5
    while time.time() < end:
        v = page.evaluate(f"{E}.level()")
        if v is None or v < floor:
            low.append(v)
        time.sleep(0.05)
    p1 = page.evaluate(f"{E}.position()")
    running = page.evaluate(f"{E}.running")
    if not (running and p1["playing"]) or (p1["bar"], p1["step"]) == (p0["bar"], p0["step"]):
        failures.append(f"{where}: the pads stopped while the panel was used (transport at {p0['bar']}.{p0['step']} then {p1['bar']}.{p1['step']}, running {running})")
    if low:
        failures.append(f"{where}: the level dropped under {floor:.1f} dB while the panel was used: {low[:4]}")
    if not page.locator(".dock .nowlist, .deskgrid").count():
        failures.append(f"{where}: the pads left the screen while the panel was used")


def walk_tablet(page, failures: list, out_dir: str | None) -> int:
    """T1: the tablet sizes (1280 x 800, 1024 x 768 and 880 x 620 landscape, the desk; 800 x 1280, 768 x 1024 and 600 x 960
    portrait, the dock), in both modes, with every panel of the rail (each layer in each mode) and every page, a pad (or,
    on Simple portrait, an instrument's lane) waiting for the next bar and a section queued. Each screen gets the frame walk's
    checks (nothing scrolls, nothing cut off, text fits, no control under 48 px) and the layout's own; a missing
    screenshot fails. T2: at 1280 x 800 an Advanced panel of PAGELESS that still shows page chips fails. Then, at each size and in both modes, a pad tapped and a panel's dial dragged without changing screen
    (the panel and the layout held), the transport running and the level up throughout.
    The smoke's core part runs it without screenshots. Leaves the phone at 390 x 844 in Simple, on the Play tab."""
    w = Walk(page, failures, out_dir)
    sec = page.evaluate(f"{E}.position().section")
    modes = {lid: page.evaluate(f"{E}.getSong().sections[{sec}].{lid}.mode") for lid in ["layer1", "layer2"]}
    bar_s = 240.0 / page.evaluate(f"{E}.bpm")

    def layout(size: tuple, orient: str, label: str) -> None:
        w.screen(size, label)
        for b in tablet_layout(page, orient):
            failures.append(f"{size[0]}x{size[1]} {label}: {b}")

    def pad_sel(orient: str, mode: str, s: int, inst: str) -> str:
        # Simple portrait's dock has the lanes: an instrument's label toggles it in the playing section.
        return f'[data-now="{inst}"]' if (orient, mode) == ("portrait", "simple") else f'[data-cell="{s}:{inst}"]'

    def settle_toggles() -> None:
        if not _wait(page, f"{E}.pendingShown().toggles.length === 0", bar_s * 2 + 1):
            failures.append("tablet walk: a pad's toggle never landed")

    for size, orient in TABLET_SIZES:
        page.set_viewport_size({"width": size[0], "height": size[1]})
        if not _wait(page, f"document.documentElement.dataset.size === {orient!r}", 2.0):
            failures.append(f"{size[0]}x{size[1]}: not the {orient} layout")
            continue
        for mode in ("simple", "advanced"):
            page.click(f'[data-appmode="{mode}"]')
            whole = mode == "advanced" and size == PAGELESS_AT

            def no_pages(t: str, label: str) -> None:
                # T2: at 1280 x 800 an Advanced panel of PAGELESS shows no page chip.
                if whole and t in PAGELESS:
                    _settle(page)
                    for b in page.evaluate(WHOLE, t):
                        failures.append(f"{size[0]}x{size[1]} {label}: {b}")

            for t in PANELS:
                page.click(f'.rail [data-tab="{t}"]')
                label = f"{mode}-{orient}-{t}"
                if t in ("layer1", "layer2"):
                    for m in LAYER_MODES:
                        page.click(f'[data-mode="{t}:{m}"]')
                        no_pages(t, f"{label}-{m}")
                        w.pages(size, f"{label}-{m}")
                        if m == "generative" and whole:
                            # Pulse adds its own dials and every other style has none: the whole panel holds both.
                            style = page.get_attribute("[data-leadstyle].on", "data-leadstyle")
                            for other in ("pulse", "hook"):
                                if other != style:
                                    page.click(f'[data-leadstyle="{other}"]')
                                    no_pages(t, f"{label}-{m}-{other}")
                                    w.pages(size, f"{label}-{m}-{other}")
                            page.click(f'[data-leadstyle="{style}"]')
                    page.click(f'[data-mode="{t}:{modes[t]}"]')
                else:
                    no_pages(t, label)
                    w.pages(size, label)
                # The panel as it opens, with the layout's own checks.
                layout(size, orient, label)
            # A pad of the playing section waiting for the next bar (its hatched frame), then put back.
            sec = page.evaluate(f"{E}.schedulerSection()")
            sel = pad_sel(orient, mode, sec, "synth")
            was = page.evaluate(f"{E}.getSong().sections[{sec}].on.synth")
            # Tapped early in a bar, so the screen is taken well before the bar line.
            _wait(page, f"{E}.position().step <= 2", bar_s + 1)
            page.click(sel)
            if not _wait(page, f"!!document.querySelector('{sel}.pending')", 0.5):
                failures.append(f"{size[0]}x{size[1]} {mode}: a tapped pad does not show Next bar")
            layout(size, orient, f"{mode}-{orient}-pad-next-bar")
            page.click(sel)
            settle_toggles()
            if page.evaluate(f"{E}.getSong().sections[{sec}].on.synth") != was:
                page.click(sel)
                settle_toggles()
            # A section queued: the strip's Next bar (and on the grid the outlined column), then landed.
            n = page.evaluate(f"{E}.getSong().sections.length")
            nxt = (sec + 1) % n
            if n > 1:
                _wait(page, f"{E}.position().step <= 2", bar_s + 1)
                page.click(f'[data-strip="{nxt}"]')
                shown = f'[data-strip="{nxt}"].pending' if (orient, mode) == ("portrait", "simple") else f'[data-cell="{nxt}:drums"].nextcol'
                if not _wait(page, f"!!document.querySelector('{shown}')", 0.5):
                    failures.append(f"{size[0]}x{size[1]} {mode}: the queued section does not show Next bar")
                layout(size, orient, f"{mode}-{orient}-section-next-bar")
                if not _wait(page, f"{E}.position().section === {nxt}", bar_s * 2 + 1):
                    failures.append(f"{size[0]}x{size[1]} {mode}: the queued section never played")
        # Pads and one instrument without changing screen, in both modes.
        for mode in ("advanced", "simple"):
            page.click(f'[data-appmode="{mode}"]')
            page.click('.rail [data-tab="drums"]')
            beside(page, failures, f"{size[0]}x{size[1]} {mode} {orient}", lambda s, o=orient, m=mode: pad_sel(o, m, s, "bass"))
            settle_toggles()
    page.click('[data-appmode="simple"]')
    page.set_viewport_size({"width": 390, "height": 844})
    _wait(page, "document.documentElement.dataset.size === 'phone'", 2.0)
    page.click('[data-tab="play"]')
    if out_dir:
        for size, orient in TABLET_SIZES:
            for label in TABLET_SCREENS[orient]:
                f = f"{size[0]}x{size[1]}-{label}.png"
                if not os.path.exists(os.path.join(out_dir, f)):
                    failures.append(f"tablet walk: no screenshot {f}")
    print(f"tablet walk: {w.count} screens at {len(TABLET_SIZES)} sizes in both modes")
    return w.count


def main() -> int:
    from playwright.sync_api import sync_playwright

    root = sys.argv[1] if len(sys.argv) > 1 else "dist"
    out = sys.argv[2] if len(sys.argv) > 2 else "shots"
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):  # stale screens of earlier rows must not pass for the current build
        if f.endswith(".png"):
            os.remove(os.path.join(out, f))
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
            close_picker(page)
            sample_play(page, failures, "first tap after load", True)
            page.click('[data-strip="1"]')  # Groove: every instrument on
            time.sleep(2.5)
            n = walk_frame(page, failures, out)
            n += walk_live(page, failures, out)
            # P10d: with Ambient (Morph on) playing, every tap during a morph.
            walk_play_button(page, failures, "Ambient, Morph on")
            # T1: the tablet sizes, last (the walks above are the phone's).
            n += walk_tablet(page, failures, out)
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
