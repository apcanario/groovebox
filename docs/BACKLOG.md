# Backlog

The next open bundle is the first numbered bundle below with a row not in Done. `docs/RUN.md` says how a chat works it. One chat works one whole bundle; a chat that stops early is resumed with the same starter and picks up at the first row not Done.

| Bundle | Rows | What you get |
|---|---|---|
| 4 | P1, P1b, P2 (Done) | The new screens, the look, Simple and Advanced |
| 5 | P3, P4, P5, P6 (Done) | Eight vibes, Simple chords, five lead styles |
| 6 | P7, P9, P8 (Done) | New sounds, effects, all 24 vibes |
| 7 | P10 (Done), P11 | The Drop, Morph |
| 8 | T1, T2, T3 | Tablet layouts, punch pads |
| 9 | G6 | The APK (parked by Pedro until after the tablet bundle, 24 Nov 2026) |
| 10 | G7 | Retouch from notes |

## Carried

Fixes waiting for the next chat. The first builder of the next bundle clears them.

- **C1. Treble crackle, applied, waiting for Pedro's ear.** G1 changed everything on the original list (22 Nov 2026): 4x oversampled kick drive and waveshapers, resonance capped (Q 6, level-compensated), filters top out at 10 kHz, hats and clap lower, master bus 0.5, limiter now -4 dB with 1 ms attack, compressor with 120 ms release in place of Tone.Limiter, pump ramps 4 ms, buffer default `balanced`. Pedro confirms by ear; if it still crackles, the next suspects are the 4x oversampled shapers' CPU cost and buffer underruns (`?hint=interactive` vs `balanced`). G5 added (23 Nov 2026): Tone's oscillator leak (every started oscillator stayed reachable, about 4 a second) is patched in `audio.ts`; it grew memory on long jams and may have contributed to crackle, so listen on a jam of ten minutes or more.

