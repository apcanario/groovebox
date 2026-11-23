#!/usr/bin/env python3
"""Headless smoke test: serve a built folder, press Play, check that audio runs and switches land on the bar,
then walk the shell (every tab, section strip, Play grid, chords, XY pad, dials, section menu) and every G3 control
(drum presets and sequencer, bass and synth rhythms, waves and dials, mix levels and meter, DnB at 174 bpm) and
every G4 layer control (three modes, lead row, new seed, pattern and sound dials) with no
page error, no control under 48 px and no more than six dials on one screen.

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
        if page.evaluate(SONG)["patches"] == song["patches"] and page.evaluate("window.__groovebox.getMix()") == mix:
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
    page.click('[data-rhythm="sustained"]')
    if not wait_for(page, "window.__groovebox.activeVoices('synth') >= 3", 5.0):
        failures.append(f"synth on Held sounds no chord ({page.evaluate('window.__groovebox.activeVoices(' + chr(39) + 'synth' + chr(39) + ')')} voices)")
    time.sleep(0.3)
    held = page.evaluate("window.__groovebox.activeVoices('synth')")

    # Detune on the held chord: every sub-oscillator lands on +-spread/2 of the new spread.
    before = page.evaluate("window.__groovebox.detunes('synth')")
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
    page.click('[data-rhythm="stabs"]')
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
    for preset in ["fourFloor", "houseShuffle", "techno", "twoStep", "dnb"]:
        page.click(f'[data-preset="{preset}"]')
        time.sleep(0.1)
        if page.evaluate(f"{S}.drums.preset") != preset:
            failures.append(f"drum preset {preset} did not take")
    page.click('[data-preset="fourFloor"]')
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
    n = turn_all(page, "drums page 1", failures)
    page.click('[data-page="drums:1"]')
    n += turn_all(page, "drums page 2", failures)
    page.click('[data-page="drums:0"]')
    if n != 10:
        failures.append(f"drums tab has {n} dials, expected 10 over two pages")

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
    for inst, rhythms in [("bass", ["offbeat", "rolling", "long", "dnbSub"]), ("synth", ["stabs", "offbeat", "sustained"])]:
        page.click(f'[data-tab="{inst}"]')
        for r in rhythms:
            page.click(f'[data-rhythm="{r}"]')
            time.sleep(0.25)
            if page.evaluate(f"{S}.{inst}.rhythm") != r:
                failures.append(f"{inst} rhythm {r} did not take")
        page.click(f'[data-rhythm="{rhythms[0]}"]')
        for w in ["square", "triangle", "sine", "sawtooth"]:
            page.click(f'[data-wave="{w}"]')
            time.sleep(0.25)
            if page.evaluate(f"{SONG}.patches.{inst}.wave") != w:
                failures.append(f"{inst} wave {w} did not take")
        k = turn_all(page, f"{inst} tab", failures)
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
    page.click('[data-page="mix:1"]')
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
    page.click('[data-page="mix:0"]')
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
        cells = page.eval_on_selector_all(f"#steps-{lid} .st", "els => els.length")
        if cells != 16:
            failures.append(f"{lid}: lead row has {cells} cells, not 16")
        seen = set()
        for _ in range(12):
            time.sleep(0.07)
            now = page.eval_on_selector_all(f"#steps-{lid} .st", "els => els.findIndex(e => e.classList.contains('now'))")
            seen.add(now)
        if len(seen - {-1}) < 3:
            failures.append(f"{lid}: lead row does not follow the playing step ({sorted(seen)})")
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

        # Sound page: wave chips and the shared patch dials.
        page.click(f'[data-page="{lid}:1"]')
        for w in ["square", "sine", "sawtooth", "triangle"]:
            page.click(f'[data-wave="{w}"]')
            time.sleep(0.1)
            if page.evaluate(f"{SONG}.patches.{lid}.wave") != w:
                failures.append(f"{lid} wave {w} did not take")
        k = turn_all(page, f"{lid} sound", failures)
        if k != 5:
            failures.append(f"{lid}: sound page has {k} dials, not 5")
        page.click(f'[data-page="{lid}:0"]')

        page.click(f'[data-mode="{lid}:{saved_mode}"]')
        if saved_mode != "pad":
            got = wait_for_value(page, f"window.__groovebox.padHz('{lid}')", 10000, 1.5)
            if abs(got - 10000) > 1:
                failures.append(f"{lid}: pad filter did not open again outside Pad mode ({got:.0f} Hz)")
        print(f"{lid}: three modes walked, back to {saved_mode}")


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
            walk_g3(page, failures)
            walk_g4(page, failures)
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
