# Bundle 7 player: P10 The Drop, P11 Morph

Player: fresh Opus 5.5 agent, 25 Nov 2026. Build at HEAD d76882c (main, pushed). No source file changed.

Read: `CLAUDE.md`, `docs/RUN.md` 4b, `docs/SPEC.md` 8.6, 8.9, 8.11, 8.12, rows P10 and P11 (from f57d04b's backlog), `docs/CHANGELOG.md`, `docs/reviews/P10.md`, `docs/reviews/P11.md`, `README.md`.

## Scripts

- `npm run check`: pass (27 files, 834 tests, build clean).
- `npm run smoke`: pass. Fingerprint 821302e2cafe; all seven parts green in the ledger (core, vibes, additions, effects, drop, morph, cost, 15:13 to 16:13 UTC today), so this run skipped all seven (0.0 min). Not rerun with `--fresh`, as told.
- `python3 tools/shots.py dist /tmp/b7shots`: SHOTS PASSED, 283 screens, 234 picker pages turned.
- My probes (outside the repo, `/tmp/b7probe`): Ambient loaded and playing, at 360 x 640 and 412 x 915; the `shots.py` CHECK and 48 px checks run on Simple Play, Simple Mix, Advanced Mix Morph and Drop, both Pad/Drone pages with the Voicing dial and Advanced Play (all clean); DROP pressed and followed through every state (off pending, build, on, on pending, wind, off); every visible page chip, dial and the DROP and Morph tiles measured in the DOM.

## Done-when, line by line

### P10 The Drop: true

| Line | True now? | Evidence |
|---|---|---|
| Loudness within 1 dB of the section in every vibe, measured in the smoke test across all 24 | Yes | Drop part green on this fingerprint (`tools/dropcheck.py` `drop_vibes`, fails above 1.0 dB and on a bar 1.5 dB past the section's spread). C20's unreproduced probe (Dub techno -4.07 dB, Drone -3.79 dB in one fresh browser) stays open there. |
| Stereo width measurably greater, across all 24 | Yes | Same part, fails under 1.15 times; changelog reads at least 1.23. |
| Stays on until the second press | Yes | Smoke (6 bars) and unit (34 bars); my probe: on for 4 s and more, left only on my second press. |
| Wind-down lands on a bar line in the right section, same and another (tested) | Yes | `walk_drop` checks both. My probe on Ambient: on pending, wind with a 4-bar countdown, off. That the wind-down is not heard as one is C21 (below). |
| Song document identical after the wind-down (tested) | Yes | JSON comparison in `walk_drop`. |
| The button's build, on and wind-down motion follows 8.12 | Yes | Screens: build dark with countdown 8 and four lit segments, on lit yellow with the band, wind drained with countdown 4, off yellow with dim segments. With Morph beside it DROP is 230 x 48 at 360 x 640 and 282 x 56 at 412 x 915; "DROP" at 26 px, never cut. Fill-from-left stripes not caught in my frames (taken on the first build frame); the smoke checks it. |
| The master never clips | Yes, where measured | Highest peak -0.7 dBFS over section, build, impact, drop, wind-down and two bars after. |
| `check` and `smoke` pass | Yes | Above. |

### P11 Morph: true

| Line | True now? | Evidence |
|---|---|---|
| With Morph on, ten minutes of Ambient never repeat a 16-bar stretch exactly (tested) | Yes, as read in C22 | Morph part green; `p11.test.ts`. Counted on notes plus every value Morph moves; by the notes alone 12 stretches repeat (C22, for Pedro's veto). |
| Never leaves the key (tested) | Yes | Morph part: 480 notes, 0 out of key; unit test. |
| Same seed, same ten minutes twice (tested) | Yes | Unit (move for move, bar for bar) and the smoke's live journey against the dry one. |
| A hand-moved control is not touched for 16 bars (tested) | Yes | Unit (five controls) and the smoke's hands check, shown to fail when the hold breaks on bar 15 (P11 review). |
| Morph off changes nothing | Yes | `p11.test.ts` (24 vibes, document and notes); give-backs on Morph off tested in `p11release.test.ts`. |
| `check` and `smoke` pass | Yes | Above. |

Screens of P11: the Morph switch sits on DROP's row to its right, 104 x 48 (360 x 640) and 104 x 56 (412 x 915); "Morph" 15 px and "On"/"Off" 12 px, both with room. On in Ambient: filled purple, icon turned a quarter a bar. Off: dark with a 4 px purple edge (8.12's Off rule). Morph speed dial on the Simple Mix Master page, 111 px wide, label fits. Morph page: five 48 px switches, Speed and Depth, help text under them. Voicing is the sixth dial on the Pad and Drone pages: 54 x 104 at 360 px, label "Voicing" 12 px with 5 px each side, value "0"; at 412 px 63 wide with 9 px each side. Nothing under 48 px, nothing wrapped.

## README

Mostly current: the P10 and P11 bullets, "Built ... P10 and P11" and the Status table are right. Gaps in S2 and M6.

## Errors

None.

## Should-fix

**S1. The Advanced Mix page chips have no room left: labels run to the chip's edge, Morph passes it, and the six chips draw at four sizes.** P10 and P11 each added a chip (Drop, Morph) to Master, Levels, Space, Audio. Measured in the DOM (text box against the chip's border box, each side):
- 360 x 640: chips 54 px; Master 10 px (0.1 px each side), Levels 11.5 px (-0.1), Space 11.5 px (-0.1), Audio 12 px (0.3), Drop 14 px (0.8), Morph 11 px (0.0).
- 412 x 915: chips 63 px; Master 12.5 px (0.1), Levels and Space 14 px (0.5), Audio 1.9, Drop 5.1, **Morph 14 px at -0.4: past both edges**, not shrunk.
- Spec 8.6: text "never overflows the edge". `shots.py` passes it because its edge test allows 0.5 px, and the fit shrinks only to the border, not inside the padding, so every label touches the frame (visible in `360x640-advanced-mix-*.png`: "Master", "Space" and "Morph" sit on the chip's line). One row of chips at 10, 11, 11.5, 12, 12.5 and 14 px also reads as untidy against the look.
- Fix: fit page-chip text inside the chip's padding (a few px each side), and one size for the whole chip row (the smallest any chip needs). Or shorten the icon gap. No threshold change in `shots.py`.

**S2. README is not fully current for what the bundle changed.**
- Layer tabs, *Pad*: "attack, release, brightness, slow filter motion"; *Drone*: "attack, release, brightness, motion". Both pages now also have Voicing (P11), and Pad has Swoop (P7).
- Mix tab bullet lists no Drop page and no Morph page or Morph speed (they are in the P10 and P11 bullets only).
- The P10 bullet says the second press "winds down over two or four bars". Pedro hears it jump back at once (C21); the README should say the wind-down is being reworked (P10b) until it is.
- "Where it is going" does not mention bundle 7b (R1, P10b), which is next in the queue.

## Minor

**M1. Advanced Play at 412 x 915 has an empty band of about 95 px between the header and DROP** (DROP top at 157 px; at 390 x 844 at 86 px). The grid sits on the strip as it should; the slack collects at the top. Not against a spec line; the grid or DROP could take it. `412x915-advanced-play.png`.

**M2. Morph off differs from the look image.** `docs/design/look/groovebox-v3-phone-1-simple-play.jpg` shows Morph off as a plain dark tile; the app gives it the 4 px purple edge of spec 8.12's Off rule. The spec rule is the later one; recorded only so a retouch does not take the difference for a bug.

**M3. The Morph page's help text names a section interval while Sections is off:** "Sections move on every 32 bars" with the Sections switch off. Say "when on" or show it only when Sections is on.

**M4. The Morph speed dial sits alone on a second row of the Simple Mix Master page, left-aligned under Tone**, the rest of the row empty. Fits and works; looks unfinished beside the three-dial row.

**M5. `tools/shots.py` never shows the bundle's screens in their live states.** The walk runs without a vibe ("Pick a vibe"), so Morph is always Off and DROP always idle: no screenshot of Morph on, DROP in build, on or wind-down, or a vibe's Drop and Morph pages. Text fit in those states was checked only by this player's probe (clean). Add a vibe (Ambient) and the DROP states to the walk.

**M6. README "Run it" says smoke builds and plays "and checks every instrument makes sound".** It is now seven resumable parts with a ledger and `--fresh` (P10); one line would say so.

Outside the bundle, seen in passing (not counted): at 360 x 640 the Advanced Drone page chip "Drone · B" is at 10.5 px with 0.2 px to its right edge.

## Already carried, not counted

- **C21:** the wind-down is not heard as one (Pedro). The scripts see a 2- or 4-bar wind phase landing on a bar line, so every P10 Done-when line holds, but spec 8.9's "the extra layers narrow and fall away" is not met by ear. Row P10b.
- **C20:** the unreproduced bass loss in one probe, Drone's 0.75 follower gain, the knob-turn click check that retries.
- **C22:** the notes-alone repeat count and the changed checks of P11.

## Verdict

P10 true, P11 true. 0 errors, 2 should-fix (S1, S2), 6 minor (M1 to M6).
