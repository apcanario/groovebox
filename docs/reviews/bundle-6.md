# Bundle 6 player check (P7, P9, P8)

Player: Opus 5.5, 24 Nov 2026, on `main` at e6338bd (all of bundle 6 pushed). No source file changed. Done-when lines recovered from `docs/BACKLOG.md` at the commit before each row closed (`a2c941f^` for P7, `2a91110^` for P9, `e6338bd^` for P8).

Chunks: 1 scripts, 2 P7 lines, 3 P9 lines, 4 P8 lines, 5 README and docs consistency, 6 whole-bundle interactions, then the verdict.

## 1. Scripts

- `npm run check`: pass. 22 test files, 784 tests, build ok.
- `npm run smoke`: **SMOKE PASSED**, about 19 minutes (18:12 to 18:31), **no PAGE ERROR line**. Oscillator probe 215 to 226 Hz on three waves; patch disconnected 23490 ended oscillators, 0 threw. All 24 vibes landed on the bar, every instrument audible with a tone (lowest tonal share: bass in Trance 35 of 56). Borrow picker at 360 x 640: 24 tiles, lowest 48.3 px. P9 cap: the seventh switch turned the oldest off, jump 0.98. Lo-fi button jump 1.04. 300 Crush and Shifter builds: 0 worklets alive, load 30.0% to 27.1%.
- Cost lines in this smoke run (this box, not the phone): slots off 74.2% / 16.5 ms; six on 82.4% / 27.6 ms; heaviest six 85.5% / 57.5 ms; all ten 83.0% / 14.8 ms; Tail drag 80.6% / 16.5 ms. These are about 10 points above P9's recorded 64.2 / 69.4 / 71.5 / 71.9 (same tool family, single run, heavier box: the P8 changelog already says "the box runs heavier than in P9"). Ordering holds (off < six < heaviest six). Not a failure; it does mean the box measures cannot say whether the six-slot cap is enough on the phone (C16 already leaves that to Pedro).
- `python3 tools/shots.py`: **SHOTS PASSED**, 279 screens, 234 picker pages turned (at least 28), 2 min 21 s. Matches the P8 changelog's 279 and 234.

## 2. P7 Done-when lines

Row text recovered from `git show a2c941f^:docs/BACKLOG.md`. Done when: "each addition is audible and can be turned off; nothing clicks when one is switched while playing; the voice cap holds; `check` and `smoke` pass."

- **Each addition is audible and can be turned off: true**, within what a script can hear. Measured in this smoke run: Perc and Shaker -26.0 dB alone, -69.9 dB at level 0; FM wave on the synth -34.3 dB, noise and FM on Layer 1 -40.0 and -43.9 dB; drone 2 notes held, 2 glides, -29.8 dB; drift, synced LFO, lo-fi, air, 20 s reverb and the noise breath each report running when on and stopped when off. The smoke test checks running state, not sound, for the air, lo-fi and LFO, so the player measured them (`/tmp/probe/probe6.py p7`, every instrument gated off while playing, master peak after the limiter): air 1 -39.7 dBFS, back to silent at 0; lo-fi hiss -46.0 dBFS, silent when off; a held pad's level moves over 84.8 dB with the synced LFO at depth 1 against 12.7 dB at 0. 16-step beats with rolls, 4- and 8-bar chords, 20 s attack and release, Swoop and the Drone mode are unit-tested (`src/engine/p7.test.ts` 70, 89, 109, 133-200, 252, 287) and on screen (Steps page with 8 steps and 1-8 / 9-16, Kit page with Perc and Shaker dials, Drone in the mode row in both modes, Root / Root + fifth, Attack s, Release s, Swoop dials; Mod page with Saw, Square, Tri, Sine, FM, Noise, LFO rate, Drift). Screens checked: `shots/360x640-advanced-drums-steps.png`, `-drums-kit.png`, `-layer1-drone-mod.png`, `-layer2-drone-pattern.png`, `-simple-layer2-drone.png`, `412x915-simple-layer1-drone.png`; no cut-off or wrapped text, every control 48 px or more (shots.py passes the size and text-fit checks on all 279).
- **Nothing clicks when one is switched while playing: true for every switch the smoke test makes** (drift, synced LFO, Swoop, fifth, LFO rate and drift rate changes, arp to drone, four wave changes through FM and noise: largest 1.37 times its own reference, a click is above 2.5; master lo-fi switch 1.00). Limit, already carried as C16: the air's and the reverb's stepped switches are not caught (0 of 8 and 3 of 8 in this run), so those two are counted, not judged. No new finding.
- **The voice cap holds: true.** Voices during the drone walk synth 10 of 16, layer1 8 of 10, layer2 4 of 10; smoke fails over twice the cap with ringing sets, and on sounding voices over the cap.
- **`check` and `smoke` pass: true** (chunk 1).
- Row bullet "Measure the cost": reported in the P7 changelog line and C15. True.

