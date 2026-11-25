"""P10 (spec 8.9): the smoke test's checks of the Drop, imported by smoke.py.

walk_drop: on one vibe, the button and its motion through build, on and wind-down (spec 8.12), a drop that stays on
until the second press, the song document identical after the wind-down, the wind-down landing on a bar line in the
same section and in a section tapped during the drop (shown as waiting, "After drop"), a cancel during the build, the
Drop page in Advanced and the presses in the event log.

drop_vibes: every vibe loaded mid-jam, its drop played (a two-bar build and wind-down, set on the Drop page), and its
loudness (K-weighted, P10 review S7) and stereo width measured on the master output over eight whole bars of the section
before and eight whole bars of the drop (after the impact's bar): within 1 dB, each of those bars within 1.5 dB past the
section's own largest bar-to-bar stray, and wider. The master's largest sample over the section, build, impact, drop, wind-down and two bars after stays under
-0.5 dBFS, also at Width 1, Hold and Saturation 0.6 (P10 review S1, S3). On Drone the drop's bar lines do not dip
(P10 review S8).
"""
import json
import math
import time

E = "window.__groovebox"
# The drop's loudness against the section it came from (spec 8.9: within 1 dB), and how much wider it must be.
LOUD_DB = 1.0
WIDER = 1.15
# P10 review S1: no single bar of the drop after the impact's bar strays further than this from the section.
BAR_DB = 1.5
# P10 review S3: the master's largest sample stays under this (dBFS), so a small regression shows before it clips.
PEAK_DBFS = -0.5
# P10 review S2: every instrument's level dial halved during the drop (once the follower holds) lowers the master by at
# least this many dB four beats later, and the follower's gain does not move.
LEVEL_DROP_DB = 3.0
# Bars read of the section before the drop and of the drop after the impact's bar: eight, so a section whose bars vary
# (IDM's generative break: one four-bar window 1.3 dB from the next) is compared over enough of it.
WINDOW = 8
# The smoke runs the 24 vibes' drops in this many groups (parts drop-1 to drop-6), each in its own browser.
DROP_GROUPS = 6
# A click: a window whose largest sample-to-sample jump, over its largest sample, is this many times the steady
# sound's (smoke.py imports it from here, so the wind-down's click check uses the same threshold as every other).
CLICK_FACTOR = 2.5
# P10b (C21), the wind-down measured bar by bar (spec 8.9): the extra layers' own level falls at least this many dB a
# bar (measured on the layers alone, before they join the music: the follower keeps the master at the section's level).
WIND_STEP_DB = 0.5
# The master's width may read this much (side over mid) higher than the bar before and still count as falling, and the
# bar after the wind-down may be this much past the section's own bar-to-bar stray from its mean.
WIND_WIDTH_TOL = 0.01
# At least this share of each descent (layers' energy, master width over the section's) is left after the first bar.
WIND_NOT_FIRST = 0.15
# The extra layers are silent (dB of energy) once the wind-down has ended.
LAYERS_GONE_DB = -80.0


def wait_for(page, expr: str, timeout: float) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if page.evaluate(expr):
            return True
        time.sleep(0.02)
    return False


def bar_s(page) -> float:
    return 240.0 / page.evaluate(f"{E}.bpm")


def next_bar(page, n: int = 1) -> int:
    """Wait for `n` bar lines to be heard; returns the bar now heard."""
    for _ in range(n):
        b0 = page.evaluate(f"{E}.position().bar")
        wait_for(page, f"{E}.position().bar !== {b0}", bar_s(page) + 1.5)
    return page.evaluate(f"{E}.position().bar")


def shown(page) -> dict:
    return page.evaluate(f"{E}.dropShown()")


def db(e: dict) -> float:
    return 10 * math.log10(max(e["energy"], 1e-12))


def drop_dom(page) -> dict:
    """The button as drawn: its state attributes, lit segments, the fill's offset (-1: empty, 0: full) and the countdown."""
    return page.evaluate(
        """() => { const b = document.querySelector('#drop'); if (!b) return null;
      const f = b.querySelector('.dfill'); const m = new DOMMatrix(getComputedStyle(f).transform);
      const r = b.getBoundingClientRect();
      return { phase: b.dataset.drop, intent: b.dataset.intent, cls: b.className, lit: b.querySelectorAll('.segs i.lit').length,
        fill: m.m41 / Math.max(1, b.clientWidth), left: (b.querySelector('.dleft') || {}).textContent ?? null,
        band: getComputedStyle(b, '::before').content !== 'none' && getComputedStyle(b, '::before').display !== 'none',
        w: r.width, h: r.height, top: r.top, bottom: r.bottom, vw: document.documentElement.clientWidth,
        over: b.scrollWidth > b.clientWidth + 1, icon: !!b.querySelector('svg[data-icon="keyboard_double_arrow_down"]') }; }"""
    )


def doc(page) -> str:
    return json.dumps(page.evaluate(f"{E}.getDocument()"), sort_keys=True)


