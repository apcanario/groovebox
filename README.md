# Groovebox

A groovebox that runs in a phone browser: pick a groove, shape the synths, switch sections, bring layers in and out, and turn knobs while it plays. It is built for jamming deep house, chill techno, simple drum and bass and their neighbours, on headphones, with one thumb.

Every sound is synthesized in the app. There are no samples, no accounts and no server.

**Play it:** https://apcanario.github.io/groovebox/ (Chrome on Android, headphones on).

## What a jam is

- **One song at a time,** in one key and at one tempo.
- **Five instruments, always the same five:**

| Instrument | What it does |
|---|---|
| Drums | A preset beat or a step sequencer you edit. |
| Bass | Automatic. It follows the root of the current chord in a rhythm you choose. |
| Synth | Plays the chord sequence as stabs, offbeats or sustained chords. |
| Layer 1 | A lead, an arpeggio or a pad. |
| Layer 2 | The same choices, independent of Layer 1. |

- **Up to four sections** (A to D: intro, groove, break, outro). Each section decides which instruments play and what they play.
- **Sound lives with the instrument, pattern lives with the section.** A synth's knobs are the same in every section; its notes and whether it is on can differ per section.
- **Everything you switch lands on the next bar line.** Tap two instruments and a section inside one bar and all three change together, in time. A tap can be cancelled by tapping again before the bar ends. Knobs act at once.
- **Everything stays in key.** Chords, bass, arpeggios and generated leads all follow the song's scale and the current chord.

## What it does today

Built and live on the link above (rows G0 to G5, 22 and 23 Nov 2026):

- **Play tab:** a grid of instruments by sections. Tap a section to switch to it, tap a cell to turn an instrument on or off in that section, hold a section to rename, copy, add or delete it.
- **Chords tab:** choose a key and a mood (Major, Minor, House, Deep, Dark), then build a sequence of up to eight chords from seven in-key buttons, with lengths of half a bar, one bar or two.
- **Drums tab:** five beats (including 2-step and drum and bass), an 8-step sequencer per drum voice, level and decay per voice, kick pitch and drive.
- **Bass and Synth tabs:** rhythm and wave pickers, envelope, filter, drive, sub level and glide for the bass; detune, attack, decay, release and filter envelope for the synth.
- **Layer tabs:** three modes each.
  - *Arp:* direction, rate, octaves, gate.
  - *Pad:* attack, release, brightness, slow filter motion.
  - *Generative:* a lead written by six knobs (Lock, Hits, Rotate, Length, Tension, Density) from a stored seed, with a new-seed button and a row showing the pattern as it plays.
- **An XY pad on every instrument** for filter cutoff and resonance, and delay and reverb sends into one shared delay and one shared reverb.
- **Mix tab:** a one-knob filter sweep over the whole mix, sidechain pump on the kick, saturation, a level per instrument and a master meter.
- **The screen stays awake while playing.**
- **Songs:** jams are saved on the phone automatically and the last one reopens on launch. A Songs sheet on the Play tab opens, renames, creates and deletes them.
- **Record:** the record button arms with Play or starts a take at once, shows the elapsed time, and logs every knob move, mute and section switch with the song.
- **MP3 export:** a take is encoded while you play (160 kbps) and saved or shared from the phone. A ten-minute take was measured with memory flat.

## Where it is going

The full plan is `docs/SPEC.md` sections 8 and 9 and `docs/BACKLOG.md`.

