#!/usr/bin/env python3
"""Phase 3 mockups: tablet landscape (Advanced) and tablet portrait (Simple)."""
import gen as g
from gen import C, INST, OUT, chips, dial

v = C["violet"]
TCSS = g.CSS + """
.wrap{padding:16px;gap:12px}
.hdr{height:48px}.newjam{height:48px;font-size:14px;padding:0 16px}.seg{height:48px}.seg span{font-size:12px;padding:0 16px}
.vstep{display:flex;gap:8px;align-items:center}
.vstep .a{width:48px;height:48px;border-radius:12px;background:#131316;display:flex;align-items:center;justify-content:center;font-size:22px}
.vstep .c{height:48px;border-radius:12px;background:#ff6b6b;color:#0a0a0c;padding:0 22px;display:flex;align-items:center;font-size:16px;font-weight:700;white-space:nowrap}
.cols{flex:1;min-height:0;display:flex;gap:14px}
.col{display:flex;flex-direction:column;gap:12px;min-height:0}
.punch{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.pp{height:64px;border-radius:12px;background:#131316;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;font-weight:700;white-space:nowrap}
.pp span{font-size:9px;font-weight:600;letter-spacing:.1em;color:#8d8d99;text-transform:uppercase;margin-top:2px}
.pp.held{background:#f4a261;color:#0a0a0c}.pp.held span{color:#0a0a0c;opacity:.7}
.pads{display:grid;grid-template-columns:104px repeat(4,1fr);gap:8px;flex:1;min-height:0}
.pl{border-radius:12px;background:#131316;display:flex;flex-direction:column;justify-content:center;padding:0 12px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.pl small{font-size:10px;color:#8d8d99;font-weight:400;letter-spacing:0;text-transform:none;margin-top:3px}
.pl .mt{height:4px;border-radius:2px;background:#26262d;margin-top:7px;overflow:hidden}.pl .mt i{display:block;height:4px;border-radius:2px}
.pad{border-radius:14px;background:#131316;position:relative}
.pad.next{outline:2px dashed var(--c);outline-offset:-2px}
.pad.live::after{content:"";position:absolute;inset:8px;border-radius:9px;border:2px solid rgba(10,10,12,.35)}
.srow{display:grid;grid-template-columns:104px repeat(4,1fr);gap:8px}
.srow .sec{height:60px}.srow .sec b{font-size:18px}
.rail{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}
.rail .chip{height:46px;font-size:13px}
.group{background:#0f0f12;border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:8px;flex:1}
.group .cap{padding-left:4px}
.top{height:56px}.play{width:72px;height:56px}.pill{height:56px}.dots{height:56px}.rec{width:56px;height:56px}
.irow{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.ib{height:104px;border-radius:16px;background:#131316;display:flex;flex-direction:column;justify-content:center;padding:0 16px;position:relative;white-space:nowrap}
.ib b{font-size:18px;font-weight:700}.ib small{font-size:12px;color:#8d8d99;margin-top:2px}
.ib .state{position:absolute;right:12px;top:12px;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;letter-spacing:.08em}
.ib.on{color:#0a0a0c}.ib.on small{color:#0a0a0c;opacity:.7}
.ib.next{outline:2px dashed var(--c);outline-offset:-2px}
.secs.t .sec{height:84px;border-radius:14px}.secs.t .sec b{font-size:24px}.secs.t .sec span{font-size:11px}
.tabs{margin:0 -16px;height:68px}.tab{font-size:10.5px}.tab svg{width:26px;height:26px}
"""


def tpage(name, w, h, body):
    css = TCSS + f"html,body{{width:{w}px;height:{h}px}}.wrap{{height:{h}px}}"
    (OUT / f"{name}.html").write_text(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css + '</style></head><body><div class="wrap">' + body + "</div></body></html>"
    )


def hdr(mode):
    s, a = ("on", "") if mode == "simple" else ("", "on")
    return (
        '<div class="hdr"><div class="newjam"><b>+</b>New jam</div>'
        '<div class="vstep"><div class="a">‹</div><div class="c">Deep house</div><div class="a">›</div></div>'
        f'<div class="seg"><span class="{s}">SIMPLE</span><span class="{a}">ADVANCED</span></div></div>'
    )


def transport(mode):
    mid = ('<div class="pill grow txt"><b>Deep house</b><span>vibe</span></div>' if mode == "simple"
           else '<div class="pill grow"><b>A min</b><span>house</span></div>')
    return ('<div class="top"><div class="play"><i></i></div><div class="pill"><b>122</b><span>bpm</span></div>' + mid +
            '<div class="pill"><b>17.3</b><span>bar</span></div>'
            '<div class="dots"><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div><div class="rec"><i></i></div></div>')


