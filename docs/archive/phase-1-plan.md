# Phase 1 plan (archive)

The plan the first version was built from, written on 22 Nov 2026 and kept here as a record. It was first published as a page ("Groovebox Build Plan"); that page was later rewritten for phases 2 and 3, so this file restates the phase 1 content. The live rules are in `docs/SPEC.md` sections 1 to 7.

## The idea

A groovebox to jam on a phone: pick chords, shape synths, switch sections, mute and unmute layers, turn knobs while it plays. A web app first, tested on the phone after every step, then wrapped into an APK.

## Stack

| Part | Choice |
|---|---|
| App | TypeScript and Vite, one web app. The APK is the same code in a wrapper. |
| Audio | Tone.js for the clock, synths and effects, behind the app's own engine layer. |
| UI | Preact, with the app's own dial and XY-pad components. |
| Song | One JSON document: mood, bpm, each instrument's patch, each section's patterns. Every random pattern comes from a stored seed. |
| Record | An event log of every knob, mute and section change, timed in beats. MP3 by capturing the master output while playing. |
| Test | GitHub Pages: each push gives a URL to open on the phone. |
| APK | Capacitor, built by GitHub Actions. |

## Risks named at the start

1. **Sound on the phone:** four synth layers, drums and effects might crackle. Tested by the sound spike.
2. **Long MP3 exports:** rendering an event log offline holds the whole mix in memory, about 1.3 GB for an hour of stereo. So export records the live output and encodes as it goes; the event log is the editable save file.
3. **Screen-off playback** was a third risk and was dropped: Pedro does not need it. The screen stays awake while playing.

## Steps

| Step | Row | What | Outcome |
|---|---|---|---|
| 0 | G0 | Sound spike: one page with kick, hats, clap, bass, chord stabs, pad, lead, sends, pump, limiter. | Done 22 Nov 2026. Worked on Pedro's phone, with a slight treble crackle that later rows treated. |
| 1 | G1 | Engine: song document, clock, sections switching on the bar line, five instruments, seeded randomness. | Done 22 Nov 2026. |
| 2 | G2 | Shell: transport bar, section strip, tab bar, Play grid, dial and XY-pad components, Chords tab. | Done 22 Nov 2026. |
| 3 | G3, G4 | Instruments: Drums, Bass, Synth and Mix tabs; Layer 1 and Layer 2 with Arp, Pad and Generative modes. | Done 23 Nov 2026. |
| 4 | G5 | Save and record: songs kept on the phone, record, MP3 export. | Done 23 Nov 2026, while phase 2 was being planned. |
| 5 | G6 | APK. | Moved to after phase 2. |

## Decisions made along the way

- **Switches land on the next bar line.** A section switch or an instrument turned on or off never takes effect immediately, so several tapped within a bar land together.
- **No samples.** Every sound is synthesized.
- **Presets as data.** New beats, rhythms, patches and progressions should need no engine or UI code.
- **Sonnet chats with Opus agents** build each row; Fable chats only design. See `docs/RUN.md`.

## What Pedro said after playing it

Chords and pads sound great. The lead lacks variety. Chords still feel like an advanced mode. Scrolling is hard because the screen is all controls. The Play tab's two rows of sections are confusing. That feedback became phase 2 (`docs/SPEC.md` section 8) and phase 3 (section 9).
