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
