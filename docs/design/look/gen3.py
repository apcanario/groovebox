#!/usr/bin/env python3
"""Groovebox look, second pass: the finished app on phone and tablet.

Direction: a hardware faceplate, flat. Square-cut tiles, round only where the thing is round
(dials, the XY dot). The one loud idea: every instrument shows the bar it is playing as a lane,
and one playhead sweeps all five. Hatching means "starts on the next bar".
"""
import math
import pathlib

OUT = pathlib.Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

BG, PANEL, TILE, LINE, TEXT, DIM = "#0a0a0c", "#101013", "#17171b", "#2a2a31", "#f2f2f4", "#8d8d99"
CORAL, ORANGE, TEAL, BLUE, VIOLET, YELLOW = "#ff6b6b", "#f4a261", "#2a9d8f", "#6aa3c9", "#9b5de5", "#e9c46a"
INST = [("Drums", CORAL, "Four on the floor"), ("Bass", TEAL, "Offbeat"), ("Synth", BLUE, "Warm stab"),
        ("Layer 1", VIOLET, "Hook lead"), ("Layer 2", YELLOW, "Soft pad")]
R = 3  # corner radius for every tile

CSS = f"""
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{background:{BG};color:{TEXT};font-family:'DM Sans',sans-serif;overflow:hidden}}
.m{{font-family:'Space Mono',monospace}}
.wrap{{display:flex;flex-direction:column;gap:10px;padding:12px}}
.t{{border-radius:{R}px;background:{TILE};white-space:nowrap;overflow:hidden}}
.row{{display:flex;gap:2px}}
.grow{{flex:1;min-width:0}}
.lbl{{font-size:11px;font-weight:500;color:{DIM}}}
/* header */
.hdr{{display:flex;gap:10px;height:40px}}
.btn{{display:flex;align-items:center;justify-content:center;gap:7px;font-size:13px;font-weight:600;padding:0 14px}}
.seg{{display:flex;gap:2px;background:{BG}}}
.seg .t{{display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:600;color:{DIM};flex:1;padding:0 10px}}
.seg .t.on{{color:{BG}}}
/* vibe */
.vibe{{display:flex;gap:2px;height:52px}}
.vibe .a{{width:52px;display:flex;align-items:center;justify-content:center;font-size:22px}}
.vibe .c{{flex:1;background:{CORAL};color:{BG};display:flex;align-items:center;justify-content:space-between;padding:0 16px}}
.vibe .c b{{font-size:19px;font-weight:700;letter-spacing:-.01em}}
.vibe .c span{{font-size:11px;font-weight:600;opacity:.7}}
/* lanes */
.lanes{{position:relative;display:flex;flex-direction:column;gap:2px}}
.lane{{display:flex;gap:2px}}
.lane .who{{flex:none;display:flex;flex-direction:column;justify-content:center;padding:0 12px;position:relative}}
.lane .who b{{font-size:16px;font-weight:700;line-height:1.15}}
.lane .who small{{font-size:11px;font-weight:500;margin-top:2px}}
.lane .who.on{{color:{BG}}}.lane .who.on small{{opacity:.72}}
.lane .who.off{{color:{DIM};border-left:4px solid var(--c)}}.lane .who.off small{{color:#5c5c66}}
.lane .who.next{{color:{TEXT};background:repeating-linear-gradient(135deg,var(--c) 0 7px,{TILE} 7px 14px)}}
.lane .who.next::before{{content:"";position:absolute;inset:6px;background:{TILE}}}
.lane .who.next b,.lane .who.next small{{position:relative}}.lane .who.next small{{color:var(--c)}}
.lane .roll{{flex:1;min-width:0;display:block}}
.head{{position:absolute;top:0;bottom:0;width:2px;background:{TEXT}}}
/* drop */
.drop{{background:{YELLOW};color:{BG};display:flex;align-items:center;justify-content:space-between;padding:0 16px}}
.drop b{{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;letter-spacing:.14em}}
.drop i{{display:flex;gap:3px}}.drop i u{{width:9px;height:22px;background:{BG};opacity:.22;display:block}}
.morph{{display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;font-weight:700}}
.morph small{{font-size:10.5px;font-weight:500;color:{DIM};margin-top:1px}}
/* sections */
.secs{{display:grid;grid-template-columns:repeat(4,1fr);gap:2px}}
.sec{{display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}}
.sec b{{font-family:'Space Mono',monospace;font-weight:700;line-height:1.05}}
.sec span{{font-size:11px;font-weight:500;color:{DIM}}}
.sec.play{{background:{TEAL};color:{BG}}}.sec.play span{{color:{BG};opacity:.75}}
.sec.next{{background:repeating-linear-gradient(135deg,{TEAL} 0 7px,{TILE} 7px 14px)}}
.sec.next::before{{content:"";position:absolute;inset:6px;background:{TILE}}}
.sec.next b,.sec.next span{{position:relative}}.sec.next span{{color:{TEAL}}}
.sec.edit{{box-shadow:inset 0 0 0 2px {YELLOW}}}.sec.edit span{{color:{YELLOW}}}
/* transport */
.tp{{display:flex;gap:2px}}
.tp .play{{background:{CORAL};display:flex;align-items:center;justify-content:center;flex:none}}
.tp .play i{{width:16px;height:16px;background:{BG};display:block}}
.tp .num{{display:flex;flex-direction:column;justify-content:center;padding:0 12px}}
.tp .num b{{font-family:'Space Mono',monospace;font-weight:700;letter-spacing:-.02em;line-height:1}}
.tp .num span{{font-size:10.5px;font-weight:500;color:{DIM};margin-top:3px}}
.tp .leds{{display:flex;align-items:center;gap:5px;padding:0 11px}}
.tp .leds i{{width:10px;height:10px;background:{LINE};display:block}}.tp .leds i.on{{background:{TEXT}}}
.tp .rec{{display:flex;align-items:center;justify-content:center;flex:none}}
.tp .rec i{{width:15px;height:15px;border-radius:50%;border:2.5px solid {CORAL};display:block}}
/* tabs */
.tabs{{display:grid;grid-template-columns:repeat(8,1fr);background:{PANEL};align-items:center}}
.tab{{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:9.5px;font-weight:500;color:{DIM}}}
.tab svg{{width:22px;height:22px;stroke:{DIM};fill:none;stroke-width:1.8;stroke-linecap:square;stroke-linejoin:miter}}
.tab.on{{color:{TEXT}}}.tab.on svg{{stroke:var(--c)}}.tab.on::before{{content:"";display:block;width:22px;height:3px;background:var(--c);margin-bottom:5px;margin-top:-8px}}
/* dials */
.dials{{display:grid;gap:2px}}
.dial{{display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}}
.dial span{{font-size:12px;font-weight:600;margin-top:1px}}
/* xy */
.xy{{position:relative;overflow:hidden;flex:1;min-height:70px;background-color:{TILE};background-image:radial-gradient({LINE} 1.2px,transparent 1.3px);background-size:22px 22px;background-position:11px 11px}}
.xy .hx{{position:absolute;left:0;right:0;height:1px;background:{ORANGE}}}
.xy .hy{{position:absolute;top:0;bottom:0;width:1px;background:{ORANGE}}}
.xy .dot{{position:absolute;border-radius:50%;background:{ORANGE}}}
.xy .tag{{position:absolute;font-size:11px;font-weight:500;color:{DIM}}}
.xy .val{{position:absolute;right:10px;top:8px;font-family:'Space Mono',monospace;font-size:11px;color:{ORANGE}}}
h1{{font-size:22px;font-weight:700;letter-spacing:-.015em}}
"""

