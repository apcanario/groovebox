#!/usr/bin/env python3
"""The smoke's parts cover every check.

`uncovered()` (run by tools/smoke.py before any part) lists every function of tools/smoke.py, tools/dropcheck.py,
tools/morphcheck.py and tools/kickcheck.py that records a failure (`failures.append`) but is reached from no part of PARTS: a check that would never run.

    python3 tools/smoke_parts.py              exits 1 if a check sits in no part
    python3 tools/smoke_parts.py --files NAME   lists what part NAME's ledger fingerprint hashes
"""
import ast
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# basscheck.py's smoke check (walk_bass_run, in drop-5) is reached through smoke.py; the file is not listed, since its
# hand-run commands (levels, probe) record failures on purpose outside any part.
# kickcheck.py (F2): its checks run in the kick part and drop-1, so a check added there and left out of a part fails.
FILES = ["smoke.py", "dropcheck.py", "morphcheck.py", "kickcheck.py"]


def _defs(tree) -> dict:
    """Every function (nested ones too) by name, with the names it calls or refers to."""
    out = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            refs = set()
            for sub in ast.walk(node):
                if isinstance(sub, ast.Name):
                    refs.add(sub.id)
                elif isinstance(sub, ast.Attribute):
                    refs.add(sub.attr)
            checks = any(
                isinstance(sub, ast.Call)
                and isinstance(sub.func, ast.Attribute)
                and sub.func.attr == "append"
                and isinstance(sub.func.value, ast.Name)
                and sub.func.value.id == "failures"
                for sub in ast.walk(node)
            )
            out.setdefault(node.name, {"refs": set(), "checks": False, "file": None})
            out[node.name]["refs"] |= refs - {node.name}
            out[node.name]["checks"] |= checks
            out[node.name]["file"] = out[node.name]["file"] or node
    return out


def _parts(tree) -> list:
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "PARTS" for t in node.targets):
            return [tuple(e.id if isinstance(e, ast.Name) else e.value for e in elt.elts) for elt in node.value.elts]
    raise SystemExit("tools/smoke.py has no PARTS")


def uncovered() -> list:
    trees = {}
    for f in FILES:
        with open(os.path.join(HERE, f)) as fh:
            trees[f] = ast.parse(fh.read())
    defs = {}
    for f, t in trees.items():
        for name, d in _defs(t).items():
            d["where"] = f
            defs.setdefault(name, d)
            defs[name]["refs"] |= d["refs"]
            defs[name]["checks"] |= d["checks"]
    parts = _parts(trees["smoke.py"])
    roots = ["open_app"]
    for _name, fn, setup in parts:
        roots += [fn] + ([setup] if setup else [])
    # run_part's own checks (page errors, the oscillator patch) run in every part.
    seen, todo = set(), roots + ["run_part"]
    while todo:
        n = todo.pop()
        if n in seen or n not in defs:
            continue
        seen.add(n)
        todo += list(defs[n]["refs"])
    missing = [f"{d['where']}:{n}" for n, d in sorted(defs.items()) if d["checks"] and n not in seen]
    in_parts = {fn for _n, fn, _s in parts}
    missing += [f"smoke.py:{n} (a part_ function not in PARTS)" for n in sorted(defs) if n.startswith("part_") and n not in in_parts]
    # Every group of the drop's vibes has its part, so no vibe is left unmeasured.
    groups = next(
        (n.value.value for n in trees["dropcheck.py"].body if isinstance(n, ast.Assign)
         and any(isinstance(t, ast.Name) and t.id == "DROP_GROUPS" for t in n.targets)), None)
    drops = [n for n, _f, _s in parts if n.startswith("drop-")]
    if drops != [f"drop-{i}" for i in range(1, (groups or 0) + 1)]:
        missing.append(f"dropcheck.py:DROP_GROUPS is {groups} but the drop parts are {', '.join(drops) or 'none'}")
    return missing


