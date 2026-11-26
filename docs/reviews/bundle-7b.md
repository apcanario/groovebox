# Player: bundle 7b (R1, P10b, P10c, P10d)

Base `be700f4`. Player: fresh agent, Opus 5.5 (main chat Sonnet 5.5). Read: `CLAUDE.md`, `docs/RUN.md` (4b), spec 8.6, 8.9, 8.11, 8.12, the Done entries and changelog lines of R1, P10b, P10c, P10d, `docs/reviews/R1.md`, `P10b.md`, `P10c.md`, `P10d.md`, `bundle-7.md`, Carried C23 to C29. This player also fixes (bundle 7b prompt).

## Scripts

- `npm ci`, `npm run check`: pass (860 vitest tests, 18 `tools/test_smoke_parts.py` tests, build), on `be700f4` and again after the fixes.
- Full smoke on `be700f4` plus the C26 hold fix (`tools/shots.py`, core only), fresh ledger: **SMOKE PASSED, all 12 parts green in 62.1 min** (core 9.2, vibes 3.3, additions 1.9, effects 6.2, drop-1 5.1, drop-2 3.7, drop-3 3.3, drop-4 4.2, drop-5 3.8, drop-6 7.7, morph 12.6, cost 1.2). drop-5 and drop-6 passed: C24 did not show. Drop groups: loudness within 0.07, 0.04, 0.28, 0.17, 0.19 and 0.57 dB (Drone), a single bar within 1.38 dB (twoStep), at least 1.23 times wider (twoStep), highest peak -0.8 dBFS (breakbeat).
- `python3 tools/shots.py dist /tmp/shots`: SHOTS PASSED, 305 screens (283 frame walk, 22 live), 234 picker pages turned. Looked at Simple and Advanced Play at both sizes in Morph on and the three DROP states, the Mix Drop and Morph pages, the layer and bass page rows, against `docs/design/look/groovebox-v3-phone-1-simple-play.jpg`.
- After the fixes (S1, M1): `check` pass; `shots.py` pass (305 screens); the new page-chip check fails on the old CSS (363 failures, at both sizes) and passes on the new; full smoke rerun (every part, `src/style.css` is in every fingerprint): **SMOKE PASSED, all 12 parts green in 61.1 min**, drop-5 and drop-6 green again (the run was carried through one server restart).
- Probes below: `/tmp/probe/` (not committed), one browser at a time, never beside a smoke.

## Probes (C24, C29)

Probe: `/tmp/probe/probe.py` (not committed), HEAD's `tools/dropcheck.py` driving the real app in headless Chrome. Per run: a vibe loaded mid-jam (`loadAtBar`), the layers' lead seeds moved by `rep x 7919` (reps 0 to 3; the bass has no seed of its own, so a "seed" here is a rep with other leads), 16 steady bars read (master K-weighted level, width, peak), then `one_drop` and its judges (`judge`, `judge_wind`) as the drop parts run them. Order per rep: Minimal Techno, IDM, EDM, Electro, Progressive (the five vibes on the Rubber square bass), Drum and bass (for drop-3's width). Four reps, 24 drops per build, one page per build.

"Before" is HEAD with `src/engine/attacks.ts` and its test put back to `8195ce0` (the parent of `42d9aad`), in a separate worktree. `42d9aad` touched only those two files; everything else in `src/` after it is the `dropLoopBars()` test hook HEAD's drop check needs, so this build plays the parent's audio.

### C29: master peak (dBFS) through section, build, impact, drop, wind-down and two bars after; limit -0.5

| Vibe | Before: median, top, over -0.5 | After: median, top, over -0.5 |
|---|---|---|
| Minimal Techno | -1.16, -1.14, 0 of 4 | -1.18, -0.93, 0 of 4 |
| IDM | -1.03, -0.93, 0 of 4 | -0.94, -0.66, 0 of 4 |
| EDM | -1.13, -0.99, 0 of 4 | -0.95, -0.82, 0 of 4 |
| Electro | -1.17, -1.01, 0 of 4 | -1.05, -1.03, 0 of 4 |
| Progressive | -1.06, -0.89, 0 of 4 | -0.95, -0.88, 0 of 4 |
| Drum and bass | -0.95, -0.86, 0 of 4 | -0.92, -0.78, 0 of 4 |

After `42d9aad` the rubber vibes' peaks sit 0.0 to 0.2 dB higher in the median (IDM's top 0.27 dB higher), as the wave and sub now add in phase; no peak passed -0.5 dBFS in 48 drops on either build, so the limit is not exceeded more often after. The smoke's -0.32 (Minimal Techno) and -0.26 dBFS (IDM) were not reproduced. No engine change made for C29, no threshold touched.

