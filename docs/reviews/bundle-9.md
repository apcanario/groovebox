# Bundle 9 player report (G6, the APK)

27 Nov 2026. Player: fresh Opus 5.5 agent that did not see the build. Local `main` at 5d86351 (one docs-only commit ahead of `origin/main` 12630ec; not pushed by the player). No source file changed.

## What was run

- `npm run check`: pass (exit 0; tsc, vitest, the Python tool tests incl. `test_release_check.py`, vite build, offline check "dist loads nothing from the network, fonts bundled").
- `npm run smoke`: pass, exit 0. All 12 parts were already green in the ledger on their fingerprints, so this run replayed none (0.0 min). The full run behind those entries is the G6 close (CHANGELOG: 12 of 12, 71.2 min).
- `python3 tools/shots.py`: SHOTS PASSED, 832 screens at 8 sizes, exit 0.
- GitHub, REST only (`gh api`):
  - `apk.yml` (Build debug APK): run 2 on 12630ec, push to main, **success**; run 1 on 9cbf4cf failed (the `setup-android` failure recorded in C34).
  - `pages.yml`: run 45 on 12630ec **success**, runs 42 to 44 success. The live site itself could not be fetched (the egress proxy refuses `apcanario.github.io`; `repos/.../pages` is also blocked), so "deploys" rests on the run conclusion.
  - Release `latest`: prerelease true, draft false, tag `latest` -> 12630ec664d5 (same as `target_commitish`), one asset `groovebox-debug.apk`, 4,359,153 bytes, uploaded 18:08:52Z. Body: "Debug APK built from 12630ec... Install: docs/INSTALL.md."
  - Asset downloaded through the release asset API (no network block). sha256 `03debae5...c8fec7fba`.
- APK inspected with androguard 4.1.4 (aapt2/apksigner not installable here) and unzip:
  - package `com.apcanario.groovebox`, versionCode 2 (= run number 2), versionName `0.0.1+2`, minSdk 24, targetSdk 36, `debuggable=true`.
  - Signature: v2 scheme (no v1, no v3); one certificate `CN=Android Debug, O=Android, C=US`, SHA-256 `fc7b5872...e1daf440`, identical to the certificate in the committed `android/app/debug.keystore` (keytool, alias `androiddebugkey`).
  - Permissions: `INTERNET` and the AndroidX `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` only. No `<service>`, no FOREGROUND_SERVICE, WAKE_LOCK or audio permission. Components: MainActivity, FileProvider, AndroidX startup provider, ProfileInstallReceiver.
  - `assets/public/` is byte-identical to the local `dist/` (index-BwmqQYxU.js, the DM Sans woff2, CSS, mp3 worker, LICENSES.txt); `capacitor.config.json` has no `server.url`, so the app loads from the APK.
  - Launcher icon (adaptive + legacy, mdpi to xxxhdpi, monochrome layer): original lanes-and-playhead design, not the Capacitor default.

## Done-when, line by line

| Line | True now? | Evidence |
|---|---|---|
| The workflow produces an APK | Yes | apk.yml run 2 green; release `latest` holds the signed APK above. |
| The web build still deploys to Pages | Yes (by run status) | pages.yml green on 9cbf4cf and 12630ec; live URL not reachable from here. |
| `check` and `smoke` pass | Yes | Both exit 0 on 5d86351 (smoke from ledger). |
| Capacitor Android project wrapping the built app | Yes | `android/`, web assets identical to `dist/`. |
| Portrait on phones, free rotation on tablets | Yes in code, unseen on a device | `MainActivity.applyOrientation` with `OrientationRule` (smallest width < 600 dp -> PORTRAIT, else FULL_USER), re-read in `onConfigurationChanged`; unit-tested in `testDebugUnitTest`. The manifest sets no `screenOrientation`. |
| Screen kept awake while playing | Yes in code, unseen on a device | `KeepAwakePlugin` (FLAG_KEEP_SCREEN_ON) driven from `src/ui/keepAwake.ts`. |
| App icon | Yes | See above. |
| Works offline (fonts bundled) | Yes | Offline check in `check`; APK assets self-contained, no server URL. |
| No foreground service, no background audio | Yes | Manifest as above; `src/ui/background.ts` stops on `pause`/hidden; `release_check.py` guards it. |
| Workflow on each push to main, release `latest` | Yes | `on: push: branches: [main]`; prerelease `latest` recreated per run, tag on the built commit. |
| `docs/INSTALL.md` | Yes, with the findings below | URL resolves to the real release; asset name matches. |

