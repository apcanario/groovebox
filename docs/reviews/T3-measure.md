# T3 measure: the cost of the movement

Row T3, slice c (spec 9.5: "audio comes first"). Measured 27 Nov 2026 on commit 3a74c84, `python3 tools/smoke.py dist --part cost`, headless Chrome in the build container.

**Scene.** The desk (1280 x 800, Advanced, the whole Mix beside the punch band and the pad grid: fader meters, pad pulses, the ghost dials), the default song in its groove with everything on (`COST_SCENE` with every P7 addition), playing. Once with motion on, once with the Mix switch on Still. `walk_motion_cost` in `tools/smoke.py`.

**How.** Audio load and worst render: `measure_cost`, six seconds of Chrome's webaudio trace (share of wall time the audio thread spends rendering; longest single render callback, against a callback every 5.0 ms). Main-thread stall: six further seconds without the trace (starting and stopping a trace stalls the page by itself: a first run that read the stall during the trace gave 131 ms on and 291 ms off), the longest gap between two animation frames, and the longest task the browser reports (PerformanceObserver longtask, 50 ms and over).

| | Audio load | Worst render callback | Worst main-thread stall (frame gap) | Longest task | Frames in 6 s |
|---|---|---|---|---|---|
| Motion on | 65.9 % | 21.90 ms | 42.6 ms | none over 50 ms | 360 |
| Motion off (Still) | 68.2 % | 48.53 ms | 33.8 ms | none over 50 ms | 361 |

**Reading.** On and off differ by less than the measure's own spread (P9 put a single run's spread at about 1.5 points of load; the first run read 66.7 % and 17.8 ms on, 63.7 % and 26.4 ms off; this run reads load higher with motion off, and the worst render callback is higher with motion off in both). The movement adds no load to the audio thread that this measure can see; the main thread had no task of 50 ms or more either way, and its worst frame gap is 9 ms longer with motion on. The headless browser draws about 60 frames a second in both. Reported, not judged: no threshold was added or changed. Only the phone can say how it feels.