P7: every Done-when line true.

## 3. P9 Done-when lines

Row text recovered from `git show 2a91110^:docs/BACKLOG.md`. Done when: "every effect is audible on every instrument and can be switched mid-jam without a click (tested by level continuity); Simple needs no knob to use them; the cost is reported; `check` and `smoke` pass."

- **Every effect is audible on every instrument: true.** Smoke: all 12 effects on all five instruments through slot 1, weakest Tremolo on Layer 1 at 0.112 of the input (wanted 0.1); slot 2 on Bass, all 12, weakest Crush 0.267; every off slot passes the sound unchanged and is disconnected. Slot 2 is tested on one instrument only; slot 1 and slot 2 are the same class (`src/engine/fx.ts`), so this is a limit, not a finding.
- **Switched mid-jam without a click, tested by level continuity: true.** Smoke: stepped switches caught 40 of 40 for every effect (8 of 8 on every instrument), so the check can fail; shipped (ramped) switches clicked 0 of 480, largest 1.08 times its own reference; every knob of every effect low to high while playing 1.39; effect changed while on 1.02; the seventh switch (cap) 0.98; Lo-fi button 1.04. A click is above 2.5.
- **Simple needs no knob to use them: true.** Smoke: Simple effect buttons and the Lo-fi switch work. Screens: Simple Bass has two on/off buttons named Fuzz and Chorus stacked beside the XY pad (`shots/360x640-simple-bass.png`); Simple Layer 1 has Echo and Phaser in the row of Back and New idea (`360x640-simple-layer1-generative-hook.png`); Simple Mix Space has Lo-fi as one on/off (`360x640-simple-mix-space.png`). No effect knob on any Simple screen. Advanced FX page: two slot chips, on/off, effect, three dials (`360x640-advanced-bass-fx.png`, `-layer1-generative-hook-fx.png`); the picker is a sheet of the twelve, 3 x 4 with Close, every tile 48 px or more (`360x640-advanced-fx-picker.png`). Matches spec 8.8's P9 notes; no text cut off or wrapped.
- **The cost is reported: true.** P9 changelog line, C16 and spec 8.8: all off 64.2%, six in use 69.4%, heaviest six 71.5%, all ten 71.9% (median of 5). The six-slot cap is in spec 8.8 and `MAX_ACTIVE_FX = 6` (`src/music/effects.ts` 37). This box measured about 10 points higher today (chunk 1); same ordering.
- **`check` and `smoke` pass: true.**
- Row bullets: tempo sync true (smoke checks 45 synced rates across the 24 vibes at each vibe's tempo, and Tremolo 2.000 Hz at 120 bpm, 1.500 Hz at 90 bpm; Echo 0.250 s, 0.333 s); the eight P3 vibes set two effects per instrument (unit-tested, and smoke checks every vibe's slots play as its song sets them).

P9: every Done-when line true.

## 4. P8 Done-when lines

Row text recovered from `git show e6338bd^:docs/BACKLOG.md`. Done when: "all 24 styles load and play (smoke test loops them); every list meets its count; every name fits its tile (tested); `check` and `smoke` pass."

- **All 24 styles load and play, smoke loops them: true.** This run: all 24 tapped from the picker mid-jam, each landed on the bar, every instrument audible with a tone over two bars (the AC-level and zero-crossing check of P8 review S2), each kept as a new song in Songs, each vibe's effect slots playing as its song sets them; arrows next and previous land on the bar. Oscillator probe 215 to 226 Hz on three waves.
- **Every list meets its count: true.** Files: 26 beats (spec: at least 24), 14 bass rhythms (14), 10 synth rhythms (10); patches 9 drums, 9 bass, 9 synth, 17 layer (at least 8 each). Every spec name present (unit test in `src/music/styles.test.ts`).
- **Every name fits its tile, tested: true.** No beat, rhythm, patch or style name over 14 characters (player grep: 214 names, 0 long; progression names too). `shots.py` turned 234 picker pages at both sizes and ran the text-fit check on each; pass. Screens: the vibe picker at 360 x 640 shows all 24 tiles, two columns, family colours, Continue first, nothing cut or wrapped, no title or Close (`shots/360x640-advanced-vibe-picker.png`); the borrow picker the same with "This jam's vibe" (`360x640-simple-chords-borrow.png`), smoke: lowest tile 48.3 px. Spec 8.6's 636 px layout holds (12 rows, 1 px gaps).
- **`check` and `smoke` pass: true.**
- Row bullets: every style sets two effects per instrument (player count: 10 slots in each of the 24 files, 3 or 4 on, so the cap of six holds on arrival); Lo-fi has `lofi: 1` (`src/styles/loFi.ts` 22) with Crush and Chorus on the keys; Ambient has the Shimmer and Airy pads (`src/styles/ambient.ts` 20-21); Drone uses the Drone layer, Swoop, long envelopes, air and a 16 s reverb (unit-tested). C9 and C10 met (smoke 24-tile checks; library retagged, at most 0.6 overlap, unit-tested).

