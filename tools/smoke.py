#!/usr/bin/env python3
"""Headless smoke test: serve a built folder, press Play, check that audio runs and switches land on the bar,
then walk the shell (every tab, section strip, Play grid, chords, XY pad, dials, section menu) and every G3 control
(drum presets and sequencer, bass and synth rhythms, waves and dials, mix levels and meter, DnB at 174 bpm) and
every G4 layer control (three modes, lead row, new seed, pattern and sound dials), G5 (two takes saved as MP3
and walked frame by frame, the event log, songs surviving a reload, new and delete) and the P1 frame (header,
one section strip whose tap always plays from the next bar, Simple's Now tiles, the frame walk of tools/shots.py
at 360 x 640 and 412 x 915: nothing scrolls, no control cut off, no text that wraps, clips or overflows) and the
P1b look (DM Sans only, the spec's icons where its table says, lanes that match the engine's notes, a playhead
in time, sentence case, the motion switch and the states without motion) with no page error, no control under
48 px and no more than six dials on one screen. P3: the vibe picker opens the app, every vibe loads mid-jam on the bar line
as a new song and plays every instrument audibly in its groove section, and the vibe arrows step on the bar.
P5: Layer 1 sounds in each of the five lead styles, and its voice glides and accents notes.
P6: every lead dial of every style turned while playing reaches the section, the output never clips, the lane
counts the phrase's bars, and the layer switched off lets every voice go (no stuck note); Simple picks the style.

Usage: python3 tools/smoke.py dist [screenshot.png]
Exits 1 on any failure. Needs Python Playwright and Chrome or Chromium.
It checks that sound is produced and nothing throws. It cannot judge how it sounds.
"""
import math
import os
import re
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mp3check import mp3_info  # noqa: E402
from shots import simple_words, walk_frame  # noqa: E402

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


def pick_chip(page, name: str, value: str) -> None:
    """Click a picker's chip (P3: a picker with more entries than fit shows them a page at a time behind More)."""
    sel = f'[data-{name}="{value}"]'
    for _ in range(12):
        if page.locator(sel).count() and page.locator(sel).is_visible():
            page.click(sel)
            return
        if not page.locator(f'[data-more="{name}"]').count():
            break
        page.click(f'[data-more="{name}"]')
    page.click(sel)  # fails with Playwright's own message


def hold(page, selector: str) -> None:
    """Long-press an element (the section sheet, a Now tile)."""
    drag(page, selector, 0, 0, hold=0.8)


def walk_now(page, failures: list) -> None:
    """P1, Simple, while playing: the Play tab's Now view (five tiles of the playing section; a tap switches
    at the next bar, a hold opens the tab), no Edit without playing, and a strip tap on another tab
    plays that section from the next bar, as on the Play tab."""
    page.click('[data-tab="play"]')
    tiles = page.eval_on_selector_all("[data-now]", "els => els.map(e => e.dataset.now)")
    if tiles != LAYERS:
        failures.append(f"the Now view shows {tiles}, not the five instruments")
    sec = page.evaluate("window.__groovebox.position().section")
    was = page.evaluate(f"{SONG}.sections[{sec}].on.layer2")
    wait_for(page, "window.__groovebox.position().step === 2", 3.0)
    page.click('[data-now="layer2"]')
    if "pending" not in (page.get_attribute('[data-now="layer2"]', "class") or ""):
        failures.append("a tapped Now tile is not shown as switching on the next bar")
    if page.evaluate(f"{SONG}.sections[{sec}].on.layer2") != was:
        failures.append("a Now tile switched at once, not on the next bar")
    if not wait_for(page, f"{SONG}.sections[{sec}].on.layer2 === {str(not was).lower()}", 4.0):
        failures.append("a Now tile's switch did not land")
    page.click('[data-now="layer2"]')
    wait_for(page, "window.__groovebox.pending().toggles.length === 0", 4.0)
    hold(page, '[data-now="bass"]')
    if page.get_attribute('[data-tab="bass"]', "aria-current") != "true":
        failures.append("holding a Now tile did not open its tab")
    if page.evaluate("window.__groovebox.pending().toggles.length"):
        failures.append("holding a Now tile also switched it")
    # On the Bass tab: a strip tap plays that section from the next bar.
    other = (sec + 1) % page.evaluate(f"{SONG}.sections.length")
    page.click(f'[data-strip="{other}"]')
    if page.evaluate("window.__groovebox.pending().section") != other:
        failures.append("a strip tap on the Bass tab did not queue the section")
    if not wait_for(page, f"window.__groovebox.position().section === {other}", 4.0):
        failures.append("a strip tap on the Bass tab did not land")
    page.click(f'[data-strip="{sec}"]')
    wait_for(page, f"window.__groovebox.position().section === {sec}", 4.0)
    hold(page, f'[data-strip="{other}"]')
    if page.locator("#section-edit").count():
        failures.append("Simple offers Edit without playing")
    page.click("#section-close")
    page.click('[data-tab="play"]')
    print(f"Now view: {len(tiles)} tiles, tap lands on the bar, hold opens the tab; strip tap from Bass played {sectionLetter(other)}")


def sectionLetter(i: int) -> str:
    return chr(65 + i)


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
    page.click('[data-page="chords:key"]')
    check_sizes(page, "chords key page", failures)
    page.click('[data-mood="deep"]')
    page.click('[data-key="D"]')
    song = page.evaluate(SONG)
    if song["mood"] != "deep" or song["key"] != "D":
        failures.append("mood or key did not change")
    page.click('[data-mood="house"]')
    page.click('[data-key="A"]')
    page.click('[data-page="chords:chords"]')
    print(f"chords edited in section {playing}: {[c['degree'] for c in seq2]}")

    # Advanced: hold section C and choose "Edit without playing": it is edited silently while B plays.
    hold(page, '[data-strip="2"]')
    if not page.locator("#section-edit").count():
        failures.append("the section sheet offers no Edit without playing in Advanced")
        return
    page.click("#section-edit")
    tile = page.inner_text('[data-strip="2"]')
    if "editing" not in tile.lower():
        failures.append(f"edit without playing did not mark section C: {tile!r}")
    if page.evaluate("window.__groovebox.pending().section") is not None:
        failures.append("edit without playing queued a section switch")
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
    hold(page, '[data-strip="2"]')
    if page.inner_text("#section-edit") != "Stop editing":
        failures.append("the edited section's sheet does not offer Stop editing")
    page.click("#section-edit")  # back to following
    if "editing" in page.inner_text('[data-strip="2"]').lower():
        failures.append("Stop editing left section C marked Editing")

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
    page.click('[data-page="mix:audio"]')
    for h in ["interactive", "playback"]:
        if not page.locator(f'[data-hint="{h}"]').is_disabled():
            failures.append(f"buffer choice {h} is not disabled while playing")
    page.click('[data-page="mix:master"]')

    # Tempo: drag up on the bpm pill.
    bpm = page.evaluate(f"{SONG}.bpm")
    drag(page, "#bpm", 0, -40)
    bpm2 = page.evaluate(f"{SONG}.bpm")
    if bpm2 <= bpm:
        failures.append(f"bpm drag did nothing ({bpm} -> {bpm2})")
    drag(page, "#bpm", 0, 40)

    # Section sheet: hold a section in the strip, rename, delete, add back.
    page.click('[data-tab="play"]')
    hold(page, '[data-strip="3"]')
    if not page.locator("#section-name").count():
        failures.append("holding a section did not open the section sheet")
        return
    check_sizes(page, "section menu", failures)
    page.fill("#section-name", "Drop")
    page.click("#section-rename")
    if page.evaluate(f"{SONG}.sections[3].name") != "Drop":
        failures.append("rename failed")
    if page.evaluate("window.__groovebox.pending().section") is not None:
        failures.append("a long-press also switched section")
    hold(page, '[data-strip="3"]')
    page.click("#section-delete")
    n = page.evaluate(f"{SONG}.sections.length")
    if n != 3:
        failures.append(f"delete failed: {n} sections")
    hold(page, '[data-strip="0"]')
    page.click("#section-add")
    n = page.evaluate(f"{SONG}.sections.length")
    if n != 4 or page.locator('[data-strip="3"]').count() != 1:
        failures.append(f"add section failed: {n} sections")
    print("section menu: rename, delete, add")

    # Copy section A while B plays: B moves to index 2, and positions scheduled before the copy
    # (carrying the old index) must still name Groove once drawn.
    hold(page, '[data-strip="3"]')
    page.click("#section-delete")
    hold(page, '[data-strip="0"]')
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


def turn(page, selector: str) -> float:
    """Drag a dial up (or down when it sits high) and return how far its value moved."""
    before = float(page.get_attribute(selector, "aria-valuenow"))
    lo = float(page.get_attribute(selector, "aria-valuemin"))
    hi = float(page.get_attribute(selector, "aria-valuemax"))
    up = before < (lo + hi) / 2
    drag(page, selector, 0, -70 if up else 70)
    time.sleep(0.03)
    return abs(float(page.get_attribute(selector, "aria-valuenow")) - before)


def dials_on_screen(page, where: str, failures: list) -> list:
    ids = page.eval_on_selector_all(".body [data-dial]", "els => els.map(e => e.dataset.dial)")
    if len(ids) > 6:
        failures.append(f"{len(ids)} dials on one screen on {where}")
    return ids


def turn_all(page, where: str, failures: list) -> int:
    """Turn every dial on screen; each must move, and the patch or mix must follow."""
    ids = dials_on_screen(page, where, failures)
    for d in ids:
        song = page.evaluate(SONG)
        mix = page.evaluate("window.__groovebox.getMix()")
        if turn(page, f'[data-dial="{d}"]') < 0.05:
            failures.append(f"dial {d} on {where} did not move")
        if page.evaluate(SONG) == song and page.evaluate("window.__groovebox.getMix()") == mix:
            failures.append(f"dial {d} on {where} changed nothing in the engine")
    check_sizes(page, where, failures)
    return len(ids)


def read_level(page, seconds: float, settle: float) -> float:
    """Loudest master reading over `seconds`, after `settle` seconds. The meter's RMS falls only by its
    smoothing each time it is read, so it is read through the settle too: a reading after an unread
    pause would still carry the level from before the change."""
    end = time.time() + settle
    while time.time() < end:
        page.evaluate("window.__groovebox.level()")
        time.sleep(0.05)
    peak = -999.0
    for _ in range(int(seconds / 0.1)):
        time.sleep(0.1)
        v = page.evaluate("window.__groovebox.level()")
        if v is not None:
            peak = max(peak, v)
    return peak


def solo_level(page, layer: str, seconds: float = 2.0, settle: float = 0.4) -> float:
    """Loudest master reading with one instrument soloed, after `settle` seconds (the shared reverb tail)."""
    solo = "(keep)=>{const e=window.__groovebox;for(const l of %r)e.setLayer(l,keep===null||l===keep)}" % LAYERS
    page.evaluate(solo, layer)
    peak = read_level(page, seconds, settle)
    page.evaluate(solo, None)
    return peak


DRUM_VOICES = ["kick", "clap", "hat", "open"]
TRIMS = {"kick": 0.95, "clap": 0.6, "hat": 0.22, "open": 0.18}  # src/engine/audio.ts Drums.trims


def wait_for_value(page, expr: str, want: float, seconds: float = 1.0) -> float:
    """Poll a numeric expression until it is within 1e-3 of `want`; return the last reading."""
    end = time.time() + seconds
    v = page.evaluate(expr)
    while abs(v - want) > 1e-3 and time.time() < end:
        time.sleep(0.03)
        v = page.evaluate(expr)
    return v