Drum and bass wind-down bar 1 width (drop-3): before 0.068 to 0.089, after 0.070 to 0.090 (section 0.037), 0 of 8 failures; the smoke's 0.120 to 0.144 was not reproduced.

### C24: the rubber-bass level step

| Vibe | Before: 16 steady bars, widest range dB; runs with a level failure | After: same |
|---|---|---|
| Minimal Techno | 0.96; 0 of 4 | 0.85; 0 of 4 |
| IDM | 3.07; 4 of 4 (drop -1.83 dB, bars to -3.35; after the wind-down to -5.23) | 0.72; 0 of 4 |
| EDM | 1.09; 1 of 4 (-1.80 dB after) | 1.99; 1 of 4 (the section already 2 dB down and wider, +2.31 dB after) |
| Electro | 3.15; 2 of 4 (+1.75, -1.85 dB after) | 1.25; 0 of 4 |
| Progressive | 1.17; 0 of 4 (one wind-down end read late) | 1.44; 0 of 4 |
| Drum and bass | 1.86; 0 of 4 | 1.89; 0 of 4 |

Before: 8 of 24 runs failed a level line, plus two page errors "Start time must be strictly greater than previous start time". After: 1 of 24. `42d9aad` removed most of C24; it is not gone.

**The cause of what is left (measured).** A second probe hangs an analyser on the bass's live wave and sub voice sets and reads their correlation each bar (square against sine at one pitch reads 0.82 to 0.90 in phase). Without drops, 29 loads of the five rubber vibes: 0.82 to 0.91 throughout (one single bar of Progressive at 0.56, back the next bar), no lasting step. With a drop in each load: in 4 of 28 loads the correlation fell inside one bar and stayed there (IDM 0.86 to 0.66 and 0.80 to 0.46, mid-drop; EDM 0.88 to -0.04 four bars after the wind-down, and 0.88 to 0.57 to -0.77 at the drop), and the master fell 0.5 to 1.5 dB with it. Tone's own calls were logged at each fall: the bass's wave and sub got a fresh start at one time (366.45218 s, an attack moved to `LATE_LEAD` past a current time of 366.40218 s), but the main thread issued the wave's native `start` at a current time of 366.41088 and the sub's at 366.43120, 20 ms later, inside Tone building the sub's OscillatorNode; with 21 ms left, the sub started late and the two ran out of phase while legato. So the 50 ms lead of `42d9aad` covers the attack's decision, not the time the attack itself takes on a stalled main thread. Most attacks in the headless runs were late (started at exactly `LATE_LEAD` past the current time).

Not fixed here: Pedro decided on 26 Nov to fix C24 after the MVP and the APK, and a sure fix changes how the bass's oscillators run (see E1). Carried as C24, updated.

## Done-when, line by line

### R1 (5 lines)

| Line | True now? | Evidence |
|---|---|---|
| `docs/RUN.md` and `CLAUDE.md` say the cycle: per-part fingerprints, one full smoke per row by the main chat, builders, reviewers and fixers run `check` and only the touched part, slices of 45 minutes or less, the watchdog | Yes | RUN.md sections 1, 3, 4, 4d; CLAUDE.md Commands. |
| The per-part fingerprint test passes | Yes | `tools/test_smoke_parts.py`, 18 tests, inside `npm run check`. |
| The drop part runs in groups | Yes | drop-1 to drop-6, four vibes each, `DROP_GROUPS` 6; `uncovered()` passed at the smoke's start. |
| `check` and `smoke` pass | Yes | Above. |
| P10b built under the new cycle | Yes | P10b's changelog line (slices, parts, one full smoke at close). |

### P10b (6 lines)

