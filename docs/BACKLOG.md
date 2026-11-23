# Backlog

The next open bundle is the first numbered bundle below with a row not in Done. `docs/RUN.md` says how a chat works it. One chat works one whole bundle; a chat that stops early is resumed with the same starter and picks up at the first row not Done.

| Bundle | Rows | What you get |
|---|---|---|
| 4 | P1, P1b, P2 | The new screens, the look, Simple and Advanced |
| 5 | P3, P4, P5, P6 | Eight vibes, Simple chords, five lead styles |
| 6 | P7, P9, P8 | New sounds, effects, all 24 vibes |
| 7 | P10, P11, G6 | The Drop, Morph, the APK (G6 was parked on 23 Nov; see its row) |
| 8 | T1, T2, T3 | Tablet layouts, punch pads |
| 9 | G7 | Retouch from notes |

## Carried

Fixes waiting for the next chat. The first builder of the next bundle clears them.

- **C1. Treble crackle, applied, waiting for Pedro's ear.** G1 changed everything on the original list (22 Nov 2026): 4x oversampled kick drive and waveshapers, resonance capped (Q 6, level-compensated), filters top out at 10 kHz, hats and clap lower, master bus 0.5, limiter now -4 dB with 1 ms attack, compressor with 120 ms release in place of Tone.Limiter, pump ramps 4 ms, buffer default `balanced`. Pedro confirms by ear; if it still crackles, the next suspects are the 4x oversampled shapers' CPU cost and buffer underruns (`?hint=interactive` vs `balanced`). G5 added (23 Nov 2026): Tone's oscillator leak (every started oscillator stayed reachable, about 4 a second) is patched in `audio.ts`; it grew memory on long jams and may have contributed to crackle, so listen on a jam of ten minutes or more.

- **C2. G3 listen items for C1** (23 Nov 2026): the bass lost its second filter (listen for crackle on a saw bass with Env amt high); the drum filter still tops at 18 kHz, not the 10 kHz of the other filters. If C1 crackle persists, these are the next suspects after buffer size.
- **C3. G3 sound defaults changed** (23 Nov 2026): default bass cutoff 0.3 with env amount 0.45, kick now about 0.2 s, drum level and sub dials max out at the C1 trims, defaults moved up the dial. Pedro's ears judge them.
- **C4. G4 listen items** (23 Nov 2026): Layer 1 in Pad mode measures about 12 dB louder than the other modes (solo about -14 dB against -30 dB for the synth), and Layer 2 sits 10 to 16 dB under Layer 1. Levels untouched, no spec rule; Pedro's ears judge them. Pad filter now opens slowly over the pad's release when leaving Pad: listen for a smooth tail.
- **C6. P1b listen item** (23 Nov 2026): the animation loop's per-frame cost on the phone was not measured (review M7); if the UI feels heavy while playing, switch Motion to Still on the Mix Audio page and say so in the notes.
- **C5. G5 listen items** (23 Nov 2026): the MP3 is 160 kbps, tap Record, play, Stop, then save or share it from the take sheet and play the file back: listen for dropouts or clicks at the start and end (1.5 s tail kept). Songs live on the Play tab (the tab bar has no room). Autosave runs 0.4 s after an edit and on page hide; reload and check the song and mix return.

## By hand (Pedro)

- **H3. Hear and use the shell on the phone** (22 Nov 2026): open https://apcanario.github.io/groovebox/ and jam a whole song with one thumb; confirm whether the C1 crackle is gone. Send notes in the next starter's `Notes:` line. Now also covers the G3 tabs (Drums, Bass, Synth, Mix), the G4 layer tabs (Arp, Pad, Generative on Layer 1 and 2) and the G5 Songs sheet and recording. Open until Pedro says done.
- H1 (Pages on) and H2 (spike heard) were done on 22 Nov 2026.

## Bundle 2: drums, bass, synth, mix

All rows of this bundle are Done.

## Bundle 3: the layers

All rows of this bundle are Done.

## Bundle 4: phase 2, the screens, the look and the two modes

