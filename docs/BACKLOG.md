# Backlog

The next open bundle is the first bundle below with a row not in Done. `docs/RUN.md` says how a chat works it.

## Carried

Fixes waiting for the next chat. The first builder of the next bundle clears them.

- **C1. Treble crackle, applied, waiting for Pedro's ear.** G1 changed everything on the original list (22 Nov 2026): 4x oversampled kick drive and waveshapers, resonance capped (Q 6, level-compensated), filters top out at 10 kHz, hats and clap lower, master bus 0.5, limiter now -4 dB with 1 ms attack, compressor with 120 ms release in place of Tone.Limiter, pump ramps 4 ms, buffer default `balanced`. Pedro confirms by ear; if it still crackles, the next suspects are the 4x oversampled shapers' CPU cost and buffer underruns (`?hint=interactive` vs `balanced`).

- **C2. G3 listen items for C1** (23 Nov 2026): the bass lost its second filter (listen for crackle on a saw bass with Env amt high); the drum filter still tops at 18 kHz, not the 10 kHz of the other filters. If C1 crackle persists, these are the next suspects after buffer size.
- **C3. G3 sound defaults changed** (23 Nov 2026): default bass cutoff 0.3 with env amount 0.45, kick now about 0.2 s, drum level and sub dials max out at the C1 trims, defaults moved up the dial. Pedro's ears judge them.
- **C4. G4 listen items** (23 Nov 2026): Layer 1 in Pad mode measures about 12 dB louder than the other modes (solo about -14 dB against -30 dB for the synth), and Layer 2 sits 10 to 16 dB under Layer 1. Levels untouched, no spec rule; Pedro's ears judge them. Pad filter now opens slowly over the pad's release when leaving Pad: listen for a smooth tail.

## By hand (Pedro)

- **H3. Hear and use the shell on the phone** (22 Nov 2026): open https://apcanario.github.io/groovebox/ and jam a whole song with one thumb; confirm whether the C1 crackle is gone. Send notes in the next starter's `Notes:` line. Now also covers the G3 tabs (Drums, Bass, Synth, Mix) and the G4 layer tabs (Arp, Pad, Generative on Layer 1 and 2). Open until Pedro says done.
- H1 (Pages on) and H2 (spike heard) were done on 22 Nov 2026.

## Bundle 2: drums, bass, synth, mix

All rows of this bundle are Done.

## Bundle 3: the layers

All rows of this bundle are Done.

## Bundle 4: phase 2, the screens

Spec section 8 is the brief for bundles 4 to 6. Read it in full before any row.

### P1. One row of sections, no scrolling, the Now view

- Spec 8.6 in full: no vertical scrolling on any tab at 360 x 640 and up, pages with large chips where a tab needs more room, lists as the only scrolling areas.
- One section strip everywhere; the Play grid's header is the strip. Tap always means play next bar; "Edit without playing" by hold, kept for Advanced.
- The three section states with their looks and words, and the four-dot bar indicator.
- The Simple Play tab ("Now"): four section buttons, five instrument buttons, hold to open a tab, and room kept under them for the vibe row that P3 adds. The grid stays as the Advanced Play tab.
- The last jam survives a reload.
- Until P2 lands the mode toggle, a temporary switch on the Play tab chooses Now or Song.
- Smoke test: at 360 x 640 and 412 x 915, on every tab and page, the document does not scroll and no control is cut off.

**Done when:** no tab scrolls at either size (tested); there is one row of sections on every screen; a section tap means the same thing everywhere; the Now view runs a whole jam; a reload brings the jam back; `check` and `smoke` pass.

### P2. Simple and Advanced

- Spec 8.1 and 8.3: the app-wide toggle in the transport bar, remembered; Simple as the first-run default.
- Simple instrument tabs: one picker and four macro dials each, as in the 8.3 table, plus the XY pad. Macro mappings as data; macro positions stored in the song.
- Advanced tabs are the tabs built in G2 to G4, re-laid to the no-scroll rule.
- Simple uses plain words only: check every visible string in Simple against 8.1.
- New idea and Back on both layers, with the eight-seed history, in both modes.
- Clear C4 (layer level balance) here, since the Level and Space macros expose it.

**Done when:** switching mode changes no sound (tested: the song document is identical before and after); every Simple move is visible in Advanced; each macro at minimum and maximum changes the values it maps (tested); Back restores the previous lead note for note (tested); `check` and `smoke` pass.

## Bundle 5: phase 2, styles and chords

### P3. Styles

- Spec 8.2: the style format as one data file per style under `src/styles/`, and the ten launch styles, each a complete groove with four arranged sections.
- New synthesized drum beats, bass rhythms and patches as the styles need them (Lo-fi swung beat, broken IDM beat, EDM, Tropical house, a near-empty Ambient kit). All as data.
- Bpm range 60 to 180.
- The vibe row on the Simple Play tab (spec 8.6): style chips in a sideways-scrolling row, current one lit, tap loads on the next bar.
- The style picker as the opening screen, with Continue last jam first; New jam from style in the transport bar; loading lands on the next bar; Previous jam kept.
- Move the existing presets (moods, drum presets, bass and synth rhythms) to data files in the same way, with pickers that list whatever exists.