# Per-part fingerprints. A part's entry in .smoke-ledger.json is keyed to a hash of the files that part exercises, so
# a change elsewhere leaves it green. Conservative: anything that could change what a part sees is in it.
#  - SHARED, in every part: the build's inputs (package.json, package-lock.json, index.html, vite.config.ts,
#    tsconfig.json, public/) and every file under src/ outside src/ui/ (engine, music, data, styles, store, assets,
#    main.tsx and style.css), since every part plays the engine and every vibe's data can reach any of them. Unit
#    tests (*.test.ts) are left out: they are not in the build and `npm run check` runs them.
#  - src/ui/: every part has App.tsx and what it imports outside src/ui/tabs/ (the shell, the picker, the sheets,
#    components, logic). A tab's file is in a part when the part's check code opens that tab: a literal
#    `data-tab="name"` in it, or every tab for a computed one (`data-tab="{...}"`) or the TABS list, or every instrument
#    and layer tab for a Play tab tile or row head (`data-now`, `data-row`, which open a tab by goTab). A tab brings
#    what it imports, tabs included. The Play tab is in every part (the app opens on it).
#  - Fail closed: a src/ui/ file reached neither from App.tsx outside src/ui/tabs/ nor from any TAB_FILES entry (a new
#    tab not yet listed, or a file nothing imports by a static line) is in every part, with what it imports.
#  - tools/: tools/smoke_parts.py whole; of tools/smoke.py and the files it imports (dropcheck, morphcheck, shots,
#    mp3check), every top-level statement that is not a function (imports, constants, PARTS) and every function the
#    part reaches from run_part, main, open_app, its setup and its own function, by name; nothing else of tools/.
# core opens every tab, so it has every src/ui/ file: a change that breaks the app for all parts still reruns core.
SHARED_FILES = ["package.json", "package-lock.json", "index.html", "vite.config.ts", "tsconfig.json"]
SHARED_DIRS = ["public", "src"]  # src/ui/ is split by part, below
TAB_FILES = {
    "play": ["PlayTab.tsx"],
    "chords": ["ChordsTab.tsx"],
    "mix": ["MixTab.tsx"],
    "drums": ["InstrumentTab.tsx", "SimpleTab.tsx"],
    "bass": ["InstrumentTab.tsx", "SimpleTab.tsx"],
    "synth": ["InstrumentTab.tsx", "SimpleTab.tsx"],
    "layer1": ["LayerTab.tsx", "SimpleTab.tsx"],
    "layer2": ["LayerTab.tsx", "SimpleTab.tsx"],
}
ROOTS = ["run_part", "main", "open_app"]
PLAY_OPENS = ["drums", "bass", "synth", "layer1", "layer2"]  # the tabs a Play tab tile or row head opens


def _base(base: str | None) -> str:
    return base or os.path.dirname(HERE)


def _files(base: str, top: str) -> list:
    path = os.path.join(base, top)
    if os.path.isfile(path):
        return [top]
    out = []
    for d, dirs, names in os.walk(path):
        dirs[:] = sorted(x for x in dirs if x not in ("__pycache__", "node_modules"))
        out += [os.path.relpath(os.path.join(d, n), base) for n in names if not n.endswith(".pyc")]
    return sorted(out)


def _ui_imports(base: str, rel: str) -> list:
    """The src/ui/ files a src/ui/ file imports for their values (`import type` lines are skipped)."""
    import re

    with open(os.path.join(base, rel)) as fh:
        text = fh.read()
    out = []
    for m in re.finditer(r'^import\s+(type\s+)?[^;]*?from\s+"(\.[^"]+)"', text, re.M):
        if m.group(1):
            continue
        target = os.path.normpath(os.path.join(os.path.dirname(rel), m.group(2)))
        if target.startswith(os.path.join("src", "ui")) and os.path.isfile(os.path.join(base, target)):
            out.append(target)
    return out


def _ui_closure(base: str, start: list, into_tabs: bool) -> set:
    seen, todo = set(), list(start)
    tabs = os.path.join("src", "ui", "tabs") + os.sep
    while todo:
        f = todo.pop()
        if f in seen:
            continue
        seen.add(f)
        todo += [x for x in _ui_imports(base, f) if into_tabs or not x.startswith(tabs)]
    return seen


