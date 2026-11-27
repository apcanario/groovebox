#!/usr/bin/env python3
"""G6: the app works offline. Scans a built dist/ and fails if anything there would reach the network.

- No font or CDN host anywhere in the build (Google Fonts, gstatic, jsDelivr, unpkg, cdnjs, Typekit, esm.sh,
  Skypack, Bunny Fonts).
- index.html loads nothing by an absolute URL (src=, href=), and every stylesheet's url() and @import is local.
- Every @font-face src is a local file that exists in the build, so DM Sans ships with the app.
- No script fetches, imports, or starts a worker from an http(s) URL.

License texts and XML namespaces (http://www.w3.org/2000/svg) are plain strings and are allowed.
Usage: python3 tools/offline_check.py dist
"""
import os
import re
import sys

CDN_HOSTS = [
    "fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "unpkg.com", "cdnjs.cloudflare.com",
    "use.typekit.net", "esm.sh", "cdn.skypack.dev", "fonts.bunny.net", "ajax.googleapis.com",
]
ABS = r"(?:https?:)?//"
HTML_ATTR = re.compile(r"""\b(?:src|href)\s*=\s*["']?\s*(""" + ABS + r"""[^"'\s>]+)""", re.I)
CSS_URL = re.compile(r"""url\(\s*["']?\s*(""" + ABS + r"""[^"')\s]+)""", re.I)
CSS_IMPORT = re.compile(r"""@import\s+(?:url\()?\s*["']?\s*(""" + ABS + r"""[^"')\s;]+)""", re.I)
JS_NET = re.compile(
    r"""\b(fetch|import|importScripts|Worker|SharedWorker|EventSource|WebSocket|sendBeacon|open)\s*\(\s*[`"'](""" + ABS
    + r"""[^`"']+)""")
FONT_FACE = re.compile(r"@font-face\s*\{([^}]*)\}", re.I)
FACE_URL = re.compile(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", re.I)


def problems(root: str) -> list:
    out = []
    files = []
    for d, dirs, names in os.walk(root):
        dirs.sort()
        for n in sorted(names):
            files.append(os.path.join(d, n))
    if not any(f.endswith("index.html") for f in files):
        out.append(f"{root}: no index.html (build first)")
    faces = 0
    for path in files:
        rel = os.path.relpath(path, root)
        if not path.endswith((".html", ".css", ".js", ".mjs", ".json", ".webmanifest", ".txt", ".svg")):
            continue
        with open(path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
        low = text.lower()
        for host in CDN_HOSTS:
            if host in low:
                out.append(f"{rel}: names the network host {host}")
        if path.endswith(".html"):
            out += [f"{rel}: loads {m} from the network" for m in HTML_ATTR.findall(text)]
        if path.endswith((".css", ".html")):
            out += [f"{rel}: url() from the network: {m}" for m in CSS_URL.findall(text)]
            out += [f"{rel}: @import from the network: {m}" for m in CSS_IMPORT.findall(text)]
            for body in FONT_FACE.findall(text):
                faces += 1
                for u in FACE_URL.findall(body):
                    u = u.strip()
                    if re.match(ABS, u) or u.startswith("data:"):
                        if not u.startswith("data:"):
                            out.append(f"{rel}: @font-face from the network: {u}")
                        continue
                    target = os.path.normpath(os.path.join(os.path.dirname(path), u.split("?")[0].split("#")[0]))
                    if not os.path.isfile(target):
                        out.append(f"{rel}: @font-face file missing from the build: {u}")
        if path.endswith((".js", ".mjs", ".html")):
            out += [f"{rel}: {fn}() from the network: {u}" for fn, u in JS_NET.findall(text)]
    if faces == 0 and not out:
        out.append(f"{root}: no @font-face in the build (DM Sans must ship with the app)")
    return out


def main(argv: list) -> int:
    root = argv[1] if len(argv) > 1 else "dist"
    found = problems(root)
    for p in found:
        print("offline check:", p)
    if found:
        return 1
    print(f"offline check: {root} loads nothing from the network, fonts bundled")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
