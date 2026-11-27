# Groovebox

A groovebox that runs in a phone browser or as an Android APK (`docs/INSTALL.md`): pick a groove, shape the synths, switch sections, bring layers in and out, and turn knobs while it plays. It is built for jamming deep house, chill techno, simple drum and bass and their neighbours, on headphones, with one thumb.

Every sound is synthesized in the app. There are no samples, no accounts and no server.

**Play it:** https://apcanario.github.io/groovebox/ (Chrome on Android, headphones on), or install the Android APK from the prerelease `latest` (`docs/INSTALL.md`).

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

Built and live on the link above, and in the APK (rows G0 to G5, P1, P1b, P2, P3, P4, P5, P6, P7, P9, P8, P10, P11, R1, P10b, P10c, P10d, T1 to T3 and G6 and the bundle 7b player pass, 22 to 27 Nov 2026):

- **Morph (P11):** a Morph switch beside DROP on the Play tab, a Morph speed dial on the Simple Mix tab and a Morph page in Advanced Mix. With it on, a seeded plan slowly drifts Bright and Space, eases Lock, moves pad and drone voicing at the end of a phrase (a new Voicing dial on the Pad page) and takes one instrument out for a phrase and gives it back, all within limits each vibe sets. Ambient and Drone have it on by default; the other vibes start with it off. Moves are logged like a hand's. A hand on a control holds it for 16 bars; a drop holds all of Morph and Morph gives back anything it had out when it stops. Section moves are built but off. Measured in ten minutes of Ambient: no note out of key, the same seed gives the same journey, no 16-bar stretch repeats counting every value Morph moves; by the notes alone 12 stretches repeat. Whether it is good to coast on is for the ear.
- **The Drop (P10):** a DROP button on the Play tab in both modes, with the same button and a Drop page (build length, cliffhanger, wind-down, Width) on the Advanced Mix tab. A press builds on the bar lines, hangs (a gap, a held chord or nothing), then lands wider with extra layers on top of the section, and stays on until the second press, which winds down over two or four bars (easing the extra layers, level, width and voices down a bar at a time, row P10b) into the same section or the one you tapped during the drop. A press during the build cancels it; a press during the wind-down does nothing. The extra layers are an overlay that never touches the song, with its own cap of 48 voices; the tempo never changes. Each of the 24 vibes has its own recipe in its style file. A level follower keeps the drop within about 1 dB of the section it came from. Measured: wider by at least 1.23 times in all 24, highest peak -0.7 dBFS. Whether it goes BAM is for the ear.
- **All 24 vibes (P8):** the sixteen others join the eight: Progressive, Acid house, Afro house, Minimal techno, Dub techno, Breakbeat, Dubstep, Future garage, Drone, Downtempo, Synthwave, IDM, EDM, Trance, Electro and Trap, in five families, all on one picker screen (no title or Close: Continue last jam is the way back; on a 640 px screen the tiles sit 1 px apart). Each sets its beat, rhythms, five sounds, lead styles, mix and two effects per instrument. Drone holds one chord for eight bars on a Drone layer with Swoop glide, attacks and releases of up to twenty seconds, the air layer and a 16-second reverb; Lo-fi now plays through the lo-fi master and Ambient has a Shimmer pad. The pickers hold the full lists: 26 beats (Minimal, Acid, Garage, Breakbeat, DnB roller, Dubstep, Electro, Trance, EDM, Downtempo, Synthwave, Glitch, Slow pulse among the new), 14 bass rhythms (Octaves, Acid line, Reese hold, Wobble, 808 glide, Arp bass and Walking play chord tones and octaves), 10 synth rhythms (Gate, Skank, Swell, Broken) and 9 to 17 sounds per instrument (Boom, Machine, Big room, Dusty; Acid, Reese, 808, Rubber; Supersaw, Brass; Square, Acid, Pluck, Strings, Shimmer, Choir, Glass pad, Tape pad). The chord library's cards are chosen per vibe, at least seven per feel; Ambient's and Drone's cards hold every chord for four or eight bars. Whether each vibe sounds like its name is for the ear.
- **Effects (P9):** two effect slots on every instrument, each holding one of twelve (Chorus, Phaser, Flanger, Fuzz, Crush, Tremolo, Pan, Gate, Ring, Vowel, Shifter, Echo), all synthesized; Tremolo, Pan, Gate, Vowel's movement and Echo's time follow the tempo, and Phaser and Flanger do at a note value. In Simple each instrument tab has two on/off buttons named after its effects, and the Mix tab's Space page has the lo-fi master as one on/off. In Advanced each instrument tab has an FX page: per slot the on/off, the effect (picked from a sheet of the twelve) and its three knobs. Switching, changing an effect or turning a knob while playing crossfades, with no click; Echo switched off lets its repeats ring out. Each vibe sets two effects per instrument and arrives with a few on (Lo-fi with Crush and Chorus on the keys). At most six slots play at once: switching on a seventh turns off the one switched on longest ago (all ten measured too heavy for a phone).
- **New sounds (P7):** Perc and Shaker drum voices, Afro and Trap beats (Trap has hat rolls) and 16-step beats with a 16-step view on the Advanced Steps page; noise and two-operator FM waves, a tempo-synced filter LFO and a slow drift on filter, pitch, pan and sends; a lo-fi master (wobble, crush, hiss); a Sound picker on every instrument that lists its patch files (four new: Glass, Wobble, Breath, Drift pad). For ambient and drone work: attack, release and reverb decay up to 20 seconds, chords of 4 and 8 bars, a Drone layer mode in both modes, Swoop glide between chords on pads and drones, and an air layer. Ambient and Drone are built on them. Each can be switched off.
- **Lead screens (P6):** the Advanced Layer tab has a style row (Hook, Phrase, Roll, Drift, Pulse), the Notes and Feel pages of six knobs each, a Pulse page with its own three knobs (shown only for Pulse), and the lane with a phrase bar showing which bar of the phrase is playing. Simple Layer has a style picker beside Busy, Evolve, Bright and Space. Every vibe sets a fitting lead style on both layers (Hook in Deep house, Tropical house and 2-step; Roll in Melodic techno; Phrase in Drum and bass and Lo-fi; Pulse in Deep techno; Drift in Ambient and on the pads). The Shape dial reads Dip and Zig for Valley and Zigzag, which do not fit a dial at 360 px.