**Done when:** each of the ten styles loads and plays with every instrument audible in its groove section (smoke test loops all ten); adding an eleventh style is one new file and no other change (shown by a test fixture); loading a style mid-jam lands on the bar; `check` and `smoke` pass. Whether each style sounds like its name is Pedro's call.

### P4. Simple chords

- Spec 8.4: the Simple Chords tab (style, feel, progression cards, Higher / Lower) and the progression library, at least six per style and 60 in all, tagged by feel, stored as degrees with mood and voicing.
- The Advanced Chords tab is the G2 editor.
- A test walks the whole library: every progression is in its mood's scale or marked as borrowing, has 2 to 8 chords, and transposes to all twelve keys inside the instruments' ranges.

**Done when:** a progression can be chosen and changed without seeing a scale or degree name; every card plays from the next bar; the library test passes; `check` and `smoke` pass.

## Bundle 6: phase 2, the leads

### P5. Lead styles

- Spec 8.5: Hook, Phrase, Roll and Drift as pure seeded generators beside Pulse, with the twelve shared knobs, varied velocity, and per-note glide and accent in the layer voice.
- Tests per style: same seed gives the same notes; always in key; Hook repeats exactly for a whole phrase when Variation is 0; Phrase ends each phrase on a chord tone and rests between phrases; Roll plays at least 12 of 16 steps with Busy at maximum; Drift's notes last at least two beats; each knob's minimum and maximum give different notes.

**Done when:** all tests above pass; the five styles produce clearly different note patterns from the same seed (shown in the review report as printed patterns); `check` and `smoke` pass.

### P6. Lead screens

- Advanced Layer tab: style selector, the Notes and Feel pages of six knobs, Pulse's own three knobs on a third page, the step row showing phrase bar and note lengths, New idea and Back.
- Simple Layer tab: style picker, Busy, Evolve, Bright, Space, New idea, Back.
- Each launch style of P3 gets a fitting lead style and settings on its layers.

**Done when:** every lead knob can be turned while playing with no stuck note or click; both modes fit without scrolling; `check` and `smoke` pass. Whether the leads now have enough variety is Pedro's call.

## Bundle 7: keep it and install it

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

## Bundle 8: retouch

### G7. Retouch

Runs only when the starter carries a `Notes:` line. After phase 2 and the install (P1 to P6, G5, G6) Pedro plays it and sends notes on the interface, the instruments and the sounds. This row works those notes and nothing else: each note is a fix, grouped by tab. Where a note changes the spec, the spec is edited in the same commit. The row reopens for every new set of notes; it is never Done.

**Done when:** every note in the `Notes:` line is either fixed or answered in the reply with the reason it was not; `check` and `smoke` pass.

## Later

Not scheduled. Each becomes a row when Pedro asks for it.

- **L1.** Advanced chord mode: 7ths, 9ths, borrowed chords, inversions.
- **L2.** Patch polish pass, driven by Pedro's notes.
- **L4.** Offline re-render of the event log, in chunks.
- **L5.** Stutter and beat-repeat on the Mix tab.
- **L6.** Knob snapshots per section.
- **L7.** Morph between two saved generative patterns.
- **L8.** One effect slot per instrument (chorus, phaser, bit-crush, tape wobble) and a lo-fi master option (crush, wobble, noise layer), all synthesized.
- **L9.** Transitions on a section switch: drum fill, riser, filter drop, chosen per style.
- **L10.** A play pad: an XY surface that plays in-key notes on a layer by touch.
- **L11.** Take one part from another style (only its drums, only its chords, only its sounds).

## Done

- **G0. Sound spike** (22 Nov 2026). Built, deployed and heard by Pedro: it works, with a slight treble crackle carried as C1.
- **G1. Engine** (22 Nov 2026). Built, reviewed (fix: 0 errors, 7 should-fix, 10 minor, all applied), pushed. Report in `docs/reviews/G1.md`.
- **G2. Shell** (22 Nov 2026). Built, reviewed (fix: 1 error, 5 should-fix, 5 minor, all applied), pushed. Report in `docs/reviews/G2.md`. Bundle 1 is done.
- **G3. Drums, Bass, Synth and Mix tabs** (23 Nov 2026). Built, reviewed (fix: 1 error, 2 should-fix, 9 minor, all applied), pushed. Report in `docs/reviews/G3.md`. Bundle 2 is done.
- **G4. Layer 1 and Layer 2** (23 Nov 2026). Built, reviewed (fix: 0 errors, 1 should-fix, 6 minor, 5 minor and the should-fix applied, loudness minor carried as C4 as a listen item), pushed. Report in `docs/reviews/G4.md`. Bundle 3 is done.
