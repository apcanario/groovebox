#!/usr/bin/env python3
"""G6: draws the Groovebox app icon and writes it as Android adaptive icon resources, every density.

Original artwork in the app's look (spec 8.12, docs/design/look/): the Simple Play tab's idea, "the music is
visible", shrunk to four lanes on a dark faceplate. Coral drum hits, teal offbeat bass, blue chord stabs and a
yellow pad, each on a dark lane tile with 3 px-style corners and 2 px-style gaps, and the white playhead through
them. Background #0a0a0c. Fixed note list, nothing random.

Writes into android/app/src/main/res/:
  mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher_foreground.png   108 dp adaptive foreground (art inside the 66 dp safe circle)
  mipmap-{...}/ic_launcher_monochrome.png                  108 dp themed-icon mask (Android 13)
  mipmap-{...}/ic_launcher.png, ic_launcher_round.png      48 dp legacy icons (API 24-25)
  mipmap-anydpi-v26/ic_launcher.xml, ic_launcher_round.xml  the adaptive icon: background colour + foreground
  values/ic_launcher_background.xml                         the background colour
Run: python3 tools/make_icon.py [res_dir]   (needs Pillow)
"""
import os
import sys

BG = "#0a0a0c"
LANE = "#18181d"
BEAT_LINE = "#26262d"
PLAYHEAD = "#f2f2f4"
CORAL, TEAL, BLUE, YELLOW = "#ff6b6b", "#2a9d8f", "#457b9d", "#e9c46a"

DENSITIES = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
ADAPTIVE_DP = 108  # full adaptive layer
SAFE_DP = 66  # the circle every launcher mask keeps
LEGACY_DP = 48
ART_DP = 46  # the square the lanes fill, centred; its half-diagonal (32.5 dp) stays inside the 33 dp safe radius
GAP_DP = 2.0
RADIUS_DP = 0.5
STEPS = 16
PLAYHEAD_STEP = 11.5  # between notes, so the line hides none

# One bar per lane: (colour, [(first step, length in steps, height 0..1 from the lane's bottom, rise)]).
LANES = [
    (CORAL, [(0, 1, 1.0, 0), (4, 1, 1.0, 0), (8, 1, 1.0, 0), (12, 1, 1.0, 0)]),  # four on the floor
    (TEAL, [(2, 2, 0.5, 0), (6, 2, 0.5, 0), (10, 1.25, 0.5, 0.5), (14, 2, 0.5, 0)]),  # offbeat bass
    (BLUE, [(1, 1, 0.8, 0.1), (5, 1, 0.8, 0.1), (9, 1, 0.8, 0.1), (13, 1, 0.8, 0.1)]),  # chord stabs
    (YELLOW, [(0, 7, 0.35, 0.35), (8, 8, 0.35, 0.35)]),  # long pad
]


def layout(size: float) -> dict:
    """Every shape of the adaptive foreground for a layer `size` px square, as rectangles (x0, y0, x1, y1)."""
    unit = size / ADAPTIVE_DP
    art = ART_DP * unit
    gap = GAP_DP * unit
    x0 = y0 = (size - art) / 2
    lane_h = (art - gap * (len(LANES) - 1)) / len(LANES)
    step_w = art / STEPS
    inset = 0.18 * lane_h
    lanes, notes, beats = [], [], []
    for i, (colour, hits) in enumerate(LANES):
        ly0 = y0 + i * (lane_h + gap)
        ly1 = ly0 + lane_h
        lanes.append((x0, ly0, x0 + art, ly1))
        for b in range(1, 4):
            bx = x0 + b * 4 * step_w
            beats.append((bx - unit * 0.25, ly0, bx + unit * 0.25, ly1))
        inner = lane_h - 2 * inset
        for step, length, height, rise in hits:
            nx0 = x0 + step * step_w + step_w * 0.18
            nx1 = x0 + (step + length) * step_w - step_w * 0.18
            ny1 = ly1 - inset - rise * inner
            ny0 = ny1 - height * inner
            notes.append((colour, (nx0, max(ny0, ly0 + inset), nx1, ny1)))
    px = x0 + PLAYHEAD_STEP * step_w
    playhead = (px - unit * 0.7, y0 - gap, px + unit * 0.7, y0 + art + gap)
    return {"unit": unit, "art": (x0, y0, x0 + art, y0 + art), "lanes": lanes, "beats": beats, "notes": notes,
            "playhead": playhead, "radius": RADIUS_DP * unit}


