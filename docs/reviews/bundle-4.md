# Bundle 4 player check (P1, P1b, P2)

Final build at `af1d381`. Player: Opus 5.5. No source file changed.

## Scripts

- `npm run check`: **pass** (12 files, 218 tests, build).
- `npm run smoke`: **pass** (SMOKE PASSED; fonts, icons, lanes, playhead, motion switch, mode switch on all 8 tabs, macros read back in Advanced (41 values), New idea and Back, reload, two takes). The first run was cut off by a session restart, not by a failure; the rerun passed in full.
- `python3 tools/shots.py`: **pass**, 97 screens (both modes, 360 x 640 and 412 x 915). The P1 and P1b changelog lines say 126; the drop is P2's Simple tabs having no pages, and every tab and page in both modes is still walked.

## Done-when, line by line

### P1. The frame

| Line | True now? |
|---|---|
| Nothing scrolls and all text fits at both sizes on every tab and page (tested) | **Yes.** shots.py and smoke walk every screen with the longest names; looked at all screenshots listed below, no wrapped, clipped or overflowing tile text. One heading outside the rule wraps (M3). |
| One row of sections on every screen, a tap means the same everywhere | **Yes.** One strip on every screenshot; smoke: "strip tap from Bass played B". |
| The strip and transport bar sit directly above the tab bar | **Yes**, on every screenshot. |
| A reload brings the jam back | **Yes** (smoke: reload kept song, sections, mix and log; mode remembered over reload). |
| `check` and `smoke` pass | **Yes.** |

### P1b. The look

| Line | True now? |
|---|---|
| Every lane matches what its instrument is playing (tested) and the playhead keeps time | **Yes** (smoke: "5 lanes match the engine, playhead in time"; `src/engine/lanes.test.ts`). How the chord and pad notes are drawn differs from the reference (M1). |
| No font but DM Sans is loaded (tested) | **Yes** (smoke: only `dm-sans-latin-wght` fetched, no other face). |
| Every icon in the spec's table is used where the table says | **Yes for everything that exists** (tab bar, instrument names, Lead/Arp/Pad, page chips, New jam, Back, New idea, group headings; smoke counts 20). Drone, Notes/Feel/FX, effects, Morph and DROP belong to later rows. |
| With motion off every state is told apart by fill and hatching | **Yes by test** (P1b fix of E1, covered in smoke). No screenshot shows a queued tile, so not seen by eye here. |
| The reviewer's screenshot comparison has no open finding | **Not fully.** M1 and M2 below are visible differences from `docs/design/look/` that belong to this bundle. Everything else that differs is by spec, a recorded choice or a later row (list at the end). |
| `check` and `smoke` pass | **Yes.** |

### P2. Simple and Advanced

| Line | True now? |
|---|---|
| Switching mode changes no sound (tested: document identical) | **Yes** (smoke, all 8 tabs; `p2.test.ts` "the Simple / Advanced switch"). |
| Every Simple move is visible in Advanced | **Yes** (smoke reads back 41 values; `p2.test.ts:76`). |
| Each macro at minimum and maximum changes the values it maps (tested) | **Yes** (`p2.test.ts:54`). |
| Back restores the previous lead note for note (tested) | **Yes** (`p2.test.ts:228`, `:248` mid-bar through the engine). |
| `check` and `smoke` pass | **Yes.** |

## Findings

### Should-fix

