# Backlog

The next open bundle is the first bundle below with a row not in Done. `docs/RUN.md` says how a chat works it.

## Carried

Fixes waiting for the next chat. The first builder of the next bundle clears them.

- None.

## By hand (Pedro)

- **H1. Turn on GitHub Pages.** Repo Settings → Pages → Source: GitHub Actions. Then re-run the failed "Deploy to GitHub Pages" run under Actions, or wait for the next push. Until this is done there is no URL to test on the phone.
- **H2. Listen to the spike** on headphones for ten minutes with every layer on. Report: crackle or not, which buffer setting (fast, balanced, safe) was clean, and anything that sounds wrong.

## Bundle 1: the instrument exists

### G1. Engine

Replace the hard-coded spike with a real engine.

- `src/engine/`: song document types and a default song; clock and step scheduler; the five instruments as basic patches; shared delay and reverb; master chain with pump and limiter (reuse what works in the spike).
- `src/music/` (no audio imports): scales and moods, chord building and voicings for easy mode, bass rhythm presets, drum presets, Euclidean rhythm, seeded random generator, the generative lead from spec section 3.
- Sections: up to four, switching on the bar line; per-section on/off per instrument; per-section chord sequence.
- Engine API as in spec section 7. Parameter changes ramp.
- Unit tests with Vitest for everything in `src/music/` and for the song schema. Add them to `npm run check`.
- Keep `window.__groovebox` with `playing`, `level()` and `setLayer()` working for the five instruments, and update `tools/smoke.py` to the new layer names.
- UI for this row: a bare test screen is enough (play, section buttons, instrument toggles).

**Done when:** a four-section default song in A minor, mood House, plays; sections switch on the bar; each instrument toggles per section; the same seed gives the same lead twice (tested); `check` and `smoke` pass.

### G2. Shell

The screens around the engine, in Preact.

- Transport bar, section strip (playing and editing states, follow by default), icon tab bar with all eight tabs.
- Play tab grid as in spec section 5, including long-press on a column header.
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

- **G0. Sound spike** (22 Nov 2026). Built and pushed. Waiting on H1 and H2.
