# Bundle 5 player check (P3, P4, P5, P6)

Final build at e1900af, 23 Nov 2026. Opus 5.5 player. No source file changed.

## Scripts

- `npm run check`: pass (18 files, 656 tests, build).
- `npm run smoke`: pass. All eight vibes landed on the bar with every instrument audible; vibe arrows landed on the bar; synth cutoff old before the bar line and new after it on 7 landings; Simple Chords 6 of 6 cards (one per feel, Ambient) landed on the next bar; More chords 2 pages; borrow and return; P6 turned 63 lead dials over five styles while playing, peak -6.0 dBFS, largest jump 0.44 of the steady sound (click limit 2.5).
- `python3 tools/shots.py`: pass, 127 screens at 360 x 640 and 412 x 915.
- Extra, by the player: the smoke's 48 px check (`SMALL`) run at 360 x 640 and 412 x 915 on the vibe picker, Simple Play, Simple Chords, Simple Layer 1 Lead and every page of all five lead styles in Advanced Layer 1: no control under 48 px.

## Done-when, line by line

### P3 Styles

| Line | True now? |
|---|---|
| Each of the eight styles loads and plays with every instrument audible in its groove section (smoke loops all of them) | Yes. Smoke: eight "landed on the bar, every instrument audible". |
| Adding another style is one new file and no other change (shown by a test fixture) | **Only partly** (S1). The fixture test (`src/music/styles.test.ts:103`) passes, but since P4 a real new style also has to use one of the 24 reserved ids (`progressions.test.ts:37`) and every section's chords must already be a library progression tagged with it (`progressions.test.ts:71`). The fixture `testVibe` meets neither and would fail `check` as a real file. |
| Loading a style mid-jam lands on the bar | Yes. Smoke checks notes, tempo and patch on each side of the bar line. |
| `check` and `smoke` pass | Yes. |

### P4 Simple chords

| Line | True now? |
|---|---|
| A progression can be chosen and changed without seeing a scale or degree name | Yes. Screens show feels, card names, colour blocks, "Warm · 1 of 7", Lower, More chords, Higher. The theory-word check passed on every Simple screen. |
| Every card plays from the next bar | Yes. All cards share one path (`setProgression`). Smoke tests one card per feel. |
| The library test passes | Yes. 137 progressions, at least 4 per feel for all 24 vibe ids, 2 to 8 chords, all twelve keys in range. In-scale holds by construction, as the test says. |
| `check` and `smoke` pass | Yes. |

### P5 Lead styles

| Line | True now? |
|---|---|
| All tests above pass | Yes (`leadStyles.test.ts`, `p5.test.ts`). |
| The five styles produce clearly different note patterns from the same seed (printed in the review report) | Yes. `docs/reviews/P5-patterns.md` matches the output of `npm run leads` today, apart from trailing spaces. Hook repeats a 2-bar motif, Phrase plays call and answer with rests, Roll plays 15 of 16 sixteenths, Drift plays 4 long notes in 8 bars, Pulse plays Euclidean hits. |
| `check` and `smoke` pass | Yes. |

### P6 Lead screens

| Line | True now? |
|---|---|
| Every lead knob can be turned while playing with no stuck note or click | Yes, as far as the script can measure. 63 dials turned with no jump over 0.44 of the steady sound. The stuck-note check passed. Small clicks are not reliably caught (carried as C13); only Pedro's ears can settle that. |
| Both modes fit without scrolling | Yes at 360 x 640 and 412 x 915 (shots pass; screenshots read). Only Hook and Pulse are walked (M2). |
| `check` and `smoke` pass | Yes. |

## Screenshots against `docs/design/look/`

- **Simple Play:** the vibe control (arrows, name, "All 8 vibes"), five lanes under one playhead, the strip and the transport match the reference. DROP and Morph are missing because they are rows P10 and P11.
- **Simple Layer:** Lead/Arp/Pad, the style row, the lane, Busy, Evolve, Bright, Space, Back and New idea, and the XY pad match. Drone and the effect buttons are missing because they are P7 and P9.
- **Advanced Layer at 412 x 915:** matches the reference: title row with Back and New idea, style row, full-width lane, Notes/Feel/Sound chips, six dials and the XY pad.
- **Advanced Layer at 360 x 640:** the lane sits beside Back and New idea, and the page chip carries the section ("Notes · B"). This is a known gap, carried as C12.
- **Text:** at both sizes, no text wraps, is cut off or overflows its tile. The Register name and the Shape values Dip and Zig are drawn smaller, as recorded.
- **Older layout references:** Simple Chords and the vibe picker follow the layout of `docs/design/phase2/`. The picker shows the 8 built vibes and leaves the lower half empty. That is by design until P8 (C9).
- **Already recorded, not new:** at 360 px the tab bar is two rows of four (bundle 4).