Spec section 8 is the brief for bundles 4 to 7, and `docs/design/look/` shows where it is going. Read sections 8.1, 8.3, 8.6 and 8.12 in full before any row of this bundle.

### P2. Simple and Advanced

- Spec 8.1 and 8.3: the app-wide toggle in the header, remembered (P1 left the switch unremembered and doubling as the temporary Now/Song switch; this row replaces that); Simple as the first-run default.
- Simple instrument tabs: one picker and four macro dials each, as in the 8.3 table, plus the XY pad. Macro mappings as data; macro positions stored in the song.
- Advanced tabs are the tabs built in G2 to G4, re-laid to the no-scroll rule.
- Simple uses plain words only: check every visible string in Simple against 8.1. The P1b review also leaves for this row: the Simple Layer tab's macro dials, Back, the XY pad and the lane row.
- New idea and Back on both layers, with the eight-seed history, in both modes.
- Clear C4 (layer level balance) here, since the Level and Space macros expose it.

**Done when:** switching mode changes no sound (tested: the song document is identical before and after); every Simple move is visible in Advanced; each macro at minimum and maximum changes the values it maps (tested); Back restores the previous lead note for note (tested); `check` and `smoke` pass.

## Bundle 5: phase 2, vibes, chords and leads

Read spec 8.2, 8.4 and 8.5 in full before any row of this bundle.

### P3. Styles

- Spec 8.2: the style format as one data file per style under `src/styles/`, and the first eight styles, each a complete groove with four arranged sections: Deep house, Tropical house, Deep techno, Melodic techno, Drum and bass, 2-step, Lo-fi, Ambient. The other sixteen come in P8.
- The beats, bass rhythms and patches those eight need, as data, using the engine as it is.
- Bpm range 60 to 180.
- The vibe control on the Simple Play tab (spec 8.6): current vibe with an arrow each side, arrows step on the next bar, the middle opens the picker.
- The vibe picker as the opening screen: a two-column grid that fits all 24 tiles on one screen without scrolling (unbuilt styles are not shown until they exist), Continue last jam first; New jam from style in the header; loading lands on the next bar; a vibe loads as a new song, so the jam it replaces stays in Songs.
- New jam is disabled while playing since P1 (review M1); this row enables it, since a vibe loads as a new song.
- Move the existing presets (moods, drum presets, bass and synth rhythms) to data files in the same way, with pickers that list whatever exists.

**Done when:** each of the eight styles loads and plays with every instrument audible in its groove section (smoke test loops all of them); adding another style is one new file and no other change (shown by a test fixture); loading a style mid-jam lands on the bar; `check` and `smoke` pass. Whether each style sounds like its name is Pedro's call.

### P4. Simple chords

- Spec 8.4: the Simple Chords tab (feel, four cards, More chords, Lower and Higher, the vibe button) and the progression library: at least 120, tagged by feel and by the vibes they suit, at least four per feel for every one of the 24 vibes, stored as degrees with mood and voicing.
- The Advanced Chords tab is the G2 editor.
- A test walks the whole library: every progression is in its mood's scale or marked as borrowing, has 2 to 8 chords, and transposes to all twelve keys inside the instruments' ranges.

**Done when:** a progression can be chosen and changed without seeing a scale or degree name; every card plays from the next bar; the library test passes; `check` and `smoke` pass.

### P5. Lead styles

- Spec 8.5: Hook, Phrase, Roll and Drift as pure seeded generators beside Pulse, with the twelve shared knobs, varied velocity, and per-note glide and accent in the layer voice.
- Tests per style: same seed gives the same notes; always in key; Hook repeats exactly for a whole phrase when Variation is 0; Phrase ends each phrase on a chord tone and rests between phrases; Roll plays at least 12 of 16 steps with Busy at maximum; Drift's notes last at least two beats; each knob's minimum and maximum give different notes.

**Done when:** all tests above pass; the five styles produce clearly different note patterns from the same seed (shown in the review report as printed patterns); `check` and `smoke` pass.

### P6. Lead screens