def _draw(size: int, mono: bool = False, with_bg: bool = False, round_mask: bool = False, scale: float = 1.0):
    from PIL import Image, ImageDraw
    ss = 4  # supersample, then downscale for smooth edges
    big = size * ss
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if with_bg:
        if round_mask:
            d.ellipse((0, 0, big - 1, big - 1), fill=BG)
        else:
            r = big * 0.12
            d.rounded_rectangle((0, 0, big - 1, big - 1), radius=r, fill=BG)
    layer = big * scale
    off = (big - layer) / 2
    g = layout(layer)
    rad = g["radius"]

    def sh(r):
        return tuple(v + off for v in r)

    white = "#ffffff"
    if mono:
        for colour, r in g["notes"]:
            d.rounded_rectangle(sh(r), radius=rad, fill=white)
        d.rectangle(sh(g["playhead"]), fill=white)
    else:
        for r in g["lanes"]:
            d.rounded_rectangle(sh(r), radius=rad, fill=LANE)
        for r in g["beats"]:
            d.rectangle(sh(r), fill=BEAT_LINE)
        for colour, r in g["notes"]:
            d.rounded_rectangle(sh(r), radius=rad, fill=colour)
        d.rectangle(sh(g["playhead"]), fill=PLAYHEAD)
    return img.resize((size, size), Image.LANCZOS)


def write(res: str) -> list:
    written = []

    def save(img, rel):
        path = os.path.join(res, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        img.save(path, optimize=True)
        written.append(rel)

    for name, k in DENSITIES.items():
        fg = round(ADAPTIVE_DP * k)
        save(_draw(fg), f"mipmap-{name}/ic_launcher_foreground.png")
        save(_draw(fg, mono=True), f"mipmap-{name}/ic_launcher_monochrome.png")
        legacy = round(LEGACY_DP * k)
        # A legacy icon shows the adaptive layer's middle 72 dp; scale the 108 dp layer to match.
        save(_draw(legacy, with_bg=True, scale=ADAPTIVE_DP / 72), f"mipmap-{name}/ic_launcher.png")
        save(_draw(legacy, with_bg=True, round_mask=True, scale=ADAPTIVE_DP / 72), f"mipmap-{name}/ic_launcher_round.png")
    adaptive = ('<?xml version="1.0" encoding="utf-8"?>\n'
                '<!-- Written by tools/make_icon.py (G6). -->\n'
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
                '    <background android:drawable="@color/ic_launcher_background"/>\n'
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
                '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n'
                '</adaptive-icon>\n')
    for n in ("ic_launcher", "ic_launcher_round"):
        p = os.path.join(res, "mipmap-anydpi-v26", f"{n}.xml")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w") as fh:
            fh.write(adaptive)
        written.append(f"mipmap-anydpi-v26/{n}.xml")
    p = os.path.join(res, "values", "ic_launcher_background.xml")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as fh:
        fh.write('<?xml version="1.0" encoding="utf-8"?>\n<!-- Written by tools/make_icon.py (G6). -->\n'
                 f'<resources>\n    <color name="ic_launcher_background">{BG.upper()}</color>\n</resources>\n')
    written.append("values/ic_launcher_background.xml")
    return written


if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    res = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, "..", "android", "app", "src", "main", "res")
    for rel in write(res):
        print("icon:", rel)
