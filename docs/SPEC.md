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
- **No samples.** Every sound is synthesized in code; no audio files ship with the app.
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
- All drum sounds are synthesized.

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

## 8. Phase 2: Simple and Advanced

Settled on 23 Nov 2026 after Pedro played bundles 1 to 3. Where this section differs from sections 2, 3 and 5, this section wins. What he said: chords and pads sound great; the lead lacks variety; chords still feel like an advanced mode; scrolling is hard because the screen is all controls; the Play tab's two rows of sections are confusing; there must be a plain Simple mode and an Advanced mode, switched app-wide. The outcome he wants: pick a style and it plays, tweak it with a few simple controls, switch to Advanced to go deeper.

### 8.1 Two modes, one song

- **One toggle, app-wide,** in the transport bar: Simple or Advanced. It is remembered between launches. A new install starts in Simple.
- **The mode changes what is shown, never what is heard.** Same song document, same engine. Switching mode mid-jam makes no sound change and loses nothing.
- **Simple** uses plain words only. No scale names, chord degrees, Euclidean, envelope or any term a non-musician would have to look up.
- **Advanced** is every control the app has: all of sections 3 to 5, plus what this section adds.
- **Nothing is hidden state.** A Simple control writes ordinary song and patch values, so Advanced shows the result of every Simple move.

### 8.2 Styles

A style is a complete starting point: one tap gives a full groove.

- **Launch set (10):** Deep house, Deep techno, Melodic techno, Lo-fi, Drum and bass, 2-step, Tropical house, Ambient, IDM, EDM.
- **A style sets everything:** bpm, swing, key and mood, its chord progression, drum beat, bass rhythm, synth rhythm, the five patches, each layer's mode and lead style, send and mix settings, and four sections arranged as intro, groove, break and outro with different instruments on in each.
- **A style is one data file** under `src/styles/`. Adding a style, a drum beat, a bass rhythm, a patch or a progression needs no engine or UI code; pickers list whatever exists.
- **Opening the app** shows the style picker: large cards, one per style, with "Continue last jam" first when there is one. Tapping a style loads it and starts playing.
- **New jam from style** is always one tap away from the transport bar. Loading a style while playing lands on the next bar line. The jam it replaces stays available as "Previous jam" until the next one replaces it.
- **Bpm range becomes 60 to 180** so Lo-fi and Ambient fit.
- **No samples, ever** (replaces the mention of sampled breaks in section 3). Every sound and effect is synthesized in code. No audio files ship with the app.

### 8.3 Simple controls

Each instrument tab in Simple shows one picker and four large dials, on one screen.

| Instrument | Picker | Dials |
|---|---|---|
| Drums | Beat | Punch, Hats, Swing, Level |
| Bass | Rhythm | Bright, Weight, Punch, Level |
| Synth | Sound | Bright, Punch, Space, Level |
| Layer 1 and 2 | Lead style (or Arp, Pad) | Busy, Evolve, Bright, Space |

- **A macro dial moves several ordinary values at once** (Bright: cutoff and filter envelope; Space: both sends; Punch: attack, decay and drive; Weight: sub and low drive; Evolve: the inverse of Lock). The mapping is data, next to the patch definitions.
- **Each macro's position is stored in the song** so the dial shows where it was left. Editing the underlying values in Advanced does not move the macro dial.
- **The XY pad stays** on every instrument tab in both modes.
- **Layers also get two buttons in both modes:** New idea (a new seed) and Back (the previous seed). The last eight seeds per layer per section are kept.

### 8.4 Chords