- **C2. G3 listen items for C1** (23 Nov 2026): the bass lost its second filter (listen for crackle on a saw bass with Env amt high); the drum filter still tops at 18 kHz, not the 10 kHz of the other filters. If C1 crackle persists, these are the next suspects after buffer size.
- **C3. G3 sound defaults changed** (23 Nov 2026): default bass cutoff 0.3 with env amount 0.45, kick now about 0.2 s, drum level and sub dials max out at the C1 trims, defaults moved up the dial. Pedro's ears judge them.
- **C7. Bundle 4 listen item** (23 Nov 2026): the drum lane is about 32 px high at 640 px screen height (recorded choice); say in the notes if it is hard to read.
- **C6. P1b listen item** (23 Nov 2026): the animation loop's per-frame cost on the phone was not measured (review M7); if the UI feels heavy while playing, switch Motion to Still on the Mix Audio page and say so in the notes.
- **C5. G5 listen items** (23 Nov 2026): the MP3 is 160 kbps, tap Record, play, Stop, then save or share it from the take sheet and play the file back: listen for dropouts or clicks at the start and end (1.5 s tail kept). Songs live on the Play tab (the tab bar has no room). Autosave runs 0.4 s after an edit and on page hide; reload and check the song and mix return.
- **C11. P5 listen items** (23 Nov 2026): Drift is sparse after the review fix (4 notes in 8 bars at seed 1234, whole bars of silence), say in the notes if it is too sparse; an accent brightens every sounding note of the layer, a lead-is-monophonic approximation (review M3); Pulse slides do not hold the previous note over the next as the other styles do.
- **C12. P6 review S1, not fixable at 360 x 640** (23 Nov 2026): the Advanced lane stays beside Back and New idea (171 px wide, up from about 135) on short screens; a full-width lane needs about 44 px more height than the dial rows free. Full width at 412 x 915. A fix needs a layout change (spec 8.6); T1 or G7 revisits it.
- **C13. P6 listen item** (23 Nov 2026): the continuity check cannot reliably catch small clicks from knob turns or style switches; and a steady Drift sound (long notes, Busy 0.9) shows jumps of 0.43 of its peak on a sine in the worklet, cause unexplained (voice stealing is one candidate). Listen on Drift for clicks and say so in the notes.
- **C14. P7 listen items** (24 Nov 2026): the 20 s reverb decay is a 3.2 s impulse plus a feedback tail (a full 20 s impulse took load to about 93%); say in the notes if the tail sounds wrong, and that the default reverb tail is now measurably longer in every vibe (review S1, fixed to match the old tail by default). Drift pans the sound rather than widening it, because the voices are mono (review M3); the Drone mode and Swoop glide, the air layer and the lo-fi master need Pedro's ears. On short screens the mode icons hide under 400 px so "Drone" draws at full size (review M8).
- **C19. P8 listen items** (24 Nov 2026): from G5 to P9 a short note's ended oscillator could cut the next note to 0 Hz (the G5 leak patch disconnected an oscillator's frequency and detune signals from every oscillator; fixed in P8, `src/engine/oscPatch.ts`, unit test and smoke check that fail on the old patch), so short notes dropped pitch since G5: re-hear C1, C11 and C13 on this build, and re-run C13's 0.43 measurement on Drift. Whether each of the 24 vibes sounds like its name is Pedro's ear; sound changed in Trance (F# minor, offbeat bass, Saw lead arp, Gate), Drone (8 bars per chord, closed organ synth), Acid house (new beat) and Progressive (new hits) in the review fixes. Ambient into Drone is the only transition above 71% load (71.5%, fresh page); the phone itself is unmeasured. `tools/cost.py vibes` now measures each vibe on a fresh page.
- **C20. P10 listen items** (25 Nov 2026): whether each vibe's drop goes BAM is your ear, vibe by vibe; the balance of the extra layers; whether the level follower (it lifts the drop by up to 2 dB to make up the deeper pump, only up to the section's level; it reads only the loop places heard before the build) is heard moving in the first bar after the impact, and above all whether Ambient and Drone hold steady through the eight bars (they sagged and climbed before the fix); the Filter knob's value is kept during a drop and applied when it ends; taps during the build or the drop wait until the wind-down ends; a press during the wind-down does nothing. Measured: drop within 0.18 dB of the section in all 24 vibes (no single bar more than 1.95 dB off, Ambient), at least 1.23 times wider, highest peak -0.7 dBFS; on the heaviest scene, measured before the drop-level fix (everything on plus the six heaviest effects) load 61.1% to 66.2%, worst stall 12.7 to 17.5 ms, at most 35 of the overlay's own 48 voices; the phone is unmeasured. Two things were not settled: a rare Tone error (a drum hit landing on its own stop) had been hidden by a 0.2 ms retry, the retry is removed, the cause was not found, and any throw now fails the smoke run with its stack; and the P9 knob-turn click check failed once in about 24 full smoke runs (Ring, Follow, layer 1, jump 3.6 times the steady sound) and could not be reproduced (0 of 10 runs on the base commit, 0 of 22 on this build), so the check now turns a clicking knob again up to three times and fails only if every turn clicks: that can hide a click that happens on one turn in three, so listen to Ring's Follow turned from low to high.

## By hand (Pedro)

- **H3. Hear and use the shell on the phone** (22 Nov 2026): open https://apcanario.github.io/groovebox/ and jam a whole song with one thumb; confirm whether the C1 crackle is gone. Send notes in the next starter's `Notes:` line. Now also covers the G3 tabs (Drums, Bass, Synth, Mix), the G4 layer tabs (Arp, Pad, Generative on Layer 1 and 2) and the G5 Songs sheet and recording. Open until Pedro says done.
- H1 (Pages on) and H2 (spike heard) were done on 22 Nov 2026.

## Bundle 2: drums, bass, synth, mix

All rows of this bundle are Done.

## Bundle 3: the layers

All rows of this bundle are Done.

## Bundle 4: phase 2, the screens, the look and the two modes

All rows of this bundle are Done. The player's check of the bundle is in `docs/reviews/bundle-4.md`.


## Bundle 5: phase 2, vibes, chords and leads

All rows of this bundle are Done. The player's check of the bundle is in `docs/reviews/bundle-5.md`.

## Bundle 6: phase 2, sounds, effects and all 24 vibes

All rows of this bundle are Done. The player's check of the bundle is in `docs/reviews/bundle-6.md`.

## Bundle 7: phase 2, the Drop and Morph

Read spec 8.9 and 8.11 in full before any row of this bundle.

### P10. The Drop

Done (25 Nov 2026), see Done below. Its text left the queue.

### P11. Morph