def walk_drum_levels(page, saved: dict, failures: list) -> None:
    """Each drum voice alone (G3 review E1): its level at 0 brings its own gain to 0, with the other
    three at their settings, and takes that voice out of the sound; back at its setting it returns."""
    set_level = "([v,x])=>window.__groovebox.setParam('drums', v+'Level', x)"
    gain = "window.__groovebox.drumGain('%s')"
    # The drums soloed for the whole walk, with no sends, the filter open and every decay at its middle,
    # so each reading is the voice itself: no other instrument's reverb tail comes back between two
    # readings, and a hat turned to its shortest decay does not read as silence.
    page.evaluate("()=>window.__groovebox.setParams('drums', {delay: 0, reverb: 0, cutoff: 1, kickDecay: 0.5, clapDecay: 0.5, hatDecay: 0.5, openDecay: 0.5})")
    solo = "(keep)=>{const e=window.__groovebox;for(const l of %r)e.setLayer(l,keep===null||l===keep)}" % LAYERS
    page.evaluate(solo, "drums")
    read_level(page, 0.0, settle=4.0)
    report = []
    for v in DRUM_VOICES:
        others = [o for o in DRUM_VOICES if o != v]
        # 1. Every voice at its setting, then this one to 0: its gain reaches 0, the others' stay.
        for o in DRUM_VOICES:
            want = TRIMS[o] * saved[o + "Level"]
            if abs(wait_for_value(page, gain % o, want) - want) > 1e-3:
                failures.append(f"{o}Level back to {saved[o + 'Level']} left its gain at {page.evaluate(gain % o):.3f}")
        page.evaluate(set_level, [v, 0])
        g = wait_for_value(page, gain % v, 0.0)
        if abs(g) > 1e-3:
            failures.append(f"{v}Level 0 left its gain at {g:.3f}")
        for o in others:
            want = TRIMS[o] * saved[o + "Level"]
            if abs(page.evaluate(gain % o) - want) > 1e-3:
                failures.append(f"{v}Level 0 moved the {o} gain to {page.evaluate(gain % o):.3f} (want {want:.3f})")
        # 2. Heard alone: the other three at 0, this one at its setting, then at 0.
        for o in others:
            page.evaluate(set_level, [o, 0])
        page.evaluate(set_level, [v, saved[v + "Level"]])
        g = wait_for_value(page, gain % v, TRIMS[v] * saved[v + "Level"])
        if abs(g - TRIMS[v] * saved[v + "Level"]) > 1e-3:
            failures.append(f"{v}Level back to {saved[v + 'Level']} left its gain at {g:.3f}")
        alone = read_level(page, 3.0, settle=1.0)
        page.evaluate(set_level, [v, 0])
        gone = read_level(page, 2.2, settle=1.0)
        gains = [round(page.evaluate(gain % o), 4) for o in DRUM_VOICES]
        if any(gains):
            failures.append(f"every drum level at 0 left gains {dict(zip(DRUM_VOICES, gains))}")
        report.append(f"{v} {alone:.1f} -> {gone:.1f}")
        # Closed hats alone read about -45 to -65 dB (trim 0.22, velocity 0.3, high-passed); silence reads below -100.
        if alone < -90:
            failures.append(f"drum voice {v} alone is silent ({alone:.1f} dB)")
        if not gone < alone - 20:
            failures.append(f"{v}Level 0 did not silence the {v} ({alone:.1f} -> {gone:.1f} dB)")
        for o in DRUM_VOICES:
            page.evaluate(set_level, [o, saved[o + "Level"]])
    page.evaluate(solo, None)
    page.evaluate("(p)=>window.__groovebox.setParams('drums', p)", saved)
    print("drum voices alone, level at setting -> 0 (dB): " + ", ".join(report))


def walk_held_synth(page, sec: int, failures: list) -> None:
    """Synth on Held: Detune ramps the sounding chord's sub-oscillators to the new spread (G3 review S1),
    and a switch to Stabs mid-chord lets go of the held chord within a bar (G3 review M8)."""
    S = f"{SONG}.sections[{sec}]"
    chords = page.evaluate(f"{S}.chords")
    patch = page.evaluate(f"{SONG}.patches.synth")
    # Two-bar chords, so a held chord would outlast the bar if the switch did not release it; short
    # attack and release, so the voice count follows the notes.
    page.evaluate(f"window.__groovebox.setChords({sec}, [{{degree: 0, bars: 2}}, {{degree: 3, bars: 2}}])")
    page.evaluate("window.__groovebox.setParams('synth', {attack: 0.005, release: 0.05})")
    page.click('[data-page="synth:rhythm"]')
    pick_chip(page, "rhythm", "sustained")
    if not wait_for(page, "window.__groovebox.activeVoices('synth') >= 3", 5.0):
        failures.append(f"synth on Held sounds no chord ({page.evaluate('window.__groovebox.activeVoices(' + chr(39) + 'synth' + chr(39) + ')')} voices)")
    time.sleep(0.3)
    held = page.evaluate("window.__groovebox.activeVoices('synth')")

    # Detune on the held chord: every sub-oscillator lands on +-spread/2 of the new spread.
    before = page.evaluate("window.__groovebox.detunes('synth')")
    page.click('[data-page="synth:sound"]')
    turn(page, '[data-dial="synth:detune"]')
    spread = page.evaluate(f"{SONG}.patches.synth.detune") * 60
    time.sleep(0.25)
    after = page.evaluate("window.__groovebox.detunes('synth')")
    if not after:
        failures.append("no sub-oscillator detunes read on the held chord")
    elif any(abs(abs(d) - spread / 2) > 0.05 for d in after):
        failures.append(f"Detune on a held chord did not land on +-{spread / 2:.1f} cents: {after}")
    if before and after and max(map(abs, before)) == max(map(abs, after)):
        failures.append(f"Detune did not change the held chord's spread ({before} -> {after})")
    print(f"held chord {held} voices, detune {max(map(abs, before or [0])):.1f} -> {spread / 2:.1f} cents each way")

    # Held -> Stabs mid-chord: the held chord is released, so within a bar there is a moment between
    # two short stabs with no voice sounding. A held chord left on (two-bar chords) never lets it reach 0.
    bar = 4 * 60 / page.evaluate(f"{SONG}.bpm")
    page.click('[data-page="synth:rhythm"]')
    pick_chip(page, "rhythm", "stabs")
    low = held
    end = time.time() + bar + 0.3
    while time.time() < end:
        low = min(low, page.evaluate("window.__groovebox.activeVoices('synth')"))
        time.sleep(0.02)
    print(f"Held -> Stabs: synth voices {held} -> as low as {low} within a bar")
    if low != 0:
        failures.append(f"switching Held to Stabs kept the held chord ({held} voices, never below {low} within a bar)")

    page.evaluate(f"(c)=>window.__groovebox.setChords({sec}, c)", chords)
    page.evaluate("(p)=>window.__groovebox.setParams('synth', {attack: p.attack, release: p.release})", patch)


def walk_g3(page, failures: list) -> None:
    """G3: every control of the Drums, Bass, Synth and Mix tabs, used while the transport runs."""
    sec = page.evaluate("window.__groovebox.position().section")
    S = f"{SONG}.sections[{sec}]"

    # Drums: the five presets, the sequencer for each voice, revert, both dial pages.
    page.click('[data-tab="drums"]')
    for preset in page.evaluate("window.__data.beats"):
        pick_chip(page, "preset", preset)
        time.sleep(0.1)
        if page.evaluate(f"{S}.drums.preset") != preset:
            failures.append(f"drum preset {preset} did not take")
    pick_chip(page, "preset", "fourFloor")
    for voice in ["kick", "clap", "hat", "open"]:
        page.click(f'[data-voice="{voice}"]')
        before = page.evaluate(f"{S}.drums.grid ? {S}.drums.grid.{voice} : null")
        page.click(f'[data-step="{voice}:5"]')
        after = page.evaluate(f"{S}.drums.grid && {S}.drums.grid.{voice}")
        if not after or after == before:
            failures.append(f"sequencer step did not change the {voice} row")
        check_sizes(page, f"drums sequencer {voice}", failures)
    if page.evaluate(f"{S}.drums.preset") != "fourFloor" or not page.evaluate(f"!!{S}.drums.grid"):
        failures.append("the sequencer did not open the preset")
    time.sleep(0.6)  # hear the edited beat
    page.click("#drums-revert")
    if page.evaluate(f"{S}.drums.grid !== undefined"):
        failures.append("revert did not drop the sequencer edit")
    page.click('[data-page="drums:kick"]')
    n = turn_all(page, "drums page 1", failures)
    page.click('[data-page="drums:hats"]')
    n += turn_all(page, "drums page 2", failures)
    page.click('[data-page="drums:beat"]')
    if n != 11:
        failures.append(f"drums tab has {n} dials, expected 11 over two pages (Swing since P2)")

    # Drum level is audible: the kick, clap and hats down to 0 silence the drum solo.
    loud = solo_level(page, "drums")
    saved = page.evaluate(f"{SONG}.patches.drums")
    page.evaluate("()=>{for(const v of ['kick','clap','hat','open'])window.__groovebox.setParam('drums', v+'Level', 0)}")
    quiet = solo_level(page, "drums", settle=4.0)
    page.evaluate("(p)=>{for(const v of ['kick','clap','hat','open'])window.__groovebox.setParam('drums', v+'Level', p[v+'Level'])}", saved)
    print(f"drums solo {loud:.1f} dB, every voice level 0: {quiet:.1f} dB")
    if not quiet < loud - 20:
        failures.append(f"drum voice levels did not silence the drums ({loud:.1f} -> {quiet:.1f} dB)")
    walk_drum_levels(page, saved, failures)

    # Bass and Synth: every rhythm, every wave, every dial.
    for inst, rhythms in [("bass", page.evaluate("window.__data.bass")), ("synth", page.evaluate("window.__data.synth"))]:
        page.click(f'[data-tab="{inst}"]')
        page.click(f'[data-page="{inst}:rhythm"]')
        for r in rhythms:
            pick_chip(page, "rhythm", r)
            time.sleep(0.25)
            if page.evaluate(f"{S}.{inst}.rhythm") != r:
                failures.append(f"{inst} rhythm {r} did not take")
        pick_chip(page, "rhythm", rhythms[0])
        for w in ["square", "triangle", "sine", "sawtooth"]:
            page.click(f'[data-wave="{w}"]')
            time.sleep(0.25)
            if page.evaluate(f"{SONG}.patches.{inst}.wave") != w:
                failures.append(f"{inst} wave {w} did not take")
        page.click(f'[data-page="{inst}:sound"]')
        k = turn_all(page, f"{inst} tab", failures)
        page.click(f'[data-page="{inst}:rhythm"]')
        print(f"{inst}: {len(rhythms)} rhythms, 4 waves, {k} dials")
        lvl = solo_level(page, inst)
        if lvl < -60:
            failures.append(f"{inst} went silent after its controls were moved ({lvl:.1f} dB)")
        if inst == "synth":
            walk_held_synth(page, sec, failures)

    # Mix: the meter reads, both pages of dials, the levels act.
    page.click('[data-tab="mix"]')
    time.sleep(0.3)
    meter = page.inner_text("#meter")
    if "db" not in meter.lower():
        failures.append(f"master meter shows no level: {meter!r}")
    page.click('[data-page="mix:levels"]')
    ids = dials_on_screen(page, "mix levels", failures)
    if sorted(ids) != sorted(f"level:{i}" for i in LAYERS):
        failures.append(f"mix levels page has {ids}")
    for i in LAYERS:
        before = page.evaluate(f"{SONG}.patches.{i}.level")
        turn(page, f'[data-dial="level:{i}"]')
        if abs(page.evaluate(f"{SONG}.patches.{i}.level") - before) < 0.05:
            failures.append(f"mix level {i} did not move")
    check_sizes(page, "mix levels", failures)
    bass = solo_level(page, "bass")
    lvl = page.evaluate(f"{SONG}.patches.bass.level")
    page.evaluate("window.__groovebox.setParam('bass','level',0)")
    muted = solo_level(page, "bass", settle=4.0)
    page.evaluate(f"window.__groovebox.setParam('bass','level',{lvl})")
    print(f"master meter {meter.split()[-2:]}; bass solo {bass:.1f} dB, level 0: {muted:.1f} dB")
    if not muted < bass - 20:
        failures.append(f"bass level 0 did not silence the bass ({bass:.1f} -> {muted:.1f} dB)")
    page.click('[data-page="mix:master"]')
    if len(dials_on_screen(page, "mix master", failures)) != 3:
        failures.append("mix master page lost its dials")

    # Drum and bass tempo: the DnB beat and sub at 174 bpm, then back.
    bpm = page.evaluate(f"{SONG}.bpm")
    page.evaluate(f"()=>{{const e=window.__groovebox;e.bpm=174;e.setDrumPreset({sec},'dnb');e.setBassRhythm({sec},'dnbSub')}}")
    peaks = []
    levels = []
    for _ in range(12):
        time.sleep(0.2)
        levels.append(page.evaluate("window.__groovebox.level()"))
        peaks.append(page.evaluate("window.__groovebox.peak()"))
    print(f"at 174 bpm, dnb + dnbSub: level up to {max(levels):.1f} dB, peak {max(peaks):.1f} dBFS")
    if max(levels) < -40:
        failures.append("drum and bass at 174 bpm is silent")
    if max(peaks) >= 0:
        failures.append(f"drum and bass at 174 bpm clips ({max(peaks):.1f} dBFS)")
    for name in ["drums", "bass"]:
        lv = solo_level(page, name, 1.2)
        if lv < -60:
            failures.append(f"{name} silent at 174 bpm ({lv:.1f} dB)")
    page.evaluate(f"()=>{{const e=window.__groovebox;e.bpm={bpm};e.setDrumPreset({sec},'fourFloor');e.setBassRhythm({sec},'offbeat')}}")