- P1b kept `leadSteps` and `preview` in the engine for this row's step row; use them or remove them, and say which in the changelog.
- Advanced Layer tab: style selector, the Notes and Feel pages of six knobs, Pulse's own three knobs on a third page, the step row showing phrase bar and note lengths, New idea and Back.
- Simple Layer tab: style picker, Busy, Evolve, Bright, Space, New idea, Back.
- Each launch style of P3 gets a fitting lead style and settings on its layers.

**Done when:** every lead knob can be turned while playing with no stuck note or click; both modes fit without scrolling; `check` and `smoke` pass. Whether the leads now have enough variety is Pedro's call.

## Bundle 6: phase 2, sounds, effects and all 24 vibes

Read spec 8.7, 8.8 and 8.10 in full before any row of this bundle.

### P7. Sound additions

- Spec 8.7, engine additions: Perc and Shaker drum voices; 16-step drum presets with repeats and the 16-step switch on the Advanced sequencer; noise oscillator and two-operator FM wave; tempo-synced filter LFO; the lo-fi master option. Each switchable off. (Chorus and the other effects are P9.)
- Spec 8.10, what Ambient and Drone need: attack, release and reverb decay up to 20 seconds; chord lengths of 4 and 8 bars; the Drone layer mode, added to the mode switch in both modes; pitch glide between chords on pads and drones; the free-running slow LFO; the air layer. Rework the Ambient vibe of P3 to use them.
- Measure the cost: report the smoke test's worst stall and audio load with everything on, against the same measure before the row.

**Done when:** each addition is audible and can be turned off; nothing clicks when one is switched while playing; the voice cap holds; `check` and `smoke` pass.

### P9. Effects

- Spec 8.8: the twelve effects, two slots per instrument, tempo-synced where the table says.
- Simple: two on/off buttons per instrument tab, named after the effects in the slots; the lo-fi master as one on/off on the Mix tab.
- Advanced: the FX page per instrument (picker, on/off and three knobs per slot).
- An off slot is disconnected. Switching a slot on or off, or changing its effect, while playing makes no click.
- Give the eight vibes of P3 their two effects per instrument.
- Measure the cost with all ten slots on against all off, on the smoke test, and report it. If it is too much, apply the six-slot cap and write it into the spec.

**Done when:** every effect is audible on every instrument and can be switched mid-jam without a click (tested by level continuity); Simple needs no knob to use them; the cost is reported; `check` and `smoke` pass. Whether they are weird and fun is Pedro's call.

### P8. The other sixteen vibes and the library

- The remaining styles of spec 8.2: Progressive, Acid house, Afro house, Minimal techno, Dub techno, Drone, Breakbeat, Dubstep, Future garage, Downtempo, Synthwave, Trap, IDM, EDM, Trance, Electro.
- The full lists of spec 8.7: at least 24 beats, 14 bass rhythms, 10 synth rhythms and 8 patches per instrument, all as data, all with names of 14 characters or fewer.
- Every one of the 24 styles sets its two effects per instrument.
- Revisit the first eight styles where the new sounds serve them (Lo-fi gets the lo-fi master, Ambient the airy pads).

**Done when:** all 24 styles load and play (smoke test loops them); every list meets its count; every name fits its tile (tested); `check` and `smoke` pass. Whether each vibe sounds like its name is Pedro's call.

## Bundle 7: phase 2, the Drop and Morph, and the install

Read spec 8.9 and 8.11 in full before any row of this bundle.

### P10. The Drop

- Spec 8.9 in full: the conductor that runs build, cliffhanger and impact on the audio clock; the drop that stays on; the wind-down on a second press, landing in the same section or the one tapped during the drop; cancel during the build; the button's countdown and lit state.
- The overlay that adds the extra layers without touching the song document, with the size coming from width and added layers. No stage changes the tempo.
- The build and impact voices (noise riser, falling sweep, sub hit, noise burst, snare roll), synthesized.
- A recipe for every one of the 24 vibes, as data in its style file.
- Simple: the button on the Play tab. Advanced: the same button and the Drop page on the Mix tab.
- Measure the cost of the overlay's extra voices and stay inside the voice cap, raising it only with the measured load reported.