def walk_drop(page, failures: list, vibe_song: str = "deepHouse") -> None:
    # At the smallest phone (spec 8.6), where the button's words, countdown and segments have least room.
    page.set_viewport_size({"width": 360, "height": 640})
    page.evaluate(f"(id) => {E}.loadAtBar(window.__vibeSong(id), 1)", vibe_song)
    wait_for(page, f"{E}.getSong().style === {vibe_song!r}", 10.0)
    if not page.evaluate(f"{E}.playing"):
        page.click("#play")
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')
    page.evaluate(f"{E}.setDrop({{build: 2, wind: 2}})")
    next_bar(page, 2)
    sec = page.evaluate(f"{E}.position().section")

    # The button: Simple Play, full width, between the instruments and the strip, its icon beside DROP, 48 px or more.
    # P11 (spec 8.6): the Morph switch sits beside it, so DROP and Morph together fill the row.
    d = drop_dom(page)
    if not d:
        return failures.append("P10: no DROP button on the Simple Play tab")
    lanes = page.evaluate("document.querySelector('.nowlist').getBoundingClientRect().bottom")
    strip = page.evaluate("document.querySelector('.secs').getBoundingClientRect().top")
    if not (d["top"] >= lanes - 0.5 and d["bottom"] <= strip + 0.5):
        failures.append(f"P10: DROP is not between the instruments and the strip ({d['top']:.0f}..{d['bottom']:.0f}, lanes end {lanes:.0f}, strip {strip:.0f})")
    morph_w = page.evaluate("(() => { const m = document.querySelector('#morph'); return m ? m.getBoundingClientRect().width + 2 : 0; })()")
    if d["w"] + morph_w < d["vw"] - 40 or d["w"] < d["vw"] / 2 or d["h"] < 48 or not d["icon"]:
        failures.append(f"P10: DROP is not a full-width tile of 48 px or more with its icon: {d}")
    if d["phase"] != "off" or d["lit"] != 0:
        failures.append(f"P10: DROP at rest is not off with dim segments: {d}")

    # At 360 x 640 the five lanes keep their 48 px with DROP added (nothing overflows the lanes).
    fit = page.evaluate("(() => { const n = document.querySelector('.nowlist'); return [n.scrollHeight, n.clientHeight, Math.min(...[...n.querySelectorAll('.now-tile')].map(t => t.getBoundingClientRect().height))]; })()")
    if fit[0] > fit[1] + 1 or fit[2] < 48:
        failures.append(f"P10: with DROP the Simple lanes do not fit at 360 x 640 (need {fit[0]} px, have {fit[1]}, lowest tile {fit[2]:.0f} px)")
    before = doc(page)
    mix_before = page.evaluate(f"{E}.dropInfo().mix")
    # First press, mid-bar: nothing immediate; armed (queued for the next bar: hatched) with its build length.
    wait_for(page, f"{E}.position().step === 5", 3.0)
    page.click("#drop")
    d = drop_dom(page)
    if d["phase"] != "off" or d["intent"] != "on" or "pending" not in d["cls"] or d["lit"] != 4 or d["left"] != "2":
        failures.append(f"P10: a press does not arm the drop for the next bar (queued, 2 bars): {d}")
    marks0 = page.evaluate(f"{E}.dropMarks.length")
    bs = bar_s(page)
    wait_for(page, f"{E}.dropShown().phase === 'build'", bs + 1.5)
    b = page.evaluate(f"{E}.position().bar")
    time.sleep(0.1)
    d1 = drop_dom(page)
    time.sleep(bs * 0.5)
    d2 = drop_dom(page)
    if d1["phase"] != "build" or d1["left"] != "2" or d1["lit"] != 4:
        failures.append(f"P10: the build did not start on the bar line with its countdown: {d1}")
    if d2["over"] or d1["over"]:
        failures.append("P10: the DROP button's contents overflow it during the build at 360 x 640")
    if not (d2["phase"] == "build" and d2["fill"] > d1["fill"] + 0.05 and -1.0 < d2["fill"] < 0):
        failures.append(f"P10: the build's fill does not grow from the left ({d1['fill']:.2f} then {d2['fill']:.2f})")
    wait_for(page, f"{E}.dropShown().barsLeft === 1", bs + 1.5)
    time.sleep(0.1)
    d3 = drop_dom(page)
    if d3["phase"] != "build" or d3["left"] != "1" or d3["lit"] != 2 or d3["fill"] <= d2["fill"]:
        failures.append(f"P10: the build's second bar does not count down (1 bar left, 2 segments): {d3}")
    wait_for(page, f"{E}.dropShown().phase === 'on'", bs + 1.5)
    time.sleep(0.3)
    d4 = drop_dom(page)
    marks = page.evaluate(f"{E}.dropMarks.slice({marks0})")
    impact = [m for m in marks if m["impact"]]
    if not impact or impact[0]["bar"] != b + 2 or [m["phase"] for m in marks[:2]] != ["build", "build"]:
        failures.append(f"P10: no impact on the bar line after the two-bar build: {marks}")
    if d4["phase"] != "on" or d4["lit"] != 4 or d4["left"] is not None or not d4["band"] or "pending" in d4["cls"]:
        failures.append(f"P10: the drop is not lit with its band while on: {d4}")
    # It stays on: six more bars, no press.
    next_bar(page, 6)
    if shown(page)["phase"] != "on":
        failures.append("P10: the drop did not stay on until the second press")
    else:
        print("P10 drop: armed, built 2 bars with the countdown, landed, stayed on 6 bars")
    # P10 review E1: knobs still work during the drop: Filter to -0.8 closes the master's low-pass, then back.
    sweep0 = page.evaluate(f"{E}.getMix().sweep")
    page.evaluate(f"{E}.setMix('sweep', -0.8)")
    time.sleep(0.4)
    lp = page.evaluate(f"{E}.dropInfo().mix.lp")
    page.evaluate(f"(v) => {E}.setMix('sweep', v)", sweep0)
    time.sleep(0.4)
    lp_back = page.evaluate(f"{E}.dropInfo().mix.lp")
    if not (lp < 2000 and lp_back > 15000):
        failures.append(f"P10: the Filter knob does nothing during the drop (low-pass {lp:.0f} Hz at -0.8, {lp_back:.0f} Hz back at {sweep0})")
    else:
        print(f"P10 drop: Filter during the drop: low-pass {lp:.0f} Hz at -0.8, {lp_back:.0f} Hz back")
    # P10 review S2: the follower does not work against a hand: every level halved, the master falls and stays down.
    levels = page.evaluate(f"(() => {{ const d = {E}.getDocument(); return Object.fromEntries(Object.entries(d.patches).map(([k, p]) => [k, p.level])); }})()")
    next_bar(page)
    page.evaluate(f"{E}.stereo()")
    next_bar(page)
    e_before = page.evaluate(f"{E}.stereo()")
    c_before = page.evaluate(f"{E}.dropInfo().comp")
    page.evaluate(f"(l) => {{ for (const [k, v] of Object.entries(l)) {E}.setParam(k, 'level', v / 2); }}", levels)
    next_bar(page)
    page.evaluate(f"{E}.stereo()")
    next_bar(page)
    e_after = page.evaluate(f"{E}.stereo()")
    c_after = page.evaluate(f"{E}.dropInfo().comp")
    page.evaluate(f"(l) => {{ for (const [k, v] of Object.entries(l)) {E}.setParam(k, 'level', v); }}", levels)
    fell = db(e_before) - db(e_after)
    moved = 20 * math.log10(max(c_after, 1e-9) / max(c_before, 1e-9))
    if fell < LEVEL_DROP_DB or abs(moved) > 0.1:
        failures.append(f"P10: the follower works against the level dials during the drop (master fell {fell:.2f} dB, wanted {LEVEL_DROP_DB}; its gain moved {moved:+.2f} dB)")
    else:
        print(f"P10 drop: every level halved during the drop: master down {fell:.2f} dB, follower's gain moved {moved:+.2f} dB")
    if shown(page)["phase"] != "on":
        failures.append("P10: the drop did not stay on through the knob checks")
    # Still: the band stops; the state reads by fill alone.
    page.click('[data-tab="mix"]')
    page.click('[data-page="mix:audio"]')
    page.click('[data-motion="off"]')
    page.click('[data-tab="play"]')
    time.sleep(0.2)
    ds = drop_dom(page)
    if ds["band"] or ds["lit"] != 4:
        failures.append(f"P10: with motion off the drop still moves, or its state is unreadable: {ds}")
    page.click('[data-tab="mix"]')
    page.click('[data-page="mix:audio"]')
    page.click('[data-motion="on"]')
    page.click('[data-tab="play"]')
    # Second press: the wind-down from the next bar line, draining, then off on a bar line in the same section.
    page.click("#drop")
    d = drop_dom(page)
    if d["intent"] != "off" or "pending" not in d["cls"]:
        failures.append(f"P10: the second press is not shown as waiting for the bar line: {d}")
    wait_for(page, f"{E}.dropShown().phase === 'wind'", bs + 1.5)
    w0 = page.evaluate(f"{E}.position().bar")
    time.sleep(bs * 0.15)
    dw1 = drop_dom(page)
    time.sleep(bar_s(page) * 0.5)
    dw2 = drop_dom(page)
    if dw1["phase"] != "wind" or dw1["left"] != "2" or not (dw2["fill"] < dw1["fill"] - 0.05):
        failures.append(f"P10: the wind-down does not count and drain ({dw1['fill']:.2f} then {dw2['fill']:.2f}): {dw1}")
    next_bar(page, 2)
    time.sleep(0.3)
    end = [m for m in page.evaluate(f"{E}.dropMarks.slice({marks0})") if m["end"]]
    if not end or end[-1]["bar"] != w0 + 2 or end[-1]["cancelled"]:
        failures.append(f"P10: the wind-down did not end on the bar line two bars after it began (bar {w0 + 2}): {end}")
    if page.evaluate(f"{E}.position().section") != sec or shown(page)["phase"] != "off":
        failures.append("P10: the wind-down did not land in the same section, back to normal")
    mix_after = page.evaluate(f"{E}.dropInfo().mix")
    # P10 review S9: the graph's Filter and Pump are back at the knobs' values, not only the document.
    if abs(mix_after["lp"] - mix_before["lp"]) > 1 or abs(mix_after["hp"] - mix_before["hp"]) > 1 or abs(mix_after["pump"] - mix_before["pump"]) > 1e-6:
        failures.append(f"P10: after the wind-down the master's filter and pump are not the knobs' ({mix_before} before, {mix_after} after)")
    after = doc(page)
    if after != before:
        failures.append("P10: the song document changed between the first press and the end of the wind-down")
    else:
        print(f"P10 drop: wound down 2 bars, back in section {sec} on bar {w0 + 2}; the song document identical")

    # P10b (spec 8.9): the Filter knob's own value, kept while the drop has the filter fully open, stays out through the
    # whole wind-down and comes back on its last bar line: the master's low-pass read on the audio clock through it.
    sweep0 = page.evaluate(f"{E}.getMix().sweep")
    page.evaluate(f"{E}.setMix('sweep', -0.3)")
    next_bar(page)
    time.sleep(0.3)
    lp_knob = page.evaluate(f"{E}.dropInfo().mix.lp")
    page.click("#drop")
    wait_for(page, f"{E}.dropShown().phase === 'on'", 3 * bs + 2.0)
    time.sleep(0.3)
    lp_on = page.evaluate(f"{E}.dropInfo().mix.lp")
    page.click("#drop")
    wait_for(page, f"{E}.dropShown().phase === 'wind'", bs + 1.5)
    reads = []
    until = time.time() + 2 * bar_s(page) + 1.2
    while time.time() < until:
        reads.append(page.evaluate(f"[{E}.cutoffNow('bass').now, {E}.dropInfo().mix.lp]"))
        time.sleep(0.05)
    fend = page.evaluate(f"{E}.dropMarks.filter(m => m.end).slice(-1)[0]")
    page.evaluate(f"(v) => {E}.setMix('sweep', v)", sweep0)
    early = [lp for t, lp in reads if fend and t < fend["at"] - 0.005]
    late = [lp for t, lp in reads if fend and t > fend["at"] + 0.5]
    if not (lp_knob < 15000 and lp_on > 15000 and early and min(early) > 15000 and late
            and all(abs(lp - lp_knob) <= 0.05 * lp_knob for lp in late)):
        failures.append(f"P10b: the Filter value kept during the drop is not applied on the wind-down's last bar line and not before "
                        f"(knob {lp_knob:.0f} Hz, drop {lp_on:.0f} Hz, wind-down lowest {min(early or [0]):.0f} Hz in {len(early)} reads, "
                        f"after the end {[round(x) for x in late[:3]]} in {len(late)} reads)")
    else:
        print(f"P10b drop: the Filter's {lp_knob:.0f} Hz kept through the drop and {len(early)} reads of the wind-down "
              f"(lowest {min(early):.0f} Hz), applied on its last bar line ({late[-1]:.0f} Hz after it)")
    next_bar(page)

    # Another section tapped during the drop: it waits for the wind-down ("After drop"), then lands on its bar line.
    other = (sec + 1) % len(page.evaluate(f"{E}.getSong().sections"))
    page.click("#drop")
    next_bar(page, 3)
    page.click(f'[data-strip="{other}"]')
    sub = page.inner_text(f'[data-strip="{other}"]').lower()
    if page.evaluate(f"{E}.pending().section") != other or "after drop" not in sub:
        failures.append(f"P10: a section tapped during the drop is not shown waiting for it: {sub!r}")
    # P10 review S9: tapping the playing section takes the waiting one back; tapping it again queues it again.
    page.click(f'[data-strip="{sec}"]')
    if page.evaluate(f"{E}.pending().section") is not None:
        failures.append("P10: tapping the playing section during the drop did not take the waiting one back")
    page.click(f'[data-strip="{other}"]')
    if page.evaluate(f"{E}.pending().section") != other:
        failures.append("P10: a section tapped again during the drop is not waiting for it")
    next_bar(page, 2)
    if page.evaluate(f"{E}.position().section") != sec:
        failures.append("P10: a section tapped during the drop switched before the wind-down")
    page.click("#drop")
    w1 = next_bar(page)
    next_bar(page, 2)
    time.sleep(0.4)
    landed = page.evaluate(f"{E}.landed.slice(-1)[0]")
    end = page.evaluate(f"{E}.dropMarks.filter(m => m.end).slice(-1)[0]")
    if page.evaluate(f"{E}.position().section") != other or not landed or landed["pending"]["section"] != other or not end or landed["bar"] != end["bar"] or end["bar"] != w1 + 2:
        failures.append(f"P10: the wind-down did not land in the tapped section on its bar line (landed {landed}, end {end})")
    else:
        print(f"P10 drop: section {other} tapped during the drop landed with the wind-down, bar {end['bar']}")

    # A press during the build cancels it, back to normal on the next bar line.
    page.click("#drop")
    c0 = next_bar(page)
    if shown(page)["phase"] != "build":
        failures.append("P10: the build did not start (cancel check)")
    page.click("#drop")
    if drop_dom(page)["intent"] != "cancel":
        failures.append("P10: a press during the build is not shown as cancelling")
    next_bar(page)
    time.sleep(0.3)
    end = page.evaluate(f"{E}.dropMarks.filter(m => m.end).slice(-1)[0]")
    if shown(page)["phase"] != "off" or not end or not end["cancelled"] or end["bar"] != c0 + 1:
        failures.append(f"P10: a press during the build did not cancel it on the next bar line: {end}")
    else:
        print("P10 drop: a press during the build cancelled it on the next bar line")

    # P10 review S9: armed, a section tapped waits for the drop; a second press before the bar line disarms the drop and
    # the section moves into the ordinary next-bar queue.
    here = page.evaluate(f"{E}.position().section")
    there = (here + 1) % len(page.evaluate(f"{E}.getSong().sections"))
    next_bar(page)
    wait_for(page, f"{E}.position().step >= 2 && {E}.position().step <= 8", 3.0)
    page.click("#drop")
    page.click(f'[data-strip="{there}"]')
    held = shown(page)["queued"]
    page.click("#drop")
    queued = page.evaluate(f"{E}.pending().section")
    d0 = next_bar(page)
    time.sleep(0.3)
    if held != there or queued != there or page.evaluate(f"{E}.position().section") != there or shown(page)["phase"] != "off":
        failures.append(f"P10: a disarmed drop did not move its waiting section into the next-bar queue (held {held}, queued {queued}, now {page.evaluate(f'{E}.position().section')}, bar {d0})")
    else:
        print(f"P10 drop: disarmed before the bar line, section {there} moved to the next bar and landed")

    # Recorded as events: a take holds the presses.
    page.evaluate(f"{E}.record()")
    page.click("#drop")
    next_bar(page)
    page.click("#drop")
    page.evaluate(f"{E}.record()")
    wait_for(page, f"{E}.recordInfo().state === 'off'", 10.0)
    ops = page.evaluate(f"({E}.getLog()?.events ?? []).filter(e => e.op === 'drop').length")
    if ops != 2:
        failures.append(f"P10: the take's log holds {ops} drop presses, not 2")
    if page.locator("#take-close").count():
        page.click("#take-close")
    next_bar(page)

    # Advanced: the same button on the Play tab, and the Drop page on the Mix tab.
    page.click('[data-appmode="advanced"]')
    if not page.locator("#drop").count():
        failures.append("P10: no DROP button on the Advanced Play tab")
    else:
        # P10 review S6: the grid sits directly on the strip (spec 8.6); DROP is above the grid, not between them.
        for vw, vh in ((360, 640), (390, 844)):
            page.set_viewport_size({"width": vw, "height": vh})
            time.sleep(0.15)
            f = page.evaluate("""() => { const r = (s) => document.querySelector(s).getBoundingClientRect();
              return { grid: r('.playtab .grid').bottom, gtop: r('.playtab .grid').top, strip: r('.secs').top, drop: r('#drop').bottom, h: r('#drop').height }; }""")
            if not (0 <= f["strip"] - f["grid"] <= 12 and f["drop"] <= f["gtop"] + 0.5 and f["h"] >= 48):
                failures.append(f"P10: on Advanced Play at {vw} x {vh} the grid is not directly on the strip with DROP above it: {f}")
        page.set_viewport_size({"width": 360, "height": 640})
    page.click('[data-tab="mix"]')
    page.click('[data-page="mix:drop"]')
    for sel, want in [('[data-dropbuild="8"]', ("build", 8)), ('[data-dropcliff="hold"]', ("cliff", "hold")), ('[data-dropwind="4"]', ("wind", 4))]:
        page.click(sel)
        got = page.evaluate(f"{E}.dropRecipe().{want[0]}")
        if got != want[1] or page.get_attribute(sel, "aria-pressed") != "true":
            failures.append(f"P10: the Drop page's {want[0]} did not set {want[1]} (got {got})")
    w_before = page.evaluate(f"{E}.dropRecipe().width")
    box = page.locator('[data-dial="dropWidth"]').bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2 + 80, steps=6)
    page.mouse.up()
    if not page.evaluate(f"{E}.dropRecipe().width") < w_before:
        failures.append("P10: the Width dial did not turn the width down")
    page.evaluate(f"{E}.setDrop({{build: 2, cliff: 'gap', wind: 2}})")
    page.click('[data-tab="play"]')
    page.click('[data-appmode="simple"]')
    page.set_viewport_size({"width": 390, "height": 844})