ICONS = [
    ("Play", '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
    ("Chords", '<rect x="3" y="4" width="18" height="16"/><path d="M9 4v16M15 4v16"/>'),
    ("Drums", '<ellipse cx="12" cy="8" rx="8" ry="3.5"/><path d="M4 8v8c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5V8"/>'),
    ("Bass", '<path d="M3 15c3 0 3-8 6-8s3 10 6 10 3-6 6-6"/>'),
    ("Synth", '<path d="M3 17l5-10v10l5-10v10l5-10v10h3"/>'),
    ("Layer 1", '<path d="M12 4l9 5-9 5-9-5 9-5z"/><path d="M3 14l9 5 9-5"/>'),
    ("Layer 2", '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>'),
    ("Mix", '<path d="M6 3v18M12 3v18M18 3v18"/><rect x="4" y="13" width="4" height="4" fill="#101013"/><rect x="10" y="6" width="4" height="4" fill="#101013"/><rect x="16" y="11" width="4" height="4" fill="#101013"/>'),
]

# One bar of each instrument, on a 16-step grid. (start, length, row 0..1 from top, height share)
NOTES = {
    "Drums": [(s, .55, .78, .16) for s in (0, 4, 8, 12)] + [(s, .55, .48, .16) for s in (4, 12)]
             + [(s, .45, .18, .16) for s in (2, 6, 10, 14)] + [(s, .25, .18, .10) for s in (1, 3, 5, 7, 9, 11, 13, 15)],
    "Bass": [(2, 1.6, .7, .2), (6, 1.6, .7, .2), (10, .9, .7, .2), (11, .9, .5, .2), (14, 1.6, .7, .2)],
    "Synth": [(s, 1.2, y, .13) for s in (0, 3, 6, 11, 14) for y in (.26, .46, .66)],
    "Layer 1": [(0, 1.8, .55, .13), (2, .9, .4, .13), (3, .9, .28, .13), (6, 2.8, .2, .13), (10, .9, .4, .13),
                (11, .9, .55, .13), (13, 1.8, .68, .13)],
    "Layer 2": [(0, 15.6, .34, .1), (0, 15.6, .52, .1), (0, 15.6, .7, .1)],
}


def roll(name, color, w, h, on=True):
    step = w / 16
    out = f'<svg class="roll t" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" preserveAspectRatio="none">'
    out += f'<rect width="{w:.0f}" height="{h:.0f}" fill="{TILE}"/>'
    for b in (4, 8, 12):
        out += f'<rect x="{b * step:.1f}" y="0" width="1" height="{h:.0f}" fill="{LINE}"/>'
    c = color if on else "#33333b"
    for s, ln, y, hh in NOTES[name]:
        out += f'<rect x="{s * step + 2:.1f}" y="{y * h - hh * h / 2:.1f}" width="{max(2, ln * step - 4):.1f}" height="{hh * h:.1f}" fill="{c}"/>'
    return out + "</svg>"


def lanes(w, who_w, lane_h, states, head_step=9.4, big=False):
    roll_w = w - who_w - 2
    out = '<div class="lanes">'
    for (n, col, sub), st in zip(INST, states):
        cls = {"on": "on", "off": "off", "next": "next"}[st]
        style = f"width:{who_w}px;height:{lane_h}px;--c:{col};" + (f"background:{col};" if st == "on" else "")
        tag = "Next bar" if st == "next" else sub
        out += (f'<div class="lane"><div class="who t {cls}" style="{style}"><b style="font-size:{19 if big else 16}px">{n}</b>'
                f'<small>{tag}</small></div>{roll(n, col, roll_w, lane_h, st == "on")}</div>')
    x = who_w + 2 + roll_w * head_step / 16
    return out + f'<div class="head" style="left:{x:.1f}px"></div></div>'


def dial(label, v, text, color, size, h, fs):
    c, r = size / 2, size * .40
    sw = size * .12

    def pt(a, rr):
        return c + rr * math.cos(math.radians(a)), c + rr * math.sin(math.radians(a))

    def arc(a0, a1):
        (x0, y0), (x1, y1) = pt(a0, r), pt(a1, r)
        return f"M{x0:.1f} {y0:.1f}A{r:.1f} {r:.1f} 0 {1 if a1 - a0 > 180 else 0} 1 {x1:.1f} {y1:.1f}"

    end = 135 + 270 * max(.002, v)
    ticks = ""
    for a in (135, 270, 405):
        (x0, y0), (x1, y1) = pt(a, r + sw * .9), pt(a, r + sw * 1.45)
        ticks += f'<path d="M{x0:.1f} {y0:.1f}L{x1:.1f} {y1:.1f}" stroke="{DIM}" stroke-width="1.5"/>'
    (px0, py0), (px1, py1) = pt(end, r - sw * .5), pt(end, r + sw * .5)
    svg = (f'<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
           f'<path d="{arc(135, 405)}" stroke="{LINE}" stroke-width="{sw:.1f}" fill="none"/>'
           f'<path d="{arc(135, end)}" stroke="{color}" stroke-width="{sw:.1f}" fill="none"/>{ticks}'
           f'<path d="M{px0:.1f} {py0:.1f}L{px1:.1f} {py1:.1f}" stroke="{TEXT}" stroke-width="2.5"/>'
           f'<text x="{c}" y="{c + fs * .36:.1f}" text-anchor="middle" style="font-family:Space Mono,monospace;font-weight:700" font-size="{fs}" fill="{TEXT}">{text}</text></svg>')
    return f'<div class="dial t" style="height:{h}px">{svg}<span>{label}</span></div>'


def seg(items, on, color, h=40, fs=None):
    f = f"font-size:{fs}px;" if fs else ""
    return f'<div class="seg" style="height:{h}px">' + "".join(
        f'<div class="t{" on" if x == on else ""}" style="{f}{f"background:{color}" if x == on else ""}">{x}</div>' for x in items) + "</div>"


def header(mode, h=40, vibe=False):
    s = seg(["Simple", "Advanced"], "Simple" if mode == "simple" else "Advanced", CORAL, h)
    v = (f'<div class="vibe" style="height:{h}px;width:300px"><div class="a t" style="width:{h}px">‹</div><div class="c t"><b style="font-size:16px">Deep house</b></div>'
         f'<div class="a t" style="width:{h}px">›</div></div><div class="grow"></div>') if vibe else '<div class="grow"></div>'
    return (f'<div class="hdr" style="height:{h}px"><div class="btn t"><b style="color:{CORAL};font-size:17px">+</b>New jam</div>'
            f'{v}<div style="width:{210 if vibe else 190}px">{s}</div></div>')


def vibe():
    return ('<div class="vibe"><div class="a t">‹</div><div class="c t"><b>Deep house</b><span>All 24 vibes</span></div>'
            '<div class="a t">›</div></div>')


def drop(h=64, morph_w=104, fs=26):
    return (f'<div class="row" style="height:{h}px"><div class="drop t grow"><b style="font-size:{fs}px">DROP</b><i><u></u><u></u><u></u><u></u></i></div>'
            f'<div class="morph t" style="width:{morph_w}px">Morph<small>Off</small></div></div>')


def secs(states, h, fs):
    names = ["Intro", "Groove", "Break", "Outro"]
    words = {"play": "Playing", "next": "Next bar", "edit": "Editing"}
    return '<div class="secs">' + "".join(
        f'<div class="sec t {st}" style="height:{h}px"><b style="font-size:{fs}px">{"ABCD"[i]}</b><span>{words.get(st, names[i])}</span></div>'
        for i, st in enumerate(states)) + "</div>"


def transport(h=56, fs=22, extra=""):
    return (f'<div class="tp" style="height:{h}px"><div class="play t" style="width:{h + 12}px"><i></i></div>'
            f'<div class="num t"><b style="font-size:{fs}px">122</b><span>bpm</span></div>{extra}'
            f'<div class="num t grow"><b style="font-size:{fs}px">17.3</b><span>bar</span></div>'
            '<div class="leds t"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div>'
            f'<div class="rec t" style="width:{h}px"><i></i></div></div>')


def tabs(active, color, h=60, margin=12):
    return (f'<div class="tabs" style="height:{h}px;margin:0 -{margin}px -{margin}px">' + "".join(
        f'<div class="tab{" on" if n == active else ""}" style="--c:{color}"><svg viewBox="0 0 24 24">{p}</svg>{n}</div>' for n, p in ICONS) + "</div>")


def xy(x, y, xl, read, dot=40):
    return (f'<div class="xy t"><div class="hx" style="top:{y}%"></div><div class="hy" style="left:{x}%"></div>'
            f'<div class="dot" style="left:{x}%;top:{y}%;width:{dot}px;height:{dot}px;margin:-{dot // 2}px 0 0 -{dot // 2}px"></div>'
            f'<div class="tag" style="left:10px;top:8px">Resonance</div><div class="tag" style="left:10px;bottom:8px">{xl}</div>'
            f'<div class="val">{read}</div></div>')


def page(name, w, h, body, pad=12):
    css = CSS + f"html,body{{width:{w}px;height:{h}px}}.wrap{{height:{h}px;padding:{pad}px}}"
    (OUT / f"{name}.html").write_text(
        f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>{css}</style></head><body><div class="wrap">{body}</div></body></html>')


def lane_single(name, color, w, h, head=9.4):
    return (f'<div class="lanes">{roll(name, color, w, h)}<div class="head" style="left:{w * head / 16:.1f}px"></div></div>')


W = 390 - 24
STATES = ["on", "on", "on", "next", "off"]

# P1. Phone, Simple, Play
page("phone-1-simple-play", 390, 844,
     header("simple") + vibe() + lanes(W, 112, 84, STATES)
     + '<div class="grow"></div>' + drop() + secs(["", "play", "next", ""], 72, 26) + transport()
     + tabs("Play", CORAL))

# P2. Phone, Simple, Layer 1
d4 = '<div class="dials" style="grid-template-columns:1fr 1fr">' + "".join([
    dial("Busy", .6, "60", VIOLET, 74, 104, 19), dial("Evolve", .25, "25", YELLOW, 74, 104, 19),
    dial("Bright", .7, "70", ORANGE, 74, 104, 19), dial("Space", .45, "45", TEAL, 74, 104, 19)]) + "</div>"
fx_row = (f'<div class="row" style="height:48px"><div class="btn t grow" style="background:{BLUE};color:{BG}">Chorus</div>'
          f'<div class="btn t grow" style="color:{DIM}">Echo</div><div class="btn t grow">Back</div>'
          f'<div class="btn t grow" style="background:{VIOLET};color:{BG}">New idea</div></div>')
page("phone-2-simple-layer", 390, 844,
     header("simple")
     + f'<div class="row" style="align-items:center;height:32px"><h1 style="color:{VIOLET}">Layer 1</h1><div class="grow"></div>'
       f'<div class="t btn" style="height:32px;background:{VIOLET};color:{BG}">On</div></div>'
     + seg(["Lead", "Arp", "Pad", "Drone"], "Lead", VIOLET)
     + seg(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Hook", VIOLET)
     + lane_single("Layer 1", VIOLET, W, 46)
     + d4 + fx_row + xy(62, 46, "Bright", "1.8 kHz")
     + secs(["", "play", "", ""], 48, 18) + transport() + tabs("Layer 1", VIOLET))

# P3. Phone, Advanced, Layer 1
d6 = '<div class="dials" style="grid-template-columns:repeat(3,1fr)">' + "".join([
    dial("Busy", .6, "60", VIOLET, 62, 92, 16), dial("Lock", .82, "82", CORAL, 62, 92, 16), dial("Shape", .42, "Arch", YELLOW, 62, 92, 13),
    dial("Range", .5, "1.5", ORANGE, 62, 92, 16), dial("Register", .66, "High", BLUE, 62, 92, 13), dial("Tension", .35, "35", TEAL, 62, 92, 16)]) + "</div>"
page("phone-3-advanced-layer", 390, 844,
     header("advanced")
     + f'<div class="row" style="align-items:center;height:32px;gap:8px"><h1 style="color:{VIOLET}">Layer 1</h1><div class="grow"></div>'
       f'<div class="t btn" style="height:32px">Back</div><div class="t btn" style="height:32px;background:{VIOLET};color:{BG}">New idea</div></div>'
     + seg(["Lead", "Arp", "Pad", "Drone"], "Lead", VIOLET, 38)
     + seg(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Phrase", VIOLET, 38)
     + lane_single("Layer 1", VIOLET, W, 46)
     + seg(["Notes", "Feel", "Sound", "FX"], "Notes", TEXT, 38)
     + d6 + xy(58, 48, "Cutoff", "2.4 kHz")
     + secs(["", "play", "", "edit"], 48, 18) + transport() + tabs("Layer 1", VIOLET))


# ---------- tablet ----------
def punch(h=60):
    items = [("Cut", 0), ("Filter", 1), ("Stutter", 0), ("Echo", 0), ("Wash", 0), ("Riser", 0)]
    return f'<div class="row" style="height:{h}px">' + "".join(
        f'<div class="btn t grow" style="font-size:14px;{f"background:{ORANGE};color:{BG}" if on else ""}">{n}</div>' for n, on in items) + "</div>"


def matrix(w, who_w, cell_h):
    on = {"Drums": [1, 1, 0, 1], "Bass": [0, 1, 0, 1], "Synth": [0, 1, 1, 0], "Layer 1": [0, 1, 1, 0], "Layer 2": [1, 1, 1, 1]}
    cw = (w - who_w - 2 * 4) / 4
    out = '<div class="lanes">'
    for n, col, sub in INST:
        out += (f'<div class="lane"><div class="who t" style="width:{who_w}px;height:{cell_h}px;border-left:4px solid {col}">'
                f'<b style="font-size:15px">{n}</b><small style="color:{DIM}">{sub}</small></div>')
        for i, o in enumerate(on[n]):
            if n == "Bass" and i == 2:
                out += f'<div class="t" style="width:{cw:.1f}px;height:{cell_h}px;background:repeating-linear-gradient(135deg,{col} 0 7px,{TILE} 7px 14px)"></div>'
            elif o and i == 1:
                out += (f'<svg class="t" width="{cw:.1f}" height="{cell_h}" viewBox="0 0 {cw:.1f} {cell_h}"><rect width="{cw:.1f}" height="{cell_h}" fill="{col}"/>'
                        + "".join(f'<rect x="{s * cw / 16 + 1.5:.1f}" y="{y * cell_h - hh * cell_h / 2:.1f}" width="{max(2, ln * cw / 16 - 3):.1f}" height="{hh * cell_h:.1f}" fill="{BG}" opacity=".55"/>'
                                  for s, ln, y, hh in NOTES[n]) + "</svg>")
            elif o:
                out += f'<div class="t" style="width:{cw:.1f}px;height:{cell_h}px;background:{col}"></div>'
            else:
                out += f'<div class="t" style="width:{cw:.1f}px;height:{cell_h}px"></div>'
        out += "</div>"
    x = who_w + 2 + cw + 2 + cw * 9.4 / 16
    return out + f'<div class="head" style="left:{x:.1f}px"></div></div>'


def secs_aligned(w, who_w, h):
    cw = (w - who_w - 8) / 4
    names = ["Intro", "Groove", "Break", "Outro"]
    st = ["", "play", "next", ""]
    words = {"play": "Playing", "next": "Next bar"}
    out = f'<div class="row"><div class="t" style="width:{who_w}px;height:{h}px;display:flex;align-items:center;padding:0 12px;background:none"><span class="lbl">Sections</span></div>'
    for i in range(4):
        out += f'<div class="sec t {st[i]}" style="width:{cw:.1f}px;height:{h}px"><b style="font-size:22px">{"ABCD"[i]}</b><span>{words.get(st[i], names[i])}</span></div>'
    return out + "</div>"


def group(title, inner, flex="1"):
    return (f'<div style="flex:{flex};min-width:0;display:flex;flex-direction:column;gap:6px;background:{PANEL};padding:8px;border-radius:{R}px">'
            f'<span class="lbl">{title}</span>{inner}</div>')


# T1. Tablet landscape, Advanced: the desk
LW = 548
left = (f'<div style="width:{LW}px;flex:none;display:flex;flex-direction:column;gap:10px">'
        + f'<div class="row" style="height:60px"><div class="grow">{punch(60)}</div></div>'
        + matrix(LW, 122, 88)
        + secs_aligned(LW, 122, 64)
        + f'<div class="row" style="height:60px"><div class="drop t" style="width:176px;padding:0 12px"><b style="font-size:22px">DROP</b><i><u></u><u></u><u></u><u></u></i></div>'
          f'<div class="grow">{transport(60, 22)}</div></div></div>')
RW = 1280 - 32 - LW - 14
notes = '<div class="dials" style="grid-template-columns:repeat(3,1fr)">' + "".join([
    dial("Busy", .6, "60", VIOLET, 66, 98, 16), dial("Lock", .82, "82", CORAL, 66, 98, 16), dial("Shape", .42, "Arch", YELLOW, 66, 98, 13),
    dial("Range", .5, "1.5", ORANGE, 66, 98, 16), dial("Register", .66, "High", BLUE, 66, 98, 13), dial("Tension", .35, "35", TEAL, 66, 98, 16)]) + "</div>"
feel = '<div class="dials" style="grid-template-columns:repeat(3,1fr)">' + "".join([
    dial("Length", .45, "45", VIOLET, 66, 98, 16), dial("Phrase", .75, "4 bar", CORAL, 66, 98, 12), dial("Variation", .3, "30", YELLOW, 66, 98, 16),
    dial("Repeats", .15, "15", ORANGE, 66, 98, 16), dial("Slide", .4, "40", BLUE, 66, 98, 16), dial("Accent", .55, "55", TEAL, 66, 98, 16)]) + "</div>"
sound = '<div class="dials" style="grid-template-columns:repeat(4,1fr)">' + "".join([
    dial("Wave", .3, "Saw", VIOLET, 54, 74, 12), dial("Attack", .1, "10", CORAL, 54, 74, 14), dial("Release", .5, "50", YELLOW, 54, 74, 14), dial("Drive", .25, "25", ORANGE, 54, 74, 14)]) + "</div>"
fx = ('<div class="dials" style="grid-template-columns:repeat(4,1fr)">'
      + f'<div class="t btn" style="height:74px;background:{BLUE};color:{BG};font-size:14px">Chorus</div>'
      + dial("Mix", .55, "55", BLUE, 54, 74, 14) + dial("Rate", .3, "1/4", BLUE, 54, 74, 12) + dial("Depth", .6, "60", BLUE, 54, 74, 14)
      + f'<div class="t btn" style="height:74px;color:{DIM};font-size:14px">Echo</div>'
      + dial("Mix", .0, "0", LINE, 54, 74, 14) + dial("Time", .5, "1/8", LINE, 54, 74, 12) + dial("Feedback", .35, "35", LINE, 54, 74, 14) + "</div>")
rail = '<div class="row" style="height:44px">' + "".join(
    f'<div class="btn t grow" style="font-size:13px;{f"background:{VIOLET};color:{BG}" if n == "Layer 1" else f"color:{DIM}"}">{n}</div>'
    for n in ["Chords", "Drums", "Bass", "Synth", "Layer 1", "Layer 2", "Mix"]) + "</div>"
right = (f'<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px">' + rail
         + f'<div class="row" style="gap:10px;align-items:center"><h1 style="color:{VIOLET}">Layer 1</h1>'
           f'<div style="width:250px">{seg(["Lead", "Arp", "Pad", "Drone"], "Lead", VIOLET, 38)}</div>'
           f'<div class="grow">{seg(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Phrase", VIOLET, 38)}</div></div>'
         + f'<div class="row" style="gap:10px"><div class="grow">{lane_single("Layer 1", VIOLET, RW - 200, 44)}</div>'
           f'<div class="t btn" style="width:80px">Back</div><div class="t btn" style="width:100px;background:{VIOLET};color:{BG}">New idea</div></div>'
         + f'<div class="row" style="gap:10px">{group("Notes", notes)}{group("Feel", feel)}</div>'
         + f'<div class="row" style="gap:10px;flex:1;min-height:0"><div style="flex:1;display:flex">{xy(60, 44, "Cutoff", "2.4 kHz", 48)}</div>'
           f'<div style="flex:1.15;display:flex;flex-direction:column;gap:10px">{group("Sound", sound, "none")}{group("Effects", fx, "none")}</div></div>'
         + "</div>")
page("tablet-1-landscape-advanced", 1280, 800,
     header("advanced", 44, vibe=True) + f'<div style="display:flex;gap:14px;flex:1;min-height:0">{left}{right}</div>', pad=16)

# T2. Tablet portrait, Simple
TW = 800 - 32
d4t = '<div class="dials" style="grid-template-columns:repeat(4,1fr)">' + "".join([
    dial("Busy", .6, "60", VIOLET, 112, 156, 26), dial("Evolve", .25, "25", YELLOW, 112, 156, 26),
    dial("Bright", .7, "70", ORANGE, 112, 156, 26), dial("Space", .45, "45", TEAL, 112, 156, 26)]) + "</div>"
fx_t = (f'<div class="row" style="height:56px"><div class="btn t grow" style="font-size:15px;background:{BLUE};color:{BG}">Chorus</div>'
        f'<div class="btn t grow" style="font-size:15px;color:{DIM}">Echo</div><div class="btn t grow" style="font-size:15px">Back</div>'
        f'<div class="btn t grow" style="font-size:15px;background:{VIOLET};color:{BG}">New idea</div></div>')
page("tablet-2-portrait-simple", 800, 1280,
     header("simple", 48, vibe=True)
     + f'<div class="row" style="gap:10px;align-items:center"><h1 style="color:{VIOLET};font-size:26px">Layer 1</h1>'
       f'<div style="width:290px">{seg(["Lead", "Arp", "Pad", "Drone"], "Lead", VIOLET, 44, 14)}</div>'
       f'<div class="grow">{seg(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Hook", VIOLET, 44, 14)}</div></div>'
     + d4t + fx_t + xy(62, 44, "Bright", "1.8 kHz", 60)
     + punch(60)
     + lanes(TW, 150, 62, STATES, big=True)
     + drop(72, 150, 30) + secs(["", "play", "next", ""], 76, 28) + transport(60, 26) + tabs("Layer 1", VIOLET, 66, 16),
     pad=16)
print("ok")