**Done when:** the drop's loudness is within 1 dB of the section it came from in every vibe, and its stereo width is measurably greater (both measured in the smoke test across all 24); it stays on until the second press; the wind-down lands on a bar line in the right section (tested for same and for another section); after the wind-down the song document is identical to before the first press (tested); the button's build, on and wind-down motion follows spec 8.12; the master never clips; `check` and `smoke` pass. Whether it goes BAM is Pedro's call, vibe by vibe.

### P11. Morph

- Spec 8.11: the seeded, recorded slow movement of macros, leads, pad voicings, instruments and, optionally, sections, within limits each vibe sets.
- Simple: the Morph button on the Play tab and the Speed dial on the Mix tab. Advanced: the Morph page.
- Hands win: a control moved by hand is left alone for 16 bars.
- On by default in Ambient and Drone.

**Done when:** with Morph on, ten minutes of Ambient in the smoke test never repeats a 16-bar stretch exactly and never leaves the key (tested); the same seed gives the same ten minutes twice (tested); a hand-moved control is not touched for 16 bars (tested); Morph off changes nothing; `check` and `smoke` pass. Whether it is good to coast on is Pedro's call.

### G6. APK

History, kept from the G5 chat: "G5 is Done. G6 is parked by Pedro (23 Nov 2026): do not work it until he asks." The phase 2 and 3 plan, which Pedro went through the same night, schedules it here, after P11. The bundle 7 chat works it unless the starter's `Notes:` line says to leave G6 parked.

- Capacitor Android project wrapping the built app. Portrait only, screen kept awake while playing, app icon, works offline (fonts bundled, no network needed).
- No foreground service and no background audio: spec section 2.
- A GitHub Actions workflow that builds a debug APK on each push to `main` and attaches it to a release named `latest`.
- A short `docs/INSTALL.md`: where to download the APK and how to install it.

**Done when:** the workflow produces an APK; the web build still deploys to Pages; `check` and `smoke` pass. Installing on the phone is Pedro's test.

## Bundle 8: phase 3, tablet

Spec section 9 is the brief. Read it in full, with section 8.12, before any row of this bundle.

### T1. Three layouts and the docked pads