def peak_db(x: float) -> float:
    return 20 * math.log10(max(x, 1e-9))


def one_drop(page, v: dict, failures: list, label: str) -> dict | None:
    """One vibe's drop measured: the section's four bars, the build, the impact's bar, each of four drop bars, the
    wind-down and two bars after it. Returns the figures, or None when the drop did not come on."""
    next_bar(page)
    page.evaluate(f"{E}.stereo()")
    # P10b: the extra layers' own sound and the master's jumps (the click check's reference: the largest bar of the
    # section's and the drop's own, as for any sound that moves by itself) are read bar by bar too.
    page.evaluate(f"{E}.dropLayers()")
    page.evaluate(f"{E}.jumps('master')")
    sec_bars = []
    jumps = []
    for _ in range(WINDOW):
        next_bar(page)
        sec_bars.append(page.evaluate(f"{E}.stereo()"))
        jumps.append(jump_ratio(page))
    n = {"energy": sum(b["energy"] for b in sec_bars) / WINDOW, "flat": sum(b["flat"] for b in sec_bars) / WINDOW,
         "width": sum(b["width"] for b in sec_bars) / WINDOW, "peak": max(b["peak"] for b in sec_bars)}
    song_before = doc(page)
    page.evaluate(f"{E}.drop()")
    # The build (two bars from the next bar line) and its cliffhanger, then the impact's bar: read separately.
    wait_for(page, f"{E}.dropShown().phase === 'on'", 4 * bar_s(page) + 2.0)
    p_build = page.evaluate(f"{E}.stereo()")
    next_bar(page)  # the impact's bar
    p_imp = page.evaluate(f"{E}.stereo()")
    page.evaluate(f"{E}.jumps('master')")
    bars = []
    for _ in range(WINDOW):
        next_bar(page)
        bars.append(page.evaluate(f"{E}.stereo()"))
        jumps.append(jump_ratio(page))
    info = page.evaluate(f"{E}.dropInfo()")
    beats = page.evaluate(f"{E}.dropBeats.slice(-16)")
    phase = shown(page)["phase"]
    if phase != "on":
        failures.append(f"P10 {label}: the drop is not on after its build ({phase})")
        page.evaluate(f"{E}.drop()")
        return None
    # The wind-down (P10b), bar by bar from the second press: the master (level, width, jumps), the extra layers' own
    # level and the overlay's voices (the most sounding at once in each bar), then the two bars after it.
    page.evaluate(f"{E}.dropLayers()")
    page.evaluate(f"{E}.dropInfo()")  # the voice count starts over
    page.evaluate(f"{E}.drop()")
    length = page.evaluate(f"{E}.dropRecipe().wind")
    wait_for(page, f"{E}.dropShown().phase === 'wind'", bar_s(page) + 2.0)
    wind = [read_wind(page)]  # the drop's last bar: from the press to the wind-down's first bar line
    w0 = page.evaluate(f"{E}.position().bar")
    for i in range(length):
        if i == 0:
            # A press during the wind-down does nothing (spec 8.9): mid first bar, it is ignored.
            time.sleep(bar_s(page) * 0.4)
            page.evaluate(f"{E}.drop()")
            pressed = shown(page)
        next_bar(page)
        wind.append(read_wind(page))
    next_bar(page)
    wind.append(read_wind(page))  # the first bar after the wind-down
    live_after = page.evaluate(f"{E}.dropInfo().live")
    next_bar(page)
    wind.append(read_wind(page))
    end = page.evaluate(f"{E}.dropMarks.filter(m => m.end).slice(-1)[0]")
    plan = (page.evaluate(f"{E}.dropInfo().wind") or {}).get("steps")  # the engine's schedule (slice a), for the report
    p_wind = {"peak": max(w["s"]["peak"] for w in wind[:length + 1])}
    p_after = {"peak": max(w["s"]["peak"] for w in wind[length + 1:])}
    winds = {"bars": wind, "length": length, "live_after": live_after, "pressed": pressed, "w0": w0, "end": end,
             "same_song": doc(page) == song_before, "phase_after": shown(page)["phase"], "plan": plan,
             "jump_ref": max(jumps) if jumps else 0.0}
    energy = sum(b["energy"] for b in bars) / len(bars)
    width = sum(b["width"] for b in bars) / len(bars)
    loud = 10 * math.log10(max(energy, 1e-12)) - db(n)
    # Each drop bar against the section's level; the section's own bars spread round it too (a generative lead or
    # break varies bar to bar), so a drop bar may stray BAR_DB beyond the section's own largest stray.
    per_bar = [db(b) - db(n) for b in bars]
    spread = max(abs(db(b) - db(n)) for b in sec_bars)
    peaks = {"section": n["peak"], "build": p_build["peak"], "impact": p_imp["peak"], "drop": max(b["peak"] for b in bars),
             "wind": p_wind["peak"], "after": p_after["peak"]}
    top = max(peaks, key=peaks.get)
    return {"n": n, "loud": loud, "per_bar": per_bar, "spread": spread, "wider": width / max(n["width"], 1e-6), "width": width,
            "peak": peaks[top], "peak_at": top, "info": info, "beats": beats, "sec_bars": sec_bars, "wind": winds}


