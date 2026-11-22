# Backlog

The next open bundle is the first bundle below with a row not in Done. `docs/RUN.md` says how a chat works it.

## Carried

Fixes waiting for the next chat. The first builder of the next bundle clears them.

- **C1. Treble crackle, applied, waiting for Pedro's ear.** G1 changed everything on the original list (22 Nov 2026): 4x oversampled kick drive and waveshapers, resonance capped (Q 6, level-compensated), filters top out at 10 kHz, hats and clap lower, master bus 0.5, limiter now -4 dB with 1 ms attack, compressor with 120 ms release in place of Tone.Limiter, pump ramps 4 ms, buffer default `balanced`. Pedro confirms by ear; if it still crackles, the next suspects are the 4x oversampled shapers' CPU cost and buffer underruns (`?hint=interactive` vs `balanced`).

## By hand (Pedro)

- None open. H1 (Pages on) and H2 (spike heard) were done on 22 Nov 2026. The app is at https://apcanario.github.io/groovebox/.

## Bundle 1: the instrument exists

### G2. Shell

The screens around the engine, in Preact.

- Transport bar, section strip (playing and editing states, follow by default), icon tab bar with all eight tabs.
- Play tab grid as in spec section 5, including long-press on a column header and the pending state for queued switches.
- Reusable `Dial` (vertical drag, large, value in the middle), `XYPad` and `SendBar` components.
- Chords tab, easy mode: mood picker, key picker, seven degree buttons, the section's sequence with add, remove and reorder.
- The other six tabs exist and show their instrument's name, on/off and an XY pad wired to its filter. Their full controls come in bundles 2 and 3.
- Screen stays awake while playing.
- Extend the smoke test: open every tab, switch section, toggle a cell in the Play grid, change a chord, with no page error.

**Done when:** a whole jam (start, switch sections, mute and unmute, change the chord sequence, sweep a filter) is possible with one thumb and no test screen; nothing on screen is smaller than 48 px; `check` and `smoke` pass.

## Bundle 2: drums, bass, synth, mix

### G3. Drums, Bass, Synth and Mix tabs

- **Drums:** the five presets; the 8-step sequencer for four drum voices; open a preset in the sequencer; per-voice level and decay; kick pitch and drive.
- **Bass:** rhythm preset picker; patch dials (wave, cutoff envelope amount, decay, drive, sub level, glide); XY pad; sends.
- **Synth:** stab rhythm presets (stabs, offbeat, sustained); patch dials (wave and detune, attack, decay, release, filter envelope, drive); XY pad; sends.
- **Mix:** filter sweep knob, pump, saturation, level per instrument, master level meter.
- Six dials per screen at most. Where an instrument needs more, use two pages inside its tab.
- Drum and bass presets must work at 170 to 176 bpm as well as 118 to 128.

**Done when:** every control named above changes the sound while playing without clicks or stuck notes; a 2-step and a drum and bass beat exist; `check` and `smoke` pass.

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
