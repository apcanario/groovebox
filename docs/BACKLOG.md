# Backlog

The next open bundle is the first numbered bundle below with a row not in Done. `docs/RUN.md` says how a chat works it. One chat works one whole bundle; a chat that stops early is resumed with the same starter and picks up at the first row not Done.

| Bundle | Rows | What you get |
|---|---|---|
| 4 | P1, P1b, P2 (Done) | The new screens, the look, Simple and Advanced |
| 5 | P3, P4, P5, P6 (Done) | Eight vibes, Simple chords, five lead styles |
| 6 | P7, P9, P8 (Done) | New sounds, effects, all 24 vibes |
| 7 | P10 (Done), P11 (Done) | The Drop, Morph |
| 7b | R1, P10b, P10c, P10d, player pass (Done) | A leaner build cycle, the drop's wind-down (C21), the bundle 7 player findings (C23), two live-build bugs from Pedro (play button, DROP and Morph position) |
| 8 | T1 (Done), T2 (Done), T3 (Done) | Tablet layouts, punch pads |
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
- **C20. P10 listen items** (25 Nov 2026): whether each vibe's drop goes BAM is your ear, vibe by vibe; the balance of the extra layers; whether the level follower (it lifts the drop by up to 2 dB to make up the deeper pump, only up to the section's level; it reads only the loop places heard before the build) is heard moving in the first bar after the impact, and above all whether Ambient and Drone hold steady through the eight bars (they sagged and climbed before the fix); the Filter knob's value is kept during a drop and applied when it ends; taps during the build or the drop wait until the wind-down ends; a press during the wind-down does nothing. Measured: drop within 0.18 dB of the section in all 24 vibes (no single bar more than 1.95 dB off, Ambient), at least 1.23 times wider, highest peak -0.7 dBFS; on the heaviest scene, measured before the drop-level fix (everything on plus the six heaviest effects) load 61.1% to 66.2%, worst stall 12.7 to 17.5 ms, at most 35 of the overlay's own 48 voices; the phone is unmeasured. Two things were not settled: a rare Tone error (a drum hit landing on its own stop) had been hidden by a 0.2 ms retry, the retry is removed, the cause was not found, and any throw now fails the smoke run with its stack; and the P9 knob-turn click check failed once in about 24 full smoke runs (Ring, Follow, layer 1, jump 3.6 times the steady sound) and could not be reproduced (0 of 10 runs on the base commit, 0 of 22 on this build), so the check now turns a clicking knob again up to three times and fails only if every turn clicks: that can hide a click that happens on one turn in three, so listen to Ring's Follow turned from low to high. A third thing was not settled: after the final drop-level fix the fixer's second probe run, the first in a fresh browser, read DubTechno -4.07 dB and Drone -3.79 dB with Ambient's section 9 dB quiet and wide, which looks like the bass lost again (the sub-sine cancellation by another path); one clean probe run and the full smoke passed, three clean runs in a row were not reached, so if a vibe's bass drops out after switching vibes, that is this. Drone's gain settles at 0.75 (-2.5 dB), a slow fade mid-drop: listen to it.
- **C22. P11 Morph listen items and changed checks** (25 Nov 2026): whether Morph is good to coast on is your ear: Ambient and Drone with Morph on for ten minutes or more, the instrument dropouts (one instrument out for a phrase, then back), the Voicing dial on the Pad page, Morph's own speed; the other vibes start with Morph off and only Ambient and Drone have their own limits; section moves are built but off. For your veto: by the notes alone, ten minutes of Ambient (160 bars) repeat 12 sixteen-bar stretches with 36 distinct bars, and Drone (150 bars) repeats 10 with 17 distinct bars; the no-repeat check passes only counting every value Morph moves (0 repeats). A notes-alone pass would need Morph to voice or drop instruments more often, which changes the music, so it was not done. Changed checks, no threshold changed: the hands-win reading in `tools/morphcheck.py` (the first version measured wrongly); the core Pad to Arp read in `tools/smoke.py` now measures again from Pad, up to two more times, only when the move was first seen more than 15 ms ahead (a stalled page thread), so a stall no longer fails it (core's timing checks also failed once each in two lone runs, a section long-press, synth detune and a layer 1 accent click, and passed in the full run; read as flakes under load); the Pad page check counts 6 dials (was 5); the drop check in `morphcheck.py` allows only give-backs on the first held bar.

