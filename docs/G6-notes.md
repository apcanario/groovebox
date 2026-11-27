# G6 slice a: notes for the main chat

Changelog line (fold into docs/CHANGELOG.md):

- Capacitor 8.6.3 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, pinned, devDependencies): wraps the built app in the Android APK (G6); nothing in `src/` imports it, so the web build and Pages are unchanged (the keep-awake bridge reaches the `window.Capacitor` global the shell injects).
