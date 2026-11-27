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
        # The Mix tab: drop-1 opens its Drop and Audio pages, morph its Master and Morph pages, cost (T3) the whole Mix
        # at the desk for the motion measure; the vibe groups do not.
        gone = self.changed(os.path.join("src", "ui", "tabs", "MixTab.tsx"))
        for n in ["core", "drop-1", "morph", "cost"]:
            self.assertIn(n, gone)
        for n in DROPS[1:] + ["additions"]:
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


class DropLevel(unittest.TestCase):
    """C27: the drop's loudness on a loop longer than the 8-bar window (Drone's two 8-bar chords) is judged against
    the section's bars at the same places, and still fails a drop that is really off."""

    @staticmethod
    def reading(level_db: float) -> dict:
        return {"energy": 10 ** (level_db / 10)}

    def setUp(self):
        import dropcheck as dc
        self.dc = dc
        # The section: bars 0 to 7 (the window) on the first chord at -11 dB, the second chord at -13 dB; read after the
        # drop on bars 24 to 31. The drop, as one_drop reads it: bars 11 to 18, places 11 to 15 of the second chord, then
        # 0 to 2 of the first.
        level = lambda at: -11.0 if at % 16 < 8 else -13.0  # noqa: E731
        self.window = [(at, self.reading(level(at))) for at in range(0, 8)]
        self.late = [(at, self.reading(level(at))) for at in range(24, 32)]
        self.drop_at = list(range(11, 19))
        self.level = level
        self.n = {"energy": sum(b["energy"] for _, b in self.window) / 8}

    def drop(self, off_db: float) -> list:
        return [self.reading(self.level(at) + off_db) for at in self.drop_at]

    def test_a_drop_at_the_section_level_reads_zero(self):
        loud, per_bar = self.dc.drop_level(self.drop(0.0), self.drop_at, self.late + self.window, 16, self.n)
        self.assertAlmostEqual(loud, 0.0, places=6)
        self.assertEqual([round(x, 6) for x in per_bar], [0.0] * 8)
        # Against the window's mean (the check before C27) the same drop read 1.1 dB low, past LOUD_DB.
        old, _ = self.dc.drop_level(self.drop(0.0), self.drop_at, self.window, 8, self.n)
        self.assertLess(old, -self.dc.LOUD_DB)

    def test_a_drop_really_off_is_still_caught(self):
        for off in (-2.0, 1.5):
            loud, per_bar = self.dc.drop_level(self.drop(off), self.drop_at, self.late + self.window, 16, self.n)
            self.assertAlmostEqual(loud, off, places=6)
            self.assertGreater(abs(loud), self.dc.LOUD_DB)
            self.assertTrue(all(abs(x - off) < 1e-6 for x in per_bar))

    def test_an_8_bar_loop_is_judged_against_the_window_as_before(self):
        bars = [self.reading(-11.5)] * 8
        loud, per_bar = self.dc.drop_level(bars, list(range(12, 20)), self.window, 8, {"energy": 10 ** -1.1})
        self.assertAlmostEqual(loud, -0.5, places=6)
        self.assertTrue(all(abs(x + 0.5) < 1e-6 for x in per_bar))


if __name__ == "__main__":
    unittest.main(verbosity=1)
