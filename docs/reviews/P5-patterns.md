# P5 lead patterns

Printed by `npm run leads` (src/music/leadPrint.ts, run from the last test of src/music/leadStyles.test.ts). Re-run it to check this copy.

```
Seed 1234, A minor, chords i VI III VII a bar each.
Knobs: lock 0.75, busy 0.85, tension 0.35 (Pulse: hits 7, rotate 0, length 5); the rest at each style's defaults.
A cell is a sixteenth: a note name starts a note, - holds it, . is rest; ~ slides in from the note before, ! accent, 2 or 3 a quick repeat.

HOOK: 24 notes in 8 bars, 6 pitches (G4..A5), length 1.7..6.0 steps, velocity 0.71..0.95, 0 slides, 10 accents, 0 repeats
bar 1 i    | G4!  -    -    -    -    -    .    F5   -    -    -    .    A5!  -    -    .
bar 2 VI   | G5   -    -    .    C5   -    C5   -    -    -    -    -    .    .    .    .
bar 3 III  | A4!  -    -    -    -    -    .    F5   -    -    -    .    G5!  -    -    .
bar 4 VII  | A5   -    -    .    C5   -    A4!  -    -    -    -    -    .    .    .    .
bar 5 i    | G4!  -    -    -    -    -    .    F5   -    -    -    .    A5!  -    -    .
bar 6 VI   | G5   -    -    .    C5   -    C5   -    -    -    -    -    .    .    .    .
bar 7 III  | A4!  -    -    -    -    -    .    F5   -    -    -    .    G5!  -    -    .
bar 8 VII  | A5   -    -    .    C5   -    A4!  -    -    -    -    -    .    .    .    .

PHRASE: 32 notes in 8 bars, 7 pitches (F4..A5), length 2.0..6.0 steps, velocity 0.61..0.87, 0 slides, 8 accents, 0 repeats
bar 1 i    | G4!  -    F5   -    E5   -    -    -    A4   -    -    -    .    .    .    .
bar 2 VI   | G4!  -    E5   -    F5   -    -    -    C5   -    -    -    .    .    .    .
bar 3 III  | F4!  -    F5   -    E5   -    -    -    G4   -    -    -    .    .    .    .
bar 4 VII  | A5   -    F4   -    E5   -    -    -    G4!  -    -    -    .    .    .    .
bar 5 i    | G4!  -    F5   -    E5   -    -    -    -    -    A4   -    .    .    .    .
bar 6 VI   | G4!  -    E5   -    F5   -    -    -    -    -    C5   -    .    .    .    .
bar 7 III  | F4!  -    F5   -    E5   -    -    -    -    -    G4   -    .    .    .    .
bar 8 VII  | A5   -    F4   -    E5   -    -    -    -    -    G4!  -    .    .    .    .

ROLL: 120 notes in 8 bars, 14 pitches (D4..F6), length 0.8..1.0 steps, velocity 0.46..0.87, 21 slides, 40 accents, 16 repeats
bar 1 i    | F5!  E4   E4!  E4   B4   ~C5  ~E4! E4   F6   E5   .    D4!  G4   G4!3 E4!  E4
bar 2 VI   | B43  F4   ~G5! F4   F5   B4!  C53  E6!  ~C5  F5!2 .    A4   ~G4! F4   G4   ~D4
bar 3 III  | F5!  E4   E4!  E4   B4   ~C5  ~B4  E4   F6   E5   .    D4!  A4   A4!3 E4!  E4
bar 4 VII  | C53  E5   F5!  D4   D5   C5!  D53  F6!  ~D5  D5!2 .    B4   ~A4! G4   F4   ~E4
bar 5 i    | F5!  E4   E4!  E4   B4   ~C5  ~B4  E4   F6   E5   .    D4!  G4   G4!3 E4!  E4
bar 6 VI   | B43  D5   G5!  F4   F5   B4!  C53  E6!  ~C5  F5!2 .    A4   ~G4! F4   G4   ~D4
bar 7 III  | F5!  E4   E4!  E4   B4   ~C5  ~B4  E4   F6   E5   .    C6   A4   A4!3 E4!  E4
bar 8 VII  | C53  E5   F5!  D4   D5   C5!  D53  F6!  ~D5  D5!2 .    B4   ~A4! G4   F4   ~E4

DRIFT: 8 notes in 8 bars, 3 pitches (C5..E5), length 11.0..18.0 steps, velocity 0.42..0.73, 1 slides, 0 accents, 0 repeats
bar 1 i    | .    .    .    .    D5   -    -    -    -    -    -    -    -    -    -    E5
bar 2 VI   | -    -    -    -    -    -    -    -    -    -    -    -    -    -    -    -
bar 3 III  | -    .    .    C5   -    -    -    -    -    -    -    -    -    -    -    -
bar 4 VII  | -    .    .    E5   -    -    -    -    -    -    -    -    -    -    -    -
bar 5 i    | -    -    -    -    ~D5  -    -    -    -    -    -    -    -    -    -    E5
bar 6 VI   | -    -    -    -    -    -    -    -    -    -    -    -    -    -    -    -
bar 7 III  | -    .    .    C5   -    -    -    -    -    -    -    -    -    -    -    -
bar 8 VII  | -    .    .    E5   -    -    -    -    -    -    -    -    -    -    -    -

PULSE: 56 notes in 8 bars, 10 pitches (A4..E6), length 0.8..0.8 steps, velocity 0.68..0.82, 0 slides, 0 accents, 0 repeats
bar 1 i    | A4   .    .    E6   .    A4   .    D5   .    .    A4   .    D5   .    F5   .
bar 2 VI   | D5   .    .    G5   .    D5   .    C6   .    .    D5   .    C6   .    A4   .
bar 3 III  | D5   .    .    C5   .    D5   .    F5   .    .    D5   .    F5   .    B4   .
bar 4 VII  | D6   .    .    C5   .    D6   .    B4   .    .    D6   .    B4   .    E5   .
bar 5 i    | F5   .    .    D5   .    F5   .    D5   .    .    F5   .    D5   .    E6   .
bar 6 VI   | A4   .    .    C6   .    A4   .    E5   .    .    A4   .    E5   .    G5   .
bar 7 III  | B4   .    .    F5   .    B4   .    E6   .    .    B4   .    E6   .    C5   .
bar 8 VII  | E5   .    .    B4   .    E5   .    F5   .    .    E5   .    F5   .    C5   .
```