def jump_ratio(page) -> float:
    """The master's largest sample-to-sample jump over its largest sample since the last read (0 when silent)."""
    r = page.evaluate(f"{E}.jumps('master')") or {"jump": 0.0, "peak": 0.0}
    return r["jump"] / r["peak"] if r["peak"] > 1e-3 else 0.0


def read_wind(page) -> dict:
    """One bar of the wind-down's reads: the master (`s`), the extra layers alone (`l`), the most overlay voices sounding
    at once (`most`), the master's jumps over its peak (`j`)."""
    return {"s": page.evaluate(f"{E}.stereo()"), "l": page.evaluate(f"{E}.dropLayers()"),
            "most": page.evaluate(f"{E}.dropInfo().most"), "j": jump_ratio(page)}


def judge_wind(r: dict, label: str, failures: list) -> list:
    """P10b (C21, spec 8.9): the wind-down measured bar by bar. From the drop's last bar through each wind-down bar the
    extra layers' own level, the master's width and the overlay's voices fall bar by bar, a share left after the first
    bar, and on the bar after the end they are the section's (layers silent, no voice sounding, the master's level and
    width the section's); the master's level holds the section's through it; no click; a press during it does nothing;
    the song document unchanged. Returns the report's figures."""
    w = r["wind"]
    n = w["length"]
    bars = w["bars"]  # the drop's last bar, the n wind-down bars, two bars after
    wind = bars[:n + 1]
    after = bars[n + 1]
    sec = r["n"]
    lay = [db(b["l"]) for b in wind]
    wid = [b["s"]["width"] for b in wind]
    most = [b["most"] for b in wind]
    bad = []
    for i in range(1, n + 1):
        if not lay[i] <= lay[i - 1] - WIND_STEP_DB:
            bad.append(f"the extra layers do not fall in wind-down bar {i} ({lay[i - 1]:.1f} -> {lay[i]:.1f} dB, at least {WIND_STEP_DB} dB a bar)")
        if not wid[i] < wid[i - 1] + WIND_WIDTH_TOL:
            bad.append(f"the width does not fall in wind-down bar {i} ({wid[i - 1]:.3f} -> {wid[i]:.3f})")
        if not most[i] < most[i - 1]:
            bad.append(f"the overlay's voices do not fall in wind-down bar {i} ({most[i - 1]} -> {most[i]})")
    if not wid[0] > sec["width"] * WIDER:
        bad.append(f"the drop's last bar is not wider than the section ({sec['width']:.3f} -> {wid[0]:.3f})")
    # Not all spent in the first bar: a share of each descent is left for the bars after it.
    e = [b["l"]["energy"] for b in wind]
    if not e[1] >= WIND_NOT_FIRST * e[0]:
        bad.append(f"the extra layers are spent in the first bar ({10 * math.log10(max(e[1], 1e-12) / max(e[0], 1e-12)):+.1f} dB, "
                   f"under {WIND_NOT_FIRST:.0%} of their energy left)")
    if not wid[1] - sec["width"] >= WIND_NOT_FIRST * (wid[0] - sec["width"]):
        bad.append(f"the width is spent in the first bar ({wid[0]:.3f} -> {wid[1]:.3f}, the section's {sec['width']:.3f})")
    # The end: the section's own values on the bar after the last bar line.
    stray = max(abs(b["width"] - sec["width"]) for b in r["sec_bars"])
    if not abs(after["s"]["width"] - sec["width"]) <= stray + WIND_WIDTH_TOL:
        bad.append(f"the width after the wind-down is not the section's ({after['s']['width']:.3f}, the section's {sec['width']:.3f} within {stray + WIND_WIDTH_TOL:.3f})")
    if not abs(db(after["s"]) - db(sec)) <= LOUD_DB:
        bad.append(f"the level after the wind-down is {db(after['s']) - db(sec):+.2f} dB from the section's (more than {LOUD_DB} dB)")
    if not db(after["l"]) <= LAYERS_GONE_DB:
        bad.append(f"the extra layers still sound after the wind-down ({db(after['l']):.1f} dB)")
    if w["live_after"] != 0:
        bad.append(f"{w['live_after']} overlay voices still sound a bar after the wind-down (stuck notes)")
    # The master holds the section's level through the wind-down, as through the drop (nothing drops out at once).
    spread = max(abs(db(b) - db(sec)) for b in r["sec_bars"])
    for i in range(1, n + 1):
        off = db(wind[i]["s"]) - db(sec)
        if abs(off) > BAR_DB + spread:
            bad.append(f"wind-down bar {i} is {off:+.2f} dB from the section (more than {BAR_DB} dB past the section's own {spread:.2f} dB)")
    # No click in the wind-down or the bars after it, against the largest jump of the section's and the drop's own bars.
    ref = w["jump_ref"]
    for i, b in enumerate(bars[1:], 1):
        if ref > 0 and b["j"] > CLICK_FACTOR * ref:
            bad.append(f"a click in {'wind-down bar ' + str(i) if i <= n else 'bar ' + str(i - n) + ' after it'} (jump {b['j'] / ref:.1f} times the section's and drop's own, over {CLICK_FACTOR})")
    if w["pressed"]["phase"] != "wind" or w["pressed"]["intent"] == "on":
        bad.append(f"a press during the wind-down did something: {w['pressed']}")
    if not w["end"] or w["end"]["bar"] != w["w0"] + n or w["end"]["cancelled"] or w["phase_after"] != "off":
        bad.append(f"the wind-down did not end on its bar line {n} bars on, back to off, after a press during it (end {w['end']}, now {w['phase_after']})")
    if not w["same_song"]:
        bad.append("the song document changed between the first press and the end of the wind-down")
    for b in bad:
        failures.append(f"P10b {label}: {b}")
    return [f"{x:.1f}" for x in lay] + [f"{db(after['l']):.0f}"], [f"{x:.3f}" for x in wid] + [f"{after['s']['width']:.3f}"], most + [after["most"]]