**Phase 2: Simple and Advanced** (rows P1 to P11)
- **One switch for the whole app.** Simple uses plain words and a few large controls. Advanced has every control. The switch changes what is shown, never what is heard, and every Simple move is visible in Advanced.
- **Vibes:** 24 complete starting grooves (Deep house, Deep techno, Lo-fi, Drum and bass, Ambient, Drone, Trance and more). One tap loads tempo, chords, beat, bass, sounds, leads and four arranged sections, and it plays.
- **Simple chords:** pick a feel (Bright, Warm, Dreamy, Dark, Tense, Uplifting) and tap a progression. No scales or chord names needed.
- **Four more lead styles** beside the current one: Hook, Phrase, Roll and Drift, shaped by twelve knobs (among them Shape, Range, Register, Note length, Phrase, Variation, Slide and Accent), with New idea and Back buttons.
- **A new look** where you can see the music: every instrument shows the bar it is playing as a lane of notes, with one playhead sweeping across them. Line icons beside every name, one typeface, and movement that shows what is playing and what is queued.
- **Screens that never scroll,** text that always fits its tile, one row of sections, and the most-used controls at the bottom in thumb reach.
- **Effects:** two slots per instrument from twelve (Chorus, Phaser, Flanger, Fuzz, Crush, Tremolo, Pan, Gate, Ring, Vowel, Shifter, Echo). On or off in Simple, three knobs each in Advanced.
- **DROP:** one large button that builds for a few bars, hangs, then brings the section back wider, with extra layers on everything, and stays there until you switch it off. Bigger by width, not volume. Each vibe has its own version.
- **Ambient and Drone:** two vibes for coasting, with drones, swooping pads and very slow movement.
- **Morph:** a switch that lets the jam change by itself, slowly, so it can be left playing.
- **More beats, bass rhythms, synth rhythms and sounds,** with the engine additions they need: two more drum voices, 16-step beats, noise and FM oscillators, a tempo-synced filter wobble and a lo-fi master.

**Install** (row G6): an Android APK built by GitHub Actions. The MP3 encoder is LGPL; its licence ships in `LICENSES.txt`.

**Phase 3: tablet** (rows T1 to T3)
- Layouts for tablet portrait and landscape. In landscape the pads and one instrument share the screen, and Advanced shows every knob of an instrument at once.
- **Punch pads:** Cut, Filter, Stutter, Echo, Wash and Riser, momentary effects that land in time.
- Pads that pulse with the music, dials that show their movement, and several controls usable at once.

## What it will not do

- **No samples.** Nothing that needs a recording: no real piano, no vocals, no chopped breaks.
- **No playing with the screen off.** It is for jamming with the phone in your hand.
- **No finger drumming.** The sequencer plays every note; you shape what it plays.
- **No accounts, cloud or sync.**

## Status

| Row | What | State |
|---|---|---|
| G0 to G5 | Sound spike, engine, shell, instrument tabs, layers, save and record | Done |
| P1 to P11 | Phase 2: Simple and Advanced, vibes, chords, leads, sounds, effects, the Drop, Morph | Planned |
| G6 | APK | Planned |
| T1 to T3 | Phase 3: tablet, punch pads | Planned |
| G7 | Retouch from Pedro's notes | Always open |

`docs/BACKLOG.md` is the live version of this table.

## Run it

```
npm ci
npm run dev      # local server
npm run check    # type-check, unit tests, build
npm run smoke    # build, then play it in headless Chrome and check every instrument makes sound
npm run record-test   # a ten-minute take: checks the MP3 and that memory stays flat
```

A push to `main` deploys to GitHub Pages. The smoke test needs Python with Playwright and Chrome.

## How it is made

- **Stack:** TypeScript, Vite, Preact for the screens, Tone.js for audio.
- **`src/music/`** is pure logic with no audio: scales, moods, chords, rhythms, the arpeggiator, the generative lead, the seeded random generator. It is unit-tested.
- **`src/engine/`** is the only code that touches Tone.js: the song document, the step sequencer, the queue that lands switches on the bar line, the instruments, sends and master chain.
- **`src/store/`** keeps songs on the phone (IndexedDB) and autosaves.
- **`src/ui/`** is the screens. They call the engine and never import Tone.js.
- **Every random choice is seeded,** so a saved jam reloads note for note.
- **The smoke test proves sound comes out.** It cannot judge how it sounds; that is done by ear on the phone.

## How it is built

Each row of the backlog is built by a thin Sonnet chat that launches three fresh Opus agents: a builder, a reviewer that never saw the build, and a fixer. Design chats, which change the spec, run on Fable and build nothing. `docs/RUN.md` has the rules and the two-line prompt that starts every build chat.

## Documents

| File | What it is |
|---|---|
| `docs/SPEC.md` | What the app is. Sections 1 to 7 are phase 1, section 8 phase 2, section 9 phase 3. |
| `docs/BACKLOG.md` | The queue: bundles of rows, fixes carried forward, tasks for Pedro. |
| `docs/CHANGELOG.md` | One line per row built, newest first. |
| `docs/RUN.md` | How a build chat works a row. |
| `docs/design/` | Mockups the screens are built from. |
| `docs/reviews/` | Each row's review report. |
| `docs/archive/` | Plans and mockups as they were when each phase was designed. |
| `CLAUDE.md` | Standing rules for any chat working in this repo. |

Landed: plan