Installing on the phone stays Pedro's test (row text); C34's three open items (first-tap audio in the WebView, screen awake, rotation keeping audio) remain unseen.

## Screens

G6 changed no screen in the browser build. The shots at 412 x 915 and 1280 x 800 were set against `docs/design/look/` (phone simple play, phone simple layer, tablet landscape advanced): same faceplate, lanes, hatched next-bar states, DROP and Morph row, dials and tab bar as at bundle 8; the long "WWWW" labels are the text-fit fixtures and fit. No cut-off text or control under 48 px seen in the sample, and the script's own checks (cut-off, sizes, frame) passed on all 832. The take sheet's new Android 7 to 9 message (`OLD_ANDROID` in `src/ui/takeOut.ts`) only shows in the APK and has no screenshot.

## Findings

Errors: 0. Should-fix: 2. Minor: 5.

### Should-fix

- **S1. README "What it does today" header is stale.** `README.md:29` says "Built and live ... (rows G0 to G5, P1 ... P10d and the bundle 7b player pass, 22 to 26 Nov 2026)", leaving out T1 to T3 and G6, which the bullets below it (tablet layouts, punch pads, the APK) describe. Fix: "(rows G0 to G5, P1 to P11, R1, P10b to P10d, T1 to T3 and G6, 22 to 27 Nov 2026)". Also `README.md:3` and `:7` still say it "runs in a phone browser" / "Chrome on Android" only; add "or as an Android APK (`docs/INSTALL.md`)".
- **S2. BACKLOG Done row contradicts C34.** `docs/BACKLOG.md:183` (G6 Done) still says "Gradle, the workflow and a device not run here", while C34 (`:45`) and the CHANGELOG record the workflow green on run 2. Fix: "Gradle ran in the workflow (run 2 green, release `latest`); a device not run."

### Minor

- **M1. INSTALL's one-time uninstall note describes an APK that was never published.** `docs/INSTALL.md:22`: apk.yml first ran on 9cbf4cf, after the fixed key's commit (b373466), and that run failed, so every APK ever on `latest` carries the committed key. The note applies only to an APK built by hand before b373466. Fix: "Only if you installed an APK built by hand before 27 Nov 2026 ..." or drop the paragraph.
- **M2. "Uninstall deletes songs" may not hold.** `android/app/src/main/AndroidManifest.xml:5` keeps `allowBackup="true"`, so Android Auto Backup can restore the WebView storage after a reinstall; `docs/INSTALL.md:20` states songs are deleted with an uninstall. Unverified on a device. Fix: set `allowBackup="false"` (then the doc is exact) or soften the doc to "may be deleted".
- **M3. Stale path in a comment.** `android/app/src/main/java/com/apcanario/groovebox/KeepAwakePlugin.java:11` points to `src/platform/keepAwake.ts`; the file is `src/ui/keepAwake.ts`. Fix the path.
- **M4. Local main is one commit ahead.** 5d86351 (README, BACKLOG, CHANGELOG: "workflow green") is not on `origin/main`; until it is pushed the remote README still says the workflow has not run. Its push will trigger apk.yml run 3 and replace `latest` (versionCode 3). Fix: push it with this report.
- **M5. Release notes are not a link.** The release body says "Install: docs/INSTALL.md." as plain text (`.github/workflows/apk.yml:66`). Fix: use `https://github.com/apcanario/groovebox/blob/main/docs/INSTALL.md`.

## Not checked

A device or emulator (none here), the live Pages URL (proxy refuses it), actionlint, the take sheet in the APK.