# ---- P1b: the look --------------------------------------------------------------------------

LANE_MATCH = """([sel, id]) => {
  const e = window.__groovebox, p = e.position(), l = e.lanes(p.playing ? p.bar : undefined);
  const el = document.querySelector(sel);
  if (!el) return {missing: true};
  // Each note by where it starts and what it is (pitch or drum voice), in the order the lane draws them.
  const want = l.notes[id].filter(n => n.step + n.shift < 16).map(n => `${n.step + n.shift}:${n.voice ?? n.pitch}`);
  const drawn = [...el.querySelectorAll('.n')].map(n => `${n.dataset.s}:${n.dataset.k}`);
  return {got: Number(el.dataset.notes), drawn, want, on: l.on[id],
          cls: el.classList.contains('on'), bar: p.bar, step: p.step};
}"""


def check_lane(page, sel: str, inst: str, failures: list, where: str) -> None:
    """A lane draws exactly the notes the engine reports for its instrument this bar, each at its step with
    its pitch or voice, greyed when off."""
    for attempt in range(6):
        r = page.evaluate(LANE_MATCH, [sel, inst])
        if r.get("missing"):
            failures.append(f"{where}: no lane for {inst}")
            return
        # A bar line may pass between the render and the read: read again away from the bar's last steps.
        if r["step"] >= 14 or r["step"] <= 1:
            time.sleep(0.15)
            continue
        if r["got"] != len(r["want"]) or r["drawn"] != r["want"]:
            if attempt < 5:
                time.sleep(0.15)
                continue
            failures.append(f"{where}: {inst} lane draws {r['drawn']}, the engine plays {r['want']} (bar {r['bar']})")
        if r["on"] != r["cls"]:
            failures.append(f"{where}: {inst} lane shows {'on' if r['cls'] else 'off'}, the engine has it {'on' if r['on'] else 'off'}")
        return
    failures.append(f"{where}: could not read the {inst} lane away from a bar line")


PLAYHEAD = """(sel) => {
  const ph = document.querySelector(sel);
  if (!ph) return null;
  const w = ph.getBoundingClientRect().width;
  const m = new DOMMatrixReadOnly(getComputedStyle(ph).transform);
  const p = window.__groovebox.position();
  return {at: (m.m41 / w) * 16, step: p.step, playing: p.playing,
          p16: parseFloat(getComputedStyle(ph).getPropertyValue('--p16'))};
}"""


