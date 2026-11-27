# T3 measure: the cost of the movement

Row T3 (spec 9.5: "audio comes first"). First measured 27 Nov 2026 on commit 3a74c84 by the builder; measured again by the fixer (T3 review S3) on 27 Nov 2026, headless Chrome in the build container (2 cores), with the master meter moved into the one motion loop (S2).

**Scene.** The desk (1280 x 800, Advanced, the whole Mix beside the punch band and the pad grid: fader meters, the master meter, pad pulses, the ghost dials), the default song in its groove with everything on (`COST_SCENE` with every P7 addition), playing. Motion on, or the Mix switch on Still. `walk_motion_cost` in `tools/smoke.py`.

**How.** Each run: audio load and worst render callback from `measure_cost` (six seconds of Chrome's webaudio trace: share of wall time the audio thread spends rendering; longest single render callback, against a callback every 5.0 ms), then six further seconds without the trace for the main thread (the longest gap between two animation frames, the longest task the browser reports at 50 ms and over, and the frames drawn). Since S3 the walk takes eight runs in the order on, off, off, on, on, off, off, on (`MOTION_ORDER`), so each way comes first in half the pairs, and prints the median, the best and the worst of each way.

Sets 1 and 4 ran inside the cost part (`python3 tools/smoke.py dist --part cost`), after the P7 and P9 cost walks. Sets 2, 3, 5 and 6 ran `walk_motion_cost` alone, in its own browser, the two builds taken in the order old, new, new, old. "Old" is commit 2ba1a28: the master meter already in the one loop, the values written on every frame. "New" is commit 3e4392e: the values written at most about 30 times a second, and only those that changed (the S3 fix below).

Median of four runs (best to worst in brackets):

| Set | Build | Way | Audio load | Worst render callback | Worst frame gap | Longest task | Frames in 6 s |
|---|---|---|---|---|---|---|---|
| 1 | old | on | 79.6 % (74.5–82.3) | 22.5 ms (14.3–49.0) | 87.6 ms (38.6–254.8) | 53.5 ms (to 188) | 346 (329–355) |
| 1 | old | off | 74.6 % (71.5–82.2) | 16.8 ms (15.0–27.1) | 72.8 ms (59.1–224.7) | 56.0 ms (to 199) | 354 (344–359) |
| 2 | old | on | 81.6 % (78.9–90.0) | 25.3 ms (21.5–67.5) | 53.0 ms (46.6–329.6) | none (to 288) | 321 (311–336) |
| 2 | old | off | 80.9 % (76.2–82.3) | 23.4 ms (17.1–34.0) | 53.2 ms (46.8–58.0) | none | 358 (357–360) |
| 3 | old | on | 87.7 % (81.7–95.4) | 28.8 ms (19.4–38.1) | 186.8 ms (50.8–270.5) | 140 ms (to 189) | 300 (291–322) |
| 3 | old | off | 82.3 % (81.2–83.9) | 24.0 ms (19.9–28.0) | 69.2 ms (38.0–158.7) | 29 ms (to 88) | 354 (343–360) |
| 4 | new | on | 86.9 % (79.8–98.0) | 28.7 ms (20.9–53.7) | 239.2 ms (180.3–249.4) | 146.5 ms (to 207) | 336 (322–343) |
| 4 | new | off | 84.3 % (73.8–87.7) | 20.3 ms (15.5–30.0) | 81.0 ms (56.8–104.7) | 28.5 ms (to 77) | 354 (346–360) |
| 5 | new | on | 80.5 % (71.1–87.7) | 20.0 ms (19.0–49.2) | 68.0 ms (58.9–90.6) | 58 ms (to 78) | 354 (350–358) |
| 5 | new | off | 78.3 % (76.2–79.9) | 18.2 ms (15.3–22.1) | 39.6 ms (34.6–70.7) | none (to 57) | 360 (352–360) |
| 6 | new | on | 82.4 % (76.9–87.7) | 19.1 ms (13.2–52.1) | 53.3 ms (48.5–81.9) | none (to 65) | 356 (351–358) |
| 6 | new | off | 81.9 % (78.9–87.4) | 22.5 ms (17.2–64.7) | 53.7 ms (41.3–72.6) | none (to 64) | 360 (358–361) |

The builder's two single runs (commit 3a74c84, with the Mix's own master meter loop) read 66.7 % / 63.7 % and 65.9 % / 68.2 % (on / off). The reviewer's single run read 78.4 % on and 71.7 % off. The container's own load moves by more than that between sets: the P7 "everything on" line before the walk read 74.1 % in set 1 and 77.4 % in set 4.

**Reading.**
- **Audio load.** Motion on reads higher than motion off in all six sets, by 0.5 to 5.4 points (median of the differences 2.4). Within one way, four runs spread over 3 to 18 points. So no single difference stands clear of the spread, but six out of six in the same direction does not look like chance. Motion on probably costs the audio thread a few points of load here. A likely cause is that on two cores the page's style and paint work competes with the audio thread for the CPU. This measure cannot show that it is the cause, and a phone has more cores, so it may cost less there or nothing.
- **Frames.** The old build drew 2 to 15 % fewer frames with motion on (346, 321 and 300 against 354 to 358). The new build drew 1 to 5 % fewer (336, 354 and 356 against 354 to 360). The frame count is the steadiest figure here, and it is the one the fix moved.
- **Worst frame gap and longest task** are single worst moments. They swing between 35 and 330 ms in both ways and in both builds, so they show the container's hiccups more than they show motion. Motion on had the worse gap in four of six sets. In sets 3 and 4 the median longest task with motion on was over 100 ms. With motion off it was under 30 ms.
- **Worst render callback** is 13 to 68 ms against a 5 ms callback in every run, on and off. These are glitches of the container's audio thread, not something motion causes. On and off overlap fully.
- **The fix (S3).** The loop now writes the moving values at most about 30 times a second (`MOTION_MS` in `src/ui/logic.ts`), and only the ones that changed. Each value is also written again 15 times a second, in case a render replaced a container's style. With the fix, motion on reads 0.5 to 2.6 points over off (old build: 0.7 to 5.4) and drops fewer frames, but the sets with and without it overlap. Whether it is enough can only be told on the phone. If it is not, the next step inside the spec is for the loop to switch movement off by itself while the audio is under load (spec 9.5: "drops frames or switches off").

Reported, not judged: no threshold was added or changed. Only the phone can say how it feels.