def _unplaced(base: str) -> set:
    """The src/ui/ files (not unit tests) that neither App.tsx outside src/ui/tabs/ nor any TAB_FILES entry reaches,
    with what they import: no part's tab list can place them, so every part has them."""
    import re

    ui = os.path.join("src", "ui")
    placed = _ui_closure(base, [os.path.join(ui, "App.tsx")], into_tabs=False)
    placed |= _ui_closure(base, [os.path.join(ui, "tabs", t) for ts in TAB_FILES.values() for t in ts
                                 if os.path.isfile(os.path.join(base, ui, "tabs", t))], into_tabs=True)
    loose = [f for f in _files(base, ui) if not re.search(r"\.test\.tsx?$", f) and f not in placed]
    return _ui_closure(base, loose, into_tabs=True) if loose else set()


def _tool_defs(base: str) -> dict:
    """tools/smoke.py and the tools files it imports: per file, its top-level functions (name -> node), the source of
    its other top-level statements, and the names it imports from which file."""
    out, todo = {}, ["smoke.py"]
    while todo:
        f = todo.pop()
        if f in out or not os.path.isfile(os.path.join(base, "tools", f)):
            continue
        with open(os.path.join(base, "tools", f)) as fh:
            src = fh.read()
        tree = ast.parse(src)
        lines = src.splitlines()
        fns, rest, names, mods, consts, text, refs, attrs, used, cnames = {}, [], {}, set(), {}, {}, {}, {}, {}, {}
        for node in tree.body:
            seg = "\n".join(lines[node.lineno - 1:node.end_lineno])
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                fns[node.name] = node
                text[node.name] = seg
                subs = list(ast.walk(node))
                used[node.name] = {x.id for x in subs if isinstance(x, ast.Name)}
                attrs[node.name] = {x.attr for x in subs if isinstance(x, ast.Attribute)}
                refs[node.name] = used[node.name] | attrs[node.name]
            else:
                rest.append(seg)
                for t in getattr(node, "targets", None) or [getattr(node, "target", None)]:
                    if isinstance(t, ast.Name):
                        consts[t.id] = rest[-1]
                        cnames[t.id] = {x.id for x in ast.walk(node) if isinstance(x, ast.Name)} - {t.id}
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module and os.path.isfile(os.path.join(base, "tools", node.module + ".py")):
                for a in node.names:
                    names[a.asname or a.name] = node.module + ".py"
                todo.append(node.module + ".py")
            elif isinstance(node, ast.Import):
                for a in node.names:
                    if os.path.isfile(os.path.join(base, "tools", a.name + ".py")):
                        mods.add(a.name + ".py")
                        todo.append(a.name + ".py")
        out[f] = {"src": src, "fns": fns, "rest": rest, "names": names, "mods": mods, "consts": consts,
                  "text": text, "refs": refs, "attrs": attrs, "used": used, "cnames": cnames, "tree": tree}
    return out


def _reach(tools: dict, roots: list) -> set:
    """(file, function) pairs reached from smoke.py's roots by name: a name resolves in its own file, then to the
    file it was imported from; an attribute also to any tools module the file imports. A module constant a reached
    function uses brings the functions it names (PARTS excepted: each part reaches only its own)."""
    seen, todo = set(), [("smoke.py", r) for r in roots]

    def resolve(f: str, x: str, attr: bool, consts_seen: set) -> None:
        t = tools[f]
        if x in t["fns"]:
            todo.append((f, x))
        if x in t["names"] and t["names"][x] in tools:
            todo.append((t["names"][x], x))
            resolve_const(t["names"][x], x, consts_seen)
        if attr:
            todo.extend((m, x) for m in t["mods"] if m in tools)
            for m in t["mods"]:
                if m in tools:
                    resolve_const(m, x, consts_seen)
        resolve_const(f, x, consts_seen)

    def resolve_const(f: str, x: str, consts_seen: set) -> None:
        if x == "PARTS" or x not in tools[f]["consts"] or (f, x) in consts_seen:
            return
        consts_seen.add((f, x))
        for y in tools[f]["cnames"][x]:
            resolve(f, y, False, consts_seen)

    consts_seen = set()
    while todo:
        f, n = todo.pop()
        if (f, n) in seen or n not in tools[f]["fns"]:
            continue
        seen.add((f, n))
        t = tools[f]
        for x in t["refs"][n]:
            resolve(f, x, x in t["attrs"][n], consts_seen)
    return seen


