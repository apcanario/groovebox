"""P10 (spec 8.9): the smoke test's checks of the Drop, imported by smoke.py.

walk_drop: on one vibe, the button and its motion through build, on and wind-down (spec 8.12), a drop that stays on
until the second press, the song document identical after the wind-down, the wind-down landing on a bar line in the
same section and in a section tapped during the drop (shown as waiting, "After drop"), a cancel during the build, the
Drop page in Advanced and the presses in the event log.

drop_vibes: every vibe loaded mid-jam, its drop played (a two-bar build, set on the Drop page), and its loudness and
stereo width measured on the master output over four whole bars of the section before and four whole bars of the drop
(after the impact's bar): whole four-bar phrases, so a phrase louder on some chords than others compares like with like: within 1 dB, and wider. The master's largest sample over every bar stays under 0 dBFS.
"""
import json
import math
import time

E = "window.__groovebox"
# The drop's loudness against the section it came from (spec 8.9: within 1 dB), and how much wider it must be.
LOUD_DB = 1.0
WIDER = 1.15


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
    d = drop_dom(page)
    if not d:
        return failures.append("P10: no DROP button on the Simple Play tab")
    lanes = page.evaluate("document.querySelector('.nowlist').getBoundingClientRect().bottom")
    strip = page.evaluate("document.querySelector('.secs').getBoundingClientRect().top")
    if not (d["top"] >= lanes - 0.5 and d["bottom"] <= strip + 0.5):
        failures.append(f"P10: DROP is not between the instruments and the strip ({d['top']:.0f}..{d['bottom']:.0f}, lanes end {lanes:.0f}, strip {strip:.0f})")
    if d["w"] < d["vw"] - 40 or d["h"] < 48 or not d["icon"]:
        failures.append(f"P10: DROP is not a full-width tile of 48 px or more with its icon: {d}")
    if d["phase"] != "off" or d["lit"] != 0:
        failures.append(f"P10: DROP at rest is not off with dim segments: {d}")

    # At 360 x 640 the five lanes keep their 48 px with DROP added (nothing overflows the lanes).
    fit = page.evaluate("(() => { const n = document.querySelector('.nowlist'); return [n.scrollHeight, n.clientHeight, Math.min(...[...n.querySelectorAll('.now-tile')].map(t => t.getBoundingClientRect().height))]; })()")
    if fit[0] > fit[1] + 1 or fit[2] < 48:
        failures.append(f"P10: with DROP the Simple lanes do not fit at 360 x 640 (need {fit[0]} px, have {fit[1]}, lowest tile {fit[2]:.0f} px)")
    before = doc(page)
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
    after = doc(page)
    if after != before:
        failures.append("P10: the song document changed between the first press and the end of the wind-down")
    else:
        print(f"P10 drop: wound down 2 bars, back in section {sec} on bar {w0 + 2}; the song document identical")

    # Another section tapped during the drop: it waits for the wind-down ("After drop"), then lands on its bar line.
    other = (sec + 1) % len(page.evaluate(f"{E}.getSong().sections"))
    page.click("#drop")
    next_bar(page, 3)
    page.click(f'[data-strip="{other}"]')
    sub = page.inner_text(f'[data-strip="{other}"]').lower()
    if page.evaluate(f"{E}.pending().section") != other or "after drop" not in sub:
        failures.append(f"P10: a section tapped during the drop is not shown waiting for it: {sub!r}")
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


def drop_vibes(page, failures: list) -> None:
    vibes = page.evaluate("window.__vibes")
    # Ambient and Drone last: their tails ring for up to 20 s and would sit in the next vibe's bars before its drop.
    slow = ["ambient", "drone"]
    vibes = [v for v in vibes if v["id"] not in slow] + [v for s in slow for v in vibes if v["id"] == s]
    if not page.evaluate(f"{E}.playing"):
        page.click("#play")
    rows = []
    worst_loud = (0.0, "")
    least_wide = (9.0, "")
    top_peak = (0.0, "")
    for v in vibes:
        page.evaluate(f"(v) => {E}.loadAtBar(window.__vibeSong(v.id), v.start)", v)
        if not wait_for(page, f"{E}.getSong().style === {v['id']!r}", 10.0):
            failures.append(f"P10 {v['id']}: did not load")
            continue
        page.evaluate(f"{E}.setDrop({{build: 2}})")
        next_bar(page)
        page.evaluate(f"{E}.stereo()")
        next_bar(page, 4)
        n = page.evaluate(f"{E}.stereo()")
        page.evaluate(f"{E}.drop()")
        # The build (two bars from the next bar line), its cliffhanger and the impact: read whole, for the peak.
        wait_for(page, f"{E}.dropShown().phase === 'on'", 4 * bar_s(page) + 2.0)
        next_bar(page)  # the impact's bar
        p2 = page.evaluate(f"{E}.stereo()")
        next_bar(page, 4)
        dr = page.evaluate(f"{E}.stereo()")
        p1 = p2
        phase = shown(page)["phase"]
        info = page.evaluate(f"{E}.dropInfo()")
        if phase != "on":
            failures.append(f"P10 {v['id']}: the drop is not on after its build ({phase})")
        loud = db(dr) - db(n)
        wider = dr["width"] / max(n["width"], 1e-6)
        peak = max(x["peak"] for x in (n, p1, p2, dr))
        rows.append(f"{v['id']} {loud:+.2f} dB, width {n['width']:.3f} -> {dr['width']:.3f}, peak {20 * math.log10(max(peak, 1e-9)):.1f} dBFS, gain {info['comp']:.2f}"
                    f" (follower {10 * math.log10(max(info['measured'], 1e-12) / max(info['ref'], 1e-12)) + 20 * math.log10(max(info['comp'], 1e-9)):+.2f} dB; out {db(n):.1f} -> {db(dr):.1f}, ref {10 * math.log10(max(info['ref'], 1e-12)):.1f})")
        if abs(loud) > abs(worst_loud[0]):
            worst_loud = (loud, v["id"])
        if wider < least_wide[0]:
            least_wide = (wider, v["id"])
        if peak > top_peak[0]:
            top_peak = (peak, v["id"])
        if abs(loud) > LOUD_DB:
            failures.append(f"P10 {v['id']}: the drop is {loud:+.2f} dB from the section it came from (more than {LOUD_DB} dB)")
        if wider < WIDER:
            failures.append(f"P10 {v['id']}: the drop is not measurably wider ({n['width']:.3f} -> {dr['width']:.3f})")
        if peak >= 1.0:
            failures.append(f"P10 {v['id']}: the master clips ({peak:.3f})")
        # Back to normal for the next vibe: the wind-down's press, then the next vibe lands (it ends any drop).
        page.evaluate(f"{E}.drop()")
    for r in rows:
        print("  P10 " + r)
    print(
        f"P10 drop in {len(rows)} vibes: loudness within {abs(worst_loud[0]):.2f} dB ({worst_loud[1]}), "
        f"at least {least_wide[0]:.2f}x wider ({least_wide[1]}), highest peak {20 * math.log10(max(top_peak[0], 1e-9)):.1f} dBFS ({top_peak[1]})"
    )
