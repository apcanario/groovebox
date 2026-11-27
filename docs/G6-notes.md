# G6 slice a: notes for the main chat

Changelog line (fold into docs/CHANGELOG.md):

- Capacitor 8.6.3 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, pinned, devDependencies): wraps the built app in the Android APK (G6); nothing in `src/` imports it, so the web build and Pages are unchanged (the keep-awake bridge reaches the `window.Capacitor` global the shell injects).

# G6 slice b: notes for the main chat

- **Background stop (spec section 2), choice:** web side only, `src/ui/background.ts`, wired in `App.tsx`. Capacitor 8.6.3 never pauses the WebView (Bridge `KeepRunning` defaults to true), but on every activity onPause its `MockCordovaWebViewImpl.handlePause` fires a `pause` document event through `window.Capacitor.triggerEvent`. Inside the shell the app calls the engine's own Stop on that event or on `visibilitychange` to hidden, whichever comes first (Stop only if running). A take in progress ends as Stop ends it: 1.5 s tail, then the take sheet. Nothing restarts on return. No native change: MainActivity is untouched. In a browser (Pages) nothing changes, so the smoke runs as before. The AudioContext is not suspended (it goes silent with Stop; suspending would cut the take's tail). Test: `src/ui/background.test.ts` (real Engine with Tone faked).
- **Workflow:** `.github/workflows/apk.yml`, push to main and workflow_dispatch, own concurrency group `apk`. Java 21, not 17: Capacitor 8's Android library compiles for `JavaVersion.VERSION_21`, so 17 cannot build it. `android-actions/setup-android@v3`, `npm ci`, `npm run build:android`, `./gradlew assembleDebug`, `./gradlew testDebugUnitTest`, then `gh release delete latest --cleanup-tag` and `gh release create latest groovebox-debug.apk --prerelease --target $GITHUB_SHA` (recreated each push so the tag follows the commit). `pages.yml` is untouched.
- **Checks:** `tools/release_check.py` (with `tools/test_release_check.py`, now in `npm run check`) fails if apk.yml lacks the push-to-main trigger, assembleDebug, testDebugUnitTest, release `latest` (prerelease, asset groovebox-debug.apk) or `contents: write`; if pages.yml stops building with `npm run build` and deploying dist, or shares apk.yml's concurrency group; if vite's base is no longer `./`; if the manifest asks for a foreground service, wake lock or audio permission or declares a `<service>`.
- **Not run here:** `./gradlew assembleDebug` and `testDebugUnitTest` (no Android SDK in this container), the workflow itself, and actionlint (not installable here; the YAML is parsed by PyYAML instead). The first push to main is the workflow's first run.
- **Pages build:** `npm ci && npm run build` at f09a02f and at this slice give the same six files (index.html identical but for hashes; main JS 704.24 kB to 705.07 kB).
- **Docs:** `docs/INSTALL.md`.

Changelog line (fold into docs/CHANGELOG.md): G6 APK: Capacitor shell (portrait phones, free tablets), native keep-awake, icon, offline check; the jam stops when the app goes to the background; `apk.yml` builds the debug APK on each push to main and puts it on the prerelease `latest`; `docs/INSTALL.md`.