## Findings

### Errors

None.

### Should-fix

- **S1. P3's "one new file" claim is no longer what the fixture test shows.** `src/music/styles.test.ts:103`, together with `src/music/progressions.test.ts:37` and `:71`. A new style file fails `check` in two cases: its id is outside the 24 in `LAUNCH_VIBES` (`src/music/progressions.ts:14`), or a section's chords are not a library progression tagged with its id. Today the fixture passes only because it is kept out of `STYLE_IDS`. **Fix:** give the fixture one of the reserved ids not yet built (for example `progressive`) and section chords taken from a progression already tagged with it. Then run the two P4 library assertions (`progressionsFor` at least 4 per feel, and every section progression present and tagged) against `readStyles({ ...appStyles, ...fixtureStyles })` in the same test. Also add one sentence to spec 8.2 (`docs/SPEC.md:158`): a style's section chords are library progressions tagged with it, and new chords mean a new progression file next to the style file.
- **S2. README is out of date in five places.**
  - `README.md:43`: the Chords tab line still describes the Simple Key page and the seven unlabelled blocks. P4 removed both. Rewrite it: Advanced is key, mood and the degree editor; Simple is the feel and card screen described under P4.
  - `README.md:44`: "five beats". There are now 11 beat files (10 beats plus None). Say "eleven beats (data files)", or drop the count.
  - `README.md:49`: the Lead mode is described with the G4 knobs (Lock, Hits, Rotate, Length, Tension, Density). Replace it with the five styles and the Notes, Feel and Pulse pages from P5 and P6.
  - `README.md:65`: "Ambient and Drone: two vibes". Ambient already exists. Say "Drone, and Ambient reworked with drones…" (P7, P8).
  - `README.md:88`: the Status row "P7 to P11 | Phase 2: vibes, chords, leads, sounds, effects, the Drop, Morph". Vibes (8 of 24), chords and leads are done. Change it to "Phase 2: sounds, effects, sixteen more vibes, the Drop, Morph".
  - Also `README.md:37`: "pickers list whatever exists" overclaims, because patches have no picker yet (C8). Add "(patches get their picker in P7)".

### Minor

- **M1. `tools/shots.py:271` never clears `shots/`.** Eighteen stale screenshots from earlier rows stay beside the 127 new ones and look current: `*-simple-chords-key.png` (the removed Simple Key page, showing "Sad"), `*-simple-chords-chords.png`, `*-generative-pattern.png`, `*-generative-sound.png` and `*-generative-filter.png` without a style, and `*-simple-layer*-generative.png`. A reviewer can mistake them for the current build. **Fix:** delete every `*.png` in `out` before the walk.
- **M2. `tools/shots.py:23` walks only Hook and Pulse.** The Phrase, Roll and Drift screens are never screenshotted or checked by `CHECK` at 360 x 640 and 412 x 915. `lead_values` covers the dial words, and smoke covers sizes at 390 x 844 and 360 x 740. **Fix:** set `LEAD_WALK` to all five styles, or at least add Drift, whose defaults differ most.
- **M3. Neither script checks the 48 px rule at 360 x 640.** `Walk.screen` (`tools/shots.py:143`) runs `CHECK` (fit, scroll, clipping) but not the smoke's `SMALL`, and `narrow_pass` (`tools/smoke.py:91`) runs at 360 x 740. The player ran it by hand at 360 x 640 and found nothing under 48 px. **Fix:** import `SMALL` from `smoke.py` into `Walk.screen` and fail on any hit.

## Verdict

Every Done-when line of P3, P4, P5 and P6 holds on the final build, with two limits:
- P3's one-file claim is weaker than written (S1).
- P6's "no click" is measured only down to the continuity check's limit (C13).

Counts: 0 errors, 2 should-fix, 3 minor.