**S1. README "What it does today" contradicts the build.** `README.md`.
- "Play tab: ... In Simple (for now the header switch), five on/off tiles" is P1-era text: the switch is now the permanent mode switch (P2) and the Simple Now view is five lanes (P1b), as the bullet above it already says. Fix: "In Simple, the five instrument lanes: tap a label to switch it at the next bar, hold to open its tab."
- "Layer tabs: three modes each ... *Generative:* ... with a new-seed button and a row showing the pattern as it plays": the mode button now reads Lead, the 16-step row was replaced by the lane (P1b), and the seed buttons are New idea and Back (P2). Fix: name the mode Lead (Generative in Advanced's knobs), say the lane shows it, and point to New idea and Back.
- "Chords tab: ... seven in-key buttons": true in Advanced only; in Simple they are seven unlabelled colour blocks and the key reads by feel. Add one clause.

**S2. README "Where it is going" and "Status" still list what this bundle built.** `README.md`.
- "Screens that never scroll, text that always fits its tile, one row of sections, and the most-used controls at the bottom in thumb reach" was built by P1; CLAUDE.md says to move built items out of "Where it is going". Remove the bullet.
- Status: the Done row's "What" says "the new frame" but not the look or Simple and Advanced; the P3 to P11 row is titled "Phase 2: Simple and Advanced, vibes, ...", although Simple and Advanced is done. Fix: Done row "..., the new frame, the look, Simple and Advanced"; Planned row "Phase 2: vibes, chords, leads, sounds, effects, the Drop, Morph".

### Minor

**M1. Chord and pad notes merge into solid blocks in the lanes.** `src/ui/logic.ts:552-553` (`laneRects`, `h = 20`, tops over 10..80 %).
Since the P1b fix of M8 every pitched note is 20 % of the lane tall; a synth chord of four or five pitches spread over 70 % overlaps into one tall column (412x915-simple-play: Synth lane), and the Layer 2 pad fills the lane as four touching bands. The reference draws each chord note as a separate small block with a gap, and pad tones as thin bars. Fix: height `min(20, 70 / (distinct pitches in the bar) - 2)` %, keeping 20 % for single-line instruments (bass, lead).

**M2. Advanced Layer: the lane is squeezed beside Back and New idea.** `src/ui/tabs/LayerTab.tsx` (Advanced layout).
At both sizes the Advanced Layer lane is a third of the width, on the row with Back and New idea (412x915-advanced-layer1-generative-pattern, 360x640 same). The reference (`groovebox-v3-phone-3-advanced-layer.jpg`) puts Back and New idea in the title row beside "Layer 1" and gives the lane the full width. The Simple Layer tab already gives it the full width. Fix: move Back and New idea to the title row in Advanced (the On button is beside it in Simple), or carry it to P6, which lays out the Advanced Layer tab.

**M3. Section sheet title wraps at 360 px.** 360x640-simple-section-sheet: "Section A · WWWWWWWWWWWWWW" breaks onto two lines. It is a heading, not a tile, so outside the text-fit rule, but it is the only wrapped text on any screen. Fix: run it through the same fit (shrink, then `stripWord`) as the layer and instrument titles, which already shorten with an ellipsis.

**M4. Drum lane still small on a 640 px screen.** 360x640-simple-drums, -advanced-drums-beat: the lane is about 32 px, the hat, clap and kick rows a few pixels each. Recorded as a choice in P1b; listed because it is still the clearest difference from the reference at 360 px. No change needed unless Pedro finds it hard to read.

**M5. Simple Chords blocks carry no word at all.** 360x640-simple-chords-chords: seven colour blocks with no text, sequence chips read only "1 bar". Within spec 8.1 (no degrees) and P2's fix of E2; P4 replaces this screen with feel cards. No change; listed so P4 does not miss it.

## Screenshot comparison with `docs/design/look/`, by spec, choice or later row (not findings)

- No vibe control on Simple Play, no vibe in the header (P3). No DROP and Morph (P10, P11). No lead style row, no Drone, no Notes/Feel/FX chips, no Chorus/Echo buttons (P5 to P9).
- New jam greyed while playing (P1 choice, until P3). Songs button in the header (P1 row).
- Tab bar two rows of four at 360 px (G2/P1b choice: eight 48 px tabs do not fit); one row at 412 px as in the reference.
- Section names show "WWWW..." because the walk uses the longest names the inputs accept; shortening with an ellipsis is the spec's rule.
- XY readout shows positions ("80 · 20") on Simple, Hz on Advanced; Simple axes Tone and Edge (P2 choice).
- Simple drum picker says Breakbeat where Advanced says DnB (P2 choice).

Looked at: 412x915 simple-play, simple-layer1-generative, advanced-layer1-generative-pattern; 360x640 simple-play, advanced-play, advanced-layer1-generative-pattern, simple-drums, simple-chords-chords, simple-synth, simple-mix-audio, simple-section-sheet, advanced-drums-beat, advanced-mix-levels. No control under 48 px seen, and smoke's 48 px check passed.

## Verdict

**Fix.** 0 errors, 2 should-fix (README), 5 minor. Every tested Done-when line of P1, P1b and P2 is true on the final build; the one P1b line not fully met is the screenshot comparison (M1, M2).