- **C24. The rubber-bass level jump: mostly gone since C27's fix, cause of the rest measured, fix deferred** (26 Nov 2026, found in P10b; Pedro's decision at 00:44 on 26 Nov: fix after the MVP and the APK). Bundle 7b player probe (`docs/reviews/bundle-7b.md`, E1), Minimal Techno, IDM, EDM, Electro, Progressive and Drum and bass, four reps each, a drop each: before `42d9aad` 8 of 24 runs failed a level line, after it 1 of 24 (EDM: the section 2 dB down and wider, +2.3 dB after the wind-down); both full smokes of the player passed drop-5 and drop-6. Cause of the rest: the bass's wave and sub start at one time 50 ms ahead (`LATE_LEAD`), but on a stalled main thread Tone builds each native oscillator inside `start` (9 ms for the wave, 20 ms for the sub in the logged case), so the sub's start reached the audio thread late; legato keeps the offset and the sine sub cancels the square's fundamental (wave/sub correlation 0.86 to between 0.66 and -0.77, master 0.5 to 1.5 dB down, until a gap in the bass). Fix to make (changes how the bass is built, so it must be heard again): run the bass's two oscillators for the life of their voice set, started together once while the set is silent and gated only by their envelopes, or build the sub from the wave's own oscillator; a larger `LATE_LEAD` only moves the margin. Until then drop-5 and drop-6 can fail now and then. No threshold was loosened.

- **C25. P10b listen items and carried findings** (26 Nov 2026): whether the wind-down feels like a calm-down that mirrors the build is your ear, vibe by vibe (listen for a bar that still jumps, and Ambient and Drone, where it is slowest). Carried: in Ambient and Drone the extra layers read -120 dB in the last wind-down bar while about three voices are still counted (cause not found, the voices fall to zero on the next bar line); the after-end width check has a Morph exception (judged only when Morph did not move in the bars read); the cost part's Tail-dial load reading failed once after R1 and once after P10b (70.7% to 86.1%, 64.8% to 83.1%) and passed on rerun both times, intermittent, no threshold changed.

