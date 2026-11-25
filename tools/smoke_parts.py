#!/usr/bin/env python3
"""The smoke's parts cover every check.

`uncovered()` (run by tools/smoke.py before any part) lists every function of tools/smoke.py and tools/dropcheck.py
that records a failure (`failures.append`) but is reached from no part of PARTS: a check that would never run.

    python3 tools/smoke_parts.py              exits 1 if a check sits in no part
    python3 tools/smoke_parts.py --against REV  also proves the parts equal REV's single run: every other top-level
                                              statement unchanged, and REV's walk equal, statement for statement, to
                                              open_app followed by every part in order and the oscillator patch check
"""
import ast
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = ["smoke.py", "dropcheck.py"]


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
    trees = {f: ast.parse(open(os.path.join(HERE, f)).read()) for f in FILES}
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
    return missing


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
