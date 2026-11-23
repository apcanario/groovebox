# Groovebox spec

Settled on 22 Nov 2026. A builder follows this; a reviewer checks against it. Where it is silent, take the most reasonable reading and record the choice in the changelog.

## 1. What it is

A groovebox for jamming on a phone: pick chords, shape synths, switch sections, mute and unmute layers, turn knobs while it plays. The fun is in the synth settings and the layering.

- **Genres:** deep house, chill melodic techno, simple drum and bass, 2-step.
- **User:** Pedro only. Android phone, portrait, headphones.
- **Form:** a web app on GitHub Pages, later the same code in a Capacitor APK.

## 2. What it is not

- **No screen-off playback.** The screen stays awake while playing. Audio may stop when the phone locks.
- **No finger drumming.** The sequencer plays every note. Touch latency is not a design constraint.
- **No Suno or any generated audio.** Everything is synthesized in the app.
- **No realism.** Drums and synths should thump and groove, not imitate real instruments.
- **No accounts, no server, no sync.** Everything lives on the phone.

## 3. Music model

- **One key and one mood per song.** Everything stays in that scale.
- **Bpm:** 80 to 180, one value per song.
- **Bar:** 16 steps of a sixteenth note. All patterns are 16 steps unless a loop length says otherwise.
- **Sections:** 1 to 4 per song (A to D), each with a name such as Intro, Groove, Break, Outro.
- **Everything that is switched lands on the next bar line, never immediately:** a section switch, and an instrument turned on or off. Several switches tapped within one bar all take effect together on that bar line. A switch tapped again before the bar line is cancelled. Knobs, the XY pad and sends are the opposite: they act at once.
- **Instruments:** five, fixed.

| Instrument | Role |
|---|---|
| Drums | Preset beat or 8-step sequencer |
| Bass | Automatic, follows the chord root |
| Synth | Plays the chord sequence |
| Layer 1 | Lead, arp or pad |
| Layer 2 | Lead, arp or pad |

**Sound lives with the instrument. Pattern lives with the section.** A patch (every knob of an instrument) is shared by all sections. A section holds, per instrument: on or off, and its pattern (chord sequence, drum pattern, layer mode settings and seed).

### Chords

- **Easy mode:** pick a mood, then build a sequence from seven buttons, the triads on each degree of the scale. Every button is in key.
- **Moods** set a scale and a voicing:

| Mood | Scale | Voicing |
|---|---|---|
| Major | major | triads |
| Minor | natural minor | triads |
| House | natural minor | 7ths and 9ths |
| Deep | dorian | 7ths and 9ths |
| Dark | phrygian | triads, low |

- **Advanced mode (row L1, later):** per chord, choose 7th or 9th, borrowed chords such as iv in a major key, and inversions.
- **Sequence:** 1 to 8 chords per section, each lasting 1 bar by default (half a bar and 2 bars allowed).

### Bass

Automatic. It plays the root of the current chord in a rhythm chosen from a few presets (offbeat, rolling sixteenths, long notes, DnB sub). The user changes only the rhythm preset and the synth patch.

### Drums

- **Presets:** four on the floor, house shuffle, techno, 2-step, drum and bass.
- **Sequencer:** 8 steps per bar for kick, snare or clap, closed hat, open hat. A preset can be opened in the sequencer and edited.
- All drum sounds are synthesized. Sampled breaks are row L3, later.

### Layers

Each layer has a mode.

- **Arp:** plays the current chord's notes. Controls: direction, rate, octaves, gate.
- **Pad:** holds the chord. Controls: attack, release, brightness, motion (slow filter movement).
- **Generative:** a lead built from knobs, always in key. Core knobs:

| Knob | What it does |
|---|---|
| Lock | Right: the loop is frozen. Middle: a note changes now and then. Left: new notes all the time. |
| Hits | Number of notes spread evenly over the bar (Euclidean rhythm). |
| Rotate | Shifts that rhythm by steps. |
| Length | Note loop of 2 to 16 steps. A length such as 5 or 7 drifts against the 16-step bar. |
| Tension | Left: chord tones only. Middle: scale tones. Right: passing notes. |
| Density | Chance that each hit actually plays. |

Every generative pattern comes from a stored seed, so a saved jam reloads note for note.

## 4. Sound

- **Per instrument:** oscillator choice, amp envelope, filter with resonance, filter envelope, drive, delay send, reverb send. The XY pad on each instrument tab is filter cutoff (x) and resonance (y).
- **Shared sends:** one delay and one reverb for the whole app. Never one per instrument.
- **Mix tab:** one-knob filter sweep (left of centre low-pass, right of centre high-pass), sidechain pump amount (bass, synth and layers duck on each kick), saturation, limiter. Level per instrument.
- **Phone CPU is the budget.** Cap polyphony. Prefer fewer, better voices.

## 5. Screens

Vertical, flat, one thumb. Colours and type come from `src/style.css` tokens. `docs/design/layer1-tab.jpg` is the reference for look and density.

**Always visible**
- **Transport bar:** play/stop, bpm, key and mood, bar counter, record.
- **Section strip:** one button per section. It shows which section is playing and which is being edited. By default the edited section follows the playing one. Tapping another section edits it silently while the current one keeps playing.
- **Tab bar:** icons for Play, Chords, Drums, Bass, Synth, Layer 1, Layer 2, Mix.

**Play tab**
- A grid: rows are instruments, columns are sections.
- Tap a column header: switch to that section on the next bar.
- Tap a cell: turn that instrument on or off in that section. For the playing section it lands on the next bar.
- A queued switch shows as pending (outlined, not filled) until the bar line, so it is clear what is about to change.
- Tap a row label: open that instrument's tab.
- Long-press a column header: rename, copy, delete, add a section.

**Instrument tabs**
- At most six dials on screen, plus one XY pad and two send bars.
- Dials are large and are turned by dragging up and down from anywhere on the dial, never by tracing a circle.
- Every knob is safe to move while playing: no clicks, no stuck notes, no out-of-key notes.

## 6. Saving and recording

- **Song document:** one JSON object holding key, mood, bpm, the five patches, and each section's patterns and seeds. Saved on the phone. Several songs can be kept.
- **Event log:** when record is armed, every knob move, mute and section switch is logged with its time in beats. The log is saved with the song.
- **MP3 export:** records the live master output and encodes while playing, so memory stays flat for long jams. Rendering the event log offline is row L4, later, and must work in chunks: an hour of stereo held in memory is about 1.3 GB.

## 7. Engine rules

- UI never touches Tone.js. It calls the engine: load song, play, stop, set parameter, switch section, toggle instrument.
- Parameter changes are ramped, never stepped.
- Section switches and instrument on/off are queued in the engine and applied together at the next bar line. The engine reports pending switches so the UI can show them.
- All scheduling is done ahead of time on the audio clock, never from UI timers.
- All randomness comes from a seeded generator.
- Pure logic (scales, chords, voicings, Euclidean rhythm, the generative lead, the song schema) has unit tests and no audio dependency.