PUNCH = [("Drop", "hold"), ("Filter", "hold"), ("Stutter", "hold"), ("Echo", "throw"), ("Wash", "throw"), ("Build", "8 bars")]
punch = '<div class="punch">' + "".join(
    f'<div class="pp{" held" if n == "Filter" else ""}">{n}<span>{s}</span></div>' for n, s in PUNCH) + "</div>"

on = {"Drums": [1, 1, 0, 1], "Bass": [0, 1, 0, 1], "Synth": [0, 1, 1, 0], "Layer 1": [0, 1, 1, 0], "Layer 2": [1, 1, 1, 1]}
sub = {"Drums": "Four on the floor", "Bass": "Offbeat", "Synth": "Warm stab", "Layer 1": "Phrase lead", "Layer 2": "Warm pad"}
lvl = {"Drums": 82, "Bass": 70, "Synth": 55, "Layer 1": 64, "Layer 2": 40}
pads = '<div class="pads">'
for n, col in INST:
    pads += f'<div class="pl" style="color:{col}">{n}<small>{sub[n]}</small><div class="mt"><i style="width:{lvl[n]}%;background:{col}"></i></div></div>'
    for i, o in enumerate(on[n]):
        if n == "Bass" and i == 2:
            pads += f'<div class="pad next" style="--c:{col}"></div>'
        elif o:
            pads += f'<div class="pad{" live" if i == 1 else ""}" style="background:{col}"></div>'
        else:
            pads += '<div class="pad"></div>'
pads += "</div>"
names = ["Intro", "Groove", "Break", "Outro"]
words = {"playing": "Playing", "next": "Next", "edit": "✎ Editing"}
srow = '<div class="srow"><div class="cap" style="display:flex;align-items:center">Sections</div>'
for i, st in enumerate(["", "playing", "next", ""]):
    srow += f'<div class="sec {st}"><b>{"ABCD"[i]}</b><span>{words.get(st, names[i])}</span></div>'
srow += "</div>"

D = 76
notes = '<div class="dials" style="grid-template-columns:repeat(3,1fr)">' + "".join([
    dial("Busy", .6, "60", v, D, 112, 16, 10.5), dial("Lock", .82, "82", C["coral"], D, 112, 16, 10.5), dial("Shape", .42, "Arch", C["yellow"], D, 112, 14, 10.5),
    dial("Range", .5, "1.5", C["orange"], D, 112, 16, 10.5), dial("Register", .66, "High", C["blue"], D, 112, 14, 10.5), dial("Tension", .35, "35", C["teal"], D, 112, 16, 10.5)]) + "</div>"
feel = '<div class="dials" style="grid-template-columns:repeat(3,1fr)">' + "".join([
    dial("Length", .45, "45", v, D, 112, 16, 10.5), dial("Phrase", .75, "4 bar", C["coral"], D, 112, 13, 10.5), dial("Variation", .3, "30", C["yellow"], D, 112, 16, 10.5),
    dial("Repeats", .15, "15", C["orange"], D, 112, 16, 10.5), dial("Slide", .4, "40", C["blue"], D, 112, 16, 10.5), dial("Accent", .55, "55", C["teal"], D, 112, 16, 10.5)]) + "</div>"
sound = '<div class="dials" style="grid-template-columns:repeat(3,1fr)">' + "".join([
    dial("Wave", .3, "Saw", v, 60, 88, 13, 10), dial("Attack", .1, "10", C["coral"], 60, 88, 15, 10), dial("Release", .5, "50", C["yellow"], 60, 88, 15, 10),
    dial("Drive", .25, "25", C["orange"], 60, 88, 15, 10), dial("Delay", .45, "45", C["blue"], 60, 88, 15, 10), dial("Reverb", .7, "70", C["teal"], 60, 88, 15, 10)]) + "</div>"

rail = '<div class="rail">' + "".join(
    f'<div class="chip{" on" if n == "Layer 1" else ""}"{f" style=background:{v}" if n == "Layer 1" else ""}>{n}</div>'
    for n in ["Chords", "Drums", "Bass", "Synth", "Layer 1", "Layer 2", "Mix"]) + "</div>"