- **Lead styles (P5):** Hook, Phrase, Roll and Drift beside Pulse, seeded and always in key, shaped by twelve shared knobs, with varied velocity and per-note glide, accent and quick repeats in the layer voice. Screens for them are P6, above.

- **Simple chords (P4):** pick a feel (Bright, Warm, Dreamy, Dark, Tense, Uplifting), then one of four cards, each a progression shown as colour blocks with a name; a tapped card plays from the next bar and sets the mood for the song. More chords brings the next four, Lower and Higher move the pitch, and the vibe button borrows another vibe's progressions without loading it. A library of 172 progressions, one data file each, tagged by feel and vibe. No scale or chord names in Simple; Advanced is the chord editor.

- **Vibes (P3):** eight complete starting grooves, one data file each (Deep house, Tropical house, Deep techno, Melodic techno, Drum and bass, 2-step, Lo-fi, Ambient), each with four arranged sections. The vibe picker opens the app (Continue last jam first); a tap loads the vibe as a new song and plays, landing on the next bar with its sounds, mix and tempo. On the Simple Play tab the vibe control steps with an arrow each side, the middle opens the picker. New jam opens the picker, also while playing. Tempo runs 60 to 180. Beats, bass and synth rhythms, moods and patches are data files too, and pickers list whatever exists.
- **One frame on every tab (P1):** header (New jam, Songs, Simple/Advanced), content, one row of sections, a transport bar with four beat lights and the bar counter, then the tab bar. Tapping a section plays it from the next bar; holding one opens its sheet. Nothing scrolls, and text shrinks to fit its tile.
- **Simple and Advanced (P2):** one switch in the header, remembered, Simple on first launch. Simple instrument tabs have one picker, four macro dials and the XY pad, in plain words; Simple Layer tabs have Busy, Evolve, Bright and Space. Advanced has every control, and every Simple move shows there. Switching changes nothing you hear. New idea and Back on both layers keep the last eight seeds, and Back restores the earlier lead note for note.
- **The look (P1b):** flat, 3 px corners, a hatched frame on anything queued for the next bar, square-cut dials with ticks, a dot-grid XY pad, DM Sans only, Material line icons beside the words. Each instrument shows the bar it is playing as a lane of notes under one playhead, five lanes together in Simple's Now view and one above the controls on each instrument tab. Motion marks what sounds and what is queued; it stops with the phone's reduce-motion setting or the Moving/Still switch on the Mix tab, and every state still reads by fill and hatching.

