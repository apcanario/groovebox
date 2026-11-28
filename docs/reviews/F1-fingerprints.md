# F1: the smoke's fingerprints against c6a7e01

Done-when line: "the ten other vibes' smoke fingerprints are unchanged except where the opening changed them". Two kinds
of fingerprint are meant: the ledger's per-part hash (`tools/smoke_parts.py`: `fingerprints`, `part_inputs`) and what
the `vibes` part measures for each vibe. Compared at F1 slice c's last commit against the row base c6a7e01.

## Ledger fingerprints: every part changed

All twelve parts (core, vibes, additions, effects, drop-1 to drop-6, morph, cost) have a new fingerprint. No part
changed for a reason of its own beyond the three below; each part's inputs were diffed file by file and function by
function (`part_inputs` at both commits).

1. **Shared files (every part).** Every file under `src/` outside `src/ui/` is in every part, and App.tsx's imports
   are too. F1 changed, in all twelve: `src/main.tsx` (the launch draw), `src/music/data.ts` (`top`, `bpmRange` on
   `StyleDef`), `src/music/styles.ts` (`TOP_IDS`, `vibeBpmRange`, `rollVibe`), `src/store/keeper.ts` (the launch
   jam), `src/style.css` (the picker sheet), `src/ui/App.tsx`, `src/ui/icons.tsx`, `src/ui/vibes.tsx`, and added
   `src/store/vibeBag.ts` and `src/ui/picker.ts`. Of the style files, only the fourteen top vibes' changed (`top:
   true`; `bpmRange` on Ambient, Downtempo, Drone and Lo-fi). None of the ten other vibes' style files changed, and
   nothing under `src/engine/` changed.
2. **The opening (every part).** `open_app`, `run_part` (the seeded bag, `BAG_SEED`) and `walk_picker_open` are reached
   by every part: a part now opens on the Play tab with a launch jam (Dub techno from seed 1), checks the new picker,
   then opens the default song from Songs, which the parts were measured on before F1.
3. **Module text (every part).** `smoke.py:<module>` (`BAG_SEED`, the import of `walk_picker`) and
   `shots.py:<module>` (`PICKER_SIZES`, `PICKER_READ`) are hashed into every part.

Beyond those, by part:

| Part | Its own check code that changed | Why |
|---|---|---|
| core | `part_core`, `walk_cold_start` (new), `shots.walk_picker` (new), `walk_g5_songs` | Slice c's cold-start check and the picker at four sizes; Songs after a reload: the last jam is first in Songs, not behind "Continue last jam" |
| vibes | `walk_p3` | The picker's class is `.vpick` and a tap outside it closes it (no "Continue last jam") |
| additions, effects, drop-1 to drop-6, morph, cost | none | The opening only |

## The ten other vibes measure the same

- **Their songs are the same.** `src/music/otherVibes.test.ts` pins `vibeSong(id)` and `vibeStart(id)` of Tropical
  house, Acid house, Afro house, Dubstep, Future garage, IDM, EDM, Trance, Electro and Trap to
  `tools/fixtures/other_vibes_c6a7e01.json`, recorded at c6a7e01. It passes; a change of one value in one of them (Trap
  at 141 bpm, tried) fails it. With `src/engine/` unchanged, the same song plays the same.
- **They still play in `vibes`.** The `vibes` part passed at slice c (`python3 tools/smoke.py dist --part vibes`): each
  of the ten loaded from the picker mid-jam, landed on the bar line in its own start section at its own bpm (the check
  fails on any other), and played every instrument audibly with a tone in its groove section, as before F1:

| Vibe | bpm | Windows with a tone / sounding: drums, bass, synth, layer 1, layer 2 |
|---|---|---|
| Tropical house | 108 | 78/78, 48/66, 78/78, 60/61, 78/78 |
| Acid house | 125 | 65/65, 66/66, 61/62, 66/66, 66/66 |
| Afro house | 120 | 71/71, 52/67, 65/65, 40/40, 71/71 |
| Dubstep | 140 | 50/51, 59/59, 59/59, 31/32, 59/59 |
| Future garage | 132 | 64/64, 54/62, 64/64, 64/64, 64/64 |
| IDM | 110 | 76/76, 76/76, 76/76, 59/60, 76/76 |
| EDM | 128 | 66/66, 66/66, 66/66, 56/56, 66/66 |
| Trance | 138 | 55/55, 33/54, 55/55, 55/55, 55/55 |
| Electro | 126 | 68/68, 68/68, 49/49, 68/68, 68/68 |
| Trap | 140 | 60/61, 61/61, 61/61, 45/45, 61/61 |

  The window counts depend on the run's timing and are not compared run to run; the songs, the engine and the checks'
  thresholds are what stay the same, and the smoke judges only that sound comes out. How they sound is Pedro's ear.
