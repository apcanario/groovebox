"""P11 (spec 8.11): the smoke test's checks of Morph, imported by smoke.py.

walk_morph: the Morph switch beside DROP on the Simple Play tab (off on a song without a vibe, a tap turns it on and
off, 48 px or more); Morph off changes nothing (no move, the song document unchanged over eight bars); the Speed dial
on the Simple Mix tab and the Morph page in Advanced (five switches, Speed and Depth). Then ten minutes of Ambient,
loaded mid-jam with Morph on by default: no 16-bar stretch repeats exactly (each bar's notes and every value Morph
moves), no note leaves the key, the master never clips, and the live engine's journey is the seeded one: its moves and
its bars equal those the same song gives played without audio (window.__morphDry), so the same seed gives the same ten
minutes. Then a hand on the synth's Bright dial: Morph leaves it alone for 16 bars; a drop holds Morph from the press
to its end; and Morph switched off makes no move.
It checks what is scheduled and that sound comes out. It cannot judge how it sounds.
"""
import json
import time

E = "window.__groovebox"
# Spec 8.11's Done-when: ten minutes of Ambient.
MINUTES = 10
HANDS_BARS = 16


def wait_for(page, expr: str, timeout: float) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if page.evaluate(expr):
            return True
        time.sleep(0.02)
    return False


def bar_s(page) -> float:
    return 240.0 / page.evaluate(f"{E}.bpm")


def wait_bars(page, n: int) -> int:
    """Wait until the journey has planned `n` more bars; returns the journey's next bar."""
    start = page.evaluate(f"{E}.morphBar()")
    wait_for(page, f"{E}.morphBar() >= {start + n}", n * bar_s(page) + 3.0)
    return page.evaluate(f"{E}.morphBar()")


def drag(page, selector: str, dx: float, dy: float) -> None:
    """Press in the middle of an element, move by (dx, dy) in steps, release (as smoke.py's drag)."""
    box = page.locator(selector).bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    for i in range(1, 11):
        page.mouse.move(x + dx * i / 10, y + dy * i / 10)
    page.mouse.up()


def repeats(sigs: list) -> list:
    seen, out = set(), []
    for i in range(len(sigs) - 15):
        k = ",".join(sigs[i:i + 16])
        if k in seen:
            out.append(i)
        seen.add(k)
    return out


def touches(m: dict, inst: str, macro: str) -> bool:
    if m["op"] == "setMacro":
        return m["a"][1] == inst and m["a"][2] == macro
    if m["op"] == "setParams":
        return m["a"][0] == inst and ("cutoff" if macro == "bright" else "delay") in m["a"][1]
    return False


def morph_dom(page) -> dict | None:
    return page.evaluate(
        """() => { const b = document.querySelector('#morph'); const d = document.querySelector('#drop'); if (!b || !d) return null;
      const r = b.getBoundingClientRect(), q = d.getBoundingClientRect(); const ic = b.querySelector('.ic');
      return { on: b.dataset.morph, checked: b.getAttribute('aria-checked'), w: r.width, h: r.height, top: r.top, dtop: q.top,
        right: q.right, left: r.left, text: b.textContent, icon: !!b.querySelector('svg[data-icon="all_inclusive"]'),
        turn: ic ? getComputedStyle(ic).transform : 'none' }; }"""
    )