- **Play tab:** in Advanced, a grid of instruments by sections on top of the section row: tap a cell to turn an instrument on or off in that section, hold a section to rename, copy, add or delete it or edit it without playing. In Simple, the five instrument lanes: tap a label to switch it at the next bar, hold to open its tab.
- **Chords tab:** in Advanced, choose a key and a mood (Major, Minor, House, Deep, Dark), then build a sequence of up to eight chords from seven in-key degree buttons, with lengths of half a bar to eight bars. In Simple, the feel and card screen of P4 above: no key, scale or chord names.
- **Drums tab:** 26 beats (data files, None among them), an 8- or 16-step sequencer for six voices (Perc and Shaker on the Kit page), level and decay per voice, kick pitch and drive, and an FX page.
- **Bass and Synth tabs:** rhythm, sound and wave pickers, envelope, filter, drive, sub level and glide for the bass; detune, attack, decay, release and filter envelope for the synth; and an FX page.
- **Layer tabs:** four modes each.
  - *Arp:* direction, rate, octaves, gate.
  - *Pad:* attack, release, brightness, slow filter motion, Swoop glide, Voicing.
  - *Lead:* five styles (Hook, Phrase, Roll, Drift, Pulse) written from a stored seed, always in key, shaped on the Notes and Feel pages (six knobs each) and, for Pulse, its own Pulse page; shown in the layer's lane as it plays; New idea and Back change the seed.
  - *Drone:* root, or root and fifth, held and gliding between chords (Swoop); attack, release, brightness, motion, Voicing.
