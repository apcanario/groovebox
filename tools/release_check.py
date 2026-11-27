#!/usr/bin/env python3
"""G6 release checks, run by `npm run check` (through tools/test_release_check.py) and on their own.

Fails (exit 1, one line per problem) if:
- .github/workflows/apk.yml does not parse, lacks the push-to-main trigger, the assembleDebug or testDebugUnitTest
  step, the release named `latest` (prerelease, asset groovebox-debug.apk) or `contents: write`;
- .github/workflows/pages.yml no longer builds with `npm run build` and deploys dist on push to main, or the two
  workflows share a concurrency group;
- vite.config.ts no longer builds with base "./" (Pages and the APK both load from a relative base);
- android/app/src/main/AndroidManifest.xml asks for a foreground service, a wake lock or background audio
  (spec section 2), or declares a <service>;
- apk.yml cancels a run in progress (it could stop between deleting and recreating the release, G6 review M1);
- any *.keystore or *.jks other than android/app/debug.keystore is in the repo, that file is missing, or
  android/app/build.gradle has a release signing config or does not sign debug with that file (G6 review E2: one
  fixed, public-by-design debug key so updates install over; never a release key).

Run: python3 tools/release_check.py [repo root]
"""
import os
import re
import sys

import yaml

DEBUG_KEYSTORE = "android/app/debug.keystore"
SKIP_DIRS = {".git", "node_modules", "build", ".gradle", "dist", "dist-single"}