- Spec 9.1 to 9.3: the phone, tablet portrait and tablet landscape layouts chosen by screen size; rotation mid-jam with no gap in the audio.
- Landscape: the pads half (grid as large pads, each row labelled with its instrument and what it plays, the playing section's pads showing their notes; strip as column labels; DROP and transport) and the instrument half (rail of seven, panel under it). Space is left above the grid for the punch pads of T3.
- Portrait: instrument panel on top, the dock at the bottom.
- Simple panels on both tablet layouts.
- The APK of G6: phones stay locked to portrait, tablets rotate.
- Smoke test at 800 x 1280, 1280 x 800, 1024 x 768 and 768 x 1024, both modes: nothing scrolls, nothing is cut off, text fits its tile, and a rotation while playing leaves the transport running.

**Done when:** all four sizes pass in both modes; the phone layout is unchanged (the phone smoke checks still pass); the pads and one instrument can be used without changing screen; `check` and `smoke` pass.

### T2. Advanced without pages

- Spec 9.2, the Advanced panels: every knob of an instrument visible at once on tablet landscape, and on tablet portrait where it fits.
- Drums as one grid of every voice by 16 steps; Mix as faders with meters; Chords as editor and library side by side.
- Pages remain only where a panel cannot fit at 1024 x 768, and the review report lists each such case.

**Done when:** on 1280 x 800 no Advanced panel has pages; every control is at least 48 px; `check` and `smoke` pass.

### T3. Punch pads, movement and many fingers

- Spec 9.4: the six punch pads (Cut, Filter, Stutter, Echo, Wash, Riser), each landing in time as the table says, several at once; on the phone as a page of the Mix tab. The DROP button of P10 placed beside them on both tablet layouts.
- Spec 9.5, on top of the motion of spec 8.12: pads pulse from per-instrument meters, playing step shown, moved dials animate, one animation loop with an off switch, audio first.
- Spec 9.6: multi-touch on every control, tested with simultaneous pointers (two dials; XY pad and a pad; three pads).
- Measure the cost: worst stall and audio load with animation on and off, on the smoke test, reported.

**Done when:** each punch pad starts and ends on the beat or bar the spec names (tested on the audio clock); two controls can be moved at once (tested); animation can be turned off; `check` and `smoke` pass. Whether it makes you want to jam for hours is Pedro's call.

## Bundle 9: retouch

### G7. Retouch

Runs only when the starter carries a `Notes:` line. After phases 2 and 3 and the install (P1 to P11, T1 to T3, G6) Pedro plays it and sends notes on the interface, the instruments and the sounds. This row works those notes and nothing else: each note is a fix, grouped by tab. Where a note changes the spec, the spec is edited in the same commit. The row reopens for every new set of notes; it is never Done.

**Done when:** every note in the `Notes:` line is either fixed or answered in the reply with the reason it was not; `check` and `smoke` pass.

## Later

Not scheduled. Each becomes a row when Pedro asks for it.

- **L1.** Advanced chord mode: 7ths, 9ths, borrowed chords, inversions.
- **L2.** Patch polish pass, driven by Pedro's notes.
- **L4.** Offline re-render of the event log, in chunks.
- **L6.** Knob snapshots per section.
- **L7.** Morph between two saved generative patterns.
- **L9.** Automatic transitions on a section switch (drum fill, filter drop), chosen per style.
- **L10.** A play pad: an XY surface that plays in-key notes on a layer by touch.
- **L11.** Take one part from another style (only its drums, only its chords, only its sounds).

### Later rows closed or moved by the phase 2 and 3 plan

Kept here so no row disappears without a record.

- **L3.** Sampled break one-shots for drum and bass. Dropped: Pedro decided on 22 Nov 2026 that every sound is synthesized, with no samples ever.
- **L5.** Stutter and beat-repeat on the Mix tab. Moved into T3 as the Stutter punch pad.
- **L8.** One effect slot per instrument and a lo-fi master. Moved into P9 (two slots per instrument, twelve effects) and P7 (the lo-fi master).
- **L12.** Autopilot. Moved into P11 as Morph.

## Done

- **G0. Sound spike** (22 Nov 2026). Built, deployed and heard by Pedro: it works, with a slight treble crackle carried as C1.
- **G1. Engine** (22 Nov 2026). Built, reviewed (fix: 0 errors, 7 should-fix, 10 minor, all applied), pushed. Report in `docs/reviews/G1.md`.
- **G2. Shell** (22 Nov 2026). Built, reviewed (fix: 1 error, 5 should-fix, 5 minor, all applied), pushed. Report in `docs/reviews/G2.md`. Bundle 1 is done.
- **G3. Drums, Bass, Synth and Mix tabs** (23 Nov 2026). Built, reviewed (fix: 1 error, 2 should-fix, 9 minor, all applied), pushed. Report in `docs/reviews/G3.md`. Bundle 2 is done.
- **G4. Layer 1 and Layer 2** (23 Nov 2026). Built, reviewed (fix: 0 errors, 1 should-fix, 6 minor, 5 minor and the should-fix applied, loudness minor carried as C4 as a listen item), pushed. Report in `docs/reviews/G4.md`. Bundle 3 is done.
- **G5. Save and record** (23 Nov 2026). Built, reviewed (fix: 1 error, 2 should-fix, 8 minor, all applied; the error was a Tone oscillator leak), pushed. Report in `docs/reviews/G5.md`. Ten-minute take: valid MP3, 600.11 s for 600.01 s, heap +0.6 MB.
- **P1. The frame** (23 Nov 2026). Built, reviewed (fix: 2 errors, 4 should-fix, 5 minor, all applied except M1 and M2, which belong to P3 and P2 and stay in those rows), pushed. Report in `docs/reviews/P1.md`.
- **P1b. The look** (23 Nov 2026). Built, reviewed (fix: 1 error, 4 should-fix, 11 minor, all applied), pushed. Report in `docs/reviews/P1b.md`. Whether it has the wow is Pedro's call.
