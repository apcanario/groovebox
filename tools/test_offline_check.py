#!/usr/bin/env python3
"""Unit tests for tools/offline_check.py (G6). Run: python3 tools/test_offline_check.py"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from offline_check import problems  # noqa: E402

GOOD_CSS = '@font-face{font-family:"DM Sans";src:url(./dm.woff2) format("woff2")}body{font-family:"DM Sans"}'
GOOD_HTML = ('<!DOCTYPE html><html><head><link rel="stylesheet" href="./assets/i.css">'
             '<script type="module" src="./assets/i.js"></script></head></html>')
GOOD_JS = ('const ns="http://www.w3.org/2000/svg";/* https://github.com/Tonejs/Tone.js */'
           'new Worker(new URL("./w.js",import.meta.url));fetch("./local.json")')


def build(files: dict) -> str:
    root = tempfile.mkdtemp()
    for rel, text in files.items():
        p = os.path.join(root, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "w" if isinstance(text, str) else "wb") as fh:
            fh.write(text)
    return root


def good(**over) -> dict:
    files = {"index.html": GOOD_HTML, "assets/i.css": GOOD_CSS, "assets/dm.woff2": b"wOF2", "assets/i.js": GOOD_JS}
    files.update(over)
    return files


class OfflineCheck(unittest.TestCase):
    def test_clean_build_passes(self):
        self.assertEqual(problems(build(good())), [])

    def test_google_fonts_link_fails(self):
        html = GOOD_HTML.replace("</head>", '<link href="https://fonts.googleapis.com/css2?family=DM+Sans"></head>')
        found = problems(build(good(**{"index.html": html})))
        self.assertTrue(any("fonts.googleapis.com" in p for p in found))
        self.assertTrue(any("loads https://fonts" in p for p in found))

    def test_network_font_face_fails(self):
        css = GOOD_CSS.replace("./dm.woff2", "https://example.com/dm.woff2")
        self.assertTrue(any("from the network" in p for p in problems(build(good(**{"assets/i.css": css})))))

    def test_protocol_relative_and_import_fail(self):
        css = '@import url(//cdn.example.com/x.css);' + GOOD_CSS
        found = problems(build(good(**{"assets/i.css": css})))
        self.assertTrue(any("@import" in p for p in found))

    def test_missing_font_file_fails(self):
        files = good()
        del files["assets/dm.woff2"]
        self.assertTrue(any("missing" in p for p in problems(build(files))))

    def test_no_font_face_fails(self):
        self.assertTrue(problems(build(good(**{"assets/i.css": "body{color:red}"}))))

    def test_cdn_script_and_runtime_fetch_fail(self):
        html = GOOD_HTML.replace("./assets/i.js", "https://unpkg.com/tone")
        self.assertTrue(problems(build(good(**{"index.html": html}))))
        js = GOOD_JS + ';fetch("https://api.example.com/x")'
        self.assertTrue(any("fetch()" in p for p in problems(build(good(**{"assets/i.js": js})))))
        js = GOOD_JS + ';import(`https://esm.example/x.js`)'
        self.assertTrue(any("import()" in p for p in problems(build(good(**{"assets/i.js": js})))))

    def test_no_build_fails(self):
        self.assertTrue(problems(tempfile.mkdtemp()))


if __name__ == "__main__":
    unittest.main()
