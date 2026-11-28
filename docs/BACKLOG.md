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
| 9 | G6 (Done) | The APK |
| 10 | F0 (Done), F1, F2 | The rubber-bass fix (C24). Phase 4: straight in with a random top vibe, the new picker, the new kick and Thump |
| 11 | F3, F4 | Phase 4: leads that hold together in all fourteen top vibes, the lab |
| 12 | F5, F6, F7 | Phase 4: the harmony pad, Perform on the Y700, Signature |
| 13 | G7 | Retouch from notes |

## Carried

Fixes waiting for the next chat. The first builder of the next bundle clears them.


- **C36. F0 carried** (28 Nov 2026, `docs/reviews/F0.md`): the stall test and the teardown check run inside the smoke's drop-5 part (the square, FM and noise waves); the FM check runs at index 0 because at the vibe's own index the unblocked control already reads -0.975, so the 0.8 line cannot judge timing there: whether the FM bass's wave and sub sit well together is an ear question. A blocked sub still enters 7 to 24 ms late: a gap at the note's start, not a phase error. The probe counts level lines only: one run (Minimal techno, rep 1) printed a wind-down click of 3.1x against a 2.5 line, not counted, not reproduced; a chat that sees it again reports it. M2 of the review is the Listen-for note below (H8, Sound).
- **C35. Known flakes and open causes** (gathered on 27 Nov 2026 from C20, C22, C25 and C28; full text in `docs/archive/backlog-to-phase-4.md`). No threshold was loosened for any of them. drop-5 and drop-6 passed three times in a row each after F0 (C24 cleared). The cost part's Tail-dial load reading failed twice and passed on rerun (70.7% to 86.1%, 64.8% to 83.1%). Core's timing checks (a section long-press, synth detune, a layer 1 accent click) each failed once in lone runs under load. The P9 knob-turn click check failed once in about 24 full runs (Ring, Follow, layer 1) and now turns a clicking knob up to three times, which can hide a click on one turn in three. A rare Tone error, a drum hit landing on its own stop, has no known cause; any throw fails the smoke with its stack. In Ambient and Drone the Drop's extra layers read -120 dB in the last wind-down bar while about three voices are still counted. Tone's Draw drops callbacks later than 0.25 s, so a position update can be skipped on a slow phone. A chat that meets one of these reruns the part once and records it; a second failure is a finding.
- **Bundled into phase 4 rows:** C1 to C3 (crackle, the kick's length) into F2; C11, C13 and C19's Drift items into F3; C28's stale `engine.playing` check into F1. What was only for Pedro's ears is H8.
- **C12. P6 review S1, not fixable at 360 x 640** (23 Nov 2026): the Advanced lane stays beside Back and New idea (171 px wide, up from about 135) on short screens; a full-width lane needs about 44 px more height than the dial rows free. Full width at 412 x 915. A fix needs a layout change (spec 8.6); G7 revisits it (T1 did not).



- **C31. T1 carried and choices for your veto** (27 Nov 2026, `docs/reviews/T1.md`): the layout is chosen by fit (the dock from 960 px tall and taller than wide, the desk from 800 px wide; a screen under 600 px on its short side is a phone, so a phone held sideways stays a phone); the desk's pad grid shows in Simple too, every pad tappable, which goes past spec 8.6's Advanced-only rule for editing a section that is not playing; the portrait rail is seven tabs with no Play tab, because the pads are always on screen; DROP with Morph sits over the transport under 960 px wide (spec 9.2 edited); tablets under 800 px wide and under 960 px tall (700 x 700, say) still get the portrait dock, which does not fit (spec 9.1 names it); Simple Mix keeps four pages on a tablet without the height; every Advanced panel still has its pages until T2; the 56 px band for the punch pads is empty until T3; the pad pulse from per-instrument meters (spec 9.5) is T3's; the core smoke part now takes about 20 minutes (the tablet walk over 10 sizes); the reviewer's phone DOM comparison against 88b7227 was made before the fixes and not repeated, the phone smoke checks pass.
- **C32. T2 carried and choices for your veto** (27 Nov 2026, `docs/reviews/T2.md`): whole or paged follows the screen size only, measured at each panel's worst case with 8 px to spare, never the jam's content, so a panel never flips while you play. Whole panels: 1280 x 800 all seven; 1024 x 768 Chords and Mix; 800 x 1280 Chords, Bass, Synth and Mix; 768 x 1024, 600 x 960 and 880 x 620 none. Pages stay where the measured need exceeds the room (the review report lists each with need against room): Drums, Bass, Synth and both layers at 1024 x 768; at 800 x 1280 the layers in every mode (a lead does not fit); at 768 x 1024 Chords always (it fitted only up to 4 chords). Drums keeps two rows of eight steps per voice, not one row of 16 (798 px needed, 649 px available), so the review's "one grid of 16" is not met. The Space help note is left out of the whole Mix. Mix meters are drawn by the one motion loop, only the meters, about 15 times a second, empty under Still. Veto any of these.
- **C33. T3 carried and choices for your veto** (27 Nov 2026, `docs/reviews/T3.md`, `docs/reviews/T3-measure.md`). Where spec 9.4 is silent: a pad is fully in on its start line and fully out on its end line. Cut, Filter and Riser start on the next sixteenth, Stutter on the next half beat, Echo and Wash on the next beat and close one bar later (a second tap pushes the close on). Cut ends on the next bar line after release, Filter and Stutter on the next beat after release; Riser falls away from the next sixteenth after release and is silent a beat later. Cut also silences the Drop's own drums, the bass's upper layer and the build roll, not the Drop's riser or impact. In Simple the Filter pad reads Sweep. The tablet Mix panel has no Punch page (the pads sit in the band). The animation loop writes its values at most about 30 times a second, only those that changed; the master meter still reads under Still; Stutter keeps recording while idle. Cost with animation on against off at the desk, four runs each way in six sets: on reads 0.5 to 2.6 points more audio load and 1 to 5 % fewer frames after the fix, inside the spread of the runs, with no render callback or task past the audio budget; the figures are in `docs/reviews/T3-measure.md`. Left, carried: a tempo change between a press and its end line moves the line (M6); the Q has no peak but the Stutter records idle (M2, half done); Macros and Morph dials get no ghost pointer and the filter wobble shows on the LFO dial, not the XY dot (M8). Veto any of these.

- **C34. G6 carried and choices for your veto** (27 Nov 2026, `docs/reviews/G6.md`, `docs/G6-notes.md`). Not run in the build chat (no Android SDK in the container): Gradle, actionlint and anything on a device. The first `apk.yml` run failed at `setup-android@v3` (the runner has its own SDK); fixed in 12630ec (the runner's sdkmanager, licences, `platforms;android-36`, `build-tools;35.0.0`), and the second run built the debug APK, ran `testDebugUnitTest` and put `groovebox-debug.apk` (4.36 MB) on the prerelease `latest` (2 m 16 s). No device has run it. Choices: the jam stops when the app goes to the background (Stop on Capacitor's `pause` event or the page hiding; the AudioContext sleeps once a take's tail has closed), because Capacitor never pauses the WebView and spec 2 allows no background audio; one public debug keystore is committed (`android/app/debug.keystore`, never for a Play release) so updates install over an APK from the same chain, and an APK from before it must be uninstalled once (which deletes its songs; web and APK songs are separate stores); Take Save/Share is a native plugin (Android 7 to 9 can only Share, no permission added); Java 21 in the workflow (Capacitor 8 needs it); INTERNET permission kept because a WebView without it was not tried on a device (M2); versionCode is the Actions run number. Open and unseen: whether tapping Play starts audio on the first tap in the real WebView, whether the screen stays awake, whether rotation on a tablet keeps the audio. Veto any of these.

## By hand (Pedro)

- **H4. Install the APK and play it** (27 Nov 2026): once the `apk.yml` run on `main` is green, download `groovebox-debug.apk` from https://github.com/apcanario/groovebox/releases/tag/latest and follow `docs/INSTALL.md` (uninstall any earlier APK once). Check: first tap starts the sound, the screen stays on while playing, backing out of the app stops the jam, a take saves to Downloads and shares, a phone stays portrait, a tablet rotates. Say in the next `Notes:` what breaks. Open until Pedro says done.
- **H8. The listen list** (27 Nov 2026; replaces H3 and the listen items of C1 to C30, whose full text is in `docs/archive/backlog-to-phase-4.md`). Play on the phone at https://apcanario.github.io/groovebox/ or in the APK and send what you hear in a `Notes:` line; G7 works it. Open until Pedro says done.
  - **Sound:** is the treble crackle gone, on a jam of ten minutes or more (C1); if not, say whether it is on a saw bass with Env amt high (C2). Default bass and drum levels (C3). Every bass patch was rebuilt in F0 (oscillators now run for the life of a voice set): hear each again, above all the FM and noise basses and a wave change in mid-note.
  - **Leads:** clicks on Drift, and on Ring's Follow turned from low to high (C13, C20). F3 replaces how Drift plans notes, so its sparseness (C11) is judged after bundle 11.
  - **Pads and space:** the long reverb tail, the Drone mode, Swoop glide, the air layer, the lo-fi master (C14).
  - **Vibes:** does each sound like its name (C19); the fourteen top vibes are reworked in bundle 11, so judge the other ten now.
  - **The Drop:** does each vibe's drop land, is the balance of the extra layers right, do Ambient and Drone hold steady through it (C20); does the wind-down feel like a calm-down (C25). A bass that drops out after switching vibes is C24.
  - **Morph:** Ambient and Drone for ten minutes with Morph on, the instrument dropouts, the Voicing dial, Morph's speed (C22). Ambient's first chord measures 2 dB under the next three and Drone steps down 1.2 dB at its chord change (C30): audible or not.
  - **Screen:** is the drum lane readable at 32 px (C7); does the UI feel heavy while playing, and if so switch Motion to Still and say so (C6); does Play show the right state after a first tap (C28).
  - **Recording:** record, stop, save or share, play the MP3 back and listen for dropouts or clicks at its start and end; reload and check the song and mix return (C5).

- **H5. Reach test on the Y700** (27 Nov 2026). After bundle 11 lands, open `https://apcanario.github.io/groovebox/#lab` on the tablet in landscape, run the reach test and put the four numbers it shows (viewport width and height, left reach, right reach) in the `Notes:` line of bundle 12. Without them F6 assumes 1280 x 800 and 65 mm.
- **H6. Reference tracks for Signature** (27 Nov 2026). One track each by Natascha Polké, Jon Hopkins and Lane 8, named in the `Notes:` line of bundle 12. Optional: without them F7 builds from spec 10.2.
- **H7. The lab tally** (27 Nov 2026). After bundle 11, go through `#lab` for the vibes you care most about and put the tally line in the next `Notes:`. Kills are reworked in G7.

## Bundle 10: phase 4, straight in and the kick

Read spec 10.1, 10.2 and 10.5 in full before any row of this bundle.

### F1. Straight in

- The app opens on the Play tab with a vibe drawn from the shuffle bag of top vibes; key and bpm rolled with it; nothing sounds until Play (spec 10.1). `top: true` on the fourteen style files, `bpmRange` where a vibe wants more than plus or minus 2.
- The bag: seeded generator only, kept in local storage, plain seeded draw without storage, never the last launch's vibe.
- A launch jam never played or edited is not saved; the last jam is first in Songs.
- The header's vibe control gains a dice; name opens the picker as a sheet; both land on the bar line while playing.
- The picker: top vibes in two columns, a line, the other ten; "More" switch where both groups do not fit at 48 px; "Surprise me". Signature's tile is F7's; leave its slot out until then.
- Spec 8.2's opening line is replaced by a pointer to 10.1. README updated.
- From C28: the vibe pick in `src/ui/vibes.tsx` still checks `engine.playing`; remove the stale check while this file is open.

**Done when:** a cold start shows the Play tab with a top vibe loaded and Play starts sound in one tap (tested, and a smoke check in core); 14 draws from a fresh bag give 14 different vibes and the 15th differs from the 14th (tested); a draw rolls key and bpm inside the range (tested); an untouched launch jam adds nothing to Songs (tested); the picker shows no scroll and no tile under 48 px at 360 x 640, 412 x 915, 800 x 1280 and 1280 x 800, top group first (`tools/shots.py`); no label wraps or overflows (shots); the ten other vibes' smoke fingerprints are unchanged except where the opening changed them, listed in the changelog; `check` and `smoke` pass.

### F2. The kick and Thump

- The four-part kick voice of spec 10.5 in `src/engine/`, replacing the membrane voice: click, sweep, body, tail, then the drive as built. Root switch and tuning to the song's root.
- Defaults reproduce the old kick for the ten other vibes. The fourteen top vibes get kick settings from the Drums column of the table in spec 10.3, as a new field of each style's drum patch.
- The kick quadrant on the Drums panel, Simple and Advanced, phone and tablet; Click, Tune and Root in the Advanced voice controls. What the Drums XY held before stays reachable; say where in Choices.
- Beat `thump` (name "Thump") in `src/data/beats/`. Top vibes take it where the table says so.
- From C1 to C3: the new voice keeps what G1 did against the treble crackle (the 4x oversampled drive, the C1 trims, the limiter and compressor settings); C3's kick length of about 0.2 s is replaced by this row's tail. The drum filter still tops at 18 kHz against 10 kHz elsewhere (C2): leave it, and name it under Listen for.
- The quadrant acts at once and never clicks: the continuity check covers a sweep of each axis while the kick plays.

**Done when:** the kick's measured fundamental sits within 30 cents of the song's root (or its octave between 45 and 60 Hz) with Root on, in three keys (tested); Punch at its ends changes the first 30 ms and Length at its ends changes the tail, both measurably (tested); Thump plays the kick on steps 0, 4, 8 and 12 and nothing else (tested); for each of the ten other vibes the kick's level and length measure within the smoke's existing tolerance of the old voice (tested against a fixture recorded from the old build before the change); master peak stays under the limit with Pump at full and a drop on (drop part of the vibe nearest the change); the quadrant is at least 48 px a side on every size and nothing moves DROP or Morph (shots, `PLAY_PLACE`); `check` and `smoke` pass. Whether it thumps is Pedro's ear.

## Bundle 11: phase 4, leads

Read spec 8.5 and 10.3 in full before any row of this bundle. `docs/reviews/P5-patterns.md` shows what the old planner prints.

### F3. The lead planner, the measures and the lab

- `src/music/leadMeasure.ts` with the five measures of spec 10.3. First slice: run it over the old planner, 8 seeds for each of the fourteen top vibes as their style files stand, and write the table to `docs/reviews/F3-before.md`. This is the audit: it says in numbers what "random" was.
- Rhythm cells as data in `src/data/cells/`, and the new planning in `leadKit.ts` and the four planned styles: rhythm first, strong onsets on chord tones, steps with bounded leaps, a phrase ending, one change at a time. Pulse untouched.
- `leadVersion` on the song: old songs play the old planner note for note (a fixture of a song saved before this row must print the same notes); new jams use the new one.
- Lead profiles and at least six cells each for Deep techno, Deep house, Ambient and Drum and bass. Their style files move to the profile's lead style.
- Every knob of 8.5 still audible in the new planner.
- The lab at `#lab`: A and B in random order per seed, keep and kill, a tally line; a viewport readout and the reach test for H5. Not linked from the UI, no effect on the app.
- `docs/reviews/F3-after.md`: the same table from the new planner, beside the bands.
- From C11, C13 and C19: run C13's measurement again on Drift under the new planner (a steady Drift line, long notes, Busy 0.9, showed jumps of 0.43 of its peak on a sine, cause unexplained, voice stealing one candidate) and put the figure and what was found in `F3-after.md`. Drift's sparseness (4 notes in 8 bars) is now set by its profile's rest band.

**Done when:** each of the four vibes' phrases sits inside its profile's bands for 8 seeds (tested, and the test fails on the old planner); a pre-phase song fixture prints identical notes before and after (tested); for each planned style every knob's minimum and maximum give different notes (tested, as in P5); a phrase loops identically until Lock lets one thing change, and then exactly one note, onset or ending differs (tested); the lab plays both planners on the same patch and its tally survives a reload (smoke check in core); no saved-jam format break (load fixtures pass); `check` and `smoke` pass. Whether the lines are good is Pedro's ear, through the lab.

### F4. The other ten top vibes

- Lead profiles and at least six cells each for Melodic techno, Minimal techno, Dub techno, Progressive, 2-step, Breakbeat, Lo-fi, Drone, Downtempo and Synthwave, following the table in spec 10.3. Ambient's unequal-length cells and Drone's held tones are checked by their own measures (no bar-repeat band for either).
- The drum direction of the same table for these ten: beat choice and kick settings only, from what F2 built.
- The lab lists all fourteen.
- `docs/reviews/F4-after.md`: the measures table for all fourteen.

**Done when:** all fourteen top vibes sit inside their bands for 8 seeds (tested); Ambient's layers do not realign within 64 bars and Drone moves by step no more often than its profile says (tested); the ten other vibes' style files are unchanged (git diff shows none of them); `check` and `smoke` pass.

## Bundle 12: phase 4, the harmony pad, Perform and Signature

Read spec 10.2, 10.4 and 10.6, with 9.2 and 9.6, in full before any row of this bundle. A `Notes:` line may carry H5's four numbers and H6's three tracks.

### F5. The harmony pad

- `engine.harmony({ height, expression } | null)` behind the engine layer: the lead window, the arp range, the synth's top voice and, when switched in, pad and drone voicing follow; the bass never. At once, with a glide and no retrigger; expression as a filter and level offset taken off on release.
- The pad UI: lanes from the chord sounding now and the scale, redrawn on the chord change with the finger's height kept; the chord strip; follow chips; Latch; release returns home over one beat; a latched position stored with the section and saved with the song.
- Phone: the Harmony control on the Play tab swaps the lanes area for the pad. Tablet: an eighth rail button, first, its panel the pad at full height. Simple and Advanced the same.
- Colour: the five-stop strip, landing on the bar line, `colour` clamp in the style files of the top vibes; spec section 3's mood line edited as 10.4 says.
- Many fingers (9.6): the pad with a punch pad, a section and DROP.
- Last slice: a recorded take of a slide across every lane in three vibes passes the continuity check.

**Done when:** every lane's pitch is in the song's scale and every wide lane is a tone of the chord sounding then, across a full progression in three vibes (tested); a held height gives a new pitch at the chord change with no new attack (tested on the event log); with the pad held the bass's notes are identical to a run without it (tested); release brings every followed value back to its own setting within one beat, and a latched position survives a section switch and a save and reload (tested); a slide across all lanes makes no jump above the continuity threshold (smoke, nearest part plus one drop group); pad plus Cut plus DROP held together all act (shots walk with three pointers); wide lanes are at least 48 px tall on every size, DROP and Morph have not moved (shots, `PLAY_PLACE`); Colour lands on the bar line and old songs load with their mood (tested); `check` and `smoke` pass.

### F6. Perform on the Y700

- Tablet landscape opens with the right half on Harmony.
- Millimetre sizing from H5's numbers in `Notes:` (spec 10.6): pixels per millimetre for this viewport in `src/ui/size.ts`, wide lanes, punch pads, section pads and DROP at least 10 mm on the short side, everything a thumb hits while playing inside the measured reach. Without the numbers: 1280 x 800 and 65 mm, recorded under Choices.
- No change to the phone or to tablet portrait. Panels that were whole at 1280 x 800 (C32) stay whole.

**Done when:** at the Y700 viewport every performing control measures at least 10 mm on its short side by the stored pixels per millimetre (shots, a new `PERFORM_MM` check); each control's centre lies inside the reach arc of its side (shots); the seven instrument panels are still whole at 1280 x 800 (the `full` tests); rotation still changes layout with no audio gap (core); `check` and `smoke` pass. Whether it plays well in the hands is Pedro's test.

### F7. Signature

- `src/styles/signature.ts`, `top: true`, `signature: true`, built to the table in spec 10.2: beat `signature`, its progressions tagged in the library, its lead profile and cells, its drop recipe, its Morph limits, its `colour` clamp.
- First in the picker on its own full-width tile, first in the bag's order, in the lab.
- If `Notes:` names H6's tracks, tune toward their mood within the table. Copy nothing from them.
- The 25th vibe joins a drop smoke group and the vibes part; `tools/smoke_parts.py` must still place every check.

**Done when:** Signature loads from the picker and from the bag and plays every section (vibes part); its lead sits inside its bands for 8 seeds (tested); its drop measures wider and within the level rule of 8.9 (its drop group); Morph runs ten minutes on it with no repeat by the morph check; the picker still fits every size with its tile added (shots); the README lists 25 vibes; `check` and `smoke` pass. Whether it sounds like him is Pedro's ear.

## Bundle 13: retouch

### G7. Retouch

Runs only when the starter carries a `Notes:` line. After phases 2, 3 and 4 and the install (P1 to P11, T1 to T3, G6, F1 to F7) Pedro plays it and sends notes on the interface, the instruments and the sounds. This row works those notes and nothing else: each note is a fix, grouped by tab. Where a note changes the spec, the spec is edited in the same commit. The row reopens for every new set of notes; it is never Done.

Waiting for this row whether or not a note names them: C12 (the Advanced lead lane at 360 x 640 needs a layout change), and H8, the listen list.

**Done when:** every note in the `Notes:` line is either fixed or answered in the reply with the reason it was not; `check` and `smoke` pass.

## Later

Not scheduled. Each becomes a row when Pedro asks for it.

- **L1.** Advanced chord mode: 7ths, 9ths, borrowed chords, inversions.
- **L6.** Knob snapshots per section.
- **L9.** Automatic transitions on a section switch (drum fill, filter drop), chosen per style.
- **L11.** Take one part from another style (only its drums, only its chords, only its sounds).

### Later rows closed or moved

Kept here so no row disappears without a record.

- **L3.** Sampled break one-shots for drum and bass. Dropped: Pedro decided on 22 Nov 2026 that every sound is synthesized, with no samples ever.
- **L5.** Stutter and beat-repeat on the Mix tab. Moved into T3 as the Stutter punch pad.
- **L8.** One effect slot per instrument and a lo-fi master. Moved into P9 (two slots per instrument, twelve effects) and P7 (the lo-fi master).
- **L12.** Autopilot. Moved into P11 as Morph.
- **L10.** A play pad: an XY surface that plays in-key notes on a layer by touch. Moved into F5 as the harmony pad (spec 10.4), 27 Nov 2026.
- **L2.** Patch polish pass, driven by Pedro's notes. Closed on 27 Nov 2026: that is what G7 does.
- **L4.** Offline re-render of the event log, in chunks. Archived on 27 Nov 2026: nobody asked for it since G5 made recording work.
- **L7.** Morph between two saved generative patterns. Archived on 27 Nov 2026: Morph (P11) and the one-change-at-a-time rule of spec 10.3 cover what it was for.

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
- **G6. APK** (27 Nov 2026). Built in two slices (a the Capacitor project, b the background stop, workflow and INSTALL.md), reviewed (fix: 2 errors, 3 should-fix, 6 minor, all applied except M2, INTERNET kept, and M6; the errors were Take Save and Share dead in the WebView, and a debug key that differed per runner so updates would not install), pushed. Report in `docs/reviews/G6.md`, notes in `docs/G6-notes.md`. Capacitor 8.6.3 shell (`android/`), portrait on phones and free rotation from 600 dp, native keep-awake and Take plugins, original icon, offline check in `check`, `.github/workflows/apk.yml` to the prerelease `latest`, `tools/release_check.py`. Full smoke 12 of 12. Gradle ran in the workflow (apk.yml run 2 green, release `latest`, per C34); a device not run. Carried and choices in C34. Bundle 9 is done.
- **F0. The rubber-bass fix (C24)** (28 Nov 2026). Built in two slices (a the oscillators run for the life of their voice set, started together once, `src/engine/bassRun.ts`; b the sub's pitch follows the wave's frequency signal, `tools/basscheck.py` with stall, levels and probe), reviewed (fix: 1 error, 3 should-fix, 5 minor, all applied; the error was a wave change in mid-note freeing the wave's set while its sub still sounded, a DC click), pushed. Report in `docs/reviews/F0.md`. Stall test: 0.83 or more on the new build, down to -0.80 on 059fc3b. All nine bass patches within 0.29 dB of the old build. Probe: 0 of 24 runs failed a level line (8 of 24 before). drop-5 and drop-6 three times in a row each. Full smoke 12 of 12. Carried in C36.