def judge(r: dict, label: str, failures: list) -> None:
    if abs(r["loud"]) > LOUD_DB:
        failures.append(f"P10 {label}: the drop is {r['loud']:+.2f} dB from the section it came from (more than {LOUD_DB} dB)")
    worst_bar = max(r["per_bar"], key=abs)
    if abs(worst_bar) > BAR_DB + r["spread"]:
        failures.append(f"P10 {label}: a bar of the drop is {worst_bar:+.2f} dB from the section (more than {BAR_DB} dB past the section's own "
                        f"{r['spread']:.2f} dB): {[round(x, 2) for x in r['per_bar']]}")
    if r["wider"] < WIDER:
        failures.append(f"P10 {label}: the drop is not measurably wider ({r['n']['width']:.3f} -> {r['width']:.3f})")
    if peak_db(r["peak"]) > PEAK_DBFS:
        failures.append(f"P10 {label}: the master peaks at {peak_db(r['peak']):.2f} dBFS ({r['peak_at']}), over {PEAK_DBFS} dBFS")


def drop_group(vibes: list, group: int | None) -> list:
    """The vibes of one drop group (1 to DROP_GROUPS) in the order they are measured, or all of them for None: every
    vibe in exactly one group, Ambient and Drone last (in the last group)."""
    if group is None:
        return vibes
    size = math.ceil(len(vibes) / DROP_GROUPS)
    return vibes[(group - 1) * size:group * size]


