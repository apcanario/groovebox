# Installing Groovebox on Android

## Download

Every push to `main` builds a fresh APK. Get it from the release `latest` on the repo's Releases page:

https://github.com/apcanario/groovebox/releases/tag/latest

Download `groovebox-debug.apk` on the phone.

## Install

1. Open the downloaded file (from the browser's downloads or the Files app).
2. The first time, Android asks to allow installs from that app (the browser or Files). Allow it once.
3. Tap Install.
4. Play Protect may say the app is unsafe or unrecognised, because it is a debug build signed with a debug key and not from the Play Store. Tap More details, then Install anyway.

## Update

Download the new `groovebox-debug.apk` and install it over the old one. Do not uninstall first: songs stay with an update and are deleted with an uninstall (the app opts out of Android backup, so a reinstall does not bring them back). Every build is signed with the same key (`android/app/debug.keystore`, committed) and carries a higher version number (the workflow's run number), so Android takes it as an update of the same app.

The key is Android's standard debug key, public by design (alias `androiddebugkey`, passwords `android`). It is not a secret and is good only for this debug build: it must never sign a Play Store release, which needs its own private key kept out of the repo.

## Where songs live

On the phone, in the app's own storage (IndexedDB inside the app). There is no account, server or sync. Songs made on the web version (the Pages site) stay in that browser and do not appear in the APK, and the other way round.

A take you record is saved or shared as an MP3 from the take sheet. Save MP3 puts it in Downloads on Android 10 and later; on Android 7 to 9 the app cannot write to Downloads without a storage permission it does not ask for, so the sheet says so: use Share there.

## What to expect

- No network needed: everything, fonts included, is inside the APK.
- Phones are portrait only. Tablets (600 dp or more on the short side) rotate freely.
- The screen stays on while playing. No background audio: the jam stops when you leave the app or lock the phone; tap Play when you come back.
