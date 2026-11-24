# Bundle 6 player check (P7, P9, P8)

Player: Opus 5.5, 24 Nov 2026, on `main` at e6338bd (all of bundle 6 pushed). No source file changed. Done-when lines recovered from `docs/BACKLOG.md` at the commit before each row closed (`a2c941f^` for P7, `2a91110^` for P9, `e6338bd^` for P8).

Chunks: 1 scripts, 2 P7 lines, 3 P9 lines, 4 P8 lines, 5 README and docs consistency, 6 whole-bundle interactions, then the verdict.

## 1. Scripts

- `npm run check`: pass. 22 test files, 784 tests, build ok.
- `npm run smoke`: **SMOKE PASSED**, about 19 minutes (18:12 to 18:31), **no PAGE ERROR line**. Oscillator probe 215 to 226 Hz on three waves; patch disconnected 23490 ended oscillators, 0 threw. All 24 vibes landed on the bar, every instrument audible with a tone (lowest tonal share: bass in Trance 35 of 56). Borrow picker at 360 x 640: 24 tiles, lowest 48.3 px. P9 cap: the seventh switch turned the oldest off, jump 0.98. Lo-fi button jump 1.04. 300 Crush and Shifter builds: 0 worklets alive, load 30.0% to 27.1%.
- Cost lines in this smoke run (this box, not the phone): slots off 74.2% / 16.5 ms; six on 82.4% / 27.6 ms; heaviest six 85.5% / 57.5 ms; all ten 83.0% / 14.8 ms; Tail drag 80.6% / 16.5 ms. These are about 10 points above P9's recorded 64.2 / 69.4 / 71.5 / 71.9 (same tool family, single run, heavier box: the P8 changelog already says "the box runs heavier than in P9"). Ordering holds (off < six < heaviest six). Not a failure; it does mean the box measures cannot say whether the six-slot cap is enough on the phone (C16 already leaves that to Pedro).
- `python3 tools/shots.py`: **SHOTS PASSED**, 279 screens, 234 picker pages turned (at least 28), 2 min 21 s. Matches the P8 changelog's 279 and 234.