P8: every Done-when line true. Whether each vibe sounds like its name stays Pedro's ear (C19).

## 5. README and docs consistency

README "What it does today" has the P7, P9 and P8 bullets (lines 31-33), and Status (line 86) and "Where it is going" (line 64) are right. Older bullets further down were not updated by the bundle and now say less than, or the opposite of, what the app does:

- **D1 (should-fix). `README.md` 49-52, Layer tabs: "three modes each" (Arp, Pad, Lead).** There are four: Drone is on the mode row in both modes (`shots/360x640-simple-layer2-drone.png`). Fix: "four modes each", and add "*Drone:* root, or root and fifth, held and gliding between chords (Swoop); attack, release, brightness, motion."
- **D2 (should-fix). `README.md` 47, Drums tab: "an 8-step sequencer per drum voice".** The sequencer has six voices (Kick, Clap, Hat, Open, Perc, Shaker), an 8 / 16 step switch with 1-8 and 9-16 pages, and a Kit page (`shots/360x640-advanced-drums-steps.png`, `-drums-kit.png`). Fix: "an 8- or 16-step sequencer for six voices (Perc and Shaker on the Kit page), level and decay per voice, kick pitch and drive, and an FX page."
- **D3 (should-fix). `README.md` 46, Chords tab: "lengths of half a bar, one bar or two".** The editor cycles 1, 2, 4, 8 and half a bar (`src/ui/logic.ts` 11). Fix: "lengths of half a bar to eight bars".
- **D4 (minor). `README.md` 38: "A library of 143 progressions".** `src/data/progressions/` holds 172 files now (P8 added 29 four- and eight-bar cards). Fix: "172".
- **D5 (minor). `README.md` 40: "(patches get their picker in P7)".** P7 built it. Fix: delete the parenthesis.
- **D6 (minor). `README.md` 48, Bass and Synth tabs: "rhythm and wave pickers".** Each also has a Sound picker of patch files and an FX page. Fix: "rhythm, sound and wave pickers, ... and an FX page".
- Source comment, not a README line (minor): `src/ui/logic.ts` 181 says "Cycle a chord's length: 1 bar, 2 bars, half a bar" while `LENGTHS` (line 11) is 1, 2, 4, 8, 0.5. Fix: "1, 2, 4 and 8 bars, then half a bar." Left unchanged here (no source edits).

`docs/CHANGELOG.md` and `docs/BACKLOG.md` against the code:

- Counts true: 24 style files; 26 beats, 14 bass, 10 synth rhythms; patches 9 / 9 / 9 / 17 ("9 to 17" in the P8 line and README); 784 tests; 279 screens and 234 picker pages (this run).
- Cap of six: spec 8.8, `MAX_ACTIVE_FX = 6` (`src/music/effects.ts` 37), README 32, P9 line, C16, all agree; every vibe arrives with 3 or 4 on.
- C14 true (`src/engine/mods.ts` 315: 3.2 s impulse plus feedback; `src/style.css` 1520: icons hide under 400 px). C16 true (figures match spec 8.8). C17 true (smoke took about 19 minutes; drum check reads the output's peak, `tools/smoke.py` 365). C19 true (`src/engine/oscPatch.ts`, probe and patch checks in smoke; 0 throws this run). C15 true as history.
- **D7 (minor). `docs/BACKLOG.md` 26 (C15, "for P9") and 28 (C17, "for P8") are addressed to rows now Done.** C15's decision is in spec 8.8 and its figures in the P7 changelog line; C17 is smoke notes with no open fix or listen item. Fix: clear both at the bundle close (or fold C17's "smoke takes about 19 minutes" into RUN.md if it is wanted).
- **D8 (minor). `docs/BACKLOG.md` 56-70, the Bundle 6 section** keeps three "Done, see the Done list" stubs; bundles 4 and 5 read "All rows of this bundle are Done. The player's check of the bundle is in `docs/reviews/bundle-N.md`." Fix at the close: the same two sentences with `bundle-6.md`. Also C11 to C13 (lines 30-32) sit after C19; move them above C14 to keep the list in order.
- Cleared items really cleared: **C8** (Simple Synth lists patches: Warm stab, Dub chord, Pluck, Soft keys, More, `shots/360x640-simple-synth.png`; every Advanced Sound page lists `patchIds`, `src/ui/tabs/SimpleTab.tsx` 104); **C9** (spec 8.6 edited, 24 tiles at 360 x 640, smoke 48.3 px lowest in the borrow picker); **C10** (per-vibe profiles, unit-tested, Ambient and Drone cards of 4 and 8 bars); **C18** (`src/engine/attacks.ts` 27 and 76, `MIN_GAP` 0.1 ms, test in `attacks.test.ts` 115; no PAGE ERROR in this smoke run).

