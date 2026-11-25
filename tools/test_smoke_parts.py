#!/usr/bin/env python3
"""Unit tests of the smoke's parts and per-part ledger fingerprints (tools/smoke_parts.py), run by `npm run check`.

Each test copies what the fingerprints read (src/, public/, tools/ and the build files) to a scratch folder, changes
one file there and checks which parts' ledger entries stay valid: a change outside a part leaves its entry green, a
change inside it clears it.
"""
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import smoke_parts as sp  # noqa: E402

DROPS = [f"drop-{i}" for i in range(1, 7)]


class PartFingerprints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="smoke-parts-")
        for top in sp.SHARED_FILES + sp.SHARED_DIRS + ["tools"]:
            src = os.path.join(ROOT, top)
            if os.path.isdir(src):
                shutil.copytree(src, os.path.join(cls.tmp, top), ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            elif os.path.isfile(src):
                shutil.copy(src, os.path.join(cls.tmp, top))
        cls.names = sp.part_names(cls.tmp)
        cls.pristine = sp.fingerprints(cls.tmp)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def fps(self) -> dict:
        return sp.fingerprints(self.tmp)

    def changed(self, rel: str, old: str | None = None, new: str | None = None) -> set:
        """The parts whose ledger entry a change to REL clears: a full ledger recorded before the change, read after."""
        before = self.pristine
        ledger = {"green": {n: {"fingerprint": fp, "seconds": 1, "at": "x"} for n, fp in before.items()}}
        path = os.path.join(self.tmp, rel)
        with open(path) as fh:
            text = fh.read()
        try:
            if old is None:
                edited = text + "\n// a change\n" if not rel.endswith(".py") else text + "\n# a change\nX_CHANGE = 1\n"
            else:
                self.assertIn(old, text, f"{rel} has no {old!r}")
                edited = text.replace(old, new, 1)
            with open(path, "w") as fh:
                fh.write(edited)
            after = self.fps()
            still = sp.valid_green(ledger, after)
            return set(self.names) - set(still)
        finally:
            with open(path, "w") as fh:
                fh.write(text)

    def test_parts_named(self):
        self.assertEqual(self.names, ["core", "vibes", "additions", "effects"] + DROPS + ["morph", "cost"])

    def test_every_check_in_a_part(self):
        self.assertEqual(sp.uncovered(), [])

    def test_unchanged_tree_keeps_every_entry(self):
        self.assertEqual(self.changed("package.json", '"private"', '"private"'), set())

    def test_ui_only_change_leaves_drop_and_morph_green(self):
        gone = self.changed(os.path.join("src", "ui", "tabs", "ChordsTab.tsx"))
        self.assertIn("core", gone)
        self.assertIn("vibes", gone)
        for n in DROPS + ["morph", "additions", "cost"]:
            self.assertNotIn(n, gone)

    def test_tab_the_part_opens_clears_it(self):
        # The Mix tab: drop-1 opens its Drop and Audio pages, morph its Master and Morph pages; the vibe groups do not.
        gone = self.changed(os.path.join("src", "ui", "tabs", "MixTab.tsx"))
        for n in ["core", "drop-1", "morph"]:
            self.assertIn(n, gone)
        for n in DROPS[1:] + ["additions", "cost"]:
            self.assertNotIn(n, gone)
        # The Layer tab's file is imported by the Simple Synth tab, which morph opens; the drop never opens it.
        gone = self.changed(os.path.join("src", "ui", "tabs", "LayerTab.tsx"))
        self.assertIn("morph", gone)
        for n in DROPS:
            self.assertNotIn(n, gone)

    def test_shell_change_clears_every_part(self):
        for rel in [os.path.join("src", "ui", "App.tsx"), os.path.join("src", "ui", "tabs", "PlayTab.tsx"),
                    os.path.join("src", "ui", "drop.tsx")]:
            self.assertEqual(self.changed(rel), set(self.names), rel)

    def test_engine_and_build_changes_clear_every_part(self):
        for rel in [os.path.join("src", "engine", "drop.ts"), os.path.join("src", "music", "morph.ts"),
                    os.path.join("src", "style.css"), "package.json", "index.html"]:
            self.assertEqual(self.changed(rel), set(self.names), rel)

    def test_unit_test_change_clears_nothing(self):
        tests = [os.path.join(d, f) for d, _x, fs in os.walk(os.path.join(self.tmp, "src")) for f in fs if f.endswith(".test.ts")]
        self.assertTrue(tests)
        self.assertEqual(self.changed(os.path.relpath(tests[0], self.tmp)), set())

    def test_check_code_change_clears_only_its_parts(self):
        tools = "tools"
        # Morph's walk: morph alone.
        self.assertEqual(self.changed(os.path.join(tools, "morphcheck.py"), "def walk_morph(page, failures: list) -> None:\n",
                                      "def walk_morph(page, failures: list) -> None:\n    pass\n"), {"morph"})
        # The Drop's walk runs in drop-1 only; the drop's measure in every drop group.
        self.assertEqual(self.changed(os.path.join(tools, "dropcheck.py"), "def walk_drop(page, failures: list, vibe_song: str = \"deepHouse\") -> None:\n",
                                      "def walk_drop(page, failures: list, vibe_song: str = \"deepHouse\") -> None:\n    pass\n"), {"drop-1"})
        self.assertEqual(self.changed(os.path.join(tools, "dropcheck.py"), "def one_drop(page, v: dict, failures: list, label: str) -> dict | None:\n",
                                      "def one_drop(page, v: dict, failures: list, label: str) -> dict | None:\n    pass\n"), set(DROPS))
        # P9's walk in smoke.py: effects only.
        self.assertEqual(self.changed(os.path.join(tools, "smoke.py"), "def walk_p9(page, failures: list) -> None:\n",
                                      "def walk_p9(page, failures: list) -> None:\n    pass\n"), {"effects"})
        # A shared helper (every part opens the app) and module-level code: every part.
        self.assertEqual(self.changed(os.path.join(tools, "smoke.py"), "def open_app(page, failures: list) -> None:\n",
                                      "def open_app(page, failures: list) -> None:\n    pass\n"), set(self.names))
        self.assertEqual(self.changed(os.path.join(tools, "smoke.py")), set(self.names))
        self.assertEqual(self.changed(os.path.join(tools, "smoke_parts.py")), set(self.names))
        # A tools file the smoke never imports: nothing.
        self.assertEqual(self.changed(os.path.join(tools, "landed.py")), set())

    def edited(self, edits: list):
        """Apply (rel, old, new) edits in the scratch copy (old None: create rel with new); undo on exit."""
        tmp = self

        class Ctx:
            def __enter__(self):
                self.saved = []
                for rel, old, new in edits:
                    path = os.path.join(tmp.tmp, rel)
                    prev = open(path).read() if os.path.exists(path) else None
                    self.saved.append((path, prev))
                    if old is None:
                        text = new
                    else:
                        tmp.assertIn(old, prev, f"{rel} has no {old!r}")
                        text = prev.replace(old, new, 1)
                    with open(path, "w") as fh:
                        fh.write(text)

            def __exit__(self, *exc):
                for path, prev in reversed(self.saved):
                    if prev is None:
                        os.remove(path)
                    else:
                        with open(path, "w") as fh:
                            fh.write(prev)

        return Ctx()

    def test_unlisted_tab_is_in_every_part(self):
        # A new tab imported by App.tsx but in no TAB_FILES entry: a change to it clears every part (fails closed).
        new_tab = os.path.join("src", "ui", "tabs", "NewTab.tsx")
        app = os.path.join("src", "ui", "App.tsx")
        imp = 'import { PlayTab } from "./tabs/PlayTab.tsx";\n'
        with self.edited([(new_tab, None, "export const NewTab = () => null;\n"),
                          (app, imp, imp + 'import { NewTab } from "./tabs/NewTab.tsx";\n')]):
            before = self.fps()
            for n in self.names:
                self.assertIn(new_tab, sp.part_inputs(n, self.tmp)["files"], n)
            with self.edited([(new_tab, "null", "undefined")]):
                after = self.fps()
        self.assertEqual({n for n in self.names if before[n] != after[n]}, set(self.names))

    def test_play_tab_tile_opens_instrument_and_layer_tabs(self):
        # A check that holds a Now tile or taps a row head on the Play tab opens an instrument or layer tab by goTab.
        ui = os.path.join("src", "ui", "tabs")
        want = {os.path.join(ui, "InstrumentTab.tsx"), os.path.join(ui, "LayerTab.tsx"), os.path.join(ui, "SimpleTab.tsx")}
        self.assertFalse(want & set(sp.part_inputs("drop-1", self.tmp)["files"]))
        head = "def walk_drop(page, failures: list, vibe_song: str = \"deepHouse\") -> None:\n"
        with self.edited([(os.path.join("tools", "dropcheck.py"), head, head + "    page.locator('[data-now=\"bass\"]')\n")]):
            self.assertTrue(want <= set(sp.part_inputs("drop-1", self.tmp)["files"]))
        with self.edited([(os.path.join("tools", "dropcheck.py"), head, head + "    page.locator('[data-row=\"layer1\"]')\n")]):
            self.assertTrue(want <= set(sp.part_inputs("drop-1", self.tmp)["files"]))

    def test_check_threshold_clears_its_parts(self):
        self.assertTrue(set(DROPS) <= self.changed(os.path.join("tools", "dropcheck.py"), "LEVEL_DROP_DB = 3.0", "LEVEL_DROP_DB = 3.5"))

    def test_functions_named_in_a_constant_are_reached(self):
        # walk_drop uses a module constant naming a function: that function is in drop-1's check code, not in morph's.
        rel = os.path.join("tools", "dropcheck.py")
        head = "def walk_drop(page, failures: list, vibe_song: str = \"deepHouse\") -> None:\n"
        with open(os.path.join(self.tmp, rel)) as fh:
            text = fh.read()
        with self.edited([(rel, None, text + "\n\ndef zz_hook(page):\n    pass\n\n\nZZ_HOOKS = [zz_hook]\n")]):
            with self.edited([(rel, head, head + "    ZZ_HOOKS\n")]):
                self.assertIn("dropcheck.py:zz_hook", sp.part_inputs("drop-1", self.tmp)["tools"])
                self.assertNotIn("dropcheck.py:zz_hook", sp.part_inputs("morph", self.tmp)["tools"])

    def test_old_ledger_is_not_trusted(self):
        fps = self.fps()
        self.assertEqual(sp.valid_green({"fingerprint": "x", "green": {"core": {"seconds": 1}}}, fps), {})
        self.assertEqual(sp.valid_green({"green": {"gone": {"fingerprint": "x"}}}, fps), {})
        self.assertEqual(sp.valid_green([], fps), {})


class DropGroups(unittest.TestCase):
    def test_groups_cover_every_vibe_once(self):
        import dropcheck

        vibes = [{"id": f"v{i}"} for i in range(22)] + [{"id": "ambient"}, {"id": "drone"}]
        groups = [dropcheck.drop_group(vibes, g) for g in range(1, dropcheck.DROP_GROUPS + 1)]
        self.assertEqual(dropcheck.DROP_GROUPS, 6)
        self.assertEqual([len(g) for g in groups], [4] * 6)
        self.assertEqual([v for g in groups for v in g], vibes)
        self.assertEqual([v["id"] for v in groups[-1]][-2:], ["ambient", "drone"])
        self.assertEqual(dropcheck.drop_group(vibes, None), vibes)


if __name__ == "__main__":
    unittest.main(verbosity=1)
