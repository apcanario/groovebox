#!/usr/bin/env python3
"""Unit tests for tools/release_check.py (G6), and the real repo passing it. Run: python3 tools/test_release_check.py"""
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from release_check import problems  # noqa: E402

FILES = [
    ".github/workflows/apk.yml",
    ".github/workflows/pages.yml",
    "vite.config.ts",
    "android/app/src/main/AndroidManifest.xml",
]


def copy() -> str:
    root = tempfile.mkdtemp()
    for rel in FILES:
        os.makedirs(os.path.dirname(os.path.join(root, rel)), exist_ok=True)
        shutil.copy(os.path.join(ROOT, rel), os.path.join(root, rel))
    return root


def edit(root: str, rel: str, old: str, new: str) -> None:
    path = os.path.join(root, rel)
    with open(path) as fh:
        text = fh.read()
    assert old in text, f"{old!r} not in {rel}"
    with open(path, "w") as fh:
        fh.write(text.replace(old, new))


class ReleaseCheck(unittest.TestCase):
    def setUp(self):
        self.root = copy()

    def tearDown(self):
        shutil.rmtree(self.root)

    def found(self) -> str:
        return "\n".join(problems(self.root))

    def test_repo_passes(self):
        self.assertEqual(problems(ROOT), [])

    def test_no_release_latest_fails(self):
        edit(self.root, FILES[0], "gh release create latest", "gh release create nightly")
        self.assertIn("no release named latest", self.found())

    def test_no_assemble_debug_fails(self):
        edit(self.root, FILES[0], "./gradlew assembleDebug", "./gradlew assembleRelease")
        self.assertIn("assembleDebug", self.found())

    def test_no_unit_test_step_fails(self):
        edit(self.root, FILES[0], "./gradlew testDebugUnitTest", "./gradlew tasks")
        self.assertIn("testDebugUnitTest", self.found())

    def test_no_push_to_main_fails(self):
        edit(self.root, FILES[0], "branches: [main]", "branches: [dev]")
        self.assertIn("apk.yml: no push-to-main trigger", self.found())

    def test_not_prerelease_fails(self):
        edit(self.root, FILES[0], "--prerelease \\\n", "\\\n")
        self.assertIn("prerelease", self.found())

    def test_wrong_asset_name_fails(self):
        edit(self.root, FILES[0], "gh release create latest groovebox-debug.apk", "gh release create latest app.apk")
        self.assertIn("groovebox-debug.apk", self.found())

    def test_no_write_permission_fails(self):
        edit(self.root, FILES[0], "contents: write", "contents: read")
        self.assertIn("contents: write", self.found())

    def test_bad_yaml_fails(self):
        edit(self.root, FILES[0], "jobs:", "jobs: [")
        self.assertIn("does not parse", self.found())

    def test_shared_concurrency_group_fails(self):
        edit(self.root, FILES[0], "group: apk", "group: pages")
        self.assertIn("share a concurrency group", self.found())

    def test_pages_build_changed_fails(self):
        edit(self.root, FILES[1], "- run: npm run build", "- run: npm run build:android")
        self.assertIn("pages.yml: no longer runs npm run build", self.found())

    def test_pages_path_changed_fails(self):
        edit(self.root, FILES[1], "path: dist", "path: android")
        self.assertIn("pages.yml: no longer uploads dist", self.found())

    def test_base_changed_fails(self):
        edit(self.root, FILES[2], 'base: "./"', 'base: "/groovebox/"')
        self.assertIn("base", self.found())

    def test_foreground_service_fails(self):
        edit(
            self.root,
            FILES[3],
            '<uses-permission android:name="android.permission.INTERNET" />',
            '<uses-permission android:name="android.permission.INTERNET" />\n'
            '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
        )
        self.assertIn("FOREGROUND_SERVICE", self.found())

    def test_wake_lock_fails(self):
        edit(
            self.root,
            FILES[3],
            '<uses-permission android:name="android.permission.INTERNET" />',
            '<uses-permission android:name="android.permission.WAKE_LOCK" />',
        )
        self.assertIn("WAKE_LOCK", self.found())

    def test_service_element_fails(self):
        edit(self.root, FILES[3], "</application>", '<service android:name=".Player" /></application>')
        self.assertIn("<service>", self.found())


if __name__ == "__main__":
    unittest.main()