xy_big = ('<div class="xy" style="flex:1.25"><div class="hx" style="top:42%"></div><div class="hy" style="left:60%"></div>'
          '<div class="dot" style="left:60%;top:42%;width:52px;height:52px;margin:-26px 0 0 -26px"></div>'
          '<div class="l" style="top:10px">RESONANCE ↑</div><div class="l" style="bottom:9px">CUTOFF →</div></div>')

# 7. Tablet landscape, Advanced: pads and one instrument, both always on screen
left = f'<div class="col" style="width:540px;flex:none">{punch}{pads}{srow}{transport("advanced")}</div>'
right = (
    '<div class="col" style="flex:1">' + rail
    + f'<div style="display:flex;gap:10px;align-items:center"><h1 style="font-size:22px;color:{v};white-space:nowrap">Layer 1</h1>'
      f'<div style="width:230px">{chips(["Lead", "Arp", "Pad"], "Lead", v, 3)}</div>'
      f'<div style="flex:1">{chips(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Phrase", v, 5)}</div></div>'
    + f'<div style="display:flex;gap:10px;align-items:center"><div style="flex:1"><div class="steps">{g.steps}</div></div>'
      f'<div class="chip" style="height:34px;padding:0 12px;color:#f2f2f4">↶ Back</div><div class="chip" style="height:34px;padding:0 12px;background:{v};color:#0a0a0c">✦ New idea</div></div>'
    + f'<div style="display:flex;gap:10px"><div class="group"><div class="cap">Notes</div>{notes}</div><div class="group"><div class="cap">Feel</div>{feel}</div></div>'
    + f'<div style="display:flex;gap:10px;flex:1;min-height:0">{xy_big}<div class="group" style="flex:1"><div class="cap">Sound</div>{sound}</div></div>'
    + "</div>"
)
tpage("7-tablet-landscape", 1280, 800, hdr("advanced") + f'<div class="cols">{left}{right}</div>')

# 8. Tablet portrait, Simple: instrument on top, the Now view docked at the bottom
D2 = 120
macros = '<div class="dials" style="grid-template-columns:repeat(4,1fr);gap:10px">' + "".join([
    dial("Busy", .6, "60", v, D2, 170, 24, 13), dial("Evolve", .25, "25", C["yellow"], D2, 170, 24, 13),
    dial("Bright", .7, "70", C["orange"], D2, 170, 24, 13), dial("Space", .45, "45", C["teal"], D2, 170, 24, 13)]) + "</div>"
irow = '<div class="irow">'
for (n, col), st in zip(INST, ["on", "on", "on", "next", "off"]):
    if st == "on":
        irow += f'<div class="ib on" style="background:{col}"><b>{n}</b><small>{sub[n]}</small><div class="state">ON</div></div>'
    elif st == "next":
        irow += f'<div class="ib next" style="--c:{col}"><b>{n}</b><small>{sub[n]}</small><div class="state" style="color:{col}">NEXT</div></div>'
    else:
        irow += f'<div class="ib"><b class="dim">{n}</b><small>{sub[n]}</small><div class="state dim">OFF</div></div>'
irow += "</div>"
body = (
    hdr("simple")
    + f'<div style="display:flex;gap:12px;align-items:center"><h1 style="font-size:26px;color:{v};white-space:nowrap">Layer 1</h1>'
      f'<div style="width:260px">{chips(["Lead", "Arp", "Pad"], "Lead", v, 3)}</div>'
      f'<div style="flex:1">{chips(["Hook", "Phrase", "Roll", "Drift", "Pulse"], "Hook", v, 5)}</div></div>'
    + macros
    + f'<div class="btns"><div class="btn" style="height:60px">↶ Back</div><div class="btn" style="height:60px;background:{v};color:#0a0a0c">✦ New idea</div></div>'
    + ('<div class="xy" style="flex:1"><div class="hx" style="top:44%"></div><div class="hy" style="left:62%"></div>'
       '<div class="dot" style="left:62%;top:44%;width:60px;height:60px;margin:-30px 0 0 -30px"></div>'
       '<div class="l" style="top:12px;font-size:12px">RESONANCE ↑</div><div class="l" style="bottom:11px;font-size:12px">BRIGHT →</div></div>')
    + punch + '<div class="cap">Playing now</div>' + irow
    + g.strip(["", "playing", "next", ""]).replace('class="secs"', 'class="secs t"')
    + transport("simple")
    + '<div class="tabs">' + "".join(
        f'<div class="tab{" on" if n == "Layer 1" else ""}"><svg viewBox="0 0 24 24">{p}</svg>{n}</div>' for n, p in g.ICONS) + "</div>"
)
tpage("8-tablet-portrait", 800, 1280, body)
print("tablet ok")