- **Simple:** no scales, no degrees. Pick a style (it starts on the song's style), pick a feel (Bright, Warm, Dreamy, Dark, Tense, Uplifting), then tap one of the progression cards. Each card has a plain name and shows its chords as coloured blocks. A tapped card plays from the next bar line. A "Higher / Lower" control transposes the song by a semitone, with no note names shown.
- **The library:** at least six progressions per style and at least 60 in all, each tagged with one or more feels. Each is stored as degrees, mood and voicing, so it transposes and stays in key. Names are neutral. No artist, song or label names, and no claim that a progression comes from any track.
- **Advanced:** the degree editor built in G2 (what section 3 calls easy mode), unchanged. Row L1 still adds 7ths, 9ths, borrowed chords and inversions later.
- A Simple progression opens in the Advanced editor as ordinary chords.

### 8.5 Lead styles

The generative mode gets a style selector. Each style is its own pure, seeded generator in `src/music/`. All of them stay in key and follow the chords.

| Style | What it plays |
|---|---|
| Hook | A short motif of 3 to 6 notes with a clear shape, one or two bars long, repeated. It changes only at the end of a phrase. |
| Phrase | A line over 4 or 8 bars in call and response (A, A varied, A, B). It rests between phrases and ends on a chord tone. |
| Roll | Driving sixteenths with slides, accents and octave jumps. |
| Drift | Sparse long notes, half a bar to two bars, moving by step, with long rests. |
| Pulse | The Euclidean generator built in G4, unchanged, with its Hits, Rotate and Length knobs. |

**Knobs shared by every style** (Advanced, two pages of six):

| Page | Knob | What it does |
|---|---|---|
| Notes | Busy | How many notes play. |
| Notes | Lock | As built: frozen at right, always changing at left. |
| Notes | Shape | Selector: Rise, Fall, Arch, Valley, Zigzag, Flat, Free. The contour the line follows. |
| Notes | Range | Half an octave to three octaves. |
| Notes | Register | Low, middle or high: where the line sits. |
| Notes | Tension | As built: chord tones, scale tones, passing notes. |
| Feel | Note length | Short and clipped to long and overlapping. |
| Feel | Phrase | 1, 2, 4 or 8 bars before the line repeats or answers itself. |
| Feel | Variation | How much the last bar of a phrase differs from the first. |
| Feel | Repeats | Chance a note retriggers as a quick double or triple. |
| Feel | Slide | Chance a note glides into the next. |
| Feel | Accent | Chance a note is louder and brighter. |

- Slide and Accent need the layer voice to support per-note glide and a per-note filter and level boost.
- Notes get varied velocity; no style plays every note at the same level.
- **Every knob must be audible:** for each style, the notes at a knob's minimum and maximum differ (tested).
- The step row shows the current phrase's bar and marks long notes by their length.

### 8.6 Screens

**No vertical scrolling on any control screen.**
- Every tab fits the screen at 360 x 640 CSS px and up without scrolling. The page itself never scrolls.
- A tab with more controls than fit uses pages, switched by large page chips at the top of the tab.
- Lists are the only things that scroll (styles, progression cards, saved jams). A scrolling list contains only tappable rows, never a dial, slider or XY pad.

**One row of sections.**
- The section strip appears once on every screen. On the Play tab the grid's column headers are that strip; there is no second row.
- Tapping a section always means the same thing: play it from the next bar line. The edited section follows the playing one.
- Editing a section that is not playing is Advanced only: hold a section and choose "Edit without playing". It then carries a pencil mark until it is played or released.
- Three states, each with its own look and a word under the letter the first times it appears: playing (filled), next (outlined, pulsing), editing (pencil).
- A bar indicator of four beat dots sits by the play button, so it is visible when "next bar" arrives.

**Play tab.**
- **Simple, "Now":** four large section buttons and five large instrument buttons for the playing section. Tap an instrument to turn it on or off at the next bar. Hold an instrument to open its tab.
- **The vibe row** sits on the Simple Play tab in the space under the instrument buttons: one large chip per style, in a row that scrolls sideways, with the current style lit. Tapping a chip loads that style from the next bar line, the same as the style picker, and the replaced jam stays as Previous jam. In Simple the word on screen is "Vibe", not "Style". Nothing else on the screen.
- **Advanced, "Song":** the instruments-by-sections grid built in G2, with the strip as its header.

**The last jam survives a reload** (kept on the phone automatically), ahead of the full save screen of row G5.