def drop_vibes(page, failures: list, group: int | None = None) -> None:
    """The drop measured in every vibe (group None) or in one group of them (the smoke's parts drop-1 to drop-6, each
    in its own browser); the extra drop at the loudest settings runs with the last group."""
    vibes = page.evaluate("window.__vibes")
    # Ambient and Drone last: their tails ring for up to 20 s and would sit in the next vibe's bars before its drop.
    slow = ["ambient", "drone"]
    vibes = [v for v in vibes if v["id"] not in slow] + [v for s in slow for v in vibes if v["id"] == s]
    mine = drop_group(vibes, group)
    if not mine:
        failures.append(f"P10: drop group {group} has no vibes ({len(vibes)} vibes in {DROP_GROUPS} groups)")
    if group is not None:
        print(f"P10 drop group {group} of {DROP_GROUPS}: {', '.join(v['id'] for v in mine)}", flush=True)
    if not page.evaluate(f"{E}.playing"):
        page.click("#play")
    rows = []
    winds = []
    worst_loud = (0.0, "")
    worst_bar = (0.0, "")
    least_wide = (9.0, "")
    top_peak = (0.0, "")
    for v in mine:
        page.evaluate(f"(v) => {E}.loadAtBar(window.__vibeSong(v.id), v.start)", v)
        if not wait_for(page, f"{E}.getSong().style === {v['id']!r}", 10.0):
            failures.append(f"P10 {v['id']}: did not load")
            continue
        page.evaluate(f"{E}.setDrop({{build: 2, wind: 2}})")
        r = one_drop(page, v, failures, v["id"])
        if not r:
            continue
        judge(r, v["id"], failures)
        lay, wid, most = judge_wind(r, v["id"], failures)
        winds.append(f"{v['id']} layers {' > '.join(lay)} dB, width {' > '.join(wid)} (section {r['n']['width']:.3f}), voices {' > '.join(map(str, most))}")
        info = r["info"]
        rows.append(f"{v['id']} {r['loud']:+.2f} dB (bars {' '.join(f'{x:+.2f}' for x in r['per_bar'])}; the section's own within {r['spread']:.2f}), width {r['n']['width']:.3f} -> {r['width']:.3f}, "
                    f"peak {peak_db(r['peak']):.1f} dBFS ({r['peak_at']}), gain {info['comp']:.2f} after {info['followed']} beats, voices at most {info['most']}, {info['dropped']} over the cap"
                    f" (out {db(r['n']):.1f}, ref {10 * math.log10(max(info['ref'], 1e-12)):.1f} dB K-weighted, {10 * math.log10(max(r['n']['flat'], 1e-12)):.1f} flat)")
        print(f"  P10 drop measured in {v['id']} ({len(rows)} of {len(mine)})", flush=True)  # progress; the rows print below
        if abs(r["loud"]) > abs(worst_loud[0]):
            worst_loud = (r["loud"], v["id"])
        wb = max(r["per_bar"], key=abs)
        if abs(wb) > abs(worst_bar[0]):
            worst_bar = (wb, v["id"])
        if r["wider"] < least_wide[0]:
            least_wide = (r["wider"], v["id"])
        if r["peak"] > top_peak[0]:
            top_peak = (r["peak"], v["id"])
        if v["id"] == "drone":
            # P10 review S8: held notes are doubled once, so the drop does not dip on its bar lines: the beat that
            # starts each bar against the beat in the middle of it (the reading at step 4 holds beat 1, at 12 beat 3).
            b1 = [b["energy"] for b in r["beats"] if b["step"] == 4]
            b3 = [b["energy"] for b in r["beats"] if b["step"] == 12]
            if b1 and b3:
                dip = 10 * math.log10(max(sum(b1) / len(b1), 1e-12) / max(sum(b3) / len(b3), 1e-12))
                print(f"  P10 drone: the drop's first beat of a bar against its third: {dip:+.2f} dB")
                if abs(dip) > 1.0:
                    failures.append(f"P10 drone: the drop's bar lines are {dip:+.2f} dB from mid-bar (more than 1 dB)")
            else:
                failures.append("P10 drone: no beats of the drop read")
    # P10 review S3: one drop at the loudest settings: Width 1, Hold, Saturation 0.6 (after the last group).
    extra = next((v for v in vibes if v["id"] == "edm"), vibes[0])
    if group in (None, DROP_GROUPS):
        page.evaluate(f"(v) => {E}.loadAtBar(window.__vibeSong(v.id), v.start)", extra)
    if group in (None, DROP_GROUPS) and wait_for(page, f"{E}.getSong().style === {extra['id']!r}", 10.0):
        sat = page.evaluate(f"{E}.getMix().saturation")
        page.evaluate(f"{E}.setMix('saturation', 0.6)")
        page.evaluate(f"{E}.setDrop({{build: 2, wind: 2, cliff: 'hold', width: 1}})")
        r = one_drop(page, extra, failures, f"{extra['id']} at Width 1, Hold, Saturation 0.6")
        page.evaluate(f"(v) => {E}.setMix('saturation', v)", sat)
        if r:
            judge(r, f"{extra['id']} at Width 1, Hold, Saturation 0.6", failures)
            judge_wind(r, f"{extra['id']} at Width 1, Hold, Saturation 0.6", failures)
            rows.append(f"{extra['id']} at Width 1, Hold, Saturation 0.6: {r['loud']:+.2f} dB, peak {peak_db(r['peak']):.1f} dBFS ({r['peak_at']})")
            if r["peak"] > top_peak[0]:
                top_peak = (r["peak"], extra["id"] + " loudest settings")
    for r in rows:
        print("  P10 " + r)
    for r in winds:
        print("  P10b wind-down " + r)
    print(
        f"P10 drop{'' if group is None else f' group {group}'} in {len(rows)} runs: loudness within {abs(worst_loud[0]):.2f} dB ({worst_loud[1]}), a single bar within {abs(worst_bar[0]):.2f} dB ({worst_bar[1]}), "
        f"at least {least_wide[0]:.2f}x wider ({least_wide[1]}), highest peak {peak_db(top_peak[0]):.1f} dBFS ({top_peak[1]}) through build, impact, drop, wind-down and after"
    )
