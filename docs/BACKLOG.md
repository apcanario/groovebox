# Backlog

The next open bundle is the first bundle below with a row not in Done. `docs/RUN.md` says how a chat works it.

## Carried

Fixes waiting for the next chat. The first builder of the next bundle clears them.

- **C1. Treble crackle, applied, waiting for Pedro's ear.** G1 changed everything on the original list (22 Nov 2026): 4x oversampled kick drive and waveshapers, resonance capped (Q 6, level-compensated), filters top out at 10 kHz, hats and clap lower, master bus 0.5, limiter now -4 dB with 1 ms attack, compressor with 120 ms release in place of Tone.Limiter, pump ramps 4 ms, buffer default `balanced`. Pedro confirms by ear; if it still crackles, the next suspects are the 4x oversampled shapers' CPU cost and buffer underruns (`?hint=interactive` vs `balanced`). G5 added (23 Nov 2026): Tone's oscillator leak (every started oscillator stayed reachable, about 4 a second) is patched in `audio.ts`; it grew memory on long jams and may have contributed to crackle, so listen on a jam of ten minutes or more.

- **C2. G3 listen items for C1** (23 Nov 2026): the bass lost its second filter (listen for crackle on a saw bass with Env amt high); the drum filter still tops at 18 kHz, not the 10 kHz of the other filters. If C1 crackle persists, these are the next suspects after buffer size.
- **C3. G3 sound defaults changed** (23 Nov 2026): default bass cutoff 0.3 with env amount 0.45, kick now about 0.2 s, drum level and sub dials max out at the C1 trims, defaults moved up the dial. Pedro's ears judge them.
- **C4. G4 listen items** (23 Nov 2026): Layer 1 in Pad mode measures about 12 dB louder than the other modes (solo about -14 dB against -30 dB for the synth), and Layer 2 sits 10 to 16 dB under Layer 1. Levels untouched, no spec rule; Pedro's ears judge them. Pad filter now opens slowly over the pad's release when leaving Pad: listen for a smooth tail.
- **C5. G5 listen items** (23 Nov 2026): the MP3 is 160 kbps, tap Record, play, Stop, then save or share it from the take sheet and play the file back: listen for dropouts or clicks at the start and end (1.5 s tail kept). Songs live on the Play tab (the tab bar has no room). Autosave runs 0.4 s after an edit and on page hide; reload and check the song and mix return.

## By hand (Pedro)

- **H3. Hear and use the shell on the phone** (22 Nov 2026): open https://apcanario.github.io/groovebox/ and jam a whole song with one thumb; confirm whether the C1 crackle is gone. Send notes in the next starter's `Notes:` line. Now also covers the G3 tabs (Drums, Bass, Synth, Mix), the G4 layer tabs (Arp, Pad, Generative on Layer 1 and 2) and the G5 Songs sheet and recording. Open until Pedro says done.
- H1 (Pages on) and H2 (spike heard) were done on 22 Nov 2026.

## Bundle 2: drums, bass, synth, mix

All rows of this bundle are Done.

## Bundle 3: the layers

All rows of this bundle are Done.

## Bundle 4: keep it and install it

G5 is Done. G6 is parked by Pedro (23 Nov 2026): do not work it until he asks.

### G6. APK

- Capacitor Android project wrapping the built app. Portrait only, screen kept awake while playing, app icon, works offline (fonts bundled, no network needed).
- No foreground service and no background audio: spec section 2.
- A GitHub Actions workflow that builds a debug APK on each push to `main` and attaches it to a release named `latest`.
- A short `docs/INSTALL.md`: where to download the APK and how to install it.

**Done when:** the workflow produces an APK; the web build still deploys to Pages; `check` and `smoke` pass. Installing on the phone is Pedro's test.

## Bundle 5: retouch

### G7. Retouch

Runs only when the starter carries a `Notes:` line. After the MVP (G1 to G6) Pedro plays it and sends notes on the interface, the instruments and the sounds. This row works those notes and nothing else: each note is a fix, grouped by tab. Where a note changes the spec, the spec is edited in the same commit. The row reopens for every new set of notes; it is never Done.

**Done when:** every note in the `Notes:` line is either fixed or answered in the reply with the reason it was not; `check` and `smoke` pass.

## Later

Not scheduled. Each becomes a row when Pedro asks for it.

- **L1.** Advanced chord mode: 7ths, 9ths, borrowed chords, inversions.
- **L2.** Patch polish pass, driven by Pedro's notes.
- **L3.** Sampled break one-shots for drum and bass.
- **L4.** Offline re-render of the event log, in chunks.
- **L5.** Stutter and beat-repeat on the Mix tab.
- **L6.** Knob snapshots per section.
- **L7.** Morph between two saved generative patterns.

## Done

- **G0. Sound spike** (22 Nov 2026). Built, deployed and heard by Pedro: it works, with a slight treble crackle carried as C1.
- **G1. Engine** (22 Nov 2026). Built, reviewed (fix: 0 errors, 7 should-fix, 10 minor, all applied), pushed. Report in `docs/reviews/G1.md`.
- **G2. Shell** (22 Nov 2026). Built, reviewed (fix: 1 error, 5 should-fix, 5 minor, all applied), pushed. Report in `docs/reviews/G2.md`. Bundle 1 is done.
- **G3. Drums, Bass, Synth and Mix tabs** (23 Nov 2026). Built, reviewed (fix: 1 error, 2 should-fix, 9 minor, all applied), pushed. Report in `docs/reviews/G3.md`. Bundle 2 is done.
- **G4. Layer 1 and Layer 2** (23 Nov 2026). Built, reviewed (fix: 0 errors, 1 should-fix, 6 minor, 5 minor and the should-fix applied, loudness minor carried as C4 as a listen item), pushed. Report in `docs/reviews/G4.md`. Bundle 3 is done.
- **G5. Save and record** (23 Nov 2026). Built, reviewed (fix: 1 error, 2 should-fix, 8 minor, all applied; the error was a Tone oscillator leak), pushed. Report in `docs/reviews/G5.md`. Ten-minute take: valid MP3, 600.11 s for 600.01 s, heap +0.6 MB.
