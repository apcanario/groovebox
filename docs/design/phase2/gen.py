#!/usr/bin/env python3
"""Phase 2 mockups: five phone screens, rendered to JPG by render.sh."""
import math
import pathlib

OUT = pathlib.Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

C = dict(coral="#ff6b6b", orange="#f4a261", teal="#2a9d8f", blue="#6aa3c9", violet="#9b5de5", yellow="#e9c46a")
INST = [("Drums", C["coral"]), ("Bass", C["teal"]), ("Synth", C["blue"]), ("Layer 1", C["violet"]), ("Layer 2", C["yellow"])]

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:390px;height:844px;background:#0a0a0c;color:#f2f2f4;font-family:'DM Sans',sans-serif;overflow:hidden}
.m{font-family:'Space Mono',monospace}
.wrap{display:flex;flex-direction:column;height:844px;padding:12px 14px 0;gap:10px}
.dim{color:#8d8d99}
.cap{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8d8d99}
/* header */
.hdr{display:flex;align-items:center;height:36px;gap:8px}
.newjam{height:36px;padding:0 12px;border-radius:10px;background:#131316;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px}
.newjam b{color:#ff6b6b;font-size:16px;line-height:1}
.seg{margin-left:auto;display:flex;background:#131316;border-radius:10px;padding:3px;height:36px}
.seg span{padding:0 12px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.1em;display:flex;align-items:center;color:#8d8d99}
.seg span.on{background:#ff6b6b;color:#0a0a0c}
/* transport */
.top{display:flex;align-items:center;gap:8px;height:48px}
.play{width:56px;height:48px;border-radius:12px;background:#ff6b6b;display:flex;align-items:center;justify-content:center;flex:none}
.play i{width:16px;height:16px;border-radius:3px;background:#0a0a0c}
.pill{height:48px;border-radius:12px;background:#131316;padding:0 12px;display:flex;flex-direction:column;justify-content:center}
.pill b{font-family:'Space Mono',monospace;font-size:16px;line-height:1.1;white-space:nowrap}
.pill span{font-size:9px;letter-spacing:.12em;color:#8d8d99;text-transform:uppercase}
.pill.grow{flex:1;min-width:0}
.pill.txt b{font-family:'DM Sans',sans-serif;font-weight:700;font-size:15px}
.dots{height:48px;border-radius:12px;background:#131316;padding:0 12px;display:flex;align-items:center;gap:6px}
.dots i{width:9px;height:9px;border-radius:50%;background:#26262d}
.dots i.on{background:#f2f2f4}
.rec{width:48px;height:48px;border-radius:12px;background:#131316;display:flex;align-items:center;justify-content:center;flex:none}
.rec i{width:16px;height:16px;border-radius:50%;border:2.5px solid #ff6b6b}
/* sections */
.secs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.sec{height:46px;border-radius:10px;background:#131316;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
.sec b{font-family:'Space Mono',monospace;font-size:15px;line-height:1.1}
.sec span{font-size:9px;color:#8d8d99;letter-spacing:.1em;text-transform:uppercase}
.sec.playing{background:#2a9d8f;color:#0a0a0c}.sec.playing span{color:#0a0a0c;opacity:.8}
.sec.next{outline:2px dashed #2a9d8f;outline-offset:-2px}.sec.next span{color:#2a9d8f}
.sec.edit{outline:2px solid #e9c46a;outline-offset:-2px}.sec.edit span{color:#e9c46a}
.secs.big .sec{height:96px;border-radius:14px}.secs.big .sec b{font-size:24px}.secs.big .sec span{font-size:10px;margin-top:2px}
/* titles, chips */
.title{display:flex;align-items:center;height:30px}
.title h1{font-size:21px;font-weight:700;letter-spacing:-.01em}
.tog{margin-left:auto;width:52px;height:28px;border-radius:14px;position:relative}
.tog i{position:absolute;right:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#0a0a0c}
.chips{display:grid;gap:6px}
.chip{height:38px;border-radius:10px;background:#131316;font-size:12.5px;font-weight:600;display:flex;align-items:center;justify-content:center;color:#8d8d99;white-space:nowrap}
.chip.on{color:#0a0a0c}
.row{display:flex;gap:8px;overflow:hidden;margin-right:-14px}
.row .chip{padding:0 16px;flex:none}
.row.big .chip{height:52px;font-size:14px;border-radius:12px;padding:0 18px}
/* instrument rows (Now view) */
.inst{height:70px;border-radius:14px;background:#131316;display:flex;align-items:center;padding:0 16px;gap:12px}
.inst .sw{width:10px;height:30px;border-radius:5px;background:#26262d}
.inst b{font-size:17px;font-weight:700}
.inst small{display:block;font-size:11px;color:#8d8d99;font-weight:400;margin-top:1px}
.inst .state{margin-left:auto;font-family:'Space Mono',monospace;font-size:12px;font-weight:700;letter-spacing:.08em}
.inst.on{color:#0a0a0c}.inst.on small{color:#0a0a0c;opacity:.7}.inst.on .sw{background:#0a0a0c;opacity:.35}
.inst.next{outline:2px dashed var(--c);outline-offset:-2px}.inst.next .state{color:var(--c)}
/* dials */
.dials{display:grid;gap:8px}
.dial{background:#131316;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
.dial .val{position:absolute;left:0;right:0;text-align:center;font-family:'Space Mono',monospace;font-weight:700}
.dial label{font-weight:600;letter-spacing:.12em;text-transform:uppercase}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btn{height:52px;border-radius:12px;background:#131316;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:700}
/* xy */
.xy{background:#131316;border-radius:14px;position:relative;overflow:hidden;flex:1;min-height:80px}
.xy .hx{position:absolute;left:0;right:0;height:2px;background:#f4a261;opacity:.5}
.xy .hy{position:absolute;top:0;bottom:0;width:2px;background:#f4a261;opacity:.5}
.xy .dot{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:#f4a261}
.xy .l{position:absolute;left:12px;font-size:10px;font-weight:600;letter-spacing:.12em;color:#f4a261}
/* steps */
.steps{display:grid;grid-template-columns:repeat(16,1fr);gap:4px}
.st{height:24px;border-radius:4px;background:#131316}
/* progression cards */
.card{height:66px;border-radius:14px;background:#131316;display:flex;align-items:center;padding:0 14px;gap:12px;flex:none}
.card b{font-size:15px;font-weight:700;width:104px}
.card .blocks{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;height:34px;align-items:end}
.card .blocks i{border-radius:4px;display:block}
.card.on{outline:2px solid #2a9d8f;outline-offset:-2px}
.list{display:flex;flex-direction:column;gap:8px;overflow:hidden;flex:1;min-height:0}
/* grid */
.grid{display:grid;grid-template-columns:86px repeat(4,1fr);gap:8px}
.rl{height:78px;border-radius:12px;background:#131316;display:flex;align-items:center;padding:0 10px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;justify-content:space-between}
.rl i{font-style:normal;color:#8d8d99;font-size:15px}
.cell{height:78px;border-radius:12px;background:#131316}
.cell.next{outline:2px dashed var(--c);outline-offset:-2px}
.legend{display:flex;flex-direction:column;gap:8px;background:#131316;border-radius:14px;padding:14px}
.legend div{display:flex;align-items:center;gap:10px;font-size:13px;color:#8d8d99}
.legend i{width:26px;height:18px;border-radius:5px;flex:none}
/* tabs */
.tabs{margin:auto -14px 0;height:64px;background:#131316;display:grid;grid-template-columns:repeat(8,1fr);align-items:center;padding:0 4px 4px;flex:none}
.tab{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:8.5px;font-weight:600;letter-spacing:.05em;color:#8d8d99;text-transform:uppercase}
.tab svg{width:23px;height:23px;stroke:#8d8d99;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tab.on{color:#ff6b6b}.tab.on svg{stroke:#ff6b6b}
"""

ICONS = [
    ("Play", '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    ("Chords", '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'),
    ("Drums", '<ellipse cx="12" cy="8" rx="8" ry="3.5"/><path d="M4 8v8c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5V8"/>'),
    ("Bass", '<path d="M3 15c3 0 3-8 6-8s3 10 6 10 3-6 6-6"/>'),
    ("Synth", '<path d="M3 17l5-10v10l5-10v10l5-10v10h3"/>'),
    ("Layer 1", '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
    ("Layer 2", '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/>'),
    ("Mix", '<path d="M6 3v18M12 3v18M18 3v18"/><rect x="4" y="13" width="4" height="4" rx="1" fill="#131316"/><rect x="10" y="6" width="4" height="4" rx="1" fill="#131316"/><rect x="16" y="11" width="4" height="4" rx="1" fill="#131316"/>'),
]


def tabs(active):
    return '<div class="tabs">' + "".join(
        f'<div class="tab{" on" if n == active else ""}"><svg viewBox="0 0 24 24">{p}</svg>{n}</div>' for n, p in ICONS
    ) + "</div>"


def header(mode):
    s, a = (" on", "") if mode == "simple" else ("", " on")
    return f'<div class="hdr"><div class="newjam"><b>+</b>New jam</div><div class="seg"><span class="{s.strip()}">SIMPLE</span><span class="{a.strip()}">ADVANCED</span></div></div>'


def transport(mode):
    mid = (
        '<div class="pill grow txt"><b>Deep house</b><span>vibe</span></div>'
        if mode == "simple"
        else '<div class="pill grow"><b>A min</b><span>house</span></div>'
    )
    return (
        '<div class="top"><div class="play"><i></i></div>'
        '<div class="pill"><b>122</b><span>bpm</span></div>' + mid +
        '<div class="dots"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div>'
        '<div class="rec"><i></i></div></div>'
    )


def strip(states, big=False):
    names = ["Intro", "Groove", "Break", "Outro"]
    words = {"playing": "Playing", "next": "Next", "edit": "✎ Editing"}
    out = f'<div class="secs{" big" if big else ""}">'
    for i, st in enumerate(states):
        out += f'<div class="sec {st}"><b>{"ABCD"[i]}</b><span>{words.get(st, names[i])}</span></div>'
    return out + "</div>"


def dial(name, v, text, color, size, h, fs=17, lfs=11):
    r = size * 0.41
    c = size / 2

    def pt(a):
        return c + r * math.cos(math.radians(a)), c + r * math.sin(math.radians(a))

    def arc(a0, a1):
        (x0, y0), (x1, y1) = pt(a0), pt(a1)
        return f"M{x0:.1f} {y0:.1f}A{r:.1f} {r:.1f} 0 {1 if a1 - a0 > 180 else 0} 1 {x1:.1f} {y1:.1f}"

    sw = size * 0.115
    end = 135 + 270 * max(0.001, v)
    top = (h - size - lfs - 6) / 2 + size / 2 - fs * 0.62
    return (
        f'<div class="dial" style="height:{h}px"><svg width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
        f'<path d="{arc(135, 405)}" stroke="#26262d" stroke-width="{sw:.1f}" fill="none" stroke-linecap="round"/>'
        f'<path d="{arc(135, end)}" stroke="{color}" stroke-width="{sw:.1f}" fill="none" stroke-linecap="round"/></svg>'
        f'<div class="val" style="top:{top:.0f}px;font-size:{fs}px">{text}</div>'
        f'<label style="color:{color};font-size:{lfs}px;margin-top:4px">{name}</label></div>'
    )


def chips(items, on, color, cols):
    return f'<div class="chips" style="grid-template-columns:repeat({cols},1fr)">' + "".join(
        f'<div class="chip{" on" if x == on else ""}"{f" style=background:{color}" if x == on else ""}>{x}</div>' for x in items
    ) + "</div>"


def row(items, on, color, big=False):
    return f'<div class="row{" big" if big else ""}">' + "".join(
        f'<div class="chip{" on" if x == on else ""}"{f" style=background:{color}" if x == on else ""}>{x}</div>' for x in items
    ) + "</div>"


def xy(x, y, lab):
    return (
        f'<div class="xy"><div class="hx" style="top:{y}%"></div><div class="hy" style="left:{x}%"></div>'
        f'<div class="dot" style="left:{x}%;top:{y}%"></div><div class="l" style="top:9px">RESONANCE ↑</div>'
        f'<div class="l" style="bottom:8px">{lab} →</div></div>'
    )


def page(name, body):
    html = (
        '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + CSS + "</style></head><body><div class=\"wrap\">"
        + body + "</div></body></html>"
    )
    (OUT / f"{name}.html").write_text(html)


VIBES = ["Deep house", "Deep techno", "Lo-fi", "Drum and bass", "Ambient", "Tropical house"]

# 1. Simple, Play ("Now")
now = [("Drums", "Four on the floor", "on"), ("Bass", "Offbeat", "on"), ("Synth", "Warm stabs", "on"),
       ("Layer 1", "Hook lead", "next"), ("Layer 2", "Soft pad", "off")]
rows = ""
for (n, sub, st), (_, col) in zip(now, INST):
    if st == "on":
        rows += f'<div class="inst on" style="background:{col}"><div class="sw"></div><div><b>{n}</b><small>{sub}</small></div><div class="state">ON</div></div>'
    elif st == "next":
        rows += f'<div class="inst next" style="--c:{col}"><div class="sw" style="background:{col}"></div><div><b>{n}</b><small>{sub}</small></div><div class="state">NEXT BAR</div></div>'
    else:
        rows += f'<div class="inst"><div class="sw"></div><div><b class="dim">{n}</b><small>{sub}</small></div><div class="state dim">OFF</div></div>'
page("1-simple-play", header("simple") + transport("simple") + strip(["", "playing", "next", ""], big=True)
     + '<div class="cap" style="margin-top:4px">Playing now · tap to switch on or off · hold to open</div>'
     + f'<div style="display:flex;flex-direction:column;gap:8px">{rows}</div>'
     + '<div class="cap" style="margin-top:4px">Vibe</div>' + row(VIBES, "Deep house", C["coral"], big=True) + tabs("Play"))

# 2. Simple, Layer 1
v = C["violet"]
d2 = '<div class="dials" style="grid-template-columns:1fr 1fr">' + "".join([
    dial("Busy", 0.6, "60", v, 84, 122, 19, 12), dial("Evolve", 0.25, "25", C["yellow"], 84, 122, 19, 12),
    dial("Bright", 0.7, "70", C["orange"], 84, 122, 19, 12), dial("Space", 0.45, "45", C["teal"], 84, 122, 19, 12)]) + "</div>"
page("2-simple-layer", header("simple") + transport("simple") + strip(["", "playing", "", ""])
     + f'<div class="title"><h1><span style="color:{v}">Layer 1</span></h1><div class="tog" style="background:{v}"><i></i></div></div>'
     + chips(["Lead", "Arp", "Pad"], "Lead", v, 3)
     + '<div class="cap">Lead style</div>' + chips(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Hook", v, 5)
     + d2
     + f'<div class="btns"><div class="btn">↶ Back</div><div class="btn" style="background:{v};color:#0a0a0c">✦ New idea</div></div>'
     + xy(62, 38, "BRIGHT") + tabs("Layer 1"))

# 3. Simple, Chords
progs = [("Late window", [.55, .8, .45, .7], True), ("Slow tide", [.5, .5, .85, .65], False), ("Night bus", [.75, .5, .6, .4], False),
         ("Open road", [.45, .7, .9, .6], False), ("Low sun", [.6, .4, .7, .85], False), ("Paper lights", [.5, .65, .5, .8], False)]
hues = [C["blue"], C["violet"], C["teal"], C["yellow"]]
cards = ""
for n, hs, on in progs:
    bl = "".join(f'<i style="height:{int(h * 34)}px;background:{hues[i]}"></i>' for i, h in enumerate(hs))
    tag = '<span class="m" style="font-size:11px;color:#2a9d8f;font-weight:700">PLAYING</span>' if on else '<span class="dim" style="font-size:18px">▸</span>'
    cards += f'<div class="card{" on" if on else ""}"><b>{n}</b><div class="blocks">{bl}</div>{tag}</div>'
page("3-simple-chords", header("simple") + transport("simple") + strip(["", "playing", "", ""])
     + f'<div class="title"><h1><span style="color:{C["blue"]}">Chords</span></h1></div>'
     + '<div class="cap">Vibe</div>' + row(VIBES, "Deep house", C["coral"])
     + '<div class="cap">Feel</div>' + chips(["Bright", "Warm", "Dreamy", "Dark", "Tense", "Uplifting"], "Dreamy", C["blue"], 3)
     + f'<div class="list">{cards}</div>'
     + '<div class="btns" style="grid-template-columns:1fr 1.1fr 1fr"><div class="btn">− Lower</div><div class="btn dim" style="background:none;font-size:11px;letter-spacing:.12em">PITCH</div><div class="btn">Higher +</div></div>'
     + tabs("Chords"))

# 4. Advanced, Play ("Song" grid)
on = {"Drums": [1, 1, 0, 1], "Bass": [0, 1, 0, 1], "Synth": [0, 1, 1, 0], "Layer 1": [0, 1, 1, 0], "Layer 2": [1, 1, 1, 1]}
states = ["", "playing", "next", "edit"]
names = ["Intro", "Groove", "Break", "Outro"]
words = {"playing": "Playing", "next": "Next", "edit": "✎ Editing"}
g = '<div class="grid"><div class="cap" style="display:flex;align-items:center">Song</div>'
for i, st in enumerate(states):
    g += f'<div class="sec {st}" style="height:56px"><b>{"ABCD"[i]}</b><span>{words.get(st, names[i])}</span></div>'
for n, col in INST:
    g += f'<div class="rl" style="color:{col}">{n}<i>›</i></div>'
    for i, o in enumerate(on[n]):
        if n == "Bass" and i == 2:
            g += f'<div class="cell next" style="--c:{col}"></div>'
        else:
            g += f'<div class="cell"{f" style=background:{col}" if o else ""}></div>'
g += "</div>"
legend = (
    '<div class="legend">'
    '<div><i style="background:#2a9d8f"></i>Filled section: playing now</div>'
    '<div><i style="outline:2px dashed #2a9d8f;outline-offset:-2px"></i>Dashed: starts on the next bar</div>'
    '<div><i style="outline:2px solid #e9c46a;outline-offset:-2px"></i>Pencil: editing it without playing it</div>'
    '<div class="dim" style="font-size:12px">Hold a section for rename, copy, delete, edit without playing.</div></div>'
)
page("4-advanced-play", header("advanced") + transport("advanced") + g + legend + tabs("Play"))

# 5. Advanced, Layer 1
steps = ""
pat = {0: 2, 3: 1, 4: 1, 6: 3, 10: 1, 11: 1, 13: 2}
i = 0
while i < 16:
    if i in pat:
        n = pat[i]
        steps += f'<div class="st" style="grid-column:span {n};background:{v};{"outline:2px solid #f2f2f4;outline-offset:-2px;" if i == 6 else ""}"></div>'
        i += n
    else:
        steps += '<div class="st"></div>'
        i += 1
d6 = '<div class="dials" style="grid-template-columns:repeat(3,1fr)">' + "".join([
    dial("Busy", 0.6, "60", v, 66, 102, 15, 10.5), dial("Lock", 0.82, "82", C["coral"], 66, 102, 15, 10.5),
    dial("Shape", 0.42, "Arch", C["yellow"], 66, 102, 13, 10.5), dial("Range", 0.5, "1.5", C["orange"], 66, 102, 15, 10.5),
    dial("Register", 0.66, "High", C["blue"], 66, 102, 13, 10.5), dial("Tension", 0.35, "35", C["teal"], 66, 102, 15, 10.5)]) + "</div>"
page("5-advanced-layer", header("advanced") + transport("advanced") + strip(["", "playing", "", "edit"])
     + f'<div class="title"><h1><span style="color:{v}">Layer 1</span></h1>'
       f'<div style="margin-left:auto;display:flex;gap:8px;align-items:center"><div class="chip" style="height:30px;padding:0 10px;color:#f2f2f4">↶ Back</div><div class="chip" style="height:30px;padding:0 10px;background:{v};color:#0a0a0c">✦ New</div><div class="tog" style="background:{v};margin-left:0"><i></i></div></div></div>'
     + chips(["Lead", "Arp", "Pad"], "Lead", v, 3)
     + chips(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Phrase", v, 5)
     + '<div style="display:flex;align-items:center;gap:8px"><div class="cap">Page</div><div style="flex:1">' + chips(["Notes", "Feel", "Sound"], "Notes", "#f2f2f4", 3) + "</div></div>"
     + f'<div><div class="steps">{steps}</div><div class="cap" style="margin-top:6px">Phrase · bar 2 of 4</div></div>'
     + d6 + xy(58, 42, "CUTOFF") + tabs("Layer 1"))

# ---- revision: Simple never scrolls or swipes; 24 vibes ----
CSS += """
.chip,.btn,.inst b,.inst small,.card b,.vt,.sec span,.pill b,.pill span,.cap{white-space:nowrap}
.stepper{display:grid;grid-template-columns:60px 1fr 60px;gap:8px}
.stepper .arrow{height:64px;border-radius:14px;background:#131316;display:flex;align-items:center;justify-content:center;font-size:26px;color:#f2f2f4}
.stepper .cur{height:64px;border-radius:14px;background:#ff6b6b;color:#0a0a0c;display:flex;flex-direction:column;align-items:center;justify-content:center}
.stepper .cur b{font-size:18px;font-weight:700;line-height:1.15}
.stepper .cur span{font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.card.tall{height:72px}.card.tall .blocks{height:40px}
.vgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.vt{height:47px;border-radius:11px;background:#131316;display:flex;align-items:center;gap:10px;padding:0 12px;font-size:14px;font-weight:600}
.vt i{width:8px;height:22px;border-radius:4px;flex:none}
.vt.on{color:#0a0a0c}.vt.on i{background:#0a0a0c!important;opacity:.4}
.cont{height:54px;border-radius:12px;background:#131316;display:flex;align-items:center;justify-content:space-between;padding:0 16px;font-size:15px;font-weight:700;outline:2px solid #2a9d8f;outline-offset:-2px}
"""

# 1. Simple, Play: vibe stepper instead of a sideways row
page("1-simple-play", header("simple") + transport("simple") + strip(["", "playing", "next", ""], big=True)
     + '<div class="cap" style="margin-top:4px">Playing now · tap to switch on or off · hold to open</div>'
     + f'<div style="display:flex;flex-direction:column;gap:8px">{rows}</div>'
     + '<div class="cap" style="margin-top:4px">Vibe</div>'
     + '<div class="stepper"><div class="arrow">‹</div><div class="cur"><b>Deep house</b><span>tap for all 24 vibes</span></div><div class="arrow">›</div></div>'
     + tabs("Play"))

# 3. Simple, Chords: four cards and a More button, nothing scrolls
cards4 = ""
for n, hs, on_ in progs[:4]:
    bl = "".join(f'<i style="height:{int(h * 40)}px;background:{hues[i]}"></i>' for i, h in enumerate(hs))
    tag = '<span class="m" style="font-size:11px;color:#2a9d8f;font-weight:700">PLAYING</span>' if on_ else '<span class="dim" style="font-size:18px">▸</span>'
    cards4 += f'<div class="card tall{" on" if on_ else ""}"><b>{n}</b><div class="blocks">{bl}</div>{tag}</div>'
page("3-simple-chords", header("simple") + transport("simple") + strip(["", "playing", "", ""])
     + f'<div class="title"><h1><span style="color:{C["blue"]}">Chords</span></h1>'
       '<div class="chip" style="margin-left:auto;height:32px;padding:0 12px;color:#f2f2f4">Deep house ▾</div></div>'
     + '<div class="cap">Feel</div>' + chips(["Bright", "Warm", "Dreamy", "Dark", "Tense", "Uplifting"], "Dreamy", C["blue"], 3)
     + '<div class="cap">Dreamy · 1 of 2</div>'
     + f'<div style="display:flex;flex-direction:column;gap:8px">{cards4}</div>'
     + '<div class="btns" style="grid-template-columns:1fr 1.2fr 1fr;margin-top:auto"><div class="btn">− Lower</div><div class="btn" style="color:#6aa3c9">More chords ›</div><div class="btn">Higher +</div></div>'
     + '<div style="height:2px"></div>' + tabs("Chords"))

# 6. The vibe picker: 24 vibes on one screen
FAM = [(C["coral"], ["Deep house", "Tropical house", "Progressive", "Acid house", "Afro house"]),
       (C["violet"], ["Deep techno", "Melodic techno", "Minimal techno", "Dub techno"]),
       (C["yellow"], ["Drum and bass", "2-step", "Breakbeat", "Dubstep", "Future garage"]),
       (C["teal"], ["Lo-fi", "Ambient", "Drone", "Downtempo", "Synthwave"]),
       (C["blue"], ["IDM", "EDM", "Trance", "Electro", "Trap"])]
tiles = ""
for col, names_ in FAM:
    for n in names_:
        if n == "Deep house":
            tiles += f'<div class="vt on" style="background:{col}"><i></i>{n}</div>'
        else:
            tiles += f'<div class="vt"><i style="background:{col}"></i>{n}</div>'
page("6-vibe-picker",
     '<div class="title" style="height:40px"><h1>Pick a vibe</h1><div class="chip" style="margin-left:auto;width:40px;height:40px;color:#f2f2f4;font-size:18px">✕</div></div>'
     + '<div class="cont"><span>Continue last jam</span><span class="m" style="font-size:12px;color:#2a9d8f">DEEP HOUSE · 122</span></div>'
     + f'<div class="vgrid">{tiles}</div>'
     + '<div class="cap" style="text-align:center;margin-top:auto;padding-bottom:16px">One tap loads a full groove on the next bar</div>')

# ---- revision 2: sections and transport sit at the bottom, in thumb reach ----
CSS += """
.content{flex:1;min-height:0;display:flex;flex-direction:column;gap:10px}
.secs.big .sec{height:74px}
.tabs{margin-top:0}
"""

def aligned_strip(states):
    names_ = ["Intro", "Groove", "Break", "Outro"]
    words_ = {"playing": "Playing", "next": "Next", "edit": "✎ Editing"}
    out = '<div class="grid"><div class="cap" style="display:flex;align-items:center">Sections</div>'
    for i, st in enumerate(states):
        out += f'<div class="sec {st}" style="height:56px"><b>{"ABCD"[i]}</b><span>{words_.get(st, names_[i])}</span></div>'
    return out + "</div>"

def screen(name, mode, content, states, tab, big=False, aligned=False):
    st = aligned_strip(states) if aligned else strip(states, big)
    page(name, header(mode) + f'<div class="content">{content}</div>' + st + transport(mode) + tabs(tab))

screen("1-simple-play", "simple",
       '<div class="cap">Vibe</div>'
       '<div class="stepper"><div class="arrow">‹</div><div class="cur"><b>Deep house</b><span>tap for all 24 vibes</span></div><div class="arrow">›</div></div>'
       '<div style="flex:1"></div><div class="cap">Playing now · tap to switch on or off · hold to open</div>'
       f'<div style="display:flex;flex-direction:column;gap:8px">{rows}</div>',
       ["", "playing", "next", ""], "Play", big=True)

screen("2-simple-layer", "simple",
       f'<div class="title"><h1><span style="color:{v}">Layer 1</span></h1><div class="tog" style="background:{v}"><i></i></div></div>'
       + chips(["Lead", "Arp", "Pad"], "Lead", v, 3)
       + '<div class="cap">Lead style</div>' + chips(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Hook", v, 5)
       + d2
       + f'<div class="btns"><div class="btn">↶ Back</div><div class="btn" style="background:{v};color:#0a0a0c">✦ New idea</div></div>'
       + xy(62, 45, "BRIGHT"),
       ["", "playing", "", ""], "Layer 1")

screen("3-simple-chords", "simple",
       f'<div class="title"><h1><span style="color:{C["blue"]}">Chords</span></h1>'
       '<div class="chip" style="margin-left:auto;height:32px;padding:0 12px;color:#f2f2f4">Deep house ▾</div></div>'
       + '<div class="cap">Feel</div>' + chips(["Bright", "Warm", "Dreamy", "Dark", "Tense", "Uplifting"], "Dreamy", C["blue"], 3)
       + '<div class="cap">Dreamy · 1 of 2</div>'
       + f'<div style="display:flex;flex-direction:column;gap:8px">{cards4}</div>'
       + '<div class="btns" style="grid-template-columns:1fr 1.2fr 1fr;margin-top:auto"><div class="btn">− Lower</div><div class="btn" style="color:#6aa3c9">More chords ›</div><div class="btn">Higher +</div></div>',
       ["", "playing", "", ""], "Chords")

g2 = '<div class="grid" style="margin-top:auto">'
for n, col in INST:
    g2 += f'<div class="rl" style="color:{col}">{n}<i>›</i></div>'
    for i, o in enumerate(on[n]):
        if n == "Bass" and i == 2:
            g2 += f'<div class="cell next" style="--c:{col}"></div>'
        else:
            g2 += f'<div class="cell"{f" style=background:{col}" if o else ""}></div>'
g2 += "</div>"
legend2 = (
    '<div class="legend" style="padding:12px 14px;gap:7px">'
    '<div><i style="background:#2a9d8f"></i>Filled: playing now</div>'
    '<div><i style="outline:2px dashed #2a9d8f;outline-offset:-2px"></i>Dashed: starts on the next bar</div>'
    '<div><i style="outline:2px solid #e9c46a;outline-offset:-2px"></i>Pencil: editing without playing</div></div>'
)
screen("4-advanced-play", "advanced", legend2 + g2, ["", "playing", "next", "edit"], "Play", aligned=True)

screen("5-advanced-layer", "advanced",
       f'<div class="title"><h1><span style="color:{v}">Layer 1</span></h1>'
       f'<div style="margin-left:auto;display:flex;gap:8px;align-items:center"><div class="chip" style="height:30px;padding:0 10px;color:#f2f2f4">↶ Back</div><div class="chip" style="height:30px;padding:0 10px;background:{v};color:#0a0a0c">✦ New</div><div class="tog" style="background:{v};margin-left:0"><i></i></div></div></div>'
       + chips(["Lead", "Arp", "Pad"], "Lead", v, 3)
       + chips(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Phrase", v, 5)
       + '<div style="display:flex;align-items:center;gap:8px"><div class="cap">Page</div><div style="flex:1">' + chips(["Notes", "Feel", "Sound"], "Notes", "#f2f2f4", 3) + "</div></div>"
       + f'<div><div class="steps">{steps}</div><div class="cap" style="margin-top:6px">Phrase · bar 2 of 4</div></div>'
       + d6 + xy(58, 45, "CUTOFF"),
       ["", "playing", "", "edit"], "Layer 1")

print("ok")
