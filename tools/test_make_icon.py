#!/usr/bin/env python3
"""Unit tests for tools/make_icon.py (G6). Run: python3 tools/test_make_icon.py"""
import math
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_icon as mi  # noqa: E402


class Layout(unittest.TestCase):
    def test_art_inside_the_safe_circle(self):
        size = 432.0
        g = mi.layout(size)
        c, r = size / 2, mi.SAFE_DP / 2 * size / mi.ADAPTIVE_DP
        shapes = g["lanes"] + [n for _c, n in g["notes"]] + [g["playhead"]]
        for x0, y0, x1, y1 in shapes:
            for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
                self.assertLessEqual(math.hypot(x - c, y - c), r + 1e-6)

    def test_notes_sit_inside_their_lane(self):
        g = mi.layout(108.0)
        for colour, (x0, y0, x1, y1) in g["notes"]:
            lane = g["lanes"][[c for c, _h in mi.LANES].index(colour)]
            self.assertTrue(lane[0] <= x0 < x1 <= lane[2] and lane[1] <= y0 < y1 <= lane[3], colour)

    def test_lanes_two_dp_apart_and_colours_from_the_look(self):
        g = mi.layout(108.0)
        for a, b in zip(g["lanes"], g["lanes"][1:]):
            self.assertAlmostEqual(b[1] - a[3], mi.GAP_DP)
        self.assertEqual(mi.BG, "#0a0a0c")
        self.assertEqual(mi.LANES[0][0], "#ff6b6b")

    def test_playhead_hides_no_note(self):
        g = mi.layout(432.0)
        px0, _y0, px1, _y1 = g["playhead"]
        for colour, (x0, _a, x1, _b) in g["notes"]:
            if colour != mi.YELLOW:  # the pad is held under the playhead, as on the Play tab
                self.assertTrue(x1 <= px0 or x0 >= px1, colour)

    def test_same_every_run(self):
        self.assertEqual(mi.layout(324.0), mi.layout(324.0))


class Write(unittest.TestCase):
    def test_every_density_and_the_adaptive_xml(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow not installed")
        res = tempfile.mkdtemp()
        written = mi.write(res)
        for name, k in mi.DENSITIES.items():
            for f, dp in (("ic_launcher_foreground", 108), ("ic_launcher_monochrome", 108),
                          ("ic_launcher", 48), ("ic_launcher_round", 48)):
                rel = f"mipmap-{name}/{f}.png"
                self.assertIn(rel, written)
                with Image.open(os.path.join(res, rel)) as im:
                    self.assertEqual(im.size, (round(dp * k),) * 2)
        with open(os.path.join(res, "mipmap-anydpi-v26", "ic_launcher.xml")) as fh:
            xml = fh.read()
        self.assertIn("@color/ic_launcher_background", xml)
        self.assertIn("@mipmap/ic_launcher_foreground", xml)
        with open(os.path.join(res, "values", "ic_launcher_background.xml")) as fh:
            self.assertIn("#0A0A0C", fh.read())


if __name__ == "__main__":
    unittest.main()
