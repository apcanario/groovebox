#!/usr/bin/env python3
"""Checks that the phase 2 and 3 plan is fully on this checkout. Prints LANDED or the problems."""
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
problems = []


def text(p):
    f = root / p
    if not f.exists():
        problems.append(f"missing: {p}")
        return ""
    return f.read_text()


for p in ["README.md", "CLAUDE.md", "docs/SPEC.md", "docs/BACKLOG.md", "docs/CHANGELOG.md", "docs/RUN.md"]:
    t = text(p)
    if re.search(r"^(<<<<<<<|=======|>>>>>>>)( |$)", t, re.M):
        problems.append(f"conflict markers left in {p}")

spec, backlog, run, readme, claude = (text(p) for p in
                                      ["docs/SPEC.md", "docs/BACKLOG.md", "docs/RUN.md", "README.md", "CLAUDE.md"])
for h in ["## 8. Phase 2", "### 8.9 The Drop", "### 8.12 The look", "## 9. Phase 3", "## 7. Engine rules"]:
    if h not in spec:
        problems.append(f"spec lacks: {h}")
for row in ["P1", "P1b", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "G6", "T1", "T2", "T3", "G7"]:
    n = len(re.findall(rf"^### {re.escape(row)}\. ", backlog, re.M))
    if n != 1:
        problems.append(f"backlog has row {row} {n} times, wants 1")
for b in range(4, 10):
    if not re.search(rf"^## Bundle {b}: ", backlog, re.M):
        problems.append(f"backlog lacks bundle {b}")
if "## Carried" not in backlog or "## Done" not in backlog:
    problems.append("backlog lost its Carried or Done section")
if "## 4b. Close the bundle" not in run:
    problems.append("RUN.md lacks section 4b")
if "README.md" not in claude:
    problems.append("CLAUDE.md lacks the README rule")
if not readme.rstrip().endswith("Landed: plan"):
    problems.append("README.md does not end with the line: Landed: plan")
look = list((root / "docs/design/look").glob("groovebox-v3-*.jpg"))
if len(look) != 5:
    problems.append(f"docs/design/look has {len(look)} of 5 mockups")
if (root / "docs/landing-base").exists():
    problems.append("docs/landing-base should be deleted after landing")
if (root / "docs/LANDING.md").exists():
    problems.append("docs/LANDING.md should not be on main")

if problems:
    print("NOT LANDED")
    for p in problems:
        print(" -", p)
    sys.exit(1)
print("LANDED")