def walk_morph(page, failures: list) -> None:
    page.click('[data-tab="play"]')
    if not page.evaluate(f"{E}.playing"):
        page.click("#play")
    # The switch: beside DROP, on its row, off on a song without a vibe.
    d = morph_dom(page)
    if not d:
        return failures.append("P11: no Morph switch beside DROP on the Simple Play tab")
    if abs(d["top"] - d["dtop"]) > 1 or d["left"] < d["right"] or d["w"] < 48 or d["h"] < 48 or not d["icon"]:
        failures.append(f"P11: Morph is not a switch of 48 px or more with its icon beside DROP: {d}")
    if d["on"] != "off" or "Off" not in d["text"]:
        failures.append(f"P11: Morph is not off on a song without a vibe: {d}")

    # Morph off changes nothing: eight bars, no move, the document as it was.
    page.evaluate(f"{E}.morphTraceOn(true)")
    before = json.dumps(page.evaluate(f"{E}.getDocument()"), sort_keys=True)
    wait_bars(page, 8)
    moved = page.evaluate(f"{E}.morphMoves.length")
    after = json.dumps(page.evaluate(f"{E}.getDocument()"), sort_keys=True)
    if moved or after != before:
        failures.append(f"P11: with Morph off something moved: {moved} moves, document {'changed' if after != before else 'unchanged'}")
    else:
        print("P11: Morph off: eight bars, no move, the document unchanged")

    # A tap turns it on (shown at once, acting from the next bar line); another turns it off.
    page.click("#morph")
    if not wait_for(page, "document.querySelector('#morph').dataset.morph === 'on'", 2.0) or not page.evaluate(f"{E}.morphPlan().on"):
        failures.append("P11: a tap does not turn Morph on")
    time.sleep(0.6)
    t1 = morph_dom(page)["turn"]
    time.sleep(0.8)
    t2 = morph_dom(page)["turn"]
    if t1 == t2 or t1 == "none":
        failures.append(f"P11: Morph's icon does not turn while on and playing ({t1} then {t2})")
    page.click("#morph")
    if not wait_for(page, "document.querySelector('#morph').dataset.morph === 'off'", 2.0) or page.evaluate(f"{E}.morphPlan().on"):
        failures.append("P11: a second tap does not turn Morph off")
    if morph_dom(page)["turn"] != "none":
        failures.append("P11: Morph's icon turns while off")

    # Simple Mix: the Speed dial.
    page.click('[data-tab="mix"]')
    page.click('[data-page="mix:master"]')
    if not page.locator('[data-dial="morphSpeed"]').count():
        failures.append("P11: no Morph speed dial on the Simple Mix tab")
    else:
        s0 = page.evaluate(f"{E}.morphPlan().speed")
        drag(page, '[data-dial="morphSpeed"]', 0, -40)
        s1 = page.evaluate(f"{E}.morphPlan().speed")
        if not s1 > s0:
            failures.append(f"P11: the Speed dial does not set Morph's speed ({s0} -> {s1})")
        page.evaluate(f"{E}.setMorph({{speed: 0.5}})")
    # Advanced: the Morph page, a switch per thing, Speed and Depth.
    page.click('[data-appmode="advanced"]')
    page.click('[data-page="mix:morph"]')
    things = page.evaluate("[...document.querySelectorAll('[data-morphthing]')].map(b => b.dataset.morphthing)")
    if things != ["sound", "leads", "voicing", "instruments", "sections"]:
        failures.append(f"P11: the Morph page's switches are {things}")
    for dial in ("morphSpeed", "morphDepth"):
        if not page.locator(f'[data-dial="{dial}"]').count():
            failures.append(f"P11: the Morph page has no {dial} dial")
    page.click('[data-morphthing="sections"]')
    if not page.evaluate(f"{E}.morphPlan().moves.sections"):
        failures.append("P11: the Sections switch does not switch section moves on")
    page.click('[data-morphthing="sections"]')
    if page.evaluate(f"{E}.morphPlan().moves.sections"):
        failures.append("P11: the Sections switch does not switch them off again")
    page.click('[data-appmode="simple"]')
    page.click('[data-tab="play"]')

    # Ten minutes of Ambient, loaded mid-jam: Morph on by default, the journey traced from its first bar.
    start = page.evaluate("window.__vibes.find(v => v.id === 'ambient').start")
    song = page.evaluate("window.__vibeSong('ambient')")
    page.evaluate(f"{E}.morphTraceOn(true)")
    page.evaluate(f"(s) => {E}.loadAtBar(s, {start})", song)
    if not wait_for(page, f"{E}.getSong().style === 'ambient'", 10.0):
        return failures.append("P11: Ambient did not load")
    if not page.evaluate(f"{E}.morphPlan().on") or morph_dom(page)["on"] != "on":
        failures.append("P11: Morph is not on by default in Ambient")
    bars = int(-(-MINUTES * 60 // bar_s(page)))
    t0 = time.time()
    peak = 0.0
    loud = -999.0
    while page.evaluate(f"{E}.morphTrace.length") < bars + 1 and time.time() - t0 < MINUTES * 60 + 60:
        time.sleep(2.0)
        pk = page.evaluate(f"{E}.peak()")
        lv = page.evaluate(f"{E}.level()")
        if pk is not None and pk > -200:
            peak = max(peak, 10 ** (pk / 20))
        if lv is not None:
            loud = max(loud, lv)
    trace = page.evaluate(f"{E}.morphTrace.slice(0, {bars})")
    moves = page.evaluate(f"{E}.morphMoves.filter(m => m.bar < {bars})")
    mins = (time.time() - t0) / 60
    if len(trace) < bars:
        return failures.append(f"P11: only {len(trace)} of {bars} bars of Ambient traced in {mins:.1f} min")
    sigs = [t["sig"] for t in trace]
    rep = repeats(sigs)
    out = [n for t in trace for n in t["out"]]
    notes = sum(t["notes"] for t in trace)
    ops = {}
    for m in moves:
        ops[m["op"]] = ops.get(m["op"], 0) + 1
    print(f"P11: {bars} bars of Ambient ({mins:.1f} min) with Morph on: {notes} notes, {len(out)} out of key, "
          f"{len(rep)} 16-bar stretches repeated, moves {ops}, master peak {20 * __import__('math').log10(max(peak, 1e-9)):.1f} dBFS, loudest {loud:.1f} dB")
    if rep:
        failures.append(f"P11: ten minutes of Ambient repeat a 16-bar stretch exactly, from bars {rep[:8]}")
    if out:
        failures.append(f"P11: ten minutes of Ambient leave the key: notes {out[:8]}")
    if notes < bars:
        failures.append(f"P11: ten minutes of Ambient played only {notes} notes")
    if not (ops.get("setMacro") and ops.get("setPad")):
        failures.append(f"P11: Morph did not move the macros and the voicings in ten minutes of Ambient: {ops}")
    if peak >= 1.0:
        failures.append("P11: the master clips during ten minutes of Morph")
    if loud < -40:
        failures.append(f"P11: ten minutes of Ambient are too quiet ({loud:.1f} dB)")
    key = page.evaluate(f"[{E}.getSong().key, {E}.getSong().mood]")
    if key != ["E", "major"]:
        failures.append(f"P11: Ambient's key moved to {key}")
    # The same seed gives the same ten minutes: the live journey is the one the song gives without audio.
    dry = page.evaluate(f"(a) => window.__morphDry(a[0], a[1], {bars})", [song, start])
    if dry["moves"] != moves:
        first = next((i for i, (a, b) in enumerate(zip(dry["moves"], moves)) if a != b), min(len(moves), len(dry["moves"])))
        failures.append(f"P11: the live journey is not the seeded one: {len(moves)} moves live, {len(dry['moves'])} without audio, "
                        f"first difference at {first}: {moves[first] if first < len(moves) else None} / {dry['moves'][first] if first < len(dry['moves']) else None}")
    elif [t["sig"] for t in dry["trace"]] != sigs:
        first = next(i for i, (a, b) in enumerate(zip([t["sig"] for t in dry["trace"]], sigs)) if a != b)
        failures.append(f"P11: the live bars are not the seeded ones from bar {first}")
    else:
        print(f"P11: the live journey equals the seeded one, move for move ({len(moves)}) and bar for bar ({bars})")

    # Hands win: the synth's Bright dial turned by hand is left alone for 16 bars.
    page.click('[data-tab="synth"]')
    sel = '[data-dial="synth:macro:bright"]'
    if not page.locator(sel).count():
        failures.append("P11: no Bright dial on the Simple Synth tab")
    else:
        b0 = page.evaluate(f"{E}.morphBar()")
        drag(page, sel, 0, 50)
        time.sleep(0.5)  # the dial's last move reaches the engine
        hand_bar = page.evaluate(f"{E}.morphBar()")
        pos = page.evaluate(f"{E}.macroPos(1, 'synth', 'bright')")
        wait_bars(page, HANDS_BARS + 1)
        # The bars after the hand, sure to be inside its 16 whatever bar line passed during the drag.
        later = page.evaluate(f"{E}.morphMoves.filter(m => m.bar >= {hand_bar} && m.bar < {b0 + HANDS_BARS})")
        hit = [m for m in later if touches(m, "synth", "bright")]
        others = [m for m in later if not touches(m, "synth", "bright")]
        now = page.evaluate(f"{E}.macroPos(1, 'synth', 'bright')")
        if hit or abs(now - pos) > 1e-9:
            failures.append(f"P11: Morph moved the synth's Bright within 16 bars of a hand: {hit[:3]} ({pos} -> {now})")
        elif not others:
            failures.append("P11: Morph stopped moving everything after a hand on one dial")
        else:
            print(f"P11: a hand on the synth's Bright held it for 16 bars; {len(others)} other moves went on")
    page.click('[data-tab="play"]')

    # A drop holds Morph from the press to its end (the trace marks each bar line a drop held).
    page.evaluate(f"{E}.setDrop({{build: 2, wind: 2}})")
    page.click("#drop")
    wait_for(page, f"{E}.dropShown().phase === 'on'", 6 * bar_s(page) + 2.0)
    wait_bars(page, 2)
    page.click("#drop")
    wait_for(page, f"{E}.dropShown().phase === 'off' && {E}.dropShown().intent === 'none'", 6 * bar_s(page) + 2.0)
    wait_bars(page, 1)
    held = page.evaluate(f"{E}.morphTrace.filter(t => t.held).map(t => t.bar)")
    during = page.evaluate(f"(h) => {E}.morphMoves.filter(m => h.includes(m.bar))", held)
    if len(held) < 6:
        failures.append(f"P11: a drop (two bars of build, two on, two of wind-down) held Morph only at bars {held}")
    elif during:
        failures.append(f"P11: Morph moved during a drop: {during[:3]}")
    else:
        print(f"P11: no Morph move through a drop ({len(held)} bars held, {held[0]} to {held[-1]})")

    # Off: no move from the next bar line.
    page.click("#morph")
    wait_bars(page, 1)
    off_at = page.evaluate(f"{E}.morphBar()")
    wait_bars(page, 8)
    after_off = page.evaluate(f"{E}.morphMoves.filter(m => m.bar >= {off_at})")
    if after_off:
        failures.append(f"P11: Morph switched off still moved: {after_off[:3]}")
    page.evaluate(f"{E}.morphTraceOn(false)")
