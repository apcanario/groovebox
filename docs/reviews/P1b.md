# P1b review: The look

Reviewer: Opus 5.5, fresh agent, had not seen the build. Base `40909a6`, head `a994c69` ("P1b: the look"). Read `CLAUDE.md`, `docs/RUN.md`, `docs/SPEC.md` (8.1, 8.3, 8.6, 8.12 in full; 7) and row P1b.

## Scripts

- `npm run check`: **pass** (tsc, 189 tests in 11 files, vite build).
- `npm run smoke`: **pass** (including the new P1b walk: fonts, icons, lanes, playhead, motion switch; "no attacks after Stop").
- `python3 tools/shots.py`: **pass**, 126 screenshots in `shots/`, all looked at against `docs/design/look/`.
- Extra, by hand with a scratch Playwright script (no source changed): Simple Play at 390 x 844 with an instrument off, an instrument queued, a section queued, motion on and off; computed styles of every queued tile with motion off; `engine.lanes()` timing (0.32 ms a call on desktop Chrome); a scan for controls under 48 px (none).

## Done-when

| Item | True? |
|---|---|
| Every lane matches what its instrument is playing (tested against the engine's notes) | **Yes at the engine.** `src/engine/lanes.test.ts` compares `Sequencer.lanes()` with the notes `next()` schedules, bar after bar, read early and late, across section switches and toggles, and would fail if they differed. The screen side is weaker: smoke compares note counts only (S4). Off lanes (the greyed "would play") are not compared with anything (S3). |
| The playhead keeps time | Yes. `playhead()` unit-tested; smoke reads the playhead's transform against the step heard, motion on and off. |
| No font but DM Sans is loaded (tested) | Yes. `look.test.ts` greps every source file and the stylesheet; smoke checks `document.fonts`, fetched font files and every element's computed family. Both would fail on a second face. Confirmed by hand: only `DM Sans loaded`. |
| Every icon in the spec's table is used where the table says | Yes for everything that exists at this row (tab bar, instrument names, Lead/Arp/Pad, Sound page chip, New jam, New idea), each beside its word; tested in `look.test.ts` and smoke. Gaps: group headings and the Mix tab's instrument names (M2, M3). |
| With motion off every state is still told apart by fill and hatching | **No.** An instrument that is on and queued to go off loses its hatching with motion off (E1). Smoke passes because it reads the wrong property (S1). |
| The reviewer's screenshot comparison has no open finding | **No.** See the comparison below: E1, S2, M4, M5, M6, M8 are this row's. |
| `check` and `smoke` pass | Yes. |

Section 7 and the engine change: the sequencer's new bar record and its copies do not alter what plays. `copy()` clones every piece of state that `next()` mutates (queue, leads via `GenerativeLead.clone`, arp index and RNGs via `Rng.clone`, sounding set, retrigger, restart), look-ahead runs use `cloneSong`, and the snapshot taken at each bar line never runs `next()` on the live song. `lanes.test.ts` "reading the lanes changes nothing" covers it; the smoke's no-attacks-after-Stop and level checks are unchanged. No audio path, ramp or scheduling changed, so no new stuck-note or click risk. UI imports no Tone.js; no `Math.random()` added. Controls: none under 48 px at 360 x 640, 390 x 844 or 412 x 915. No hover rules.

## Findings

### Errors

**E1. With motion off, an on instrument (or on cell) queued for the next bar loses its hatched frame.** `src/style.css:176-182`.
`.still .tile.on::before, .still .cell.on::before, .still .tog.on::before, .still .sec.playing::before { display: none }` is meant to stop the moving band, but the hatched frame of the Next-bar state is the same `::before`. A tile that is `.on.pending` (playing now, switching off on the next bar) therefore shows a plain dark tile with "Next bar" in colour and no hatching. Reproduced with motion set to Still: `[data-now=layer1]` (`tile now-tile on pending`), the Advanced grid cell (`cell on pending live`) and the instrument tab's switch (`tog on pending`) all have `::before { display: none }`. Spec 8.12: with the switch off "the states stay readable by fill and hatching alone"; Next bar is "a diagonally hatched frame". Done-when line false.
Fix: scope the rule to the band only: `.still .sec.playing:not(.pending)::before, .still .tile.on:not(.pending)::before, .still .cell.on:not(.pending)::before, .still .tog.on:not(.pending)::before { display: none; }`. Then fix the test (S1) so it fails on today's build.

### Should-fix

**S1. The smoke's motion-off state check cannot see E1, and its fill checks compare the wrong property.** `tools/smoke.py:736-800` (`STATES`, `walk_look`).
It reads the hatch's `backgroundImage`, which stays set when `display` is `none`, so E1 passes. "On and off tiles have the same fill" and "Next bar filled like on" compare `backgroundPosition`, not the colour shown. Only a Now tile is checked; queued cells, switches and section tiles are not.
Fix: for each queued element (Now tile going off and going on, Advanced cell, instrument-tab switch, section tile) assert `getComputedStyle(el, '::before').display !== 'none'` and the repeating gradient, with motion off; compare on, off and next-bar by a rendered pixel sample (screenshot of the element's centre and frame) or at least by the resolved fill (`background-position` together with `background-image` stop colours). It must fail on `a994c69` and pass after E1.

**S2. Long dial values overlap the arc.** `src/style.css:1010` (`.dial .val { inset: 14% }`).
The ring's inner edge is at radius 26 of 78 (R 30, stroke 8), so a value box inset 14% is wider than the hole. At 360 x 640 Advanced Layer 1 Sound page, "160ms" and "200ms" run into the purple arc (Decay, Release); the fit only keeps text inside `.val`, not inside the ring. Spec 8.6: text never passes its edge; 8.12: value in the centre.
Fix: inset the value box to the ring's inner square (about 24%: 39 - 26/√2 ≈ 20.6 px of 78), and let `fit.ts` shrink to 10 px within it; if "160ms" still does not fit at 10 px on a five-dial row, show "160" with the unit in the name ("Decay ms") or use seconds.

**S3. Off lanes (what an instrument would play) are not tested against anything.** `src/engine/lanes.test.ts:65` and `:117`.
Every comparison skips instruments that are off; the off test only checks that some notes exist. The ghost path (`Sequencer.ghost`, snapshots at the bar line, `copy(..., false)`) can drift from what the instrument plays when switched on and no test would fail.
Fix: for an instrument off in bar N, record `lanes(N).notes[id]`, then in a twin sequencer switch it on for bar N (toggle queued before the bar line) and assert the played notes equal the ghost, for a generative lead, an arp and a pad.

**S4. On screen, a lane is checked by note count only.** `tools/smoke.py:601-633` (`LANE_MATCH`, `check_lane`).
A lane that drew the right number of notes at the wrong steps or from the wrong bar (most patterns repeat their count every bar) passes.
Fix: put each note's start step and pitch or voice on the element (`data-s`, `data-k`) in `src/ui/lanes.tsx`, and compare that list with `engine.lanes(bar).notes[id]` in `LANE_MATCH`.

### Minor

**M1. Page chips carry icons only where the label happens to match the table.** `src/ui/components.tsx:8`, `:366`.
"Sound" and "Lead" get icons; "Filter", "Beat", "Kick · Clap", "Hats", "Rhythm", "Chords", "Key", "Master", "Levels", "Audio" do not, so the same row of chips mixes both. The spec's page chips (Notes, Feel, Sound, FX) arrive with P6.
Fix: either give every page chip an icon (pick from Material Symbols outlined 300, add them to the spec's table per 8.12's rule), or none until P6's pages exist; at least use `filter_alt` on the Filter page chip.

**M2. Group headings have no icon.** `src/style.css:527` (`.glabel`), used in the instrument, layer and Mix tabs ("Wave", "Rhythm", "Sequencer", "Motion").
Spec 8.12 lists group headings among the places icons go.
Fix: choose an icon per heading from the same set, add them to the spec's table, render with `<Icon>` beside the word.

**M3. Instrument names on the Mix tab's Levels dials have no icon.** `src/ui/tabs/MixTab.tsx:92`.
8.12: instrument names carry their icon.
Fix: render the dial label as `<InstName id={id} />` (icon at the label's size), or drop the rule for dial names in the spec.

**M4. The instrument tab's subtitle is cut mid-letter.** `src/style.css:506` (`.head .sub { text-overflow: clip }`), `src/ui/tabs/InstrumentTab.tsx:103`.
Shots at 360 and 412 (stress names): "B · WWWWWWW" is sliced at the On switch.
Fix: use `stripWord` for the section name, or `text-overflow: ellipsis`.

**M5. The lane on instrument tabs is 30 px tall on a short phone.** `src/style.css:628`.
At 360 x 640 the drum lane's three voice rows are 4 to 6 px each and hard to read; the reference's lane is about 44 px.
Fix: 40 px minimum where it fits (the Drums and Bass tabs have room below their chip rows at 640 high).

**M6. Dial ticks are barely visible.** `src/style.css:999`, `src/ui/components.tsx` (`TICKS`, 3 units long, 1.5 wide, `--dim`).
Fix: 4 to 5 units long, stroke 2, `--mute` or lighter, as in the reference.

**M7. Every frame sets custom properties on the root, which restyles the whole tree.** `src/ui/motion.ts:93-98`.
`--p16`, `--p`, `--beat` and `--f-*` are inherited, so each change invalidates style for every element, every frame while playing. Cheap on desktop; unmeasured on the phone, where the same thread runs Tone's scheduler.
Fix: set them on the containers that use them (`.nowlist`, each `.lane`, `.secs`, `.top`, `.tabs`) or measure a ten-minute jam on the phone and record the frame cost in the changelog.

**M8. Pitched notes are thin slivers.** `src/ui/logic.ts` (`laneRects`, `h = 12`).
Bass and lead notes are 12% of the lane (about 7 px in a 60 px lane); the reference draws them about twice that.
Fix: about 20% for pitched notes, keeping the 10 to 82% spread.

**M9. The lanes are recomputed on every engine change.** `src/ui/App.tsx:242`.
`engine.getSong()` clones, so `song` changes identity on every dial event and `engine.lanes()` (copy, up to 32 look-ahead steps, two `cloneSong`) runs per drag event, 0.32 ms each on desktop.
Fix: recompute at most once per animation frame (or key on a song revision counter from the engine).

**M10. The Mix tab's motion switch shows "Moving" while the system's reduce-motion setting holds everything still.** `src/ui/tabs/MixTab.tsx:34-49`.
Fix: when `prefers-reduced-motion` matches, show Still as on and add "The phone's setting is on" under it.

**M11. Dead code left by the lane.** `src/engine/index.ts:525` (`leadSteps`), `src/engine/sequencer.ts:383`, `src/music/lead.ts:126` (`preview`): no UI caller since the lead row was removed.
Fix: remove them with their tests, or note in the changelog that P6's step row will use them.

## Screenshot comparison with `docs/design/look/`

Phone references compared: `groovebox-v3-phone-1-simple-play` with `360x640-simple-play`, `412x915-simple-play` and the by-hand 390 x 844 state shots; `phone-2-simple-layer` with `*-simple-layer1-*`; `phone-3-advanced-layer` with `*-advanced-layer1-*`; the other tabs against 8.12's rules. The two tablet images belong to T1 to T3.

Matches: 3 px corners and 2 px gaps; filled on tiles with black text and the moving band; off tiles dark with a 4 px edge and greyed lane; hatched Next bar on instruments and sections (motion on); teal playing section; yellow Editing inset; lanes with beat lines, drum hats over clap over kick, pitched notes, one playhead across all five; square-cut dials with pointer and value in 800; dot-grid XY pad with hairline crosshairs and corner readout; four square beat lights; tab bar icons with the coloured active icon and sliding marker; DM Sans throughout, sentence case.

Differences that belong to this row: E1 (hatching gone with motion off), S2 (dial values over the arc), M4 (cut subtitle), M5 (short lane), M6 (faint ticks), M8 (thin notes); also M1 to M3 (icons).

Differences that are by the spec or by earlier rows, not findings:
- Header has a Songs button; the reference does not. Spec 8.6 puts Songs in the header.
- New jam is greyed while playing (P1 review M1); P3 enables it.
- At 360 px the tab bar is two rows of four: eight 48 px tabs do not fit; at 390 px and up it is one row as in the reference.
- Section words show "WWWW…" in the shots: the walk renames everything to the widest names (P1 E2).

Differences that belong to later rows:
- Simple Play: no vibe control at the top (**P3**); no DROP tile or Morph switch above the strip (**P10**, **P11**); the label's second line says "4/4", "Stabs", "Lead" instead of plain words like "Four on the floor", "Warm stab" (**P2** plain words, **P3** style names).
- Simple Layer: no Busy, Evolve, Bright, Space macro dials, no Back, no XY pad on the main page, the lane shares its row with New idea (**P2**); no lead style row Hook, Phrase, Roll, Drift, Pulse (**P5**); no Drone mode (**P7**); no Chorus and Echo effect buttons (**P9**).
- Advanced Layer: no Back beside New idea in the title row and pages are "Lead · B / Sound / Filter" rather than Notes, Feel, Sound, FX (**P6**); no style row (**P5**); no Drone (**P7**); at 360 x 640 the XY pad sits on its own Filter page while the reference shows it under the dials (the reference is 390 x 844; at 412 x 915 it is under the dials).
- Tablet layouts (**T1**, **T2**).

## Verdict

**fix.** 1 error, 4 should-fix, 11 minor. Apply E1 and S1 together (the test must fail before the fix), then S2 to S4 and the minors.
