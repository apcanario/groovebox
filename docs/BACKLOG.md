# Backlog

The next open bundle is the first bundle below with a row not in Done. `docs/RUN.md` says how a chat works it.

## Carried

Fixes waiting for the next chat. The first builder of the next bundle clears them.

- **C1. Treble crackle, applied, waiting for Pedro's ear.** G1 changed everything on the original list (22 Nov 2026): 4x oversampled kick drive and waveshapers, resonance capped (Q 6, level-compensated), filters top out at 10 kHz, hats and clap lower, master bus 0.5, limiter now -4 dB with 1 ms attack, compressor with 120 ms release in place of Tone.Limiter, pump ramps 4 ms, buffer default `balanced`. Pedro confirms by ear; if it still crackles, the next suspects are the 4x oversampled shapers' CPU cost and buffer underruns (`?hint=interactive` vs `balanced`).

- **C2. G3 listen items for C1** (23 Nov 2026): the bass lost its second filter (listen for crackle on a saw bass with Env amt high); the drum filter still tops at 18 kHz, not the 10 kHz of the other filters. If C1 crackle persists, these are the next suspects after buffer size.
- **C3. G3 sound defaults changed** (23 Nov 2026): default bass cutoff 0.3 with env amount 0.45, kick now about 0.2 s, drum level and sub dials max out at the C1 trims, defaults moved up the dial. Pedro's ears judge them.

## By hand (Pedro)

- **H3. Hear and use the shell on the phone** (22 Nov 2026): open https://apcanario.github.io/groovebox/ and jam a whole song with one thumb; confirm whether the C1 crackle is gone. Send notes in the next starter's `Notes:` line. Now also covers the G3 tabs (Drums, Bass, Synth, Mix). Open until Pedro says done.
- H1 (Pages on) and H2 (spike heard) were done on 22 Nov 2026.

## Bundle 2: drums, bass, synth, mix

All rows of this bundle are Done.

## Bundle 3: the layers

### G4. Layer 1 and Layer 2

- Mode switch per layer: Arp, Pad, Generative.
- **Generative:** the six knobs of spec section 3, a 16-step row showing the current pattern and the playing step, a new-seed button, and a lock that keeps the current notes when other knobs move.
- **Arp** and **Pad** controls as in spec section 3.
- Patch dials shared by the three modes (wave, envelope, drive), XY pad, sends.
- The layer screen should match `docs/design/layer1-tab.jpg` closely.

**Done when:** each mode plays in key over every chord of every mood; Lock fully right repeats the same loop for 32 bars (tested); a length of 5 or 7 audibly drifts against the bar; `check` and `smoke` pass.

## Bundle 4: keep it and install it

### G5. Save and record

- Save, load, rename and delete songs on the phone (IndexedDB). The last song reopens on launch.
- Record arm: the event log of spec section 6, saved with the song.
- MP3 export of the live output, encoded in a worker while playing; choose the encoder, record the choice and its licence in the changelog. The file is saved or shared from the phone.
- A recording indicator and elapsed time in the transport bar.

**Done when:** a song survives a reload; a ten-minute recording in headless Chrome produces a valid MP3 of the right length with memory use flat (measured and reported); `check` and `smoke` pass.

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