- **An XY pad on every instrument** for filter cutoff and resonance, and delay and reverb sends into one shared delay and one shared reverb.
- **Mix tab:** a one-knob filter sweep over the whole mix, sidechain pump on the kick, saturation, a level per instrument, reverb tail, air and the lo-fi switch, and a master meter; in Advanced also a Drop page and a Morph page, and in Simple the Morph speed dial.
- **The screen stays awake while playing.**
- **Android APK:** the same app in a Capacitor shell, built by GitHub Actions on each push to `main` and put on the prerelease `latest` (`docs/INSTALL.md`). Portrait only on phones, free rotation on tablets (600 px or more on the short side), works offline, no service and no background audio: the jam stops when the app goes to the background. Save and Share of a take use a native hand-off in the APK. It is a debug APK (about 4.4 MB); the workflow has built it on `main` and no device has run it yet.
- **Songs:** jams are saved on the phone automatically and the last one reopens on launch. A Songs sheet, opened from the header, opens, renames, creates and deletes them.
- **Record:** the record button arms with Play or starts a take at once, shows the elapsed time, and logs every knob move, mute and section switch with the song.
- **MP3 export:** a take is encoded while you play (160 kbps) and saved or shared from the phone. A ten-minute take was measured with memory flat.
- **Tablet layouts:** the layout follows the screen. On a wide tablet the pads (a large labelled grid showing the playing section's notes, the strip as column labels, DROP and Morph, the transport) and one instrument panel share the screen; on a tall tablet the panel sits on top and the pads dock at the bottom. Rotating while you play does not touch the audio. A phone keeps its layout.
- **Advanced without pages:** where a panel measurably fits the screen, Advanced shows every control at once: all seven panels on a wide tablet, Chords and Mix at 1024 x 768, Chords, Bass, Synth and Mix on a tall tablet. Elsewhere the pages stay. Which one is decided by screen size only, so a panel never changes while you play.
- **Punch pads:** six momentary effects, Cut, Filter (Sweep in Simple), Stutter, Echo, Wash and Riser, that land on the beat, bar or sixteenth they are built for, several at once. A Punch page of the Mix tab on the phone; on a tablet a row beside DROP. Pads pulse with their instrument, the Filter sweep shows on its dial, and the movement can be turned off with Still. Two or three fingers at once work on dials, the XY pad and the pads.

## Where it is going

**Next, bundle 10: phase 4** (rows F1 and F2): the app opens straight into a random top vibe with the picker one tap away, and the kick is rebuilt with a kick-only beat, Thump. Then bundle 11 (F3, F4): leads planned from rhythm cells so they repeat and resolve, in the fourteen top vibes. Then bundle 12 (F5 to F7): the harmony pad, a touch surface that moves the pitch of the whole piece inside the current chord; Perform sizing for the Legion Y700; and Signature, a 25th vibe. Retouch (row G7) is bundle 13 and runs on Pedro's notes from playing the app. Bundles 7b, 8 (tablet) and 9 (the APK) are done. Known: in the rubber-bass vibes (IDM, EDM, Electro, Progressive, Minimal techno) the bass's two oscillators can still fall out of phase after a stall, which drops the level 1 to 2 dB until the bass rests (about 1 drop run in 24 in the probe, C24); the fix comes after the APK, by Pedro's decision, so it is now due.

The full plan is `docs/SPEC.md` sections 8 to 10 and `docs/BACKLOG.md`.

**Install:** `docs/INSTALL.md`. The MP3 encoder is LGPL; its licence ships in `LICENSES.txt`.

## What it will not do

- **No samples.** Nothing that needs a recording: no real piano, no vocals, no chopped breaks.
- **No playing with the screen off.** It is for jamming with the phone in your hand.
- **No finger drumming.** The sequencer plays every note; you shape what it plays.
- **No accounts, cloud or sync.**


## Status

| Row | What | State |
|---|---|---|
| G0 to G5, P1, P1b, P2, P3, P4, P5, P6, P7, P9, P8, P10, P11, P10b, P10c, P10d, T1, T2, T3 | Sound spike, engine, shell, instrument tabs, layers, save and record, the new frame, the look, Simple and Advanced, eight vibes and the picker, Simple chords, lead styles and their screens, new sounds, effects, all 24 vibes and the full lists, the Drop, Morph, the tablet layouts, Advanced without pages, punch pads, movement and many fingers | Done |
| G6 | APK: Capacitor shell, workflow that builds a debug APK to the release `latest`, `docs/INSTALL.md` | Done: the workflow built and released the APK on `main` (27 Nov 2026); not yet run on a device |
| F1 to F7 | Phase 4: straight in, the kick and Thump, leads that hold together, the harmony pad, Perform on the Y700, Signature | Planned (spec 10), not started |
| G7 | Retouch from Pedro's notes | Always open |

`docs/BACKLOG.md` is the live version of this table.

## Run it

```
npm ci
npm run dev      # local server
npm run check    # type-check, unit tests, build
npm run smoke    # build, then play it in headless Chrome in twelve resumable parts (a ledger skips green ones; --fresh runs all)
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