## 6. Whole-bundle interactions

Player probes, `/tmp/probe/probe6.py` (not committed; it imports `tools/smoke.py`'s helpers), on the built `dist`, headless Chrome on this box.

- **Effects on Ambient and Drone, long envelopes: no click, no clip, no silence.** Each vibe loaded from its tile, every slot off, then each of the twelve effects switched on and off in slot 1 of both layers (the long pads and the drone). Fuzz and Crush read 5 to 12 times the clean layer's jump, but against the effect's own steady sound (the check smoke uses, P9 review E3) four off/on rounds gave 0.95 and 0.99 on Ambient and 0.89 and 1.00 on Drone: the jump is the distortion's and the crusher's own edge, not a click. The other ten effects read 0.78 to 1.45 against the clean sound (a click is above 2.5). Master peak -2.6 to -8.9 dBFS throughout. With the heaviest six on (Shifter, Flanger, Tremolo, Vowel, Crush, Pan) every instrument still sounds with a tone; Drone 51.3% load and 14.3 ms worst stall with the vibe's own slots, 65.4% and 13.5 ms with the heaviest six; Ambient 53.7% / 11.4 ms, then 61.5% / 38.5 ms (single runs). Worklets: 0 with every slot off, 2 with Crush and Shifter on.
- **Lo-fi master with the Lo-fi vibe's own Crush and Chorus: fine.** Lo-fi arrives with `lofi: 1`, Crush and Chorus on the keys (synth) and Tremolo on Layer 2, one worklet alive (Crush; the lo-fi master's crush is not a worklet). Every instrument sounds with a tone; master peak -5.6 dBFS with the master on, -3.3 off. Six lo-fi switches over the vibe's own Crush: jumps 0.50 to 0.83 of the master's own reference. Load 56.5% with, 54.0% without (single runs, inside the measure's spread).
- **Switching vibes with effect slots on: the cap holds, nothing is left over.** 25 landings (all 24, then Deep house again). Before each, Crush put in Layer 1 slot 1, Shifter in Layer 2 slot 1, and all ten slots switched on: 6 on every time (the cap), worklets alive equal to the Crush and Shifter slots on, every time. After each landing (5 s for fades and Echo's ring-out): the slots on equal the new vibe's song (25 of 25), 3 or 4 on, wired slots equal slots on (no disconnected effect left in the path), worklets alive equal to the vibe's own Crush and Shifter slots (0 in all but Minimal techno, which has 1). Load after the 25 landings 62.7% / 14.3 ms against 58.8% / 13.6 ms on a fresh page with the same vibe (single runs; C15 puts a single run's spread at about 10%), so no sign of a leak. No page error.
- **Saved songs from before P7 load on this build: true.** The bundle-5 head (d456af1, 8 vibes, song document without `fx`) built and served; all eight vibes tapped (eight songs autosaved), an edit made. The same origin and browser profile then served this build (HTTP cache off): the picker showed Continue last jam, all 8 songs listed, Continue opened Ambient and it played; each of the 8 opened through the keeper and played (master -16.8 to -30.6 dB); every effect slot off as P9's defaults say (no effect switched on by the migration); no page error in either build. A pre-P7 Lo-fi song keeps its saved mix (no lo-fi master): correct, a song plays as saved.
- Morph (P11) not built; not judged.

No finding in this chunk.

## Verdict

**fix**, documents only. Every Done-when line of P7, P9 and P8 is true on this build; `check`, `smoke` (no PAGE ERROR) and `shots.py` pass; the bundle's interactions hold. Three should-fix README lines (D1 Layer tabs have four modes, D2 the Drums tab has a 16-step switch and six voices, D3 chord lengths reach eight bars) describe the app as it was before P7, against the CLAUDE.md rule that the README says what the app does today. Five minor (D4 progression count 172, D5 stale P7 parenthesis, D6 Sound picker and FX page on Bass and Synth, D7 clear C15 and C17, D8 the bundle-6 section and C11 to C13 order) and one source comment (`src/ui/logic.ts` 181). No engine, UI or test change is needed.
