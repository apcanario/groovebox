#!/usr/bin/env python3
"""The smoke's parts cover every check.

`uncovered()` (run by tools/smoke.py before any part) lists every function of tools/smoke.py, tools/dropcheck.py and
tools/morphcheck.py
that records a failure (`failures.append`) but is reached from no part of PARTS: a check that would never run.

    python3 tools/smoke_parts.py              exits 1 if a check sits in no part
    python3 tools/smoke_parts.py --files NAME   lists what part NAME's ledger fingerprint hashes
    python3 tools/smoke_parts.py --against REV  also proves the parts equal REV's single run: every other top-level
                                              statement unchanged, and REV's walk equal, statement for statement, to
                                              open_app followed by every part in order and the oscillator patch check
"""
import ast
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["smoke.py", "dropcheck.py", "morphcheck.py"]


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
#    `data-tab="name"` in it, or every tab for a computed one (`data-tab="{...}"`) or the TABS list. A tab brings what it
#    imports, tabs included. The Play tab is in every part (the app opens on it).
#  - tools/: tools/smoke_parts.py whole; of tools/smoke.py and the files it imports (dropcheck, morphcheck, shots,
#    mp3check), every top-level statement that is not a function (imports, constants, PARTS) and every function the
#    part reaches from run_part, main, open_app, its setup and its own function, by name; nothing else of tools/.
# core opens every tab, so it has every file: a change that breaks the app for all parts still reruns core.
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
        fns, rest, names, mods, consts, text, refs, attrs, used = {}, [], {}, set(), {}, {}, {}, {}, {}
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
                  "text": text, "refs": refs, "attrs": attrs, "used": used, "tree": tree}
    return out


def _reach(tools: dict, roots: list) -> set:
    """(file, function) pairs reached from smoke.py's roots by name: a name resolves in its own file, then to the
    file it was imported from; an attribute also to any tools module the file imports."""
    seen, todo = set(), [("smoke.py", r) for r in roots]
    while todo:
        f, n = todo.pop()
        if (f, n) in seen or n not in tools[f]["fns"]:
            continue
        seen.add((f, n))
        t = tools[f]
        for x in t["refs"][n]:
            if x in t["fns"]:
                todo.append((f, x))
            if x in t["names"] and t["names"][x] in tools:
                todo.append((t["names"][x], x))
            if x in t["attrs"][n]:
                todo += [(m, x) for m in t["mods"] if m in tools]
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
    ui = os.path.join("src", "ui")
    start = [os.path.join(ui, "App.tsx")]
    shown = _ui_closure(base, start, into_tabs=False)
    shown |= _ui_closure(base, [os.path.join(ui, "tabs", t) for tab in sorted(tabs) for t in TAB_FILES.get(tab, [])], into_tabs=True)
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


def against(rev: str) -> list:
    """Differences between REV's single run and the parts (empty when equal)."""
    old = ast.parse(subprocess.check_output(["git", "show", f"{rev}:tools/smoke.py"], cwd=HERE, text=True))
    new = ast.parse(open(os.path.join(HERE, "smoke.py")).read())
    problems = []

    def top(tree):
        out = {}
        for node in tree.body:
            if node is tree.body[0] and isinstance(node, ast.Expr):
                continue  # the module docstring, which says how the parts run
            key = getattr(node, "name", None) or ast.dump(node)[:200]
            out[key] = ast.dump(node)
        return out

    o, n = top(old), top(new)
    for k, v in o.items():
        if k == "main":
            continue
        if k not in n:
            problems.append(f"{k} is gone")
        elif n[k] != v:
            problems.append(f"{k} changed")
    fn = {x.name: x for x in new.body if isinstance(x, ast.FunctionDef)}
    old_main = next(x for x in old.body if isinstance(x, ast.FunctionDef) and x.name == "main")
    with_old = next(x for x in ast.walk(old_main) if isinstance(x, ast.With))
    stmts = [ast.dump(s) for s in with_old.body]
    start = next(i for i, s in enumerate(with_old.body) if "'!!window.__groovebox'" in ast.unparse(s)) + 1
    end = next(i for i, s in enumerate(with_old.body) if ast.unparse(s) == "browser.close()")
    walk_old = stmts[start:end]
    walk_new = [ast.dump(s) for s in fn["open_app"].body[1:]]  # [0] is its docstring
    names = []
    for name, part, _setup in _parts(new):
        names.append(name)
        walk_new += [ast.dump(s) for s in fn[part].body]
    walk_new.append(ast.dump(ast.parse("check_osc_patch(page, failures)").body[0]))
    if walk_old != walk_new:
        for i, (a, b) in enumerate(zip(walk_old, walk_new)):
            if a != b:
                problems.append(f"the walk differs at statement {i}")
                break
        if len(walk_old) != len(walk_new):
            problems.append(f"the walk has {len(walk_old)} statements in {rev}, {len(walk_new)} in the parts")
    # The browser, page and page errors open each part as they opened the single run.
    with_new = next(x for x in ast.walk(fn["run_part"]) if isinstance(x, ast.With))
    if [ast.dump(s) for s in with_new.body[:start]] != stmts[:start]:
        problems.append("run_part opens the browser and page differently")
    print(f"{rev}: {len(walk_old)} walk statements; parts {', '.join(names)}: {len(walk_new)} statements"
          f"{', equal' if walk_old == walk_new else ', DIFFERENT'}; {len(o) - 1} other top-level statements compared")
    return problems


if __name__ == "__main__":
    if "--files" in sys.argv:
        got = part_inputs(sys.argv[sys.argv.index("--files") + 1])
        print("\n".join(got["files"] + list(got["tools"])))
        sys.exit(0)
    bad = uncovered()
    for b in bad:
        print("check in no part:", b)
    if "--against" in sys.argv:
        diff = against(sys.argv[sys.argv.index("--against") + 1])
        for d in diff:
            print("differs:", d)
        bad += diff
    print("smoke parts: " + ("FAILED" if bad else "every check sits in a part"))
    sys.exit(1 if bad else 0)