- **C28. P10d carried** (26 Nov 2026, `docs/reviews/P10d.md`): Tone's Draw drops callbacks later than 0.25 s, so a position update can be skipped on a slow phone; the vibe pick in `src/ui/vibes.tsx:40` still checks `engine.playing` (harmless); on a first tap the button dims for about a second while audio starts (intended). Pedro's exact symptom (Play after a tap while the music plays) did not reproduce on the old build in 12 headless scenarios; what reproduced was Play shown for 6 to 7 frames after a first tap and Stop stuck after a Stop, both fixed. Check by hand on the phone.
- **C30. Bundle 7b player** (26 Nov 2026, `docs/reviews/bundle-7b.md`). For your veto: every six-chip page row (Advanced Drums, a Lead's pages, the layer pages at 412 px) and the five-chip rows under 400 px of width (Bass, Layer Arp, Pad and Drone) now set the icon over the word at 12 px, as the Mix row does, so no label runs to the chip's edge (C26, checked by `PAGE_CHIPS` in `tools/shots.py`). Listen: Ambient's first chord of its 16-bar loop measures 2 dB under the next three (the same in every load, -18.7 to -15.6 dB), Drone steps down 1.2 dB at its chord change; no dropout, click or bass cancellation was measured in either. The rubber vibes' peaks sit 0.0 to 0.2 dB higher since C27's fix (top -0.66 dBFS, limit -0.5; the C29 one-offs did not come back in 48 probe drops and two full smokes). C26, C27 and C29 are closed.
- **C31. T1 carried and choices for your veto** (27 Nov 2026, `docs/reviews/T1.md`): the layout is chosen by fit (the dock from 960 px tall and taller than wide, the desk from 800 px wide; a screen under 600 px on its short side is a phone, so a phone held sideways stays a phone); the desk's pad grid shows in Simple too, every pad tappable, which goes past spec 8.6's Advanced-only rule for editing a section that is not playing; the portrait rail is seven tabs with no Play tab, because the pads are always on screen; DROP with Morph sits over the transport under 960 px wide (spec 9.2 edited); tablets under 800 px wide and under 960 px tall (700 x 700, say) still get the portrait dock, which does not fit (spec 9.1 names it); Simple Mix keeps four pages on a tablet without the height; every Advanced panel still has its pages until T2; the 56 px band for the punch pads is empty until T3; the pad pulse from per-instrument meters (spec 9.5) is T3's; the core smoke part now takes about 20 minutes (the tablet walk over 10 sizes); the reviewer's phone DOM comparison against 88b7227 was made before the fixes and not repeated, the phone smoke checks pass.
- **C32. T2 carried and choices for your veto** (27 Nov 2026, `docs/reviews/T2.md`): whole or paged follows the screen size only, measured at each panel's worst case with 8 px to spare, never the jam's content, so a panel never flips while you play. Whole panels: 1280 x 800 all seven; 1024 x 768 Chords and Mix; 800 x 1280 Chords, Bass, Synth and Mix; 768 x 1024, 600 x 960 and 880 x 620 none. Pages stay where the measured need exceeds the room (the review report lists each with need against room): Drums, Bass, Synth and both layers at 1024 x 768; at 800 x 1280 the layers in every mode (a lead does not fit); at 768 x 1024 Chords always (it fitted only up to 4 chords). Drums keeps two rows of eight steps per voice, not one row of 16 (798 px needed, 649 px available), so the review's "one grid of 16" is not met. The Space help note is left out of the whole Mix. Mix meters are drawn by the one motion loop, only the meters, about 15 times a second, empty under Still. Veto any of these.
- **C33. T3 carried and choices for your veto** (27 Nov 2026, `docs/reviews/T3.md`, `docs/reviews/T3-measure.md`). Where spec 9.4 is silent: a pad is fully in on its start line and fully out on its end line. Cut, Filter and Riser start on the next sixteenth, Stutter on the next half beat, Echo and Wash on the next beat and close one bar later (a second tap pushes the close on). Cut ends on the next bar line after release, Filter and Stutter on the next beat after release; Riser falls away from the next sixteenth after release and is silent a beat later. Cut also silences the Drop's own drums, the bass's upper layer and the build roll, not the Drop's riser or impact. In Simple the Filter pad reads Sweep. The tablet Mix panel has no Punch page (the pads sit in the band). The animation loop writes its values at most about 30 times a second, only those that changed; the master meter still reads under Still; Stutter keeps recording while idle. Cost with animation on against off at the desk, four runs each way in six sets: on reads 0.5 to 2.6 points more audio load and 1 to 5 % fewer frames after the fix, inside the spread of the runs, with no render callback or task past the audio budget; the figures are in `docs/reviews/T3-measure.md`. Left, carried: a tempo change between a press and its end line moves the line (M6); the Q has no peak but the Stutter records idle (M2, half done); Macros and Morph dials get no ghost pointer and the filter wobble shows on the LFO dial, not the XY dot (M8). Veto any of these.

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

Done (25 Nov 2026), see Done below. Its text left the queue.

## Bundle 7b: the cycle and the drop's wind-down

Worked after bundle 7 and before bundle 8. R1, P10b, P10c, P10d and the player pass are Done; P10b was built with the cycle R1 wrote, so it was also R1's trial.

### R1. A leaner build cycle

Done (25 Nov 2026), see Done below. Its text left the queue.

### P10b. The Drop's wind-down

Done (26 Nov 2026), see Done below. Its text left the queue.

### P10c. Bundle 7 player findings

Done (26 Nov 2026), see Done below. Its text left the queue; M1 moved into P10d.

### Bundle 7b player pass

Done (26 Nov 2026), see Done below. Its text left the queue.

### P10d. Play button state and DROP and Morph position

Done (26 Nov 2026), see Done below. Its text left the queue.

## Bundle 8: phase 3, tablet

Spec section 9 is the brief. Read it in full, with section 8.12, before any row of this bundle.

### T1. Three layouts and the docked pads

Done (27 Nov 2026), see Done below. Its text left the queue.

## Bundle 9: the install

### G6. APK

History, kept from the G5 chat: "G5 is Done. G6 is parked by Pedro (23 Nov 2026): do not work it until he asks." Pedro moved it on 24 Nov 2026: G6 waits until after the tablet bundle (bundle 8) and is bundle 9; the chat that works bundle 9 starts it, and a `Notes:` line can park it again.

- Capacitor Android project wrapping the built app. Portrait only, screen kept awake while playing, app icon, works offline (fonts bundled, no network needed).
- Note from T1 (spec 9.1): "portrait only" is for phones; a tablet (600 px or more on its short side) rotates freely.
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
- **P11. Morph** (25 Nov 2026). Built, reviewed (fix: 1 error, 2 should-fix, 5 minor, all applied, M5 (R1 says seven-part) at close; the error was Morph losing track of an instrument it had taken out or a Lock it had eased on Stop, a load, a new seed or a drop). Report in `docs/reviews/P11.md`. Planner in `src/music/morph.ts`, a Morph switch beside DROP, Morph speed on the Simple Mix tab, a Morph page in Advanced Mix and a Voicing dial on the Pad page; the smoke gained a seventh part, morph. Listen items and changed checks in C22. Bundle 7 is done.
- **R1. A leaner build cycle** (25 Nov 2026). Built in two slices (R1a tools, R1b docs), reviewed (fix: 1 error, 3 should-fix, 5 minor, all applied; the error was a tab file named in no part's fingerprint). Report in `docs/reviews/R1.md`. Per-part smoke fingerprints, the drop part in six groups (twelve parts), one full smoke per row, slices, the watchdog.
- **P10b. The Drop's wind-down** (26 Nov 2026). Built in two slices, reviewed (fix: 3 errors, 5 should-fix, 5 minor), then fixed four times. The second press now eases the extra layers, level, width and overlay voices down bar by bar over the 2 or 4 wind-down bars (`windSteps` in `src/music/drop.ts`, `DropOverlay.wind` in `src/engine/drop.ts`); the Filter value kept during the drop is applied at the end; a press during the wind-down does nothing; the song is unchanged. The smoke's drop parts judge the descent bar by bar. Pushed with drop-5 and drop-6 red on a known defect, C24 (Pedro's decision, 26 Nov). Report in `docs/reviews/P10b.md`.
- **P10c. Bundle 7 player findings** (26 Nov 2026). Built, reviewed (pass: 0 errors, 0 should-fix, 0 minor), pushed. S1 (six Advanced Mix chips one size, icon over the word, inside the padding), M3 (Morph help text true for Sections on and off), M4 (Simple Master dials two by two), M5 (`tools/shots.py` walk of 22 live screens: Morph on, the Drop page, the three DROP states) done, each with a check that fails on the old layout. M1 moved to P10d (closing the band by growing the grid would move DROP up). M2 kept (the spec wins). Report in `docs/reviews/P10c.md`.
- **P10d. Play button state and DROP and Morph position** (26 Nov 2026). Built, reviewed (pass: 0 errors, 0 should-fix, 3 minor, all applied), pushed. The button reads the engine's run state, told at once by Play and Stop, and a run counter drops stale Draw callbacks; a tap decides on what the button shows, and a Stop tap in the first 50 ms is no longer lost (`tapPlay`, five tests, `sample_play` and `walk_play_button` in `tools/shots.py`). DROP and Morph keep one place in Simple and Advanced: Advanced's DROP row sits under the grid, the grid fills the tab, the Play strip is 64 px (52 px under 700 px of height), and the band above DROP (C23 M1) is closed (spec 8.6 and 8.9, `PLAY_PLACE` check). Pushed with drop-6 red on drone and EDM (C27, C24). Report in `docs/reviews/P10d.md`.
- **Bundle 7b player pass** (26 Nov 2026). Every Done-when line of R1, P10b, P10c and P10d true on the final build. 1 error (C24's remaining cause, measured, carried for Pedro's decision), 2 should-fix (page chips on every tab inside their padding, README), 4 minor (the section hold waits for its sheet; three recorded). C24 probed before and after `42d9aad` (8 of 24 runs failing a level line before, 1 of 24 after), C29 not reproduced. C26, C27 and C29 closed, C24 updated, C30 carried. Report in `docs/reviews/bundle-7b.md`. Bundle 7b is done.
- **T1. Three layouts and the docked pads** (27 Nov 2026). Built in three slices, reviewed (fix: 2 errors, 2 should-fix, 5 minor, all applied; the errors were a shots check that failed on Ambient sections that start no note, and the panel cut off at 600 x 960), pushed. Report in `docs/reviews/T1.md`. Size classes in `src/ui/size.ts` (phone, tablet portrait dock, tablet landscape desk, by fit), the labelled pad grid with notes in `src/ui/tabs/DeskPads.tsx`, rotation with no engine call, four-size and edge-size walks in smoke core and `tools/shots.py`. Choices in C31.
- **T2. Advanced without pages** (27 Nov 2026). Built in three slices, reviewed (fix: 2 errors, 3 should-fix, 5 minor, all applied), pushed. Report in `docs/reviews/T2.md`. Every instrument panel shows all its controls at once where it measurably fits (`useFull` in `src/ui/tabs/full.ts`, by screen size only), with pages kept elsewhere; Mix as faders with meters from the one motion loop, Chords as editor and library side by side, Drums with a lane and grouped voice rows. The walk checks whole panels at 1024 x 768 and 8 px of slack, and that every phone control is in the whole panel; a unit test fails if the decision follows the jam's content. Spec 9.1 and 9.2 edited. Full smoke 12 of 12. Carried and choices in C32.
- **T3. Punch pads, movement and many fingers** (27 Nov 2026). Built in three slices (engine, pads, motion and many fingers), reviewed (fix: 2 errors, 3 should-fix, 9 minor, 14 findings applied except parts of M2, M6 and M8), pushed. Report in `docs/reviews/T3.md`. Six punch pads (`src/music/punch.ts`, `src/engine/punch.ts`, `src/ui/punch.tsx`) on the phone's Punch page of Mix and in the tablet band beside DROP, each starting and ending on the beat, bar or sixteenth its rule names, tested on a fake audio clock and in the browser; pads pulse from their instrument's meter and a ghost pointer shows the Filter sweep and the filter LFO, all in the one motion loop (`src/ui/motion.ts`, a test fails on a second loop), all off under Still; `walk_fingers` moves two dials, the XY pad with a pad and three pads with real touch points and fails when only the first finger is handled. Full smoke 12 of 12. Carried and choices in C33.
