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

F2: the kick quadrant (walk_kick_pad) at 360 x 640, 412 x 915, 800 x 1280 and 1280 x 800 in both modes: one on the
Drums panel, at least 48 px a side, its words on one line inside it, and DROP and Morph unmoved while it is opened and
dragged; the smoke's kick part runs it too, without screenshots.

T1: the tablet walk (walk_tablet) saves six tablet sizes in both modes: the desk at 1280 x 800, 1024 x 768 and 880 x 620
and the dock at 800 x 1280, 768 x 1024 and 600 x 960, every rail panel and page, with the same checks and the layout's own (DESK,
DOCK); the smoke's core part runs it too, without screenshots.

F1: before the frame walk, the vibe picker (walk_picker) at 360 x 640, 412 x 915, 800 x 1280 and 1280 x 800: no scroll,
no tile under 48 px, no label wrapped or overflowing, the top group first, More's other group checked the same.

tools/smoke.py runs the same walk (without screenshots) while the transport plays.

F1 review E1: the launch bag is seeded (bag_seed), and the walks run on the default song opened from Songs, so a run
is the same every time. SHOTS_LAUNCH=<vibe id> runs them on that vibe's launch jam instead.

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

# T2 slice c: an XY pad's axis names stay clear of its value readout (the narrow Drums pad on the desk once drew
# "Resonance" under it). Any overlap of a shown name's box with the readout's box fails.
XY_CLEAR = r"""() => {
  const bad = [];
  for (const xy of document.querySelectorAll('.xy')) {
    const rv = xy.querySelector('.rv');
    if (!rv || !xy.getClientRects().length) continue;
    const a = rv.getBoundingClientRect();
    for (const l of xy.querySelectorAll('.lx, .ly')) {
      const b = l.getBoundingClientRect();
      if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5)
        bad.push(`the XY pad's "${l.textContent.trim()}" sits under its readout "${rv.textContent.trim()}"`);
    }
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


# T2 review S3: the controls a tab body shows, one key each: the first data attribute that names the control
# (name=value), else its id. A fader and a Levels dial are the same control (fader=level:x is dial=level:x); a picker
# paged behind More counts once by its name; the phone's sequencer view (its voice, its view and its eight-step cells)
# is a view of the sixteen-step grid the whole Drums shows, the drum sound picker sits behind its Sound button (F2: and
# so does the drums' filter pad, whose place at the foot of the whole Drums column the kick quadrant took), and the
# phone's slot chips (which slot its FX page shows) are the whole panel's two slots.
CONTROL_KEYS = r"""() => {
  const body = document.querySelector('.shell .inst .body') || document.querySelector('.shell > .body');
  if (!body) return [];
  const skip = new Set(['value', 'pageOf', 'grp', 'shown', 'meter', 'page']);
  const paged = new Set([...body.querySelectorAll('[data-more]')].map((e) => e.dataset.more));
  const drums = !!body.querySelector('[data-whole="drums"], [data-page="drums:beat"]');
  const out = new Set();
  for (const el of body.querySelectorAll('button, a, input, [role=slider], [role=switch], [role=group]')) {
    // T3: a tablet has the punch pads over its pads, not in the Mix panel (the punch walk checks them there).
    if (!el.getClientRects().length || el.closest('.pager') || el.closest('.punchpads')) continue;
    const k = Object.keys(el.dataset).find((n) => !skip.has(n));
    let key = k ? `${k}=${el.dataset[k]}` : el.id ? `#${el.id}` : null;
    if (!key) continue;
    if (k === 'fader') key = `dial=${el.dataset[k]}`;
    if (k === 'seq') key = 'seq=*';
    if (k && paged.has(k)) key = `${k}=*`;
    if (k === 'step' || k === 'voice' || k === 'seqview') key = 'drum sequencer';
    if (k === 'step16') key = 'drum sequencer';
    // The phone's slot chips choose which effect slot its FX page shows; the whole panel shows both slots' pickers.
    if (k === 'fxslot') key = `fxpick=${el.dataset[k]}`;
    if (drums && (key === '#drums-sound' || k === 'patch' || key === 'more=patch' || key === 'xy=drums')) key = 'drum sound';
    out.add(key);
  }
  return [...out].sort();
}"""

# Keys of the Advanced phone panels (412 x 915), by tab, or tab:mode for a layer, gathered by the frame walk.
PHONE_KEYS: dict = {}


def panel_group(label: str):
    """The panel an Advanced frame-walk label shows: 'drums', or 'layer1:arp' for a layer in a mode; None otherwise."""
    parts = label.split("-")
    if len(parts) < 2 or parts[0] != "advanced" or parts[1] not in ("chords", "drums", "bass", "synth", "layer1", "layer2", "mix"):
        return None
    if parts[1] in ("layer1", "layer2"):
        return f"{parts[1]}:{parts[2]}" if len(parts) > 2 else None
    return parts[1]


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
        # T2 review S3: the frame walk gathers the phone's Advanced panel controls (PHONE_KEYS).
        self.collect = False
        # T3 slice b: Punch pages of the Mix tab checked (screen).
        self.punch = 0

    def screen(self, size: tuple, label: str) -> None:
        _settle(self.page)
        where = f"{size[0]}x{size[1]} {label}"
        for b in self.page.evaluate(CHECK):
            self.failures.append(f"{where}: {b}")
        for b in self.page.evaluate(SMALL):
            self.failures.append(f"{where}: control under 48 px: {b}")
        for b in self.page.evaluate(XY_CLEAR):
            self.failures.append(f"{where}: {b}")
        if label.startswith("simple"):
            for b in simple_words(self.page):
                self.failures.append(f"{where}: {b}")
        for b in self.page.evaluate(PAGE_CHIPS):
            self.failures.append(f"{where}: {b}")
        if "-mix" in label:
            for b in self.page.evaluate(MIX_CHIPS):
                self.failures.append(f"{where}: {b}")
        if label.endswith("-mix-punch"):
            # T3 slice b: the phone's Punch page of the Mix tab holds the six pads (walk_frame counts these).
            self.punch += 1
            for b in self.page.evaluate(PUNCH, ["page", PUNCH_ORDER]):
                self.failures.append(f"{where}: {b}")
        if label == "simple-mix-master":
            for b in self.page.evaluate(MORPH_SPEED_ROW):
                self.failures.append(f"{where}: {b}")
        if self.collect and size == (412, 915) and (g := panel_group(label)):
            PHONE_KEYS.setdefault(g, set()).update(self.page.evaluate(CONTROL_KEYS))
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
    """F1 (spec 10.1): the app opens on the Play tab with the launch jam, no picker. Wait for the Play tab; should a
    picker show, Escape closes it, keeping the song that opened."""
    page.wait_for_selector(".shell", timeout=5000)
    if page.locator(".vpick, .vibes").count():
        page.keyboard.press("Escape")


def bag_seed(first: str = "dubTechno") -> str:
    """F1: an init script that seeds the launch bag (once per browser context), so the launch jam is always `first`,
    its key and bpm rolled from seed 1, whatever the clock. Shared with tools/smoke.py (BAG_SEED)."""
    return ("try { if (!localStorage.getItem('groovebox.vibeBag'))\n"
            f"  localStorage.setItem('groovebox.vibeBag', JSON.stringify({{ seed: 1, bag: ['{first}'], last: null }})); }} catch (e) {{}}")


BAG_SEED = bag_seed()


PICKER_SIZES = [(360, 640), (412, 915), (800, 1280), (1280, 800)]
# F1 (spec 10.1): what the vibe picker sheet shows, measured: its groups in order with their tiles, whether it or the
# document scrolls, tiles off the screen or under 48 px, labels that wrap or overflow, the More switch.
PICKER_READ = r"""() => {
  const v = document.querySelector('.vpick');
  if (!v) return null;
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const se = document.scrollingElement;
  const bad = [];
  if (v.scrollHeight > v.clientHeight + 1 || v.scrollWidth > v.clientWidth + 1) bad.push(`the picker scrolls: ${v.scrollWidth}x${v.scrollHeight} in ${v.clientWidth}x${v.clientHeight}`);
  if (se.scrollHeight > vh + 1 || se.scrollWidth > vw + 1) bad.push(`the document scrolls: ${se.scrollWidth}x${se.scrollHeight} in ${vw}x${vh}`);
  const sr = v.getBoundingClientRect();
  const oneLine = (el, what) => {
    if (!el || !el.getClientRects().length) return;
    if (el.scrollWidth > el.clientWidth + 0.5) bad.push(`${what} overflows: ${el.scrollWidth} > ${el.clientWidth}`);
    const box = el.getBoundingClientRect();
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((q) => q.width > 0);
      if (new Set(rects.map((q) => Math.round(q.top))).size > 1) bad.push(`${what} wraps: "${n.textContent.trim()}"`);
      const u = range.getBoundingClientRect();
      if (u.left < box.left - 0.5 || u.right > box.right + 0.5 || u.top < box.top - 0.5 || u.bottom > box.bottom + 0.5)
        bad.push(`${what} passes its edge: "${n.textContent.trim()}"`);
    }
  };
  const groups = [...v.querySelectorAll('[data-group]')].map((g) => {
    const tiles = [...g.querySelectorAll('[data-vibe]')].map((t) => {
      const b = t.getBoundingClientRect();
      const id = t.dataset.vibe;
      if (b.width < 47.99 || b.height < 47.99) bad.push(`tile ${id} under 48 px: ${b.width.toFixed(1)}x${b.height.toFixed(1)}`);
      if (b.left < -0.5 || b.top < -0.5 || b.right > vw + 0.5 || b.bottom > vh + 0.5) bad.push(`tile ${id} off the screen`);
      if (b.left < sr.left - 0.5 || b.right > sr.right + 0.5 || b.top < sr.top - 0.5 || b.bottom > sr.bottom + 0.5) bad.push(`tile ${id} cut off by the sheet`);
      oneLine(t, `tile ${id}'s label`);
      return { id, top: b.top, bottom: b.bottom, left: b.left, right: b.right, x: Math.round(b.left) };
    });
    for (let i = 0; i < tiles.length; i++)
      for (let j = i + 1; j < tiles.length; j++) {
        const a = tiles[i], c = tiles[j];
        if (a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5)
          bad.push(`tiles ${a.id} and ${c.id} overlap`);
      }
    const r = g.getBoundingClientRect();
    return { name: g.dataset.group, top: r.top, tiles, cols: new Set(tiles.map((t) => t.x)).size,
             span: tiles.length ? Math.max(...tiles.map((t) => t.bottom)) - Math.min(...tiles.map((t) => t.top)) : 0 };
  });
  oneLine(v.querySelector('.vline span'), 'the line\'s label');
  oneLine(v.querySelector('#vibe-surprise'), 'Surprise me');
  oneLine(v.querySelector('#vibe-more'), 'More');
  oneLine(v.querySelector('.vphead h2'), 'the title');
  const line = v.querySelector('.vline');
  const gap = parseFloat(getComputedStyle(v).rowGap) || 0;
  return { bad, groups, more: !!v.querySelector('#vibe-more'), surprise: !!v.querySelector('#vibe-surprise'),
           sheet: sr.height, line: line ? line.getBoundingClientRect().height : 0, gap, vh };
}"""


def walk_picker(page, failures: list, out_dir: str | None = None) -> int:
    """F1 (spec 10.1, Done when): the vibe picker at 360 x 640, 412 x 915, 800 x 1280 and 1280 x 800, opened from the
    vibe control's name in Simple: no scroll, no tile under 48 px, no label wrapped or overflowing, the top group first
    (the top vibes in their order, then the others), two columns; where the More switch shows, it swaps in the other
    vibes with the same checks, and both groups would not have fit (where they fit, both show). Leaves the app in
    Simple on the Play tab at 390 x 844 with the picker closed. Returns the number of screens checked."""
    vibes = page.evaluate("window.__vibes")
    # F1 review M2: the top group in spec 10.2's order (window.__topIds), the others in the arrows' order.
    top = page.evaluate("window.__topIds")
    others = [v["id"] for v in vibes if not v["top"]]
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    n = 0
    for size in PICKER_SIZES:
        where = f"{size[0]}x{size[1]} vibe picker"
        page.set_viewport_size({"width": size[0], "height": size[1]})
        time.sleep(0.25)
        opener = "#vibe-open" if page.locator("#vibe-open").count() else "#new-jam"
        page.click(opener)
        if not _wait(page, "!!document.querySelector('.vpick')", 2.0):
            failures.append(f"{where}: {opener} did not open the picker")
            continue
        _settle(page)
        p = page.evaluate(PICKER_READ)
        views = [("", p)]
        names = [g["name"] for g in p["groups"]]
        if not names or names[0] != "top":
            failures.append(f"{where}: the first group is {names[:1]}, not the top vibes")
        if p["more"]:
            if names != ["top"]:
                failures.append(f"{where}: with More, the groups shown are {names}, expected the top group alone")
            page.click("#vibe-more")
            _settle(page)
            q = page.evaluate(PICKER_READ)
            views.append((" More", q))
            if [g["name"] for g in q["groups"]] != ["other"]:
                failures.append(f"{where}: More did not swap in the other vibes ({[g['name'] for g in q['groups']]})")
            elif q["groups"]:
                # Where both groups fit at 48 px a tile, both show: the sheet as it would be with both, from what was
                # measured (the 48 px More row back to the plain line, the other group under it).
                other_span = q["groups"][0]["span"]
                both = p["sheet"] - p["line"] + 28 + p["gap"] + other_span
                if both <= p["vh"] + 0.5:
                    failures.append(f"{where}: More shows, but both groups fit ({both:.0f} px of {p['vh']} px)")
            if abs(q["sheet"] - p["sheet"]) > 0.5:
                failures.append(f"{where}: More moved the sheet ({p['sheet']:.0f} -> {q['sheet']:.0f} px tall)")
            if out_dir:
                page.screenshot(path=os.path.join(out_dir, f"{size[0]}x{size[1]}-simple-vibe-picker-more.png"))
            page.click("#vibe-more")
            _settle(page)
            if [g["name"] for g in page.evaluate(PICKER_READ)["groups"]] != ["top"]:
                failures.append(f"{where}: More did not swap the top vibes back")
        elif names != ["top", "other"]:
            failures.append(f"{where}: groups {names}, expected the top vibes, then the others")
        elif not p["groups"][0]["top"] < p["groups"][1]["top"]:
            failures.append(f"{where}: the top group is not above the others")
        got = [t["id"] for _l, q in views for g in q["groups"] for t in g["tiles"]]
        if got != top + others:
            failures.append(f"{where}: tiles {got}, expected the top vibes {top} then the others {others}")
        for label, q in views:
            for b in q["bad"]:
                failures.append(f"{where}{label}: {b}")
            for g in q["groups"]:
                if g["cols"] != 2:
                    failures.append(f"{where}{label}: the {g['name']} group in {g['cols']} columns, expected two")
            if not q["surprise"]:
                failures.append(f"{where}{label}: no Surprise me")
        if out_dir:
            page.screenshot(path=os.path.join(out_dir, f"{size[0]}x{size[1]}-simple-vibe-picker.png"))
        n += len(views)
        page.keyboard.press("Escape")
        if not _wait(page, "!document.querySelector('.vpick')", 2.0):
            failures.append(f"{where}: Escape did not close the picker")
    page.set_viewport_size({"width": 390, "height": 844})
    time.sleep(0.2)
    print(f"vibe picker: {n} screens at {', '.join(f'{w} x {h}' for w, h in PICKER_SIZES)}; top group first, no scroll, tiles 48 px")
    return n


def walk_frame(page, failures: list, out_dir: str | None = None) -> int:
    """Every tab and page, both modes, both sizes, with the song and every section renamed to the longest,
    widest names the app accepts (spec 8.6: user text fits too). Leaves the app in Simple on the Play tab at 390 x 844,
    with every layer back in the mode it had. Returns the number of screens checked."""
    w = Walk(page, failures, out_dir)
    w.collect = True
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
    # T3 slice b: the Mix tab's Punch page, at each phone size in both modes; absent, the pads went unchecked.
    if w.punch != 2 * len(SIZES):
        failures.append(f"the frame walk checked the Mix tab's Punch page {w.punch} times, not {2 * len(SIZES)} (each phone size, both modes)")
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


# F2 (spec 10.5): the kick quadrant on the Drums panel (the phone's Drums tab, its Kick page in Advanced; the rail's
# Drums panel on a tablet, its Kick page where the panel is paged): one on screen, at least 48 px a side, inside the
# screen, its words (Length, Punch and the readout) each on one line, inside the pad and drawn at 10 px or more.
KICK_PAD = r"""() => {
  const pads = [...document.querySelectorAll('[data-xy="kick"]')].filter((e) => e.getClientRects().length);
  if (pads.length !== 1) return { bad: [`${pads.length} kick quadrants on screen, not 1`] };
  const xy = pads[0], r = xy.getBoundingClientRect(), bad = [];
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  if (r.width < 47.5 || r.height < 47.5) bad.push(`the kick quadrant is ${r.width.toFixed(0)} x ${r.height.toFixed(0)} px`);
  if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) bad.push('the kick quadrant is outside the screen');
  const at = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
  if (!at || !xy.contains(at)) bad.push('the kick quadrant is covered at its centre');
  const words = {};
  for (const cls of ['lx', 'ly', 'rv']) {
    const l = xy.querySelector('.' + cls);
    if (!l) { bad.push(`the kick quadrant has no .${cls}`); continue; }
    const t = l.textContent.trim(), b = l.getBoundingClientRect();
    words[cls] = t;
    const rg = document.createRange();
    rg.selectNodeContents(l);
    const tops = new Set([...rg.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top)));
    if (tops.size > 1) bad.push(`the kick quadrant's "${t}" wraps onto ${tops.size} lines`);
    if (l.scrollWidth > l.clientWidth + 0.5 || l.scrollHeight > l.clientHeight + 0.5) bad.push(`the kick quadrant's "${t}" overflows its box`);
    const tr = rg.getBoundingClientRect();
    if (tr.left < r.left - 0.5 || tr.right > r.right + 0.5 || tr.top < r.top - 0.5 || tr.bottom > r.bottom + 0.5) bad.push(`the kick quadrant's "${t}" sticks out of the pad`);
    if (parseFloat(getComputedStyle(l).fontSize) < 10) bad.push(`the kick quadrant's "${t}" is drawn under 10 px`);
  }
  if (words.lx !== 'Length' || words.ly !== 'Punch') bad.push(`the kick quadrant reads "${words.lx}" across and "${words.ly}" up, not Length and Punch`);
  return { bad, w: r.width, h: r.height };
}"""

# Where DROP and Morph are: the Play tab's (PLAY_PLACE) on a phone; on a tablet, DROP and Morph as the layout shows them.
DROP_MORPH = r"""() => {
  const r = (s) => { const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length); return e ? e.getBoundingClientRect() : null; };
  const d = r('#drop'), m = r('#morph') || r('.droprow .morph');
  return d && m ? [d.left, d.top, d.width, d.height, m.left, m.top, m.width, m.height].map((v) => Math.round(v * 2) / 2) : null;
}"""

KICK_SIZES = [(360, 640), (412, 915), (800, 1280), (1280, 800)]


def walk_kick_pad(page, failures: list, out_dir: str | None = None) -> int:
    """F2 Done-when: the kick quadrant is at least 48 px a side on every size (360 x 640, 412 x 915, 800 x 1280 and
    1280 x 800) in Simple and Advanced, with its words fitting (KICK_PAD), and nothing moves DROP or Morph: on a phone
    the Play tab's PLAY_PLACE is the same after the Drums tab is opened and the quadrant dragged, on a tablet DROP and
    Morph stay put while the Drums panel opens and the quadrant is dragged. The quadrant is dragged corner to corner and
    put back. Leaves the phone at 390 x 844 in Simple on the Play tab. Returns the screens checked."""
    n = 0
    saved = page.evaluate(f"(() => {{ const p = {E}.getSong().patches.drums; return {{ kickDecay: p.kickDecay, kickPunch: p.kickPunch ?? 0.5 }}; }})()")
    for size in KICK_SIZES:
        page.set_viewport_size({"width": size[0], "height": size[1]})
        tablet = size[0] >= 600
        _wait(page, f"document.documentElement.dataset.size {'!==' if tablet else '==='} 'phone'", 2.0)
        for mode in ("simple", "advanced"):
            where = f"{size[0]}x{size[1]} {mode}"
            page.click(f'[data-appmode="{mode}"]')
            tab = '.rail [data-tab="drums"]' if tablet else '[data-tab="drums"]'
            if tablet:
                page.click('.rail [data-tab="chords"]')
            else:
                page.click('[data-tab="play"]')
            _settle(page)
            place0 = page.evaluate(DROP_MORPH if tablet else PLAY_PLACE)
            if not place0:
                failures.append(f"{where}: no DROP and Morph to measure")
            page.click(tab)
            chip = page.locator('[data-page="drums:kick"]')
            if chip.count() and chip.first.is_visible():
                chip.first.click()
            _settle(page)
            got = page.evaluate(KICK_PAD)
            for b in got["bad"]:
                failures.append(f"{where}: {b}")
            if out_dir:
                page.screenshot(path=os.path.join(out_dir, f"{size[0]}x{size[1]}-{mode}-kick-quadrant.png"))
            n += 1
            if "w" in got:
                print(f"kick quadrant {where}: {got['w']:.0f} x {got['h']:.0f} px")
                box = page.locator('[data-xy="kick"]').first.bounding_box()
                page.mouse.move(box["x"] + 2, box["y"] + box["height"] - 2)
                page.mouse.down()
                for i in range(1, 9):
                    page.mouse.move(box["x"] + 2 + (box["width"] - 4) * i / 8, box["y"] + box["height"] - 2 - (box["height"] - 4) * i / 8)
                page.mouse.up()
                _settle(page)
                after = page.evaluate(KICK_PAD)
                for b in after["bad"]:
                    failures.append(f"{where}, the quadrant dragged: {b}")
                if "w" in after and (abs(after["w"] - got["w"]) > 0.5 or abs(after["h"] - got["h"]) > 0.5):
                    failures.append(f"{where}: dragging the kick quadrant resized it ({got['w']:.0f} x {got['h']:.0f} -> {after['w']:.0f} x {after['h']:.0f})")
                pad = page.evaluate(f"{E}.getSong().patches.drums")
                if not (pad["kickDecay"] > 0.95 and pad.get("kickPunch", 0) > 0.95):
                    failures.append(f"{where}: the quadrant dragged to its top right corner set Length {pad['kickDecay']:.2f}, Punch {pad.get('kickPunch')}")
                page.evaluate(f"(v) => {E}.setParams('drums', v)", saved)
            if tablet:
                place1 = page.evaluate(DROP_MORPH)
            else:
                page.click('[data-tab="play"]')
                _settle(page)
                place1 = page.evaluate(PLAY_PLACE)
            if place0 and place1 != place0:
                failures.append(f"{where}: DROP or Morph moved with the Drums panel and the kick quadrant ({place0} -> {place1})")
    page.click('[data-appmode="simple"]')
    page.set_viewport_size({"width": 390, "height": 844})
    _wait(page, "document.documentElement.dataset.size === 'phone'", 2.0)
    page.click('[data-tab="play"]')
    return n


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
  // Under 960 px wide (T1 review S1) DROP with Morph sits directly over the transport bar; from 960 px, beside it. T2
  // review E1: in Advanced from 1000 px the instrument half is 53 %, and under 1200 px DROP sits over the bar there too.
  const adv = !!document.querySelector('.tablet.adv');
  if (innerWidth < 960 || (adv && innerWidth >= 1000 && innerWidth < 1200)) {
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


# T2 (spec 9.2, 9.3): the Advanced panels that show every page at once, by tablet size: no page chips, the panel whole.
# On the desk at 1280 x 800 every panel of the rail (slices a and b). T2 review E1: at 1024 x 768 the panel has 513 x 628
# px (the instrument half 53 % from 1000 px), and Chords and Mix fit it whole; the rest keep their pages (docs/reviews/T2.md,
# Fixer notes, with the measured need). Slice c: on the dock at 800 x 1280 the panel has 776 x 566 px over the pads, and
# these fit it whole; Drums (twelve rows of 48 px steps) does not, nor a layer, which is whole or paged by size alone in
# every mode (T2 review E2, M5), and a lead does not fit. A layer is named alone (every mode) or as layer:mode.
PAGELESS = {
    (1280, 800): {"chords", "drums", "bass", "synth", "layer1", "layer2", "mix"},
    (1024, 768): {"chords", "mix"},
    (800, 1280): {"chords", "bass", "synth", "mix"},
}


def pageless(size: tuple, t: str, m: str | None = None) -> bool:
    """Whether the Advanced panel t (in layer mode m) must show whole at this tablet size."""
    want = PAGELESS.get(size, set())
    return t in want or (m is not None and f"{t}:{m}" in want)


WHOLE = r"""(panel) => {
  const chips = [...document.querySelectorAll('.shell .inst .body [data-page]')].filter((c) => c.getClientRects().length);
  const bad = [];
  const fit = document.querySelector('.shell .inst .body')?.dataset.fit ?? '';
  if (chips.length) bad.push(`the Advanced ${panel} panel still has pages (${chips.map((c) => c.dataset.page).join(', ')}; ${fit})`);
  else if (!document.querySelector(`.shell .inst [data-whole="${panel}"]`)) bad.push(`the Advanced ${panel} panel is not shown whole`);
  // T2 review S1: the part that takes the height left (the XY pad, the fader tracks) keeps 8 px over its floor.
  for (const [sel, floor] of [['.xy', 96], ['.ftrack', 48]]) {
    for (const el of document.querySelectorAll(`.shell .inst [data-whole="${panel}"] ${sel}`)) {
      const h = el.getBoundingClientRect().height;
      if (h < floor + 8 - 0.5) bad.push(`the whole ${panel} panel's ${sel.slice(1)} is ${h.toFixed(0)} px, under ${floor + 8} (its floor and 8 px to spare)`);
    }
  }
  return bad;
}"""


# T2 review E2: whether the instrument panel shown is whole or paged.
SHAPE = "() => document.querySelector('.shell .inst .body [data-whole]') ? 'whole' : 'paged'"


# What must hold while a pad and a panel's dial are used (T1 review S2): the panel shown, the layout, the panel's dials.
SCREEN_HELD = """() => ({ panel: document.querySelector('.shell .inst')?.dataset.panel ?? null,
  size: document.documentElement.dataset.size, dial: !!document.querySelector('.shell .inst .body .dial') })"""


# T3 slice b (spec 9.4): the six punch pads, on the phone's Punch page of the Mix tab ("page") or in the band over the
# tablet pads ("band"): all six there in order, each at least 48 px each way, inside the screen, none overlapping
# another, nothing drawn over any of them (the element at its centre is the pad), and the band inside its 48 px space
# over the grid or the lanes. Absent pads fail.
PUNCH_ORDER = ["cut", "filter", "stutter", "echo", "wash", "riser"]
PUNCH = r"""([where, order]) => {
  const bad = [];
  const box = document.querySelector(where === 'band' ? '.shell .punchpads.punchslot' : '.mixtab .punchpads');
  if (!box || !box.getClientRects().length) return [`no punch pads (${where === 'band' ? 'the band over the pads' : 'the Punch page'})`];
  if (document.querySelectorAll('.punchpads').length !== 1) bad.push(`${document.querySelectorAll('.punchpads').length} sets of punch pads on screen, not 1`);
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const pads = [...box.querySelectorAll('[data-punch]')].filter((p) => p.getClientRects().length);
  const got = pads.map((p) => p.dataset.punch);
  if (got.join() !== order.join()) bad.push(`punch pads ${got.join(', ') || 'none'}, not ${order.join(', ')}`);
  const rs = pads.map((p) => p.getBoundingClientRect());
  const bx = box.getBoundingClientRect();
  rs.forEach((r, i) => {
    const n = got[i];
    if (r.width < 47.5 || r.height < 47.5) bad.push(`the ${n} pad is ${r.width.toFixed(0)} x ${r.height.toFixed(0)} px`);
    if (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5) bad.push(`the ${n} pad is outside the screen`);
    if (r.left < bx.left - 0.5 || r.right > bx.right + 0.5 || r.top < bx.top - 0.5 || r.bottom > bx.bottom + 0.5) bad.push(`the ${n} pad sticks out of its row`);
    for (let j = 0; j < i; j++) {
      const o = rs[j];
      if (Math.min(r.right, o.right) - Math.max(r.left, o.left) > 0.5 && Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top) > 0.5) bad.push(`the ${n} pad overlaps the ${got[j]} pad`);
    }
    const at = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    if (!at || !pads[i].contains(at)) bad.push(`the ${n} pad is covered at its centre`);
    if (!pads[i].querySelector('svg') || !pads[i].dataset.word || pads[i].querySelector('b')?.textContent.trim() !== pads[i].dataset.word) bad.push(`the ${n} pad lacks its icon or its word`);
  });
  if (where === 'band') {
    const under = document.querySelector('.shell .deskgrid') || document.querySelector('.dock .nowlist');
    if (under && bx.bottom > under.getBoundingClientRect().top + 0.5) bad.push('the punch pads overlap the pads under them');
    if (bx.height < 47.5) bad.push(`the punch band is ${bx.height.toFixed(0)} px tall`);
  }
  return bad;
}"""

# Where the punch walk presses the pads: the phone's Punch page and both tablet layouts.
PUNCH_SIZES = [((390, 844), "phone"), ((1280, 800), "landscape"), ((800, 1280), "portrait")]


def walk_punch(page, failures: list, playing: bool) -> None:
    """T3 slice b (spec 9.4, 9.6): at the phone size on the Mix tab's Punch page and at a desk and a dock size, the pads
    pass PUNCH, then a finger on Cut. Playing: Cut is held at once (the engine's state and the pad's look), a finger
    sliding onto Filter keeps Cut held and does not press Filter (pointer capture), and the lift lets Cut go. Stopped: a
    press shows nothing and does nothing (no pad held, lit or waiting; page errors are the caller's). Waits for every pad
    to end, so the walks after it hear the whole mix. Leaves the phone at 390 x 844 in Simple on the Play tab."""
    state = f"((p) => {E}.punchState().find((s) => s.pad === p))"
    mode = "playing" if playing else "stopped"
    if page.evaluate(f"{E}.playing") != playing:
        failures.append(f"punch walk: the transport is not {mode}")
    for size, orient in PUNCH_SIZES:
        page.set_viewport_size({"width": size[0], "height": size[1]})
        if not _wait(page, f"document.documentElement.dataset.size === {orient!r}", 2.0):
            failures.append(f"{size[0]}x{size[1]}: not the {orient} layout")
            continue
        if orient == "phone":
            page.click('[data-tab="mix"]')
            page.click('[data-page="mix:punch"]')
        _settle(page)
        where = f"{size[0]}x{size[1]} punch pads, {mode}"
        for b in page.evaluate(PUNCH, ["page" if orient == "phone" else "band", PUNCH_ORDER]):
            failures.append(f"{where}: {b}")
        cut, flt = page.locator('.punchpads [data-punch="cut"]'), page.locator('.punchpads [data-punch="filter"]')
        if not cut.count() or not flt.count():
            failures.append(f"{where}: no Cut or Filter pad to press")
            continue
        a, f = cut.bounding_box(), flt.bounding_box()
        page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
        page.mouse.down()
        if playing:
            if not _wait(page, f"{state}('cut').held && !!document.querySelector('.punchpads [data-punch=cut].held')", 0.5):
                failures.append(f"{where}: a finger on Cut did not hold it")
            page.mouse.move(f["x"] + f["width"] / 2, f["y"] + f["height"] / 2, steps=4)
            time.sleep(0.1)
            if not page.evaluate(f"{state}('cut').held"):
                failures.append(f"{where}: Cut let go when the finger slid off it")
            if page.evaluate(f"{state}('filter').held"):
                failures.append(f"{where}: a finger sliding from Cut onto Filter pressed Filter")
        else:
            time.sleep(0.2)
            if page.evaluate(f"{E}.punchState().some((s) => s.held || s.start !== null)") or page.locator(".punchpads .held, .punchpads .on, .punchpads .pending").count():
                failures.append(f"{where}: a press while stopped held, lit or queued a pad")
        page.mouse.up()
        if not _wait(page, f"!{state}('cut').held && !document.querySelector('.punchpads .held')", 0.5):
            failures.append(f"{where}: lifting the finger did not let Cut go")
        if playing:
            # T3 review M6: Cut's end is a bar line of the transport and of what is heard: the transport's beats there
            # are a whole bar, and the bar the engine reports turns over on it (its last steps just before, its first just
            # after).
            grid = page.evaluate(
                f"""async () => {{ const e = {E}; const end = e.punchState().find((s) => s.pad === 'cut').end;
                  if (end === null) return null; const beats = e.beatsAt(end);
                  const until = (t) => new Promise((r) => {{ const k = () => e.audioNow() >= t ? r() : setTimeout(k, 5); k(); }});
                  await until(end - 0.12); const before = e.position();
                  await until(end + 0.12); const after = e.position();
                  return {{ beats, before, after }}; }}"""
            )
            if grid is None:
                failures.append(f"{where}: Cut let go has no end line")
            else:
                off = grid["beats"] / 4 - round(grid["beats"] / 4)
                if abs(off) > 1e-3:
                    failures.append(f"{where}: Cut ended at transport beat {grid['beats']:.4f}, not on a bar line")
                pb, pa = grid["before"], grid["after"]
                if pa["step"] > 3 or pb["step"] < 12:
                    failures.append(f"{where}: the bar heard does not change on Cut's end line (before {pb}, after {pa})")
            # T3 review M9: a pad held when the app goes to the background is let go.
            page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
            page.mouse.down()
            if not _wait(page, f"{state}('cut').held", 0.5):
                failures.append(f"{where}: a finger on Cut did not hold it (second press)")
            page.evaluate(
                "() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });"
                " document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; }"
            )
            if not _wait(page, f"!{state}('cut').held && !document.querySelector('.punchpads .held')", 0.5):
                failures.append(f"{where}: Cut stayed held with the app in the background")
            page.mouse.up()
        # Cut returns on the next bar line after release: wait until every pad is out.
        bar_s = 240.0 / page.evaluate(f"{E}.bpm")
        if not _wait(page, f"{E}.punchState().every((s) => s.start === null || (s.end !== null && s.end <= {E}.audioNow()))", bar_s * 2 + 1):
            failures.append(f"{where}: a punch pad never ended")
    page.set_viewport_size({"width": 390, "height": 844})
    _wait(page, "document.documentElement.dataset.size === 'phone'", 2.0)
    page.click('[data-tab="mix"]')
    page.click('[data-page="mix:master"]')
    page.click('[data-tab="play"]')
    print(f"punch walk ({mode}): {len(PUNCH_SIZES)} sizes")


class Fingers:
    """T3 slice c (spec 9.6): real touches through Chrome's DevTools (Input.dispatchTouchEvent), each finger its own id,
    so the page sees touch pointers with distinct pointerIds, as a phone sends them. `down`, `move` and `up` change one
    finger and send every finger still down."""

    def __init__(self, page):
        self.cdp = page.context.new_cdp_session(page)
        self.at: dict = {}

    def _send(self, typ: str) -> None:
        pts = [{"x": x, "y": y, "id": i} for i, (x, y) in self.at.items()]
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd" if not pts else typ, "touchPoints": pts})

    def down(self, i: int, x: float, y: float) -> None:
        self.at[i] = (x, y)
        self._send("touchStart")

    def move(self, i: int, x: float, y: float) -> None:
        self.at[i] = (x, y)
        self._send("touchMove")

    def up(self, i: int) -> None:
        # Chrome lifts the points a touchEnd names; the others stay down.
        x, y = self.at.pop(i)
        self.cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": [{"x": x, "y": y, "id": i}]})

    def lift_all(self) -> None:
        self.at.clear()
        self._send("touchEnd")


def _mid(page, sel: str):
    loc = page.locator(sel)
    if not loc.count():
        return None
    b = loc.first.bounding_box()
    return (b["x"] + b["width"] / 2, b["y"] + b["height"] / 2) if b else None


PULSE = """() => [...document.querySelectorAll('.deskgrid .cell.live.on .pulse')].map((p) => {
  const s = getComputedStyle(p);
  return s.display === 'none' ? -1 : Number(s.opacity);
})"""


def walk_fingers(page, failures: list) -> None:
    """T3 slice c (spec 9.5, 9.6), the transport playing. Many fingers: on the phone's Mix master page two dials turned
    at once, each by its own finger, end with their own values; at the desk an XY pad moved while a finger holds Cut, and
    three pads (Cut, Filter, Riser) held at once, one lifted while the others stay held. Movement: at the desk the pads
    of the playing section pulse (from their meters) and a held Filter pad moves the Mix Filter dial's ghost pointer;
    with motion off (the Mix switch) neither shows and the root is still. Leaves the phone at 390 x 844 in Simple on the
    Play tab, motion on."""
    if not page.evaluate(f"{E}.playing"):
        failures.append("fingers walk: the transport is not playing")
        return
    held = f"((p) => {E}.punchState().find((s) => s.pad === p).held)"
    t = Fingers(page)
    # Two dials at once (phone, Mix, master page).
    page.set_viewport_size({"width": 390, "height": 844})
    _wait(page, "document.documentElement.dataset.size === 'phone'", 2.0)
    page.click('[data-appmode="advanced"]')
    page.click('[data-tab="mix"]')
    page.click('[data-page="mix:master"]')
    _settle(page)
    a, b = _mid(page, '[data-dial="sweep"]'), _mid(page, '[data-dial="pump"]')
    if not a or not b:
        failures.append("fingers: no Filter or Pump dial on the Mix master page")
    else:
        page.evaluate(f"{E}.setMix('sweep', 0); {E}.setMix('pump', 0.5)")
        time.sleep(0.2)
        t.down(1, *a)
        t.down(2, *b)
        for k in range(1, 11):
            t.at[1] = (a[0], a[1] - 5 * k)
            t.move(2, b[0], b[1] + 5 * k)
            time.sleep(0.02)
        t.up(1)
        t.move(2, b[0], b[1] + 60)
        t.lift_all()
        time.sleep(0.3)
        mix = page.evaluate("""() => Object.fromEntries(['sweep', 'pump'].map((k) =>
          [k, Number(document.querySelector(`[data-dial="${k}"]`).getAttribute('aria-valuenow'))]))""")
        if not mix["sweep"] > 0.15:
            failures.append(f"fingers: the Filter dial turned up by one finger while another turned Pump reads {mix['sweep']:.2f} (wanted above 0.15)")
        if not mix["pump"] < 0.35:
            failures.append(f"fingers: the Pump dial turned down by one finger while another turned Filter reads {mix['pump']:.2f} (wanted below 0.35)")
        page.evaluate(f"{E}.setMix('sweep', 0); {E}.setMix('pump', 0.5)")
    page.click('[data-page="mix:master"]')
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    # The desk: an XY pad and a pad together, then three pads.
    page.set_viewport_size({"width": 1280, "height": 800})
    if not _wait(page, "document.documentElement.dataset.size === 'landscape'", 2.0):
        failures.append("fingers: 1280x800 is not the desk")
    page.click('[data-tab="bass"]')
    _settle(page)
    xy, cut = _mid(page, '.xy[data-xy="bass"]'), _mid(page, '.punchpads [data-punch="cut"]')
    if not xy or not cut:
        failures.append("fingers: no Bass XY pad or Cut pad at the desk")
    else:
        box = page.locator('.xy[data-xy="bass"]').first.bounding_box()
        t.down(2, *cut)
        t.down(1, box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5)
        for k in range(1, 9):
            t.move(1, box["x"] + box["width"] * (0.5 + 0.035 * k), box["y"] + box["height"] * (0.5 + 0.035 * k))
            time.sleep(0.02)
        time.sleep(0.1)
        p = page.evaluate(f"{E}.getSong().patches.bass")
        if abs(p["cutoff"] - 0.78) > 0.06 or abs(p["resonance"] - 0.22) > 0.06:
            failures.append(f"fingers: the XY pad moved while a finger held Cut reads {p['cutoff']:.2f} {p['resonance']:.2f} (wanted 0.78 0.22)")
        if not page.evaluate(f"{held}('cut') && !!document.querySelector('.punchpads [data-punch=cut].held')"):
            failures.append("fingers: Cut let go while another finger moved the XY pad")
        t.up(1)
        time.sleep(0.1)
        if not page.evaluate(f"{held}('cut')"):
            failures.append("fingers: lifting the XY finger let Cut go")
        t.lift_all()
        if not _wait(page, f"!{held}('cut')", 0.5):
            failures.append("fingers: lifting the last finger did not let Cut go")
    three = ["cut", "filter", "riser"]
    pts = [_mid(page, f'.punchpads [data-punch="{q}"]') for q in three]
    if not all(pts):
        failures.append("fingers: Cut, Filter or Riser missing from the desk's band")
    else:
        for i, pt in enumerate(pts):
            t.down(i + 1, *pt)
        time.sleep(0.15)
        st = page.evaluate(f"[{', '.join(f'{held}({q!r})' for q in three)}]")
        lit = page.locator(".punchpads .held").count()
        if st != [True, True, True] or lit != 3:
            failures.append(f"fingers: three fingers on Cut, Filter and Riser hold {st} with {lit} pads lit (wanted all three)")
        t.up(2)
        time.sleep(0.15)
        st = page.evaluate(f"[{', '.join(f'{held}({q!r})' for q in three)}]")
        if st != [True, False, True]:
            failures.append(f"fingers: lifting the finger on Filter left {st} held (wanted Cut and Riser only)")
        t.lift_all()
        if not _wait(page, f"{E}.punchState().every((s) => !s.held)", 0.5):
            failures.append("fingers: lifting every finger left a pad held")
    # Movement: the pads pulse, the Filter dial's ghost follows the Filter pad; motion off, neither.
    page.click('[data-appmode="advanced"]')
    page.click('[data-tab="mix"]')
    _settle(page)
    for on in (True, False):
        if not on:
            page.click('[data-motion="off"]')
            time.sleep(0.3)
        seen = []
        for _ in range(20):
            seen += page.evaluate(PULSE)
            time.sleep(0.05)
        f = _mid(page, '.punchpads [data-punch="filter"]')
        ghost = []
        if f and page.locator('.dial[data-dial="sweep"]').count():
            t.down(1, *f)
            for _ in range(15):
                ghost.append(page.evaluate("""() => { const d = document.querySelector('.dial[data-dial="sweep"]');
                  return [d.hasAttribute('data-moved'), getComputedStyle(d.querySelector('.ghost')).display !== 'none'
                    && Number(getComputedStyle(d.querySelector('.ghost')).opacity) > 0]; }"""))
                time.sleep(0.05)
            t.lift_all()
        else:
            failures.append("fingers: no Filter pad and Mix Filter dial together at the desk")
        still = page.evaluate("document.documentElement.classList.contains('still')")
        if on:
            if not seen or max(seen) <= 0:
                failures.append(f"motion on: no pad of the playing section pulsed ({len(seen)} pads read)")
            if not any(g[0] and g[1] for g in ghost):
                failures.append("motion on: a held Filter pad never showed on the Mix Filter dial")
            if still:
                failures.append("motion on: the root is still")
        else:
            if any(v > 0 for v in seen):
                failures.append("motion off: a pad still pulses")
            if any(g[1] for g in ghost):
                failures.append("motion off: the Filter dial's ghost still shows")
            if not still:
                failures.append("motion off: the root is not still")
    page.click('[data-motion="on"]')
    bar_s = 240.0 / page.evaluate(f"{E}.bpm")
    if not _wait(page, f"{E}.punchState().every((s) => s.start === null || (s.end !== null && s.end <= {E}.audioNow()))", bar_s * 2 + 1):
        failures.append("fingers: a punch pad never ended")
    page.click('[data-appmode="simple"]')
    page.set_viewport_size({"width": 390, "height": 844})
    _wait(page, "document.documentElement.dataset.size === 'phone'", 2.0)
    page.click('[data-tab="play"]')
    print("fingers walk: two dials, XY pad with a pad, three pads; pulse and ghost with motion on and off")


def tablet_layout(page, orient: str) -> list:
    """The layout checks of the tablet layout shown: the desk (landscape) or the dock (portrait), and T3's punch pads
    in the band over its pads."""
    return page.evaluate(DESK if orient == "landscape" else DOCK) + page.evaluate(PUNCH, ["band", PUNCH_ORDER])


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
    screenshot fails. T2: an Advanced panel that PAGELESS names for the size (1280 x 800, 1024 x 768, 800 x 1280) and that
    still shows page chips fails, as does one whose XY pad or fader tracks keep less than 8 px over their floor, or that
    lacks a control of its phone pages (T2 review S1, S3). Then, at each size and in both modes, a pad tapped and a panel's dial dragged without changing screen
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
        whole_keys: dict = {}
        for mode in ("simple", "advanced"):
            page.click(f'[data-appmode="{mode}"]')
            adv = mode == "advanced"

            def no_pages(t: str, label: str, m: str | None = None) -> None:
                # T2: at a size of PAGELESS an Advanced panel it names shows no page chip.
                if adv and pageless(size, t, m):
                    _settle(page)
                    for b in page.evaluate(WHOLE, t):
                        failures.append(f"{size[0]}x{size[1]} {label}: {b}")
                    whole_keys.setdefault(f"{t}:{m}" if m else t, set()).update(page.evaluate(CONTROL_KEYS))

            for t in PANELS:
                page.click(f'.rail [data-tab="{t}"]')
                label = f"{mode}-{orient}-{t}"
                if adv and t == "chords":
                    # T2 review E2: whole or paged does not follow the chord count (1 chord, then 8, then as it was).
                    _settle(page)
                    shape0 = page.evaluate(SHAPE)
                    ed = page.evaluate(f"(() => {{ const e = document.querySelector('.secs [data-strip].edit'); return e ? +e.dataset.strip : {E}.position().section; }})()")
                    seq0 = page.evaluate(f"{E}.getSong().sections[{ed}].chords")
                    for n in (1, 8):
                        page.evaluate(f"(n) => {E}.setChords({ed}, Array.from({{length: n}}, (_, i) => ({{degree: i % 7, bars: 1}})))", n)
                        _settle(page)
                        if page.evaluate(SHAPE) != shape0:
                            failures.append(f"{size[0]}x{size[1]} {label}: with {n} chords the panel turned {page.evaluate(SHAPE)} (it was {shape0})")
                    page.evaluate(f"(c) => {E}.setChords({ed}, c)", seq0)
                if t in ("layer1", "layer2"):
                    shapes = set()
                    for m in LAYER_MODES:
                        page.click(f'[data-mode="{t}:{m}"]')
                        _settle(page)
                        shapes.add(page.evaluate(SHAPE))
                        no_pages(t, f"{label}-{m}", m)
                        w.pages(size, f"{label}-{m}")
                        if m == "generative" and adv and pageless(size, t, m):
                            # Pulse adds its own dials and every other style has none: the whole panel holds both.
                            style = page.get_attribute("[data-leadstyle].on", "data-leadstyle")
                            for other in ("pulse", "hook"):
                                if other != style:
                                    page.click(f'[data-leadstyle="{other}"]')
                                    no_pages(t, f"{label}-{m}-{other}", m)
                                    w.pages(size, f"{label}-{m}-{other}")
                            page.click(f'[data-leadstyle="{style}"]')
                    page.click(f'[data-mode="{t}:{modes[t]}"]')
                    # T2 review E2, M5: a layer is whole or paged by size alone, the same in every mode.
                    if adv and len(shapes) > 1:
                        failures.append(f"{size[0]}x{size[1]} {label}: the layer is whole in some modes and paged in others")
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
        # T2 review S3: every control of the phone's Advanced panel (all its pages, at 412 x 915) is in the whole panel.
        for g, got in whole_keys.items():
            want = PHONE_KEYS.get(g)
            if not want:
                failures.append(f"{size[0]}x{size[1]}: no phone panel {g} to compare the whole one with")
                continue
            missing = sorted(want - got)
            if missing:
                failures.append(f"{size[0]}x{size[1]}: the whole {g} panel lacks controls of its phone pages: {', '.join(missing)}")
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
            # F1 review E1: the bag is seeded before the first load, so the run is the same every time. SHOTS_LAUNCH=<id>
            # keeps that vibe's launch jam open for the walks (a check of one vibe's screens, e.g. drone); by default the
            # default song is opened from Songs, as the smoke's open_app does, so the walks measure what they did
            # before F1.
            launch = os.environ.get("SHOTS_LAUNCH")
            page.add_init_script(bag_seed(launch) if launch else BAG_SEED)
            page.goto(f"http://localhost:{port}/index.html")
            end = time.time() + 5
            while time.time() < end and not page.evaluate("!!window.__groovebox"):
                time.sleep(0.05)
            close_picker(page)
            if launch:
                if page.evaluate(f"{E}.getSong().style") != launch:
                    failures.append(f"SHOTS_LAUNCH={launch}: the launch jam is {page.evaluate(f'{E}.getSong().style')!r}")
            else:
                page.evaluate("window.__keeper.create()")
                if not _wait(page, "window.__keeper.list().then(l => l.length === 1 && l[0].name === 'Song 1')", 3.0):
                    failures.append("the default song did not open from Songs")
            sample_play(page, failures, "first tap after load", True)
            page.click('[data-strip="1"]')  # Groove: every instrument on
            time.sleep(2.5)
            # F1: the vibe picker at the four sizes of its Done-when line.
            n = walk_picker(page, failures, out)
            n += walk_frame(page, failures, out)
            # F2: the kick quadrant at the four sizes of its Done-when line, both modes; DROP and Morph unmoved.
            n += walk_kick_pad(page, failures, out)
            n += walk_live(page, failures, out)
            # P10d: with Ambient (Morph on) playing, every tap during a morph.
            walk_play_button(page, failures, "Ambient, Morph on")
            # T1: the tablet sizes, last (the walks above are the phone's).
            n += walk_tablet(page, failures, out)
            # T3 slice b: the punch pads pressed while playing, then while stopped.
            walk_punch(page, failures, True)
            # T3 slice c: many fingers, and the movement on and off.
            walk_fingers(page, failures)
            page.click("#play")
            _wait(page, f"!{E}.playing", 3.0)
            walk_punch(page, failures, False)
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