def part_inputs(name: str, base: str | None = None, tools: dict | None = None) -> dict:
    """What part NAME's fingerprint hashes: {"files": [paths], "tools": {"file:function" or "file:<module>": source}}."""
    import re

    base = _base(base)
    tools = tools or _tool_defs(base)
    parts = {n: (fn, setup) for n, fn, setup in _parts(tools["smoke.py"]["tree"])}
    if name not in parts:
        raise SystemExit(f"no part {name} in PARTS")
    fn, setup = parts[name]
    reached = _reach(tools, ROOTS + [fn] + ([setup] if setup else []))
    code = {f"{f}:{n}": tools[f]["text"][n] for f, n in sorted(reached)}
    for f in sorted(tools):
        code[f"{f}:<module>"] = "\n".join(tools[f]["rest"])
    # The tabs the part opens: selectors in the functions it reaches and in the module constants they name.
    used = {x for f, n in reached for x in tools[f]["used"][n]}
    text = "\n".join([v for k, v in code.items() if not k.endswith("<module>")]
                     + [c for f in tools for k, c in tools[f]["consts"].items() if k in used])
    tabs = {"play"} | set(re.findall(r'data-tab="(\w+)"', text))
    if re.search(r'data-tab="\{', text) or "TABS" in used:
        tabs |= set(TAB_FILES)
    if re.search(r"data-(now|row)\b", text):
        tabs |= set(PLAY_OPENS)
    ui = os.path.join("src", "ui")
    start = [os.path.join(ui, "App.tsx")]
    shown = _ui_closure(base, start, into_tabs=False)
    shown |= _ui_closure(base, [os.path.join(ui, "tabs", t) for tab in sorted(tabs) for t in TAB_FILES.get(tab, [])], into_tabs=True)
    shown |= _unplaced(base)
    files = []
    for top in SHARED_FILES + SHARED_DIRS:
        for f in _files(base, top):
            if re.search(r"\.test\.tsx?$", f):
                continue
            if f.startswith(ui + os.sep) and f not in shown:
                continue
            files.append(f)
    files.append(os.path.join("tools", "smoke_parts.py"))
    return {"files": files, "tools": code}


def fingerprints(base: str | None = None) -> dict:
    """Every part's fingerprint by name: a hash of the paths and contents of its files and of its check code."""
    import hashlib

    base = _base(base)
    tools = _tool_defs(base)
    digests, out = {}, {}

    def digest(f: str) -> bytes:
        if f not in digests:
            with open(os.path.join(base, f), "rb") as fh:
                digests[f] = hashlib.sha256(fh.read()).digest()
        return digests[f]

    for name, _fn, _setup in _parts(tools["smoke.py"]["tree"]):
        got = part_inputs(name, base, tools)
        h = hashlib.sha256()
        for f in got["files"]:
            h.update(f.encode() + b"\0" + digest(f))
        for k, v in got["tools"].items():
            h.update(k.encode() + b"\0" + hashlib.sha256(v.encode()).digest())
        out[name] = h.hexdigest()
    return out


def part_names(base: str | None = None) -> list:
    with open(os.path.join(_base(base), "tools", "smoke.py")) as fh:
        tree = ast.parse(fh.read())
    return [n for n, _f, _s in _parts(tree)]


def valid_green(ledger: dict, fps: dict) -> dict:
    """The ledger's entries still valid: a part recorded green on the fingerprint it has now."""
    green = ledger.get("green", {}) if isinstance(ledger, dict) else {}
    return {n: e for n, e in green.items() if isinstance(e, dict) and n in fps and e.get("fingerprint") == fps[n]}


if __name__ == "__main__":
    if "--files" in sys.argv:
        got = part_inputs(sys.argv[sys.argv.index("--files") + 1])
        print("\n".join(got["files"] + list(got["tools"])))
        sys.exit(0)
    bad = uncovered()
    for b in bad:
        print("check in no part:", b)
    print("smoke parts: " + ("FAILED" if bad else "every check sits in a part"))
    sys.exit(1 if bad else 0)