def check_playhead(page, sel: str, failures: list, where: str, still: bool = False) -> None:
    """The playhead keeps time: it sits within about a step of the step heard, and sweeps the whole bar."""
    seen = set()
    bad = []
    for _ in range(30):
        time.sleep(0.05)
        r = page.evaluate(PLAYHEAD, sel)
        if r is None:
            failures.append(f"{where}: no playhead")
            return
        d = (r["at"] - r["step"]) % 16
        d = min(d, 16 - d)
        if d > 1.6:
            bad.append(f"{r['at']:.2f} at step {r['step']}")
        if still and abs(r["at"] - round(r["at"])) > 0.02:
            bad.append(f"moves between steps with motion off ({r['at']:.2f})")
        seen.add(int(r["at"]) // 4)
    if bad:
        failures.append(f"{where}: playhead out of time: {bad[:4]}")
    if len(seen) < 3:
        failures.append(f"{where}: playhead does not sweep the bar (quarters seen {sorted(seen)})")


FONTS = r"""() => {
  const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, ''));
  const faces = [...document.fonts].map(f => f.family.replace(/"/g, ''));
  const files = performance.getEntriesByType('resource').map(r => r.name).filter(n => /\.(woff2?|ttf|otf)(\?|$)|fonts\./.test(n));
  const other = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const f = getComputedStyle(el).fontFamily.replace(/"/g, '');
    if (!f.startsWith('DM Sans')) other.add(f);
  }
  return {loaded, faces, files, other: [...other]};
}"""


def check_fonts(page, failures: list) -> None:
    """No font but DM Sans is loaded, and it is the app's own file (spec 8.12)."""
    r = page.evaluate(FONTS)
    if set(r["faces"]) != {"DM Sans"} or "DM Sans" not in r["loaded"]:
        failures.append(f"fonts: faces {r['faces']}, loaded {r['loaded']}; only DM Sans may be loaded")
    for f in r["files"]:
        if "localhost" not in f or "dm-sans" not in f:
            failures.append(f"fonts: a font file other than the app's DM Sans was fetched: {f}")
    if not r["files"]:
        failures.append("fonts: the DM Sans file was not fetched")
    if r["other"]:
        failures.append(f"fonts: elements drawn in another face: {r['other']}")
    print(f"fonts: {sorted(set(r['loaded']))} from {[f.rsplit('/', 1)[-1] for f in r['files']]}")


# Spec 8.12's icon table, where each icon goes at this row (Drone, Notes, Feel, FX, Morph, DROP and
# the effects do not exist yet).
ICON_PLACES = [
    ('[data-tab="play"]', "grid_view"), ('[data-tab="chords"]', "piano"), ('[data-tab="drums"]', "adjust"),
    ('[data-tab="bass"]', "graphic_eq"), ('[data-tab="synth"]', "airwave"), ('[data-tab="layer1"]', "layers"),
    ('[data-tab="layer2"]', "stacks"), ('[data-tab="mix"]', "tune"), ("#new-jam", "add"),
    ('[data-now="drums"]', "adjust"), ('[data-now="bass"]', "graphic_eq"), ('[data-now="synth"]', "airwave"),
    ('[data-now="layer1"]', "layers"), ('[data-now="layer2"]', "stacks"),
]
LAYER_ICONS = [
    ('[data-mode="layer1:generative"]', "show_chart"), ('[data-mode="layer1:arp"]', "stairs"),
    ('[data-mode="layer1:pad"]', "cloud"), ('[data-seed="layer1"]', "casino"), ('[data-back="layer1"]', "undo"),
    (".headrow .head", "layers"),
]

CAPS = r"""() => {
  const bad = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.parentElement || !n.parentElement.getClientRects().length) continue;
    for (const w of n.textContent.split(/[^A-Za-z]+/)) {
      if (w.length > 1 && w === w.toUpperCase() && w !== 'DROP' && !/^[IV]+$/.test(w) && !/^W+$/.test(w)) bad.push(n.textContent.trim());
    }
    const tt = getComputedStyle(n.parentElement).textTransform;
    if (tt === 'uppercase') bad.push(`uppercase: ${n.textContent.trim()}`);
  }
  return bad;
}"""


BARE = """() => [...document.querySelectorAll('.pager button, .glabel, .dials.n5 .dial label')]
  .filter(e => e.getClientRects().length && !e.querySelector('[data-icon]')).map(e => e.textContent.trim())"""


def check_bare(page, failures: list, where: str) -> None:
    """Every page chip, group heading and instrument dial name on screen carries its icon (P1b review M1 to M3)."""
    for t in page.evaluate(BARE):
        failures.append(f"{where}: {t!r} has no icon")


def check_icons(page, places: list, failures: list, where: str) -> None:
    for sel, icon in places:
        got = page.eval_on_selector_all(f"{sel} [data-icon]", "els => els.map(e => e.dataset.icon)")
        if icon not in got:
            failures.append(f"{where}: {sel} has icons {got}, the spec's table says {icon}")
        # An icon always sits beside its word.
        text = page.inner_text(sel).strip() if page.locator(sel).count() else ""
        if not text:
            failures.append(f"{where}: {sel} has an icon but no word")


PROBE = """(sel) => {
  // The colours a tile draws, resolved (--c and --card may be var() chains), and its hatch layer.
  const el = document.querySelector(sel);
  if (!el) return null;
  const probe = (v) => { const i = document.createElement('i'); i.style.color = v; el.appendChild(i);
    const c = getComputedStyle(i).color; i.remove(); return c.match(/[\\d.]+/g).slice(0, 3).map(Number); };
  const b = getComputedStyle(el, '::before');
  return {c: probe('var(--c)'), card: probe('var(--card)'), cls: el.className,
          before: b.display, hatch: b.backgroundImage, march: b.backgroundPosition};
}"""

# Hide words and icons while a tile is photographed, so only its fill and frame are read.
HIDE_TEXT = "[data-probe], [data-probe] * { color: transparent !important; text-shadow: none !important; }"


def read_tile(page, sel: str) -> dict | None:
    """What a tile shows, from its pixels: `fill`, the share of its centre in its colour; `frame`, the share
    of its top edge in its colour; `turns`, how often that edge changes between colour and dark (hatching);
    `edge`, whether its left 3 px are in its colour. Plus the hatch layer's computed style."""
    import io
    from PIL import Image

    st = page.evaluate(PROBE, sel)
    if not st:
        return None
    page.evaluate("(sel) => document.querySelector(sel).setAttribute('data-probe', '')", sel)
    try:
        img = Image.open(io.BytesIO(page.locator(sel).first.screenshot(animations="disabled"))).convert("RGB")
    finally:
        page.evaluate("(sel) => document.querySelector(sel).removeAttribute('data-probe')", sel)
    w, h = img.size
    c, card = st["c"], st["card"]

    def mine(x: int, y: int) -> bool:
        p = img.getpixel((x, y))
        dc = sum((a - b) ** 2 for a, b in zip(p, c))
        dk = sum((a - b) ** 2 for a, b in zip(p, card))
        return dc < dk

    inner = [mine(x, y) for x in range(9, w - 9) for y in range(9, h - 9)]
    top = [mine(x, 2) for x in range(9, w - 9)]
    turns = sum(1 for a, b in zip(top, top[1:]) if a != b)
    st.update(fill=sum(inner) / max(len(inner), 1), frame=sum(top) / max(len(top), 1), turns=turns,
              edge=all(mine(1, y) for y in range(9, h - 9)))
    return st


def tile_state(t: dict) -> str:
    """on, off or next, as a person reads it: filled; dark with an edge of its colour (a section not playing:
    dark); a hatched frame round a dark centre."""
    if t["fill"] > 0.8:
        return "on"
    if t["fill"] < 0.2 and 0.2 < t["frame"] < 0.8 and t["turns"] >= 4:
        return "next"
    if t["fill"] < 0.2 and t["frame"] < 0.2:
        return "off" if t["edge"] else "dark"
    return f"unreadable (fill {t['fill']:.2f}, frame {t['frame']:.2f}, {t['turns']} turns, edge {t['edge']})"


def check_tile(page, sel: str, want: str, failures: list, where: str) -> dict | None:
    t = read_tile(page, sel)
    if not t:
        failures.append(f"{where}: no {sel}")
        return None
    got = tile_state(t)
    if got != want:
        failures.append(f"{where}: {sel} reads as {got}, it is {want} ({t['cls']})")
    if want == "next":
        if t["before"] == "none" or "repeating-linear-gradient" not in (t["hatch"] or ""):
            failures.append(f"{where}: {sel} is queued but its hatched frame is hidden ({t['before']}, {t['hatch']})")
    return t


def queued_tile(page, sel: str, want_now: str, undo, failures: list, where: str) -> None:
    """Read a tile before and after a tap queues it, then tap again to cancel. Reads early in a bar so the
    queue cannot land between tap and read; if it lands anyway, `undo` puts the song back."""
    page.evaluate(f"document.head.insertAdjacentHTML('beforeend', '<style id=probe-style>{HIDE_TEXT}</style>')")
    try:
        for attempt in range(3):
            wait_for(page, "window.__groovebox.position().step === 1", 3.0)
            before = page.evaluate("JSON.stringify([window.__groovebox.getSong().sections.map(s => s.on), window.__groovebox.position().section])")
            check_tile(page, sel, want_now, failures, where)
            page.click(sel)
            time.sleep(0.05)
            check_tile(page, sel, "next", failures, where)
            m1 = (read_tile(page, sel) or {}).get("march")
            time.sleep(0.25)
            m2 = (read_tile(page, sel) or {}).get("march")
            if m1 != m2:
                failures.append(f"{where}: {sel} hatching still marches ({m1} -> {m2})")
            page.click(sel)
            time.sleep(0.05)
            after = page.evaluate("JSON.stringify([window.__groovebox.getSong().sections.map(s => s.on), window.__groovebox.position().section])")
            p = page.evaluate("window.__groovebox.pending()")
            if after == before and not p["toggles"] and p["section"] is None:
                return
            wait_for(page, "window.__groovebox.pending().toggles.length === 0 && window.__groovebox.pending().section === null", 4.0)
            undo()
            wait_for(page, "window.__groovebox.pending().toggles.length === 0 && window.__groovebox.pending().section === null", 4.0)
        failures.append(f"{where}: {sel}: a bar line kept passing between tap and read")
    finally:
        page.evaluate("document.getElementById('probe-style')?.remove()")


def walk_look(page, failures: list) -> None:
    """P1b, Simple, while playing: DM Sans only; the icons of the spec's table where it says; the five lanes
    match the engine's notes, one playhead keeps time; sentence case; the motion switch on the Mix tab, and
    with motion off every state still told apart by fill and hatching."""
    check_fonts(page, failures)
    page.click('[data-tab="play"]')
    time.sleep(0.2)
    check_icons(page, ICON_PLACES, failures, "Play tab")
    for inst in LAYERS:
        check_lane(page, f'[data-lane="{inst}"]', inst, failures, "Now view")
    check_playhead(page, ".phcol .ph", failures, "Now view")
    for b in page.evaluate(CAPS):
        failures.append(f"all-capital text on the Play tab: {b!r}")
    for tab in ["drums", "bass", "synth"]:
        page.click(f'[data-tab="{tab}"]')
        time.sleep(0.15)
        check_lane(page, f'[data-lane="{tab}"]', tab, failures, f"{tab} tab")
        check_icons(page, [(".headrow .head", {"drums": "adjust", "bass": "graphic_eq", "synth": "airwave"}[tab])], failures, f"{tab} tab")
        for b in page.evaluate(CAPS):
            failures.append(f"all-capital text on the {tab} tab: {b!r}")
        check_bare(page, failures, f"{tab} tab")
    page.click('[data-tab="layer1"]')
    sec = page.evaluate("window.__groovebox.position().section")
    mode = page.evaluate(f"{SONG}.sections[{sec}].layer1.mode")
    page.click('[data-mode="layer1:generative"]')
    time.sleep(0.15)
    check_icons(page, LAYER_ICONS, failures, "Layer 1 tab")
    check_bare(page, failures, "Layer 1 tab")
    check_lane(page, '[data-lane="layer1"]', "layer1", failures, "layer1 tab")
    page.click(f'[data-mode="layer1:{mode}"]')

    # The motion switch: off, nothing moves; the states still read by fill and hatching.
    page.click('[data-tab="mix"]')
    page.click('[data-page="mix:levels"]')
    check_bare(page, failures, "Mix tab, Levels")
    page.click('[data-page="mix:audio"]')
    check_bare(page, failures, "Mix tab, Audio")
    page.click('[data-motion="off"]')
    page.click('[data-tab="play"]')
    time.sleep(0.2)
    if not page.evaluate("document.documentElement.classList.contains('still')"):
        failures.append("motion off: the root is not still")
    band = page.evaluate("getComputedStyle(document.querySelector('.sec.playing'), '::before').display")
    if band != "none":
        failures.append(f"motion off: the moving band still shows ({band})")
    sec = page.evaluate("window.__groovebox.schedulerSection()")
    on = page.evaluate(f"{SONG}.sections[{sec}].on")
    going_off = next(i for i in LAYERS if on[i])
    going_on = next((i for i in LAYERS if not on[i]), None)
    if going_on is None:
        page.evaluate(f"()=>{{window.__groovebox.toggleInstrumentInPlaying('layer2')}}")
        wait_for(page, "window.__groovebox.pending().toggles.length === 0", 4.0)
        going_on = "layer2"
        on = page.evaluate(f"{SONG}.sections[{sec}].on")

    def toggle_back(inst):
        return lambda: page.evaluate(f"()=>window.__groovebox.toggleInstrumentInPlaying('{inst}')")

    # Simple: a Now tile going off, one going on, a section tile.
    queued_tile(page, f'[data-now="{going_off}"]', "on", toggle_back(going_off), failures, "motion off, Now tile")
    queued_tile(page, f'[data-now="{going_on}"]', "off", toggle_back(going_on), failures, "motion off, Now tile")
    other = (sec + 1) % page.evaluate(f"{SONG}.sections.length")
    queued_tile(page, f'[data-strip="{other}"]', "dark", lambda: page.evaluate(f"()=>window.__groovebox.switchSection({sec})"),
                failures, "motion off, section tile")
    check_playhead(page, ".phcol .ph", failures, "Now view, motion off", still=True)
    # Advanced: a cell of the playing section going off and one going on.
    page.click('[data-appmode="advanced"]')
    time.sleep(0.15)
    queued_tile(page, f'[data-cell="{sec}:{going_off}"]', "on", toggle_back(going_off), failures, "motion off, Song cell")
    queued_tile(page, f'[data-cell="{sec}:{going_on}"]', "off", toggle_back(going_on), failures, "motion off, Song cell")
    page.click('[data-appmode="simple"]')
    # The instrument tab's switch, on and off.
    tab = going_off if going_off in ("drums", "bass", "synth") else "drums"
    if on[tab]:
        page.click(f'[data-tab="{tab}"]')
        time.sleep(0.15)
        queued_tile(page, f'[data-toggle="{tab}"]', "on", toggle_back(tab), failures, f"motion off, {tab} switch")
    if going_on in ("drums", "bass", "synth"):
        page.click(f'[data-tab="{going_on}"]')
        time.sleep(0.15)
        queued_tile(page, f'[data-toggle="{going_on}"]', "off", toggle_back(going_on), failures, f"motion off, {going_on} switch")
    if page.evaluate(f"{SONG}.sections[{sec}].on") != on:
        failures.append("motion off: the walk left the playing section's instruments changed")
    page.click('[data-tab="play"]')
    page.click('[data-tab="mix"]')
    page.click('[data-page="mix:audio"]')
    page.click('[data-motion="on"]')
    page.click('[data-page="mix:master"]')
    page.click('[data-tab="play"]')
    time.sleep(0.2)
    if page.evaluate("document.documentElement.classList.contains('still')"):
        failures.append("motion on again: the root stays still")
    print(f"look: DM Sans only, {len(ICON_PLACES) + len(LAYER_ICONS)} icons placed, 5 lanes match the engine, playhead in time, motion switch")


def walk_c4(page, failures: list) -> None:
    """C4 (P2), on the default song's Groove section with its default patches: each layer soloed in Lead, Arp
    and Pad (the lead at the G4 walk's settings). A mode switch keeps the layer's level, and Layer 2 sits with
    Layer 1: each of the six within 6 dB of their median (before P2 the pad sat about 13 dB over the lead and
    Layer 2 10 to 16 dB under Layer 1). Reported, so the balance can be read against Pedro's ear."""
    page.evaluate("window.__groovebox.switchSection(1)")
    wait_for(page, "window.__groovebox.position().section === 1", 4.0)
    S = f"{SONG}.sections[1]"
    saved = {lid: page.evaluate(f"{S}.{lid}") for lid in ["layer1", "layer2"]}
    levels = {}
    for lid in ["layer1", "layer2"]:
        page.evaluate(f"()=>window.__groovebox.setGen(1, '{lid}', {{hits: 9, density: 1, lock: 0.5}})")
        for mode in ["generative", "arp", "pad"]:
            page.evaluate(f"()=>window.__groovebox.setLayerMode(1, '{lid}', '{mode}')")
            levels[(lid, mode)] = solo_level(page, lid, seconds=3.0, settle=1.0)
    mid = sorted(levels.values())[len(levels) // 2]
    print("C4, solo levels (dB): " + ", ".join(f"{l} {m} {v:.1f}" for (l, m), v in levels.items()) + f"; median {mid:.1f}")
    for (lid, mode), v in levels.items():
        if abs(v - mid) > 6:
            failures.append(f"C4: {lid} {mode} at {v:.1f} dB, {v - mid:+.1f} dB from the median of the layer modes")
    for lid, layer in saved.items():
        page.evaluate(f"()=>window.__groovebox.setLayerMode(1, '{lid}', '{layer['mode']}')")
        gen = {k: layer["gen"][k] for k in ["hits", "density", "lock"]}
        page.evaluate(f"(g)=>window.__groovebox.setGen(1, '{lid}', g)", gen)
    page.evaluate("window.__groovebox.switchSection(0)")
    wait_for(page, "window.__groovebox.position().section === 0", 4.0)


LEAD_STYLES = ["hook", "phrase", "roll", "drift", "pulse"]  # src/music/lead.ts


def walk_p5(page, failures: list) -> None:
    """P5, on the default song's Groove section: Layer 1's lead in each of the five styles, soloed, makes sound;
    with Slide and Accent at 1 the layer voice glides notes and opens its filter (per note). Reported, so the
    levels can be read against Pedro's ear. The layer goes back to what it was."""
    page.evaluate("window.__groovebox.switchSection(1)")
    wait_for(page, "window.__groovebox.position().section === 1", 4.0)
    S = f"{SONG}.sections[1]"
    saved = page.evaluate(f"{S}.layer1")
    page.evaluate("()=>window.__groovebox.setLayerMode(1, 'layer1', 'generative')")
    levels = {}
    for style in LEAD_STYLES:
        page.evaluate(f"()=>window.__groovebox.setGen(1, 'layer1', {{style: '{style}', density: 1, slide: 1, accent: 1}})")
        before = page.evaluate("window.__groovebox.leadMarks('layer1')")
        # Drift rests up to a bar and a quarter at Busy 1 (P5 review E1): read it over three bars or so.
        levels[style] = solo_level(page, "layer1", seconds=6.0 if style == "drift" else 2.5, settle=0.5)
        after = page.evaluate("window.__groovebox.leadMarks('layer1')")
        if levels[style] < -50:
            failures.append(f"P5: Layer 1's {style} lead is silent ({levels[style]:.1f} dB)")
        if after["glides"] <= before["glides"]:
            failures.append(f"P5: {style} with Slide at 1 started no glide")
        if after["accentAt"] <= before["accentAt"]:
            failures.append(f"P5: {style} with Accent at 1 opened no accent")
    print("P5, Layer 1 lead solo levels (dB): " + ", ".join(f"{k} {v:.1f}" for k, v in levels.items()))
    marks = page.evaluate("window.__groovebox.leadMarks('layer1')")
    print(f"P5, Layer 1 glides: {marks['glides']} started, {marks['glideDrops']} not started (no voice free)")
    gen = dict(saved["gen"])
    gen.pop("seed", None)
    # A knob the song did not set goes back to unset (null clears it, P5 review M4).
    for k in ["style", "slide", "accent"]:
        gen.setdefault(k, None)
    page.evaluate("(g)=>window.__groovebox.setGen(1, 'layer1', g)", gen)
    restored = page.evaluate(f"{S}.layer1.gen")
    if restored != saved["gen"]:
        failures.append(f"P5: Layer 1's lead did not go back to what it was: {restored} != {saved['gen']}")
    page.evaluate(f"()=>window.__groovebox.setLayerMode(1, 'layer1', '{saved['mode']}')")
    page.evaluate("window.__groovebox.switchSection(0)")
    wait_for(page, "window.__groovebox.position().section === 0", 4.0)


# Pages of lead dials in Advanced (P6): Notes and Feel for every style, Pulse's own page for Pulse.
LEAD_DIAL_PAGES = {"notes": 6, "feel": 6, "pulse": 3}
OPTIONAL_GEN = ["style", "shape", "phrase", "range", "register", "noteLength", "variation", "repeats", "slide", "accent"]


def walk_p6(page, failures: list) -> None:
    """P6, Advanced Layer 1 in Lead while the transport runs: for each of the five styles, picked from the style row,
    every dial of every lead page is turned and must reach the section; the output never clips; the lane's phrase bar
    counts the phrase's bars. Then the layer is switched off on the bar line: every voice must let go (no stuck
    note). Simple: the style picker sets the style. The layer goes back to what it was."""
    sec = page.evaluate("window.__groovebox.position().section")
    L = f"{SONG}.sections[{sec}].layer1"
    saved = page.evaluate(L)
    page.click('[data-appmode="advanced"]')
    page.click('[data-tab="layer1"]')
    page.click('[data-mode="layer1:generative"]')
    peak = -999.0
    turned = 0
    for style in LEAD_STYLES:
        page.click(f'[data-leadstyle="{style}"]')
        if page.evaluate(f"{L}.gen.style") != style:
            failures.append(f"P6: the style row did not pick {style}")
        pages = page.eval_on_selector_all(".body [data-page]", "els => els.map(e => e.dataset.page.split(':')[1])")
        want = ["notes", "feel"] + (["pulse"] if style == "pulse" else [])
        if [k for k in pages if k in LEAD_DIAL_PAGES] != want:
            failures.append(f"P6: {style} shows the lead pages {pages}, wanted {want}")
        for k in want:
            page.click(f'[data-page="layer1:{k}"]')
            ids = dials_on_screen(page, f"layer1 {style} {k}", failures)
            if len(ids) != LEAD_DIAL_PAGES[k]:
                failures.append(f"P6: {style}'s {k} page has {len(ids)} dials, not {LEAD_DIAL_PAGES[k]}")
            for d in ids:
                before = page.evaluate(f"{L}.gen")
                turn(page, f'[data-dial="{d}"]')
                turned += 1
                if page.evaluate(f"{L}.gen") == before:
                    failures.append(f"P6: dial {d} ({style}) changed nothing in the section")
                pk = page.evaluate("window.__groovebox.peak()")
                if pk is not None:
                    peak = max(peak, pk)
            check_sizes(page, f"layer1 {style} {k}", failures)
        # The step row: the lane shows which bar of the phrase plays, one segment per bar.
        g = page.evaluate(f"{L}.gen")
        bars = max(2, g.get("phrase", 4)) if style == "phrase" else g.get("phrase")
        time.sleep(0.6)
        shown = page.get_attribute('[data-lane="layer1"] .phr', "data-phrase") if page.locator('[data-lane="layer1"] .phr').count() else None
        if not shown:
            failures.append(f"P6: {style}: the lane shows no phrase bar")
        elif bars is not None and shown.split("/")[1] != str(bars):
            failures.append(f"P6: {style}: the lane shows phrase bar {shown}, the phrase has {bars} bars")
        elif page.locator('[data-lane="layer1"] .phr i').count() != int(shown.split("/")[1]):
            failures.append(f"P6: {style}: the phrase bar draws {page.locator('[data-lane=layer1] .phr i').count()} segments for {shown}")
    print(f"P6: {turned} lead dials turned over five styles while playing; output peak {peak:.1f} dBFS")
    if peak >= 0:
        failures.append(f"P6: the output clipped while lead dials were turned ({peak:.1f} dBFS)")
    # No stuck note: switched off on the bar line, the layer lets every voice go within its release.
    page.evaluate(f"window.__groovebox.toggleInstrument({sec}, 'layer1')")
    if not wait_for(page, f"!{L}.on && window.__groovebox.pending().toggles.length === 0", 4.0):
        failures.append("P6: Layer 1 did not switch off on the bar line")
    if not wait_for(page, "window.__groovebox.activeVoices('layer1') === 0", 6.0):
        failures.append(f"P6: {page.evaluate(chr(119) + 'indow.__groovebox.activeVoices(' + chr(39) + 'layer1' + chr(39) + ')')} Layer 1 voices still sound after it went off (stuck notes)")
    page.evaluate(f"window.__groovebox.toggleInstrument({sec}, 'layer1')")
    wait_for(page, "window.__groovebox.pending().toggles.length === 0", 4.0)
    # Simple: the style picker beside Busy, Evolve, Bright and Space.
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="layer1"]')
    page.click('[data-mode="layer1:generative"]')
    for style in ["drift", "hook"]:
        page.click(f'[data-leadstyle="{style}"]')
        if page.evaluate(f"{L}.gen.style") != style:
            failures.append(f"P6: Simple's style picker did not pick {style}")
    for w in simple_words(page):
        failures.append(f"P6: Simple Layer 1 in Lead: {w}")
    page.click('[data-appmode="advanced"]')
    gen = dict(saved["gen"])
    gen.pop("seed", None)
    for k in OPTIONAL_GEN:
        gen.setdefault(k, None)
    page.evaluate(f"(g)=>window.__groovebox.setGen({sec}, 'layer1', g)", gen)
    page.evaluate(f"()=>window.__groovebox.setLayerMode({sec}, 'layer1', '{saved['mode']}')")
    if page.evaluate(f"{L}.gen") != saved["gen"]:
        failures.append(f"P6: Layer 1's lead did not go back to what it was")


def jsround(x: float) -> int:
    """Math.round: halves go up (Python's round goes to even)."""
    return math.floor(x + 0.5)


def advanced_read(page, sec: int, inst: str, t: dict) -> tuple:
    """In Advanced, on the tab already shown: what the control of a macro target shows, and what it should show
    for the song's value. Goes to the page (and for a layer, the mode) that holds the control."""
    S = f"{SONG}.sections[{sec}]"
    layer = inst in ("layer1", "layer2")

    def go(page_key: str) -> None:
        sel = f'[data-page="{inst}:{page_key}"]'
        if page.locator(sel).count():
            page.click(sel)

    def dial(dial_id: str) -> str:
        return page.get_attribute(f'[data-dial="{dial_id}"]', "aria-valuetext")

    kind, key = t["kind"], t.get("key")
    if kind == "swing":
        go("hats")
        return dial("drums:swing"), str(page.evaluate(f"Math.round(window.__groovebox.getSong().sections[{sec}].drums.swing * 100)"))
    if kind in ("gen", "arp", "pad"):
        page.click(f'[data-mode="{inst}:{ {"gen": "generative", "arp": "arp", "pad": "pad"}[kind] }"]')
        if kind == "gen" and key in ("hits", "rotate", "length"):
            # P6: Pulse's own knobs sit on its own page, shown while the style is Pulse; the style goes back after.
            style = page.evaluate(f"{S}.{inst}.gen.style ?? null")
            page.click(f'[data-leadstyle="pulse"]')
            go("pulse")
            v = page.evaluate(f"{S}.{inst}.gen.{key}")
            got = dial(f"{inst}:gen:{key}")
            page.evaluate(f"(s) => window.__groovebox.setGen({sec}, '{inst}', {{style: s}})", style)
            return got, str(jsround(v))
        go("notes" if kind == "gen" else "pattern")
        v = page.evaluate(f"{S}.{inst}.{kind}.{key}")
        if kind == "arp":
            name = {"rate": "arprate", "octaves": "arpoct"}[key]
            on = page.eval_on_selector_all(f'.body [data-{name}][aria-pressed="true"]', f"els => els.map(e => e.dataset.{name})")
            return ",".join(on), str(v)
        want = str(jsround(v)) if key == "hits" else str(jsround(v * 100))
        return dial(f"{inst}:{kind}:{key}"), want
    v = page.evaluate(f"{SONG}.patches.{inst}.{key}")
    if key in ("cutoff", "resonance"):
        go("filter")
        x, y = page.get_attribute(f'.body [data-xy="{inst}"]', "data-value").split()
        return (x if key == "cutoff" else y), str(jsround(v * 100))
    if key in ("delay", "reverb"):
        go("filter")
        return page.get_attribute(f'.body [data-send="{key}"]', "aria-valuenow"), str(jsround(v * 100))
    if key == "level":
        page.click('[data-tab="mix"]')
        page.click('[data-page="mix:levels"]')
        got = dial(f"level:{inst}")
        page.click(f'[data-tab="{inst}"]')
        return got, str(jsround(v * 100))
    # A patch dial: the drums' Kick or Hats page, the Bass and Synth Sound page.
    for p in ["kick", "hats", "sound"]:
        go(p)
        if page.locator(f'.body [data-dial="{inst}:{key}"]').count():
            seconds = page.evaluate(f"document.querySelector('[data-dial=\"{inst}:{key}\"] label').textContent.endsWith(' ms')")
            return dial(f"{inst}:{key}"), str(jsround(v * 1000)) if seconds else str(jsround(v * 100))
    return None, f"{key} (no dial in Advanced)"


def walk_p2(page, failures: list) -> None:
    """P2, while playing, starting in Simple: switching mode changes nothing in the song document; each Simple
    tab shows one picker, four macro dials and the XY pad; each macro dial moves its values, and Advanced
    shows them; New idea and Back on both layers, in both modes; Simple shows no Advanced words."""
    doc = "JSON.stringify(window.__groovebox.getDocument())"
    sec = page.evaluate("window.__groovebox.position().section")
    for tab in TABS:
        page.click(f'[data-tab="{tab}"]')
        before = page.evaluate(doc)
        page.click('[data-appmode="advanced"]')
        time.sleep(0.1)
        mid = page.evaluate(doc)
        page.click('[data-appmode="simple"]')
        time.sleep(0.1)
        if not (before == mid == page.evaluate(doc)):
            failures.append(f"switching mode on the {tab} tab changed the song document")
    print(f"mode switched on all {len(TABS)} tabs: the song document identical before and after")

    # Simple instrument tabs: one picker (drums, bass, synth), four dials, the XY pad, plain words.
    for inst in LAYERS:
        page.click(f'[data-tab="{inst}"]')
        time.sleep(0.1)
        ids = page.eval_on_selector_all(".body [data-dial]", "els => els.map(e => e.dataset.dial)")
        want = [f"{inst}:macro:{m}" for m in {"drums": ["punch", "hats", "swing", "level"], "bass": ["bright", "weight", "punch", "level"],
                "synth": ["bright", "punch", "space", "level"]}.get(inst, ["busy", "evolve", "bright", "space"])]
        if ids != want:
            failures.append(f"Simple {inst}: dials {ids}, the spec's table says {want}")
        if not page.locator(f'[data-xy="{inst}"]').count():
            failures.append(f"Simple {inst}: no XY pad")
        if inst in ("drums", "bass", "synth"):
            n = page.locator(".body .chips").count()
            if n != 1:
                failures.append(f"Simple {inst}: {n} pickers, not one")
        for b in simple_words(page):
            failures.append(f"Simple {inst}: {b}")
        check_sizes(page, f"Simple {inst}", failures)
        for d in ids:
            song = page.evaluate(SONG)
            if turn(page, f'[data-dial="{d}"]') < 0.05:
                failures.append(f"macro dial {d} did not move")
            if page.evaluate(SONG) == song:
                failures.append(f"macro dial {d} changed nothing in the song")
    print("Simple tabs: one picker, four macro dials and the XY pad each; every macro dial moves the song")

    # Every Simple move is visible in Advanced (spec 8.1; P2 review E1): after each macro turn, every value the
    # macro maps reads on its Advanced control as the song holds it.
    n = 0
    modes = {lid: page.evaluate(f"{SONG}.sections[{sec}].{lid}.mode") for lid in ["layer1", "layer2"]}
    for inst in LAYERS:
        for m in page.evaluate(f"window.__macros['{inst}']"):
            page.click(f'[data-tab="{inst}"]')
            turn(page, f'[data-dial="{inst}:macro:{m["id"]}"]')
            page.click('[data-appmode="advanced"]')
            for t in m["targets"]:
                got, want = advanced_read(page, sec, inst, t)
                n += 1
                if got != want:
                    failures.append(f"Simple {inst} {m['id']}: Advanced shows {t.get('key', t['kind'])} as {got}, the song holds {want}")
            page.click('[data-appmode="simple"]')
        if inst in modes:
            page.click(f'[data-mode="{inst}:{modes[inst]}"]')
    print(f"every Simple macro move read back on its Advanced control ({n} values)")

    # New idea and Back on both layers, in both modes.
    S = f"{SONG}.sections[{sec}]"
    for mode in ["simple", "advanced"]:
        page.click(f'[data-appmode="{mode}"]')
        for lid in ["layer1", "layer2"]:
            L = f"{S}.{lid}"
            page.click(f'[data-tab="{lid}"]')
            was = page.evaluate(f"{L}.mode")
            page.click(f'[data-mode="{lid}:generative"]')
            seed = page.evaluate(f"{L}.gen.seed")
            page.click(f'[data-seed="{lid}"]')
            page.click(f'[data-seed="{lid}"]')
            if page.evaluate(f"{L}.gen.seed") == seed:
                failures.append(f"{mode} {lid}: New idea did not change the seed")
            page.click(f'[data-back="{lid}"]')
            page.click(f'[data-back="{lid}"]')
            if page.evaluate(f"{L}.gen.seed") != seed:
                failures.append(f"{mode} {lid}: Back twice did not return to the seed before two new ideas")
            if not page.locator(f'[data-back="{lid}"]').is_disabled():
                failures.append(f"{mode} {lid}: Back is offered with no earlier seed")
            page.click(f'[data-mode="{lid}:{was}"]')
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    print("New idea and Back on both layers, in both modes")


def walk_g4(page, failures: list) -> None:
    """G4: Layer 1 and Layer 2 while the transport runs: every mode makes sound, every pattern dial and
    chip reaches the section, the lead row follows the playing step, new seed, the Sound page's patch dials."""
    sec = page.evaluate("window.__groovebox.position().section")
    for lid in ["layer1", "layer2"]:
        L = f"{SONG}.sections[{sec}].{lid}"
        page.click(f'[data-tab="{lid}"]')
        saved_mode = page.evaluate(f"{L}.mode")

        # Generative: the 16-step row, the six dials, new seed.
        page.click(f'[data-mode="{lid}:generative"]')
        time.sleep(0.1)
        if page.evaluate(f"{L}.mode") != "generative":
            failures.append(f"{lid}: generative mode did not take")
        # The layer's own lane above its controls, matching the engine's notes, with its playhead in time (P1b).
        check_lane(page, f'[data-lane="{lid}"]', lid, failures, f"{lid} tab")
        check_playhead(page, f'[data-lane="{lid}"] .ph', failures, f"{lid} tab")
        ids = dials_on_screen(page, f"{lid} generative", failures)
        if len(ids) != 6:
            failures.append(f"{lid}: generative page has {len(ids)} dials, not 6")
        for d in ids:
            before = page.evaluate(f"{L}.gen")
            turn(page, f'[data-dial="{d}"]')
            if page.evaluate(f"{L}.gen") == before:
                failures.append(f"dial {d} changed nothing in the section")
        seed = page.evaluate(f"{L}.gen.seed")
        page.click(f'[data-seed="{lid}"]')
        if page.evaluate(f"{L}.gen.seed") == seed:
            failures.append(f"{lid}: new seed did not change the seed")
        check_sizes(page, f"{lid} generative", failures)
        page.evaluate(f"()=>window.__groovebox.setGen({sec}, '{lid}', {{hits: 9, density: 1, lock: 0.5}})")
        lvl = solo_level(page, lid)
        print(f"{lid} generative: {lvl:.1f} dB")
        if lvl < -60:
            failures.append(f"{lid} generative is silent ({lvl:.1f} dB)")

        # Arp: direction, rate, octaves chips and the gate dial.
        page.click(f'[data-mode="{lid}:arp"]')
        for d in ["down", "updown", "random", "up"]:
            page.click(f'[data-arpdir="{d}"]')
        for r in ["1", "4", "2"]:
            page.click(f'[data-arprate="{r}"]')
        for o in ["3", "1", "2"]:
            page.click(f'[data-arpoct="{o}"]')
        arp = page.evaluate(f"{L}.arp")
        if (arp["direction"], arp["rate"], arp["octaves"]) != ("up", 2, 2):
            failures.append(f"{lid}: arp chips did not take: {arp}")
        for d in dials_on_screen(page, f"{lid} arp", failures):
            if turn(page, f'[data-dial="{d}"]') < 0.05:
                failures.append(f"dial {d} did not move")
        if page.evaluate(f"{L}.arp.gate") == arp["gate"]:
            failures.append(f"{lid}: arp gate did not change")
        check_sizes(page, f"{lid} arp", failures)
        lvl = solo_level(page, lid)
        print(f"{lid} arp: {lvl:.1f} dB")
        if lvl < -60:
            failures.append(f"{lid} arp is silent ({lvl:.1f} dB)")

        # Pad: four dials; brightness moves the pad filter at once; it opens again outside Pad mode.
        page.click(f'[data-mode="{lid}:pad"]')
        ids = dials_on_screen(page, f"{lid} pad", failures)
        if len(ids) != 4:
            failures.append(f"{lid}: pad page has {len(ids)} dials, not 4")
        for d in ids:
            before = page.evaluate(f"{L}.pad")
            turn(page, f'[data-dial="{d}"]')
            if page.evaluate(f"{L}.pad") == before:
                failures.append(f"dial {d} changed nothing in the section")
        page.evaluate(f"()=>window.__groovebox.setPad({sec}, '{lid}', {{brightness: 0.2, attack: 0.05}})")
        want = 300 * (10000 / 300) ** 0.2
        got = wait_for_value(page, f"window.__groovebox.padHz('{lid}')", want, 1.5)
        if abs(got - want) > 1:
            failures.append(f"{lid}: pad brightness did not reach the filter ({got:.0f} Hz, wanted {want:.0f})")
        check_sizes(page, f"{lid} pad", failures)
        lvl = solo_level(page, lid, settle=1.0)
        print(f"{lid} pad: {lvl:.1f} dB, pad filter {got:.0f} Hz")
        if lvl < -60:
            failures.append(f"{lid} pad is silent ({lvl:.1f} dB)")
        walk_pad_to_arp(page, sec, lid, failures)

        # Sound page: wave chips and the shared patch dials.
        page.click(f'[data-page="{lid}:sound"]')
        for w in ["square", "sine", "sawtooth", "triangle"]:
            page.click(f'[data-wave="{w}"]')
            time.sleep(0.1)
            if page.evaluate(f"{SONG}.patches.{lid}.wave") != w:
                failures.append(f"{lid} wave {w} did not take")
        k = turn_all(page, f"{lid} sound", failures)
        if k != 5:
            failures.append(f"{lid}: sound page has {k} dials, not 5")
        page.click(f'[data-page="{lid}:pattern"]')

        page.click(f'[data-mode="{lid}:{saved_mode}"]')
        if saved_mode != "pad":
            got = wait_for_value(page, f"window.__groovebox.padHz('{lid}')", 10000, 6.0)
            if abs(got - 10000) > 1:
                failures.append(f"{lid}: pad filter did not open again outside Pad mode ({got:.0f} Hz)")
        print(f"{lid}: three modes walked, back to {saved_mode}")


def walk_pad_to_arp(page, sec: int, lid: str, failures: list) -> None:
    """Pad to Arp just after a bar line (G4 review S1, M6): the pad filter holds the brightness value
    until the switch's step time on the audio clock, then opens over the pad's release; the held pad
    voices let go within the pad release plus a bar. Leaves the layer in Arp mode."""
    release = 0.3
    page.evaluate(f"()=>window.__groovebox.setPad({sec}, '{lid}', {{brightness: 0.2, release: {release}}})")
    page.evaluate(f"()=>window.__groovebox.setArp({sec}, '{lid}', {{rate: 4, gate: 0.25}})")
    want = 300 * (10000 / 300) ** 0.2
    wait_for_value(page, f"window.__groovebox.padHz('{lid}')", want, 1.5)
    solo = "(keep)=>{const e=window.__groovebox;for(const l of %r)e.setLayer(l,keep===null||l===keep)}" % LAYERS
    page.evaluate(solo, lid)
    if not wait_for(page, f"window.__groovebox.activeVoices('{lid}') >= 3", 5.0):
        failures.append(f"{lid}: pad sounds no chord before the switch")
    held = page.evaluate(f"window.__groovebox.activeVoices('{lid}')")
    # In the page, so the reading falls inside the lookahead: wait for a bar line, switch, then read
    # the pad filter as soon as the scheduler has placed its move, while the audio clock is still before it.
    r = page.evaluate(
        """async ([sec, lid]) => {
          const e = window.__groovebox;
          const sleep = (ms) => new Promise((f) => setTimeout(f, ms));
          let last = e.position().step;
          for (let i = 0; i < 2000; i++) {
            const s = e.position().step;
            if (s < last) break;
            last = s;
            await sleep(2);
          }
          const before = e.padMove(lid).at;
          e.setLayerMode(sec, lid, 'arp');
          for (let i = 0; i < 1000; i++) {
            const m = e.padMove(lid);
            if (m.at !== before) {
              // Wait until just before the step time, so a move made at once would have shown by now.
              while (e.padMove(lid).now < m.at - 0.015) await sleep(1);
              const hz = e.padHz(lid);
              return { at: m.at, now: e.padMove(lid).now, hz, step: e.position().step };
            }
            await sleep(1);
          }
          return null;
        }""",
        [sec, lid],
    )
    if r is None:
        failures.append(f"{lid}: Pad to Arp never moved the pad filter")
    else:
        ahead = (r["at"] - r["now"]) * 1000
        print(f"{lid} Pad -> Arp: read {ahead:.0f} ms before the filter's move (step {r['step']}): {r['hz']:.0f} Hz")
        if ahead <= 0:
            failures.append(f"{lid}: pad filter read after the switch's step time ({ahead:.0f} ms); the check could not run")
        elif abs(r["hz"] - want) > 1:
            failures.append(f"{lid}: pad filter left the brightness value before the switch's step time ({r['hz']:.0f} Hz, wanted {want:.0f})")
    bar = 4 * 60 / page.evaluate(f"{SONG}.bpm")
    low = held
    end = time.time() + release + bar
    while time.time() < end:
        low = min(low, page.evaluate(f"window.__groovebox.activeVoices('{lid}')"))
        time.sleep(0.02)
    print(f"{lid} Pad -> Arp: voices {held} -> as low as {low} within the pad release plus a bar")
    if low >= min(held, 3):
        failures.append(f"{lid}: switching Pad to Arp kept the pad voices ({held}, never below {low})")
    page.evaluate(solo, None)


REC = "window.__groovebox.recordInfo()"


def save_take(page, failures: list, want: float, where: str) -> dict | None:
    """Wait for the take sheet, save the MP3 through its Save button and walk every frame."""
    if not wait_for(page, "!!document.querySelector('#take-save')", 10.0):
        failures.append(f"{where}: the take sheet did not open")
        return None
    check_sizes(page, f"take sheet ({where})", failures)
    with page.expect_download() as dl:
        page.click("#take-save")
    path = dl.value.path()
    name = dl.value.suggested_filename
    with open(path, "rb") as f:
        info = mp3_info(f.read())
    print(f"{where}: {name}: {info['frames']} frames, {info['sample_rate']} Hz, {info['kbps']} kbps, "
          f"{info['seconds']:.2f} s, {info['bytes']} bytes")
    if info["error"]:
        failures.append(f"{where}: MP3 not valid: {info['error']}")
    if not name.endswith(".mp3"):
        failures.append(f"{where}: saved file is not named .mp3: {name}")
    # LAME pads the start and end by under 0.1 s; the timer may lead the audio by a block.
    if abs(info["seconds"] - want) > 0.35:
        failures.append(f"{where}: MP3 lasts {info['seconds']:.2f} s, expected about {want:.2f} s")
    page.click("#take-close")
    return info


def walk_g5_record(page, failures: list) -> None:
    """G5 while playing: a take with the indicator and timer, knob moves in its log, saved as MP3."""
    page.click('[data-tab="mix"]')
    page.click("#rec")
    if page.evaluate(REC)["state"] != "recording":
        failures.append("record while playing did not start a take")
        return
    t0 = time.time()
    if "recording" not in (page.get_attribute("#rec", "class") or ""):
        failures.append("record button does not show the take")
    drag(page, '[data-dial="pump"]', 0, 30)
    drag(page, '[data-dial="pump"]', 0, -30)
    page.click('[data-tab="play"]')
    page.click('[data-cell="1:layer2"]')
    time.sleep(2.0)
    shown = page.inner_text("#rec-time")
    if shown not in ("0:02", "0:03"):
        failures.append(f"record timer shows {shown!r} after about 2 s")
    narrow_pass(page, failures)  # the wider record button must still fit at 360 px
    page.click('[data-cell="1:layer2"]')
    while time.time() - t0 < 6.0:
        time.sleep(0.1)
    secs = page.evaluate(REC)["seconds"]
    page.click("#rec")
    info = save_take(page, failures, secs, "take while playing")
    log = page.evaluate("window.__groovebox.getLog()")
    if not log:
        failures.append("no event log after the take")
        return
    ops = [e["op"] for e in log["events"]]
    print(f"take log: {len(ops)} events {sorted(set(ops))}, {log['seconds']:.2f} s")
    if "setMix" not in ops or ops.count("toggleInstrument") != 2:
        failures.append(f"take log is missing the knob moves or mutes: {ops}")
    if info and abs(log["seconds"] - info["seconds"]) > 0.35:
        failures.append(f"log says {log['seconds']:.2f} s, MP3 {info['seconds']:.2f} s")
    if page.evaluate(REC)["state"] != "off":
        failures.append("record did not return to off after the take")


def walk_g5_songs(page, failures: list, url: str) -> None:
    """G5 stopped: rename, survive a reload, new and delete, armed record starting with Play and a Stop tail."""
    page.click('[data-tab="play"]')
    page.click("#songs-open")
    check_sizes(page, "songs sheet", failures)
    page.fill("#song-name", "Smoke jam")
    page.click("#song-rename")
    page.click('[data-tab="mix"]')
    drag(page, '[data-dial="saturation"]', 0, -40)
    before = page.evaluate("window.__groovebox.getDocument()")
    time.sleep(0.8)  # the save follows edits after 0.4 s
    page.goto(url)
    if not wait_for(page, "!!window.__groovebox", 5.0):
        failures.append("the app did not come back after a reload")
        return
    # P3: the picker opens the app again, now with the jam to continue first.
    walk_picker_open(page, failures, first=False)
    page.click("#vibe-continue")
    # P2: the Simple / Advanced switch is remembered (the walk left it on Advanced).
    if page.get_attribute('[data-appmode="advanced"]', "aria-checked") != "true":
        failures.append("the Advanced mode was not remembered over a reload")
    else:
        print("the mode switch was remembered over a reload: Advanced")
    after = page.evaluate("window.__groovebox.getDocument()")
    for k in ["name", "bpm", "key", "mood", "sections", "patches", "mix", "macros"]:
        if after.get(k) != before.get(k):
            failures.append(f"reload lost the song's {k}")
    if (after.get("log") or {}).get("events") != (before.get("log") or {}).get("events"):
        failures.append("reload lost the event log")
    print(f"reload kept {after['name']!r}: {len(after['sections'])} sections, mix {after['mix']}, "
          f"log of {len((after.get('log') or {}).get('events', []))} events")
    if "Smoke jam" not in (page.get_attribute("#songs-open", "aria-label") or ""):
        failures.append("the Songs button does not name the reopened song")

    # New jam, in the header, opens the vibe picker (P3): a tile loads a new song and plays; the jam it replaces
    # stays in Songs.
    page.click('[data-tab="mix"]')
    if page.locator("#new-jam").is_disabled():
        failures.append("New jam is disabled while stopped")
    page.click("#new-jam")
    page.click('[data-vibe="deepHouse"]')
    wait_for(page, "window.__groovebox.playing", 3.0)
    time.sleep(0.3)
    name = page.evaluate("window.__groovebox.getSong().name")
    n = page.evaluate("window.__keeper.list().then(l => l.length)")
    if n != 2 or name != "Deep house" or page.evaluate("window.__groovebox.getLog()") is not None:
        failures.append(f"new jam from a vibe failed: {n} songs, open {name!r}")
    if not page.evaluate("window.__groovebox.playing"):
        failures.append("a vibe tile did not start playing")
    page.click("#play")
    page.click("#songs-open")
    page.click("#song-delete")
    page.click("#song-delete")
    time.sleep(0.3)
    n = page.evaluate("window.__keeper.list().then(l => l.length)")
    if n != 1 or page.evaluate("window.__groovebox.getSong().name") != "Smoke jam":
        failures.append(f"delete did not go back to the other song ({n} songs)")
    page.goto(url)
    wait_for(page, "!!window.__groovebox", 5.0)
    page.click("#vibe-continue")
    if page.evaluate("window.__groovebox.getSong().name") != "Smoke jam":
        failures.append("the last song did not reopen on launch")

    # Armed while stopped: the take starts with Play, and Stop keeps a tail.
    page.click("#rec")
    if page.evaluate(REC)["state"] != "armed" or "armed" not in (page.get_attribute("#rec", "class") or ""):
        failures.append("record while stopped did not arm")
    played = time.monotonic()
    page.click("#play")
    if not wait_for(page, "window.__groovebox.recordInfo().state === 'recording'", 3.0):
        failures.append("an armed take did not start with Play")
        return
    time.sleep(2.0)
    # The take's length is audio-clock seconds, so it is measured against the audio clock, not this sleep (a
    # busy host can stall the audio clock or delay the click; P5 review): the take's seconds just before and
    # just after Stop bracket the moment Stop landed.
    before = page.evaluate(REC)["seconds"]
    waited = time.monotonic() - played
    page.click("#play")
    info = page.evaluate(REC)
    after = info["seconds"]
    if info["state"] != "finishing":
        failures.append("Stop did not keep a tail")
    # The tail closes on a 1.5 s timer; the last reading while it runs is how far the audio clock got by then
    # (capped at Stop + 1.5 s), so a stalled audio clock is seen rather than counted as a short tail.
    reached = after
    page.click("#songs-open")
    if not page.locator("#song-new").is_disabled():
        failures.append("new song is allowed while a take finishes")
    page.click("#songs-close")
    deadline = time.monotonic() + 6.0
    while time.monotonic() < deadline:
        r = page.evaluate(REC)
        if r["state"] != "finishing":
            break
        reached = max(reached, r["seconds"])
        time.sleep(0.02)
    wait_for(page, "!!document.querySelector('#take-save')", 6.0)
    secs = page.evaluate("window.__groovebox.getLog().seconds")
    tail = 1.5  # RECORD_TAIL, src/engine/index.ts
    # It started with Play (the audio clock cannot run ahead of the wall clock) and recorded something.
    if not 0.5 <= before <= waited + 0.1:
        failures.append(f"armed take was {before:.2f} s long {waited:.2f} s after Play")
    # It holds everything up to Stop and the whole tail: at least to Stop + 1.5 s, or as far as the audio
    # clock got before the take closed if that was less, and never less than half the tail; at most Stop +
    # 1.5 s plus the encoder's last block and the timer's lateness.
    lo = max(before + tail / 2, min(before + tail, reached) - 0.1)
    hi = after + tail + 0.5
    if not lo <= secs <= hi:
        failures.append(f"armed take with tail lasts {secs:.2f} s, expected {lo:.2f}..{hi:.2f} (Stop at {before:.2f}..{after:.2f} s)")
    print(f"armed take: Stop at {before:.2f}..{after:.2f} s, tail reached {reached:.2f} s, take {secs:.2f} s")
    save_take(page, failures, secs, "armed take")


PICKER = """() => {
  const v = document.querySelector('.vibes');
  if (!v) return null;
  const r = v.getBoundingClientRect();
  const tiles = [...v.querySelectorAll('[data-vibe]')].map((t) => {
    const b = t.getBoundingClientRect();
    return { id: t.dataset.vibe, name: t.innerText.trim(), x: b.left, y: b.top, bottom: b.bottom, c: getComputedStyle(t).getPropertyValue('--c').trim() };
  });
  return { tiles, scrolls: v.scrollHeight > v.clientHeight + 1, bottom: r.bottom, h: window.innerHeight,
           cont: !!v.querySelector('#vibe-continue'), first: v.querySelector('button.vcont, [data-vibe]')?.id || '' };
}"""


def walk_picker_open(page, failures: list, first: bool) -> None:
    """P3 (spec 8.2): the picker opens the app; every vibe that exists is a tile, two columns, coloured by family,
    on one screen at 360 x 640 without scrolling; "Continue last jam" comes first when there is a jam."""
    if not wait_for(page, "!!document.querySelector('.vibes')", 3.0):
        failures.append("the app did not open on the vibe picker")
        return
    vibes = page.evaluate("window.__vibes")
    for size in [(360, 640), (390, 844)]:
        page.set_viewport_size({"width": size[0], "height": size[1]})
        time.sleep(0.15)
        p = page.evaluate(PICKER)
        where = f"vibe picker at {size[0]} x {size[1]}"
        if [t["id"] for t in p["tiles"]] != [v["id"] for v in vibes]:
            failures.append(f"{where}: tiles {[t['id'] for t in p['tiles']]}, expected every vibe {[v['id'] for v in vibes]}")
        xs = sorted({round(t["x"]) for t in p["tiles"]})
        if len(xs) != 2:
            failures.append(f"{where}: tiles in {len(xs)} columns, expected two")
        if p["scrolls"] or any(t["bottom"] > p["h"] + 0.5 for t in p["tiles"]):
            failures.append(f"{where}: the picker scrolls or a tile is off the screen")
        if len({t["c"] for t in p["tiles"]}) < 4:
            failures.append(f"{where}: tiles not coloured by family: {sorted({t['c'] for t in p['tiles']})}")
        if p["cont"] == first:
            failures.append(f"{where}: Continue last jam {'shown on a first launch' if first else 'missing'}")
        if not first and p["first"] != "vibe-continue":
            failures.append(f"{where}: Continue last jam is not first")
        check_sizes(page, where, failures)
        for b in page.evaluate(OFF_SCREEN):
            failures.append(f"{where}: {b}")
    page.set_viewport_size({"width": 390, "height": 844})
    time.sleep(0.1)
    print(f"vibe picker: {len(vibes)} tiles, two columns, one screen, continue {'hidden' if first else 'first'}")


def solo_bar(page, layer: str, bar_s: float) -> float:
    """Highest level of one instrument over a little more than a bar, read on its own channel's meter (P3 review
    S2): before the shared sends, so another instrument's reverb tail cannot pass a silent one."""
    top = -999.0
    end = time.time() + bar_s + 0.3
    while time.time() < end:
        v = page.evaluate(f"window.__groovebox.instrumentLevel({layer!r})")
        if v is not None:
            top = max(top, v)
        time.sleep(0.05)
    return top


CUTOFF_TRACE = """(id) => {
  const e = window.__groovebox, trace = [], end = performance.now() + 12000;
  window.__cutoffTrace = trace;
  const loop = () => {
    const c = e.cutoffNow(id);
    if (c) trace.push([c.now, c.hz]);
    if (window.__cutoffTrace === trace && performance.now() < end) setTimeout(loop, 2);
  };
  loop();
}"""


def check_landing_cutoff(page, failures: list, v: dict) -> bool:
    """P3 review E1: a vibe's patch changes on its bar line, not a lookahead early. Reads the synth's native
    cutoff traced through the landing: the old value 10 ms before the bar line (the review asked 30; 10 also
    catches a small lead), the new one 60 ms after.
    Returns whether the old and new cutoffs differed (so the check could judge anything)."""
    E = "window.__groovebox"
    at = (page.evaluate(f"{E}.landed.slice(-1)[0]") or {}).get("loaded", {}).get("at")
    trace = page.evaluate("window.__cutoffTrace") or []
    page.evaluate("window.__cutoffTrace = null")
    if at is None or len(trace) < 10:
        failures.append(f"{v['id']}: no cutoff trace through the landing ({len(trace)} samples, at {at})")
        return False
    old, new = trace[0][1], trace[-1][1]
    if abs(new - old) / old < 0.05 or trace[0][0] > at - 0.05 or trace[-1][0] < at + 0.1:
        return False
    before = [hz for t, hz in trace if t <= at - 0.01]
    after = [hz for t, hz in trace if t >= at + 0.06]
    if not before or not after:
        failures.append(f"{v['id']}: cutoff trace misses the bar line at {at:.3f}")
        return True
    if abs(before[-1] - old) / old > 0.01:
        failures.append(f"{v['id']}: synth cutoff {before[-1]:.0f} Hz 10 ms before the bar line, expected the old {old:.0f} Hz (changed early)")
    if abs(after[0] - new) / new > 0.02:
        failures.append(f"{v['id']}: synth cutoff {after[0]:.0f} Hz 60 ms after the bar line, expected the new {new:.0f} Hz")
    return True


def load_vibe_and_check(page, failures: list, v: dict, how: str) -> bool:
    """After a vibe was asked for mid-bar: it waits for the bar line, then lands whole on it."""
    E = "window.__groovebox"
    pend = page.evaluate(f"{E}.pendingLoad()")
    if not pend or pend.get("style") != v["id"]:
        failures.append(f"{v['id']} ({how}): not queued for the bar line (pending {pend})")
    if page.evaluate(f"{E}.getSong().style") == v["id"] and pend:
        failures.append(f"{v['id']} ({how}): loaded before the bar line")
    if pend and "pending" not in (page.get_attribute("#vibe-open", "class") or ""):
        failures.append(f"{v['id']} ({how}): the vibe control does not show it as next bar")
    if not wait_for(page, f"{E}.getSong().style === {v['id']!r}", 10.0):
        failures.append(f"{v['id']} ({how}): did not land")
        return False
    time.sleep(0.4)  # the scheduler runs a look-ahead before what is heard
    landed = page.evaluate(f"{E}.landed.slice(-1)[0]")
    if not landed or (landed.get("loaded") or {}).get("style") != v["id"] or landed["pending"]["section"] != v["start"]:
        failures.append(f"{v['id']} ({how}): not landed on a bar line as a whole song: {landed}")
    if page.evaluate(f"{E}.bpm") != v["bpm"] or page.evaluate(f"{E}.position().section") != v["start"]:
        failures.append(f"{v['id']} ({how}): plays at {page.evaluate(f'{E}.bpm')} bpm in section {page.evaluate(f'{E}.position().section')}")
    return True


def walk_p3(page, failures: list) -> None:
    """P3: every vibe loads from the picker mid-jam, lands on the bar line as a new song, and plays every instrument
    audibly in its groove section; the arrows step to the next vibe from the next bar."""
    E = "window.__groovebox"
    if page.locator("#take-close").count():
        page.click("#take-close")
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    if not page.evaluate(f"{E}.playing"):
        page.click("#play")
        wait_for(page, f"{E}.playing", 3.0)
    before = page.evaluate("window.__keeper.list().then(l => l.length)")
    vibes = page.evaluate("window.__vibes")
    timed = 0
    for v in vibes:
        page.click("#new-jam")
        wait_for(page, f"{E}.position().step >= 2 && {E}.position().step <= 8", 6.0)
        page.evaluate(CUTOFF_TRACE, "synth")
        page.click(f'[data-vibe="{v["id"]}"]')
        wait_for(page, f"!!{E}.pendingLoad() || {E}.getSong().style === {v['id']!r}", 2.0)
        wait_for(page, "!document.querySelector('.vibes')", 2.0)
        if page.locator(".vibes").count():
            failures.append(f"{v['id']}: the picker stayed open after a tap")
            page.click("#vibe-close")
        if not load_vibe_and_check(page, failures, v, "picker"):
            page.evaluate("window.__cutoffTrace = null")
            continue
        if check_landing_cutoff(page, failures, v):
            timed += 1
        bar_s = 4 * 60 / v["bpm"]
        quiet = []
        for inst in LAYERS:
            lvl = solo_bar(page, inst, bar_s)
            if lvl < -60:
                quiet.append(f"{inst} {lvl:.1f} dB")
        if quiet:
            failures.append(f"{v['id']}: silent in its groove section: {', '.join(quiet)}")
        print(f"vibe {v['name']}: landed on the bar at {v['bpm']} bpm, every instrument audible")
    if timed < 3:
        failures.append(f"the synth cutoff was checked across only {timed} vibe landings, expected at least 3")
    print(f"vibe landings: synth cutoff old before the bar line, new after it, on {timed} landings")
    after = page.evaluate("window.__keeper.list().then(l => l.length)")
    if after != before + len(vibes):
        failures.append(f"each vibe should be a new song kept in Songs: {before} songs before, {after} after {len(vibes)} vibes")
    # The arrows: the next vibe from the next bar line; the middle opens the picker.
    wait_for(page, f"{E}.position().step >= 2 && {E}.position().step <= 8", 6.0)
    page.click("#vibe-next")
    wait_for(page, f"!!{E}.pendingLoad()", 2.0)
    load_vibe_and_check(page, failures, vibes[0], "next arrow")
    wait_for(page, f"{E}.position().step >= 2 && {E}.position().step <= 8", 6.0)
    page.click("#vibe-prev")
    wait_for(page, f"!!{E}.pendingLoad()", 2.0)
    load_vibe_and_check(page, failures, vibes[-1], "previous arrow")
    page.click("#vibe-open")
    if not page.locator(".vibes").count():
        failures.append("the vibe control's middle did not open the picker")
    else:
        page.click("#vibe-close")
    check_sizes(page, "simple play with the vibe control", failures)
    print("vibe arrows: next and previous landed on the bar")


# What Simple Chords must not show (P4 Done when: no scale or degree name). Scale names and the mood words that
# are not also a feel or part of a vibe or card name ("Warm", "Dark", "Deep" and "House" are; they are checked
# by the mood's own words "Major", "Minor" and "Sad"); roman numerals, either case, with or without a degree sign;
# note names as words.
NO_THEORY = [
    re.compile(r"\b(major|minor|ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian|pentatonic|scale|degree|key)\b", re.I),
    re.compile(r"\bSad\b"),
    re.compile(r"(?<![\w-])(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)°?(?![\w-])"),
    re.compile(r"(?<![\w-])[A-G][#b♯♭]?(?![\w-])"),
]


def theory_words(text: str) -> list:
    return sorted({m.group(0) for r in NO_THEORY for m in r.finditer(text)})


def walk_p4(page, failures: list) -> None:
    """P4: Simple Chords while playing. Every feel shows four cards for the vibe; a tapped card plays from the next
    bar line (mood and chords together, nothing before it), and is then shown playing; a card tapped twice cancels;
    More chords turns the page; the vibe button borrows another vibe's cards and loads nothing; Lower and Higher
    move the key; Advanced shows the progression as ordinary chords."""
    E = "window.__groovebox"
    page.click('[data-appmode="simple"]')
    if not page.evaluate(f"{E}.playing"):
        page.click("#play")
        wait_for(page, f"{E}.playing", 3.0)
    page.click('[data-tab="chords"]')
    feels = page.eval_on_selector_all("[data-feel]", "els => els.map(e => e.dataset.feel)")
    if feels != ["bright", "warm", "dreamy", "dark", "tense", "uplifting"]:
        failures.append(f"Simple Chords shows the feels {feels}")
    style = page.evaluate(f"{E}.getSong().style")
    landings = 0
    for feel in feels:
        page.click(f'[data-feel="{feel}"]')
        bad = theory_words(page.inner_text(".chordtab.simple"))
        if bad:
            failures.append(f"Simple Chords ({feel}) shows scale or degree words: {bad}")
        cards = page.eval_on_selector_all("[data-prog]", "els => els.map(e => e.dataset.prog)")
        if len(cards) != 4:
            failures.append(f"{style}/{feel}: {len(cards)} cards, not four")
            continue
        free = [c for c in cards if "playing" not in (page.get_attribute(f'[data-prog="{c}"]', "class") or "")]
        if not free:
            failures.append(f"{style}/{feel}: every card shows playing")
            continue
        card = free[0]
        sec = page.evaluate(f"{E}.position().section")
        wait_for(page, f"{E}.position().step >= 2 && {E}.position().step <= 8", 6.0)
        before = page.evaluate(f"JSON.stringify([{E}.getSong().mood, {E}.getSong().sections[{sec}].chords])")
        bar = page.evaluate(f"{E}.position().bar")
        page.click(f'[data-prog="{card}"]')
        want = page.evaluate(f"{E}.pending().chords")
        if not want:
            failures.append(f"{style}/{feel}: tapping card {card} queued nothing")
            continue
        if "pending" not in (page.get_attribute(f'[data-prog="{card}"]', "class") or ""):
            failures.append(f"{style}/{feel}: card {card} not shown as Next bar")
        if page.evaluate(f"JSON.stringify([{E}.getSong().mood, {E}.getSong().sections[{sec}].chords])") != before:
            failures.append(f"{style}/{feel}: card {card} changed the chords before the bar line")
        if not wait_for(page, f"!{E}.pending().chords", 6.0):
            failures.append(f"{style}/{feel}: card {card} did not land")
            continue
        last = page.evaluate(f"{E}.landed.slice(-1)[0]")
        got = page.evaluate(f"[{E}.getSong().mood, {E}.getSong().sections[{sec}].chords]")
        if not last or not last["pending"].get("chords") or last["bar"] != bar + 1:
            failures.append(f"{style}/{feel}: card {card} did not land on the next bar line ({bar} -> {last})")
        elif got != [want["mood"], want["chords"]]:
            failures.append(f"{style}/{feel}: card {card} landed as {got}, not {want}")
        else:
            landings += 1
        wait_for(page, f"{E}.position().bar > {bar + 1}", 6.0)
        if "playing" not in (page.get_attribute(f'[data-prog="{card}"]', "class") or ""):
            failures.append(f"{style}/{feel}: card {card} is not shown playing after it landed")
        check_sizes(page, f"simple chords {feel}", failures)
    print(f"Simple Chords ({style}): {landings} of {len(feels)} cards landed on the next bar line, one per feel")
    lvl = solo_bar(page, "synth", 4 * 60 / page.evaluate(f"{E}.bpm"))
    if lvl < -60:
        failures.append(f"the synth is silent on a card's progression ({lvl:.1f} dB)")

    # Tapped twice before the bar line: cancelled, nothing lands.
    wait_for(page, f"{E}.position().step >= 2 && {E}.position().step <= 8", 6.0)
    cards = page.eval_on_selector_all("[data-prog]:not(.playing)", "els => els.map(e => e.dataset.prog)")
    sec = page.evaluate(f"{E}.position().section")
    before = page.evaluate(f"JSON.stringify({E}.getSong().sections[{sec}].chords)")
    page.click(f'[data-prog="{cards[0]}"]')
    page.click(f'[data-prog="{cards[0]}"]')
    if page.evaluate(f"{E}.pending().chords"):
        failures.append("a card tapped twice before the bar line is still queued")
    bar = page.evaluate(f"{E}.position().bar")
    wait_for(page, f"{E}.position().bar > {bar + 1}", 6.0)
    if page.evaluate(f"JSON.stringify({E}.getSong().sections[{sec}].chords)") != before:
        failures.append("a cancelled card changed the chords")

    # More chords: the next four, wrapping back to the first page.
    first = page.eval_on_selector_all("[data-prog]", "els => els.map(e => e.dataset.prog)")
    of = page.get_attribute("#chord-more", "data-page-of")
    pages = int(of.split("/")[1])
    seen = {tuple(first)}
    for _ in range(pages):
        page.click("#chord-more")
        seen.add(tuple(page.eval_on_selector_all("[data-prog]", "els => els.map(e => e.dataset.prog)")))
    again = page.eval_on_selector_all("[data-prog]", "els => els.map(e => e.dataset.prog)")
    if pages > 1 and len(seen) != pages:
        failures.append(f"More chords showed {len(seen)} different pages, not {pages}")
    if again != first:
        failures.append("More chords did not wrap back to the first page")
    print(f"More chords: {pages} pages, wraps")

    # Borrow another vibe's chords: the cards change, nothing loads.
    vibes = page.evaluate("window.__vibes")
    other = next(v for v in vibes if v["id"] != style)
    page.click("#chord-vibe")
    if not page.locator(f'[data-borrow="{other["id"]}"]').count():
        failures.append("the vibe button in the Chords title did not open the vibe picker")
    else:
        check_sizes(page, "borrow picker", failures)
        page.click(f'[data-borrow="{other["id"]}"]')
        if page.evaluate(f"{E}.pendingLoad()") or page.evaluate(f"{E}.getSong().style") != style:
            failures.append("borrowing a vibe's chords loaded the vibe")
        if other["name"] not in page.inner_text("#chord-vibe"):
            failures.append(f"the vibe button does not name the borrowed vibe: {page.inner_text('#chord-vibe')!r}")
        page.click("#chord-vibe")
        page.click("#borrow-own")
        print(f"borrowed {other['name']}'s chords without loading it, then went back")

    # Lower and Higher: a semitone each way, at once.
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    key = page.evaluate(f"{E}.getSong().key")
    page.click('[data-transpose="1"]')
    up = page.evaluate(f"{E}.getSong().key")
    page.click('[data-transpose="-1"]')
    back = page.evaluate(f"{E}.getSong().key")
    if up != names[(names.index(key) + 1) % 12] or back != key:
        failures.append(f"Higher then Lower moved the key {key} -> {up} -> {back}")

    # Advanced shows the progression as ordinary chords.
    sec = page.evaluate(f"{E}.position().section")
    n = page.evaluate(f"{E}.getSong().sections[{sec}].chords.length")
    page.click('[data-appmode="advanced"]')
    shown = page.locator("[data-seq]").count()
    if shown != n:
        failures.append(f"Advanced shows {shown} chords of the card's {n}")
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')


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
            wait_for(page, "!!window.__groovebox", 5.0)
            # P3: the vibe picker opens the app; on a first launch there is no jam to continue.
            walk_picker_open(page, failures, first=True)
            page.click("#vibe-close")
            if page.get_attribute('[data-appmode="simple"]', "aria-checked") != "true":
                failures.append("the app does not start in Simple")
            page.click("#play")
            time.sleep(0.5)
            walk_c4(page, failures)
            walk_p5(page, failures)
            walk_now(page, failures)
            walk_look(page, failures)
            walk_p2(page, failures)
            # The rest of the walk uses Advanced's controls (the Song grid, Edit without playing).
            page.click('[data-appmode="advanced"]')

            # Section B (Groove) has every instrument on. A tap on the strip waits for the bar line.
            page.click('[data-strip="1"]')
            if "pending" not in (page.get_attribute('[data-strip="1"]', "class") or ""):
                failures.append("queued section is not shown as pending")
            if "next bar" not in page.inner_text('[data-strip="1"]').lower():
                failures.append(f"queued section does not say Next bar: {page.inner_text('.secs')!r}")
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
            walk_g3(page, failures)
            walk_g4(page, failures)
            walk_p6(page, failures)
            walk_g5_record(page, failures)
            if page.locator("#new-jam").is_disabled():
                failures.append("New jam is disabled while playing (P3 enables it: a vibe loads as a new song)")
            n = walk_frame(page, failures)
            print(f"frame walk: {n} screens at 360 x 640 and 412 x 915, both modes")
            page.click('[data-appmode="advanced"]')
            narrow_pass(page, failures)
            if not page.evaluate("window.__groovebox.playing"):
                failures.append("the transport stopped during the shell walk")

            if shot:
                page.click('[data-tab="layer1"]')
                page.click('[data-mode="layer1:generative"]')
                time.sleep(0.3)
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
            walk_g5_songs(page, failures, f"http://localhost:{PORT}/index.html")
            walk_p3(page, failures)
            walk_p4(page, failures)
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