- Spec 8.11: the seeded, recorded slow movement of macros, leads, pad voicings, instruments and, optionally, sections, within limits each vibe sets.
- Simple: the Morph button on the Play tab and the Speed dial on the Mix tab. Advanced: the Morph page.
- Hands win: a control moved by hand is left alone for 16 bars.
- On by default in Ambient and Drone.

**Done when:** with Morph on, ten minutes of Ambient in the smoke test never repeats a 16-bar stretch exactly and never leaves the key (tested); the same seed gives the same ten minutes twice (tested); a hand-moved control is not touched for 16 bars (tested); Morph off changes nothing; `check` and `smoke` pass. Whether it is good to coast on is Pedro's call.

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

## Bundle 9: the install

### G6. APK

History, kept from the G5 chat: "G5 is Done. G6 is parked by Pedro (23 Nov 2026): do not work it until he asks." Pedro moved it on 24 Nov 2026: G6 waits until after the tablet bundle (bundle 8) and is bundle 9; the chat that works bundle 9 starts it, and a `Notes:` line can park it again.

- Capacitor Android project wrapping the built app. Portrait only, screen kept awake while playing, app icon, works offline (fonts bundled, no network needed).
- No foreground service and no background audio: spec section 2.
- A GitHub Actions workflow that builds a debug APK on each push to `main` and attaches it to a release named `latest`.
- A short `docs/INSTALL.md`: where to download the APK and how to install it.

**Done when:** the workflow produces an APK; the web build still deploys to Pages; `check` and `smoke` pass. Installing on the phone is Pedro's test.

## Bundle 10: retouch

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
- **P2. Simple and Advanced** (23 Nov 2026). Built, reviewed (fix: 2 errors, 4 should-fix, 8 minor, all applied except Busy silent in Pad and bass Punch without drive, kept as choices), pushed. Report in `docs/reviews/P2.md`. C4 cleared. Bundle 4 is done.
- **P3. Styles** (23 Nov 2026). Built, reviewed (fix: 1 error, 2 should-fix, 8 minor, all applied; the error was a vibe's sounds and mix landing 0.1 s before the bar line), pushed. Report in `docs/reviews/P3.md`.
- **P4. Simple chords** (23 Nov 2026). Built, reviewed (fix: 0 errors, 5 should-fix, 6 minor, all applied except M2, carried as C10 for P8), pushed. Report in `docs/reviews/P4.md`.
- **P5. Lead styles** (23 Nov 2026). Built, reviewed (fix: 1 error, 3 should-fix, 5 minor, all applied), pushed. Report in `docs/reviews/P5.md`, printed patterns in `docs/reviews/P5-patterns.md`.
- **P6. Lead screens** (23 Nov 2026). Built, reviewed (fix: 0 errors, 3 should-fix, 7 minor, all applied except S1, carried as C12, and S2 applied in part, see C13), pushed. Report in `docs/reviews/P6.md`.
- **P7. Sound additions** (24 Nov 2026). Built, reviewed (fix: 2 errors, 5 should-fix, 9 minor, all applied; the errors were a drone or pad going silent after two wave or patch changes, and the Tail dial stacking a reverb per move). Report in `docs/reviews/P7.md`. C8 cleared. Cost with everything on: about 55% load before, about 59% after (median of 5), worst stall 13.6 ms before and 18.9 ms after.
- **P9. Effects** (24 Nov 2026). Built, reviewed (fix: 3 errors, 4 should-fix, 10 minor, all applied; the errors were Crush and Shifter processors never stopping, and click checks too weak to prove no click). Report in `docs/reviews/P9.md`. Six-slot active cap applied on measured cost.
- **P8. Sixteen more vibes and the full lists** (24 Nov 2026). Built, reviewed (fix: 1 error, 7 should-fix, 6 minor, all applied; the error was 1- and 2-bar chord cards padding Drone and Ambient against spec 8.10). Report in `docs/reviews/P8.md`, fix log in `docs/reviews/P8-fix-progress.md`. C9, C10 and C18 cleared.
- **P10. The Drop** (25 Nov 2026). Built, reviewed (fix: 1 error, 10 should-fix, 7 minor, all applied; the error was the Filter knob doing nothing while the drop is on). Report in `docs/reviews/P10.md`. Conductor and overlay in `src/engine/drop.ts` with its own 48-voice cap, a recipe in each of the 24 style files, DROP on the Play tab in both modes and the Drop page on the Advanced Mix tab.