FORBIDDEN_PERMISSIONS = ("FOREGROUND_SERVICE", "WAKE_LOCK", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS")


def _load(path: str):
    with open(path) as fh:
        return yaml.safe_load(fh)


def _on(doc: dict) -> dict:
    # PyYAML reads the bare key `on` as the boolean True.
    trig = doc.get("on", doc.get(True))
    return trig if isinstance(trig, dict) else {}


def _pushes_main(doc: dict) -> bool:
    push = _on(doc).get("push")
    return isinstance(push, dict) and "main" in (push.get("branches") or [])


def _steps(doc: dict) -> list:
    out = []
    for job in (doc.get("jobs") or {}).values():
        out.extend(job.get("steps") or [])
    return out


def _runs(doc: dict) -> str:
    return "\n".join(str(s.get("run", "")) for s in _steps(doc))


def _group(doc: dict):
    c = doc.get("concurrency")
    return c.get("group") if isinstance(c, dict) else c


def apk_problems(path: str) -> list:
    if not os.path.exists(path):
        return [f"{path}: missing"]
    try:
        doc = _load(path)
    except yaml.YAMLError as e:
        return [f"{path}: does not parse: {e}"]
    if not isinstance(doc, dict):
        return [f"{path}: not a workflow"]
    p = []
    if not _pushes_main(doc):
        p.append("apk.yml: no push-to-main trigger")
    if "workflow_dispatch" not in _on(doc):
        p.append("apk.yml: no workflow_dispatch trigger")
    if (doc.get("permissions") or {}).get("contents") != "write":
        p.append("apk.yml: permissions lack contents: write")
    runs = _runs(doc)
    if "npm ci" not in runs:
        p.append("apk.yml: no npm ci step")
    if "npm run build:android" not in runs:
        p.append("apk.yml: no npm run build:android step")
    if not re.search(r"\./gradlew\s+assembleDebug\b", runs):
        p.append("apk.yml: no ./gradlew assembleDebug step")
    if not re.search(r"\./gradlew\s+testDebugUnitTest\b", runs):
        p.append("apk.yml: no ./gradlew testDebugUnitTest step")
    uses = [str(s.get("uses", "")) for s in _steps(doc)]
    if not any(u.startswith("actions/setup-java@") for u in uses):
        p.append("apk.yml: no setup-java step")
    rel = re.search(r"gh release create\s+latest\b(.*)", runs, re.S)
    soft = [s for s in _steps(doc) if str(s.get("uses", "")).startswith("softprops/action-gh-release@")]
    if rel:
        tail = rel.group(1)
        if "groovebox-debug.apk" not in tail:
            p.append("apk.yml: release asset is not groovebox-debug.apk")
        if "--prerelease" not in tail:
            p.append("apk.yml: release latest is not marked prerelease")
    elif soft:
        w = soft[0].get("with") or {}
        if w.get("tag_name") != "latest":
            p.append("apk.yml: release is not tagged latest")
        if "groovebox-debug.apk" not in str(w.get("files", "")):
            p.append("apk.yml: release asset is not groovebox-debug.apk")
        if w.get("prerelease") is not True:
            p.append("apk.yml: release latest is not marked prerelease")
    else:
        p.append("apk.yml: no release named latest")
    conc = doc.get("concurrency")
    if isinstance(conc, dict) and conc.get("cancel-in-progress") is True:
        p.append("apk.yml: cancel-in-progress is true (a cancelled run can leave no release latest)")
    if "groovebox-debug.apk" not in runs and not soft:
        p.append("apk.yml: the APK is never named groovebox-debug.apk")
    return p


def pages_problems(path: str, apk_path: str) -> list:
    if not os.path.exists(path):
        return [f"{path}: missing"]
    doc = _load(path)
    p = []
    if not _pushes_main(doc):
        p.append("pages.yml: no push-to-main trigger")
    if "npm run build" not in _runs(doc).split("\n"):
        p.append("pages.yml: no longer runs npm run build")
    steps = _steps(doc)
    up = [s for s in steps if str(s.get("uses", "")).startswith("actions/upload-pages-artifact@")]
    if not up or (up[0].get("with") or {}).get("path") != "dist":
        p.append("pages.yml: no longer uploads dist")
    if not any(str(s.get("uses", "")).startswith("actions/deploy-pages@") for s in steps):
        p.append("pages.yml: no deploy-pages step")
    if os.path.exists(apk_path):
        try:
            if _group(_load(apk_path)) == _group(doc):
                p.append("apk.yml and pages.yml share a concurrency group (one would cancel the other)")
        except yaml.YAMLError:
            pass
    return p


def base_problems(path: str) -> list:
    with open(path) as fh:
        text = fh.read()
    return [] if re.search(r"""\bbase:\s*["']\./["']""", text) else ["vite.config.ts: base is no longer \"./\""]


def manifest_problems(path: str) -> list:
    with open(path) as fh:
        text = fh.read()
    p = []
    for name in re.findall(r'android:name="android\.permission\.([A-Z_]+)"', text):
        if any(name.startswith(f) for f in FORBIDDEN_PERMISSIONS):
            p.append(f"AndroidManifest.xml: permission {name} (spec section 2: no foreground service, no background audio)")
    if re.search(r"<service\b", text):
        p.append("AndroidManifest.xml: declares a <service> (spec section 2)")
    if "foregroundServiceType" in text:
        p.append("AndroidManifest.xml: foregroundServiceType (spec section 2)")
    return p


def _block(text: str, name: str):
    """The body of the first `name { ... }` block in a Gradle file, or None."""
    m = re.search(r"\b" + re.escape(name) + r"\s*\{", text)
    if not m:
        return None
    depth, i = 1, m.end()
    while i < len(text) and depth:
        depth += {"{": 1, "}": -1}.get(text[i], 0)
        i += 1
    return text[m.end() : i - 1]


def _strip_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def keystore_problems(root: str) -> list:
    p = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in files:
            if f.endswith((".keystore", ".jks")):
                rel = os.path.relpath(os.path.join(dirpath, f), root).replace(os.sep, "/")
                if rel != DEBUG_KEYSTORE:
                    p.append(f"{rel}: a keystore other than {DEBUG_KEYSTORE} (only the public debug key is committed)")
    if not os.path.exists(os.path.join(root, DEBUG_KEYSTORE)):
        p.append(f"{DEBUG_KEYSTORE}: missing (each runner would sign with a new key; updates would not install over)")
    gradle = os.path.join(root, "android", "app", "build.gradle")
    if not os.path.exists(gradle):
        return p + ["android/app/build.gradle: missing"]
    with open(gradle) as fh:
        text = _strip_comments(fh.read())
    configs = _block(text, "signingConfigs") or ""
    names = re.findall(r"(?m)^\s*(\w+)\s*\{", configs)
    if any(n != "debug" for n in names) or re.search(r"\b(create|register)\s*\(", configs):
        p.append("build.gradle: a signing config other than debug (no release key in this repo)")
    debug_cfg = _block(configs, "debug") or ""
    if not re.search(r"""storeFile\s*(=\s*)?file\(\s*["']debug\.keystore["']\s*\)""", debug_cfg):
        p.append("build.gradle: the debug signing config does not use debug.keystore")
    types = _block(text, "buildTypes") or ""
    if not re.search(r"signingConfig\s*(=\s*)?signingConfigs\.debug\b", _block(types, "debug") or ""):
        p.append("build.gradle: the debug build type is not signed with signingConfigs.debug")
    if "signingConfig" in (_block(types, "release") or ""):
        p.append("build.gradle: the release build type has a signing config (the debug key must never sign a release)")
    return p


def problems(root: str) -> list:
    wf = os.path.join(root, ".github", "workflows")
    apk = os.path.join(wf, "apk.yml")
    return (
        apk_problems(apk)
        + pages_problems(os.path.join(wf, "pages.yml"), apk)
        + base_problems(os.path.join(root, "vite.config.ts"))
        + manifest_problems(os.path.join(root, "android", "app", "src", "main", "AndroidManifest.xml"))
        + keystore_problems(root)
    )


def main() -> int:
    root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    found = problems(root)
    for line in found:
        print(line)
    if not found:
        print("release check: apk.yml, pages.yml, vite base, the manifest and the signing are as G6 needs")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