| Line | True now? | Evidence |
|---|---|---|
| A test measures the descent bar by bar (level, width, overlay voices fall in steps, reach the section's values at the end, all 24 vibes) | Yes | `judge_wind` in drop-1 to drop-6, each vibe at its own 2 or 4 bars; all six groups green. |
| A press during the wind-down still does nothing | Yes | The `pressed` check in every vibe. |
| The song document is unchanged after it | Yes | Read in the last wind-down bar in all 24 vibes, and two bars after where Morph is off. |
| The Filter value kept during the drop is applied at the end and not before | Yes | `walk_drop` (drop-1) and Ambient's 4-bar wind-down (drop-6). |
| The stuck-note and click checks pass | Yes | `live_after == 0`, layers at -120 dB, no click over `CLICK_FACTOR` in every drop group. |
| `check` and `smoke` pass | Yes now (was false at P10b's close: drop-5 and drop-6 red on C24) | Both full smokes here. |

### P10c (7 lines)

| Line | True now? | Evidence |
|---|---|---|
| No Advanced Mix chip label closer than its padding to the chip edge, all six at one size (tested, fails on the old layout) | Yes | `MIX_CHIPS` in the frame walk; and now every page row (S1 below). |
| The band above DROP in Advanced Play at 412 x 915 is gone | Yes (moved to P10d) | `play_place`; screens `412x915-advanced-play*.png`: grid to DROP 10 px, DROP on the strip. |
| Morph help matches the Sections state (tested against both states) | Yes | `#morph-help` in both screens of the live walk; the unit test. |
| The Morph speed dial shares a row on the Simple Mix Master page at both sizes | Yes | `MORPH_SPEED_ROW`; two by two. |
| `shots.py` writes Morph on and the three DROP states and fails if one is missing | Yes | 22 live screens written. |
| No threshold changed | Yes | |
| `check` and `smoke` pass | Yes | |

### P10d (5 lines)

| Line | True now? | Evidence |
|---|---|---|
| A test taps Play and samples the button over 2 s while the transport runs and fails if it ever shows the stopped state (Simple and Advanced) | Yes | `sample_play` on the first tap (every part's `open_app`) and `walk_play_button` (core, `shots.py`), all green. |
| A test measures DROP and Morph at 360 x 640 and 412 x 915 in both modes and fails if their top edge differs between Simple and Advanced or moves when Advanced switches page | Yes | `play_place`, all Play screens and after every tab; green. Screens: DROP top the same in all eight Play screens of each size. |
| The band above DROP in Advanced Play at 412 x 915 is gone | Yes | As above. |
| Stuck-note and click checks pass | Yes | All drop groups. |
| `check` and `smoke` pass | Yes | |

### Carried notes

| Note | True now? |
|---|---|
| C23 (bundle 7 S1, M1 to M5) | Closed in P10c and P10d and true now (chips, band, help text, dials two by two, live walk); M2 kept as the spec says. S1's rule now holds on every tab (S1 below). |
| C24 (rubber-bass level jump) | Still happens, less: 1 of 24 probe runs after `42d9aad` against 8 of 24 before; drop-5 and drop-6 passed in the full smoke. Cause of the rest measured (E1). Open, updated. |
| C26 (section hold; chip rows on other tabs; drop-6 drone) | Hold fixed (M1); chip rows fixed (S1); drop-6 passed with Drone at -0.57 dB, a single bar -1.36 (limit 1.5 past its own 1.36). Closed. |
| C27 (drone and ambient drop level) | True in the full smoke: Ambient +0.28 dB, Drone -0.57 dB against the same places of their 16-bar loops; Drone's bar lines +0.06 dB. Two more passes on top of P10d's two. Closed; Ambient's unexplained 3.6 to 5.6 dB decline did not show (see M3). |
| C28 (P10d carried) | Unchanged: Draw's 0.25 s expiry, `src/ui/vibes.tsx:40` `engine.playing` (harmless), the first-tap dim. Pedro's exact symptom is still for the phone. |
| C29 (drop-2, drop-3, drop-5 one-offs) | Not reproduced in 48 probe drops or the full smoke; peaks after `42d9aad` 0.0 to 0.2 dB higher in the median, none over -0.5 dBFS (top -0.66, IDM). Closed as not more often; M2 to watch. |

### README

Stale in "Where it is going" (bundle 7b's player pass and the C24 text) and the status line; fixed (S2).

## Findings

### Errors

**E1. C24's remaining cause: the bass's wave and sub can still start out of phase when the main thread is slow inside an attack.** `src/engine/audio.ts:811-815` (`Bass.trigger` starts `live` then `sub`), `src/engine/attacks.ts:84-90` (`LATE_LEAD` 0.05). The attack's time is decided once, 50 ms past the current time, but Tone builds each oscillator's native node inside `start`, and on a stalled thread that took 9 ms for the wave and 20 ms for the sub, so the sub's native start reached the audio thread with 21 ms left and started late. Legato keeps the offset (Tone's restart keeps a running oscillator), so the square and its sine sub at one pitch cancel the fundamental: correlation 0.86 to between 0.66 and -0.77, master 0.5 to 1.5 dB down, wider (the centre falls), until a gap in the bass lets both stop. Probe: 4 of 28 loads with a drop, 1 of 24 full drop runs failed its level lines (EDM). A larger `LATE_LEAD` only moves the margin and delays every late note; the fix is structural: run the bass's two oscillators for the life of their voice set, started together once (well ahead, while the set is silent) and gated only by their envelopes, so no note can start one without the other; or build the sub from the wave's own oscillator. **Not applied:** Pedro decided on 26 Nov to fix C24 after the MVP and the APK, and either fix changes how the bass is built (its sound must be heard again). Carried as C24, updated.

### Should-fix

**S1. Page chips on the other tabs still ran their labels to the chip edge (C26).** `src/ui/components.tsx:439`, `src/style.css:1962`. Measured on every tab, page and mode at both sizes: 10 labels inside 0 px of their padding, five past the border by 0.2 px (360 x 640: Bass Rhythm and Sound, Layer Drone/Pad/Arp pattern chips "Drone · A" at 10.5 px; 412 x 915: a Lead's Sound, Notes, Pulse, Drums Steps). **Fixed:** the P10c rule (icon over the word, 12 px) now applies to every six-chip page row, and to five-chip rows under 400 px of width; 108 chips measured, 0 inside their padding, none under 48 px. `PAGE_CHIPS` in `tools/shots.py` checks every page chip on every screen of the frame walk (fails on the old CSS with 363 findings, passes now). Look: the 412 px six-chip rows and the 360 px five-chip rows now set their icons over the words, as the Mix row does; for Pedro's veto.

**S2. README out of date.** "Where it is going" still named the bundle 7b player pass as next and C24 as a likely recheck. **Fixed:** bundle 8 is next; C24's state as measured here.

### Minor

**M1. The section-sheet hold slept a fixed 0.7 s (C26).** `tools/shots.py:372`. **Fixed:** it holds until the sheet opens, at most 3 s (the long-press timer is 500 ms); no threshold.

**M2. C29: the rubber vibes' peaks moved up 0.0 to 0.2 dB with `42d9aad`.** Top -0.66 dBFS (IDM) against the -0.5 limit, 0 of 48 over. Not a defect (in phase is the intended sound) and no change made; if the drop-2 or drop-5 peak one-off comes back, the drop's limiter headroom is where to look, not the threshold.

**M3. Ambient's and Drone's level moves with their chords (measured, for the ear).** 32 steady bars, two loads each, Morph on: Ambient -18.7 to -15.6 dB K-weighted, the same 16-bar shape in both loads (the first chord's 4 bars 2 dB under the next, steps up to 2.0 dB on chord lines); Drone -13.8 to -11.4 dB, a 1.2 to 1.3 dB step down at its chord change (bar 8) and a slow drift with Morph. No dropout (no bar more than 3.1 dB under the loudest), no click (largest jump 0.04 to 0.08 of the peak), the bass's two sines in phase (correlation 0.97 to 1.00). Whether Ambient's first chord should sit 2 dB under the rest is for the ear. Drop-6: Ambient +0.28 dB, Drone -0.57 dB; after the wind-down Ambient read +1.19 to +1.30 dB and Drone -1.07 to -1.29 dB from the section with Morph moving (judged per bar only, inside 1.5 past each one's own spread). Morph part: 160 bars of Ambient, 480 notes, 0 out of key, 0 repeated 16-bar stretches (12 by the notes alone), the live journey equal to the seeded one, master peak -1.6 dBFS. Carried for the ear (C25, C22).

**M4. `src/ui/vibes.tsx:40` still waits on `engine.playing` after a picker tile (C28).** Harmless (it only decides whether to call `play()`); left.

## Verdict

R1, P10b, P10c and P10d: every Done-when line true now. 1 error (E1, C24's remaining cause, carried for Pedro's decision), 2 should-fix (S1, S2, fixed), 4 minor (M1 fixed; M2 to M4 recorded). No threshold changed; Pedro's 5 to 10 percent allowance was not used.
