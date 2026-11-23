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

- **One toggle, app-wide,** in the header: Simple or Advanced. It is remembered between launches. A new install starts in Simple.
- **The mode changes what is shown, never what is heard.** Same song document, same engine. Switching mode mid-jam makes no sound change and loses nothing.
- **Simple** uses plain words only. No scale names, chord degrees, Euclidean, envelope or any term a non-musician would have to look up.
- **Advanced** is every control the app has: all of sections 3 to 5, plus what this section adds.
- **Nothing is hidden state.** A Simple control writes ordinary song and patch values, so Advanced shows the result of every Simple move.

### 8.2 Styles

A style is a complete starting point: one tap gives a full groove.

- **Launch set (24), in five families:**

| Family | Styles |
|---|---|
| House | Deep house, Tropical house, Progressive, Acid house, Afro house |
| Techno | Deep techno, Melodic techno, Minimal techno, Dub techno |
| Breaks | Drum and bass, 2-step, Breakbeat, Dubstep, Future garage |
| Slow | Lo-fi, Ambient, Drone, Downtempo, Synthwave |
| Other | IDM, EDM, Trance, Electro, Trap |

- **A style's name is at most 14 characters,** so it fits a tile on one line. In Simple the word on screen is "Vibe".
- **A style sets everything:** bpm, swing, key and mood, its chord progression, drum beat, bass rhythm, synth rhythm, the five patches, each layer's mode and lead style, send and mix settings, and four sections arranged as intro, groove, break and outro with different instruments on in each.
- **A style is one data file** under `src/styles/`. Adding a style, a drum beat, a bass rhythm, a patch or a progression needs no engine or UI code; pickers list whatever exists.
- **A style's section chords are library progressions tagged with it** (spec 8.4). New chords for a style mean a new progression file next to the style file.
- **Opening the app** shows the vibe picker: all 24 as tiles in two columns on one screen, coloured by family, with "Continue last jam" first when there is one. It does not scroll. Tapping a tile loads it and starts playing.
- **New jam from style** is always one tap away, in the header. Loading a style while playing lands on the next bar line. A vibe loads as a new song, so the jam it replaces is kept in Songs.
- **Bpm range becomes 60 to 180** so Lo-fi and Ambient fit.
- **No samples, ever** (replaces the mention of sampled breaks in section 3). Every sound and effect is synthesized in code. No audio files ship with the app.

### 8.3 Simple controls

Each instrument tab in Simple shows one picker and four large dials, on one screen.

| Instrument | Picker | Dials |
|---|---|---|
| Drums | Beat | Punch, Hats, Swing, Level |
| Bass | Rhythm | Bright, Weight, Punch, Level |
| Synth | Sound | Bright, Punch, Space, Level |
| Layer 1 and 2 | Mode (Lead, Arp, Pad, Drone), and the lead style when the mode is Lead | Busy, Evolve, Bright, Space |

- **A macro dial moves several ordinary values at once** (Bright: cutoff and filter envelope; Space: both sends; Punch: attack, decay and drive; Weight: sub and low drive; Evolve: the inverse of Lock). The mapping is data, next to the patch definitions.
- **Each macro's position is stored in the song** so the dial shows where it was left. Editing the underlying values in Advanced does not move the macro dial.
- **The XY pad stays** on every instrument tab in both modes.
- **Two effect buttons** sit on every Simple instrument tab: on or off, nothing else (section 8.8).
- **Layers also get two buttons in both modes:** New idea (a new seed) and Back (the previous seed). The last eight seeds per layer per section are kept.

### 8.4 Chords

- **Simple:** no scales, no degrees. Pick a feel (Bright, Warm, Dreamy, Dark, Tense, Uplifting), then tap one of four progression cards. A "More chords" button shows the next four; nothing scrolls. Each card has a plain name and shows its chords as coloured blocks. A tapped card plays from the next bar line. The cards are those that suit the song's vibe; a button in the tab's title opens the vibe picker to borrow another vibe's chords. "Lower" and "Higher" transpose the song by a semitone, with no note names shown.
- **The library:** at least 120 progressions, each tagged with one or more feels and the vibes it suits, so that every vibe has at least four for every feel. Each is stored as degrees, mood and voicing, so it transposes and stays in key. Names are neutral. No artist, song or label names, and no claim that a progression comes from any track.
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

The images in `docs/design/look/` are the reference for how screens look (section 8.12) and for the layout of Simple Play, Simple Layer, Advanced Layer and both tablet layouts. The older images in `docs/design/phase2/` are the reference only for the layout of Simple Chords (`groovebox-3`), the vibe picker (`groovebox-6`) and Advanced Play on a phone (`groovebox-4`); their rounded corners, dashed outlines, plain instrument buttons and second typeface are superseded. Names and values in all of them are placeholders.

**Simple never scrolls and never swipes, in any direction.**
- Every Simple screen shows everything it has at 360 x 640 CSS px and up. Where there is more than fits (progressions), a visible button pages to the next set.
- Simple is complete on its own: a whole jam, from picking a vibe to changing chords, beats, sounds and leads, without opening Advanced.

**Advanced never scrolls vertically.**
- Every tab fits the screen at 360 x 640 and up. The page itself never scrolls.
- A tab with more controls than fit uses pages, switched by large page chips at the top of the tab. Advanced is where the fine control lives.
- The saved-jams list is the one thing that scrolls. It contains only tappable rows.

**Text always fits its tile.** On a tile, chip, button, dial or pill, at 360 px wide and up, text never wraps, is never cut off and never overflows the edge. Text that is too wide is drawn smaller until it fits, down to 10 px. A label that still does not fit at 10 px is shortened in the source. Help text goes under a control or in a sheet, never inside a tile.

**The controls used most sit at the bottom, in thumb reach.** Every screen is laid out in this order, top to bottom:

1. Header: New jam, Songs and the Simple / Advanced switch.
2. The tab's own content. Within it, the control touched most (the XY pad, the instrument buttons, the grid) sits lowest.
3. The section strip.
4. The transport bar: play and stop, bpm, the bar counter, the four beat lights, record. The vibe is shown in the vibe control; key and mood are on the Chords tab.
5. The tab bar.

The strip and the transport bar are in the same place on every tab. On the Advanced Play tab the strip is indented to line up under the grid's four columns, so the strip is the grid's column labels.

**One row of sections.**
- The section strip appears once on every screen, above the transport bar. On the Play tab the grid sits directly on top of it and uses it as its column labels; there is no second row.
- Tapping a section always means the same thing: play it from the next bar line. The edited section follows the playing one.
- Editing a section that is not playing is Advanced only: hold a section and choose "Edit without playing". It then shows as Editing until it is played or released.
- Three states, each with its own look and a word under the letter: Playing (filled, with the moving band), Next bar (hatched frame, marching and pulsing), Editing (a yellow inset line). Section 8.12 has the detail.
- Four square beat lights sit in the transport bar, so it is visible when "next bar" arrives.

**Play tab.**
- **Simple, "Now":** the vibe control at the top, then the five instrument lanes for the playing section (section 8.12), then the DROP button (section 8.9) with the Morph switch (section 8.11) beside it, directly above a taller section strip. Tap an instrument to turn it on or off at the next bar. Hold an instrument to open its tab.
- **The vibe control** sits at the top of the Simple Play tab: the current vibe as one large button with an arrow button on each side. An arrow loads the previous or next vibe from the next bar line; the middle button opens the vibe picker. The replaced jam is kept in Songs.
- **Advanced, "Song":** the instruments-by-sections grid built in G2, sitting on the strip.

**The last jam survives a reload.** G5 built this: the song is saved automatically and reopens on launch.

### 8.7 Sounds, beats and rhythms

Everything here is data that pickers list, apart from the engine additions at the end. All of it is synthesized.

- **Beats (at least 24):** Four on the floor, House shuffle, Techno, Minimal, Dub, Acid, Afro, Tropical, Progressive, 2-step, Garage shuffle, Breakbeat, DnB two-step, DnB roller, Halftime, Dubstep, Boom bap, Trap, Electro, Trance, EDM, Downtempo, Synthwave, Glitch, and None.
- **Bass rhythms (at least 14):** Offbeat, Rolling, Long notes, DnB sub, Octave bounce, Acid line, Dub, Reese hold, Wobble, 808 glide, Arp bass, Pedal, Garage skip, Walking.
- **Synth rhythms (at least 10):** Stabs, Offbeat, Sustained, Dub chord, Pluck eighths, Gate, Skank, Swell, Broken chord, Push.
- **Patches (at least 8 per instrument):** for example Sub, Round, Acid, Reese, Wobble, 808, Pluck and Rubber for bass; Warm stab, Dub chord, Organ, Pluck, Supersaw, Soft keys, Glass and Brass for synth; Soft sine, Square, Acid, Pluck, Bell, Saw, Whistle and Airy for leads; Warm, Dark, Airy, Strings, Shimmer, Choir-like, Glass and Tape for pads.
- **Names:** at most 14 characters, plain, one line.

**Engine additions these need:**
- Two more drum voices, Perc (a tuned tom or conga-like hit) and Shaker, in presets and in the Advanced sequencer.
- Drum presets on 16 steps with repeats (hat rolls), and a 16-step switch on the Advanced sequencer. Simple shows only the beat picker.
- A noise oscillator and a two-operator FM wave for patches (airy pads, bells, glassy keys).
- A tempo-synced LFO on the filter, for Wobble bass and pad motion.
- A lo-fi master option (bit-crush, slow pitch wobble, a noise layer), switchable off. Chorus and the other effects are section 8.8.
- All within the phone CPU budget of section 4: voice cap unchanged, every addition switchable off.

### 8.8 Effects

Things that make a sound weird and fun. All synthesized, all switchable while playing without a click.

**Two effect slots per instrument.** Each slot holds one effect from this list:

| Effect | What it does | Advanced knobs |
|---|---|---|
| Chorus | Thickens and widens. | Mix, Rate, Depth |
| Phaser | A slow sweeping whoosh. | Mix, Rate, Depth |
| Flanger | A metallic jet sweep. | Mix, Rate, Feedback |
| Fuzz | Hard distortion, beyond the patch's Drive. | Amount, Tone, Mix |
| Crush | Bit-crush and sample-rate reduction: gritty, digital. | Bits, Rate, Mix |
| Tremolo | Volume pulsing in time. | Depth, Rate, Shape |
| Pan | Moves the sound left and right in time. | Depth, Rate, Shape |
| Gate | Chops the sound into a rhythm, in time. | Pattern, Depth, Smooth |
| Ring | Ring modulation: bell-like, robotic. | Mix, Pitch, Follow |
| Vowel | A formant filter that makes it talk. | Mix, Vowel, Rate |
| Shifter | Frequency shift: detuned, alien. | Mix, Shift, Feedback |
| Echo | A ping-pong delay of the instrument's own. | Mix, Time, Feedback |

- **Simple:** each instrument tab shows its two slots as two large on/off buttons carrying the effect's name. The vibe decides which two effects are in the slots and how they are set. Nothing else to adjust.
- **Advanced:** an FX page on each instrument tab: per slot, a picker for the effect, an on/off, and its three knobs.
- **Rates are tempo-synced** where the effect moves in time (Tremolo, Pan, Gate, and Phaser and Flanger when set to a note value).
- **Master effects** stay on the Mix tab: the filter sweep, pump, saturation, and the lo-fi master of 8.7. Simple shows the lo-fi master as one on/off.
- **Cost:** a slot that is off is disconnected and costs nothing. At most two effects per instrument. The row that builds this measures the phone load with all ten slots on and reports it; if that is too much, the cap drops to six active slots across the app and the spec says so.
- **Each vibe sets its slots,** so Lo-fi can arrive with Crush and Chorus on the keys and Dub techno with Echo on the chords.

### 8.9 The Drop

One large button, DROP, that turns whatever section is playing into its biggest moment and keeps it there until it is switched off.

**Switching it on.** A press is never immediate: the track gets a few bars to prepare and deliver. Everything runs on the audio clock and starts on the next bar line.

1. **Build** (2, 4 or 8 bars, set by the vibe). The bass is filtered out, the drums thin and a snare or clap roll speeds up, a noise riser sweeps upward, the reverb grows, the lead climbs.
2. **Cliffhanger** (the last beat or half bar of the build). Gap (silence) or Hold (a single filtered chord hangs). The tempo never changes.
3. **Swoosh and impact** on the bar line: a falling noise sweep, a sub hit and a bright noise burst.
4. **The drop:** every instrument of the section, plus extra layers. It stays on.

**Switching it off.** A second press runs the reverse: over 2 or 4 bars (set by the vibe) the extra layers narrow and fall away, and on a bar line the music is back at its normal size.
- If another section was tapped during the drop, the wind-down lands in that section. Otherwise it lands in the same one.
- A section tapped during the drop does not switch at once; it waits for the wind-down. This is the one exception to the next-bar rule, and the section shows as queued until then.
- A press during the build cancels it, back to normal on the next bar line.

**Bigger means wider, not louder.**
- The drop sits at the same loudness as the section it came from, within 1 dB (measured). Nothing gets turned up.
- The size comes from layers that are added automatically and spread across the stereo field:
  - Synth: extra detuned voices panned wide, and a second layer an octave up.
  - Bass: the centre stays as it was; a wide, filtered upper layer is added around it.
  - Drums: open hats, a ride or shaker layer and extra percussion, panned out; the kick is unchanged.
  - Layers: the lead doubled an octave up with a short stereo delay; the pad wider and brighter.
  - Mix: deeper pump and a fully open filter.
- The build makes room for it: with the low end filtered out beforehand, the full range coming back is what reads as big.

**Rules**
- **The extra layers are an overlay.** They sit on top of the song while the drop is on and change nothing in the song document. After the wind-down, every knob is where it was. Knobs still work during a drop.
- **The button shows where it is:** a countdown of bars during the build and the wind-down, lit steadily while the drop is on.
- **Each vibe has its own recipe,** as data in its style file: build length and parts, the cliffhanger, the impact, which extra layers and how wide, the wind-down length. Deep techno's is restrained (hats out, filter down, kick back in, wider chords). Ambient's and Drone's are a slow bloom with no impact. Lo-fi's is a filter-down and the beat falling back in. EDM's and Trance's are the full thing.
- **Where it is:** Simple, on the Play tab between the instruments and the section strip, full width. Advanced shows the same button and adds a Drop page on the Mix tab: build length, cliffhanger, wind-down length and one Width knob.
- **Recorded as events** (on, off), so a saved jam replays it identically.

### 8.10 Ambient and Drone

Two vibes for coasting: drones, swooping pads, weird and slow, changing by themselves. Ambient is soft and tonal; Drone is darker and stays on one note or chord for a long time. They need things the dance vibes do not.

- **Long everything:** attack and release up to 20 seconds on pads and layers; reverb decay up to 20 seconds; chords that last 4 or 8 bars (the other vibes keep half a bar to 2).
- **A Drone mode on the layers,** beside Arp, Pad and the lead styles: one or two held notes (root, or root and fifth) that never retrigger and glide slowly when the chord changes.
- **Swoop:** pads and drones glide in pitch between chords, with the glide time as a knob.
- **Free-running slow movement:** a second kind of LFO, not tied to the tempo, with a period of up to two minutes, on filter, pitch (a few cents), width and send levels.
- **An air layer:** filtered noise that breathes slowly.
- **Tempo from 60 bpm; the beat picker's None,** or a sparse pulse.
- **Effects that suit them:** Shifter, Vowel, Echo and the long reverb.
- Their Drop is a bloom: no roll, no impact, the pads open and widen over 8 bars.

### 8.11 Morph

A switch that lets the jam change by itself, slowly, so it can be left playing.

- **Simple:** one on/off button, Morph, on the Play tab, and one Speed dial on the Mix tab. On by default in Ambient and Drone, off elsewhere.
- **What it moves,** all slowly and all within limits the vibe sets:
  - The Bright and Space macros of each instrument drift up and down.
  - Leads evolve: Lock eases off for a few bars now and then, so a note or two changes, then holds again.
  - Pads and drones change voicing and register at phrase ends.
  - Instruments drop out and return at section-length intervals.
  - Optionally, the section moves on by itself every 16 or 32 bars.
- **Advanced:** a Morph page on the Mix tab with a switch per thing it may move, the speed and the depth.
- **It is seeded and recorded,** so a saved jam replays the same journey.
- **Touching a control takes it back:** Morph leaves a control alone for 16 bars after it is moved by hand.
- **It never writes to the song document** except through the same recorded events a hand would make.

### 8.12 The look

Approved by Pedro on 23 Nov 2026 from the five images in `docs/design/look/` (the `v3` set: icons, one typeface, motion shown as single frames). They are the reference for how every screen looks; the older images in `docs/design/phase2/` remain the reference only for the layout of the screens not redrawn (Simple Chords, the vibe picker, Advanced Play on a phone).

A hardware faceplate, flat, in the existing colours. One loud idea, everything else quiet.

**The loud idea: the music is visible.**
- Every instrument shows the bar it is playing as a lane: drum hits, bass notes, chord stabs, the lead's melody, the pad's long tones, drawn in the instrument's colour on a 16-step grid with a faint line every beat.
- One playhead line sweeps across all the lanes in time.
- On the Simple Play tab the five instruments are five lanes: a label block on the left (name and what it plays; tap to switch on or off at the next bar, hold to open its tab) and the lane to its right. This replaces the plain instrument buttons of section 8.6.
- On every instrument tab the instrument's own lane sits above its controls.
- On the tablet pad grid the pads of the playing section show their notes inside the pad, with the playhead through that column.
- An instrument that is off still shows its lane, greyed.
- The engine gives the screen each instrument's current bar as a list of notes (step, length, pitch or drum voice). Drawing them must never delay the audio.

**Shapes**
- Tiles, buttons, chips and pads have a 3 px corner radius. Only things that are round in the physical world are round: dials and the XY dot.
- Tiles sit 2 px apart, so a screen reads as one panel. Groups are separated by 10 px.
- No shadows, no glow, and no gradients except the moving band described under Motion.

**States**
- On: the tile is filled with the instrument's colour, text in black.
- Off: a dark tile with a 4 px edge of its colour.
- Starts on the next bar: a diagonally hatched frame in the colour around a dark centre, with the words "Next bar". This replaces the dashed outline everywhere.
- Playing section: filled teal. Editing without playing: a yellow inset line and the word "Editing".

**Dials**
- A square-cut arc (no rounded ends) on a dark track, three tick marks at minimum, middle and maximum, a short white pointer at the value, the value in the centre in weight 800, the name under it in sentence case.

**Type**
- One typeface for everything: DM Sans. No second face.
- Hierarchy comes from weight, size and letter spacing:

| Use | Weight | Size | Spacing |
|---|---|---|---|
| Large numbers (bpm, bar), section letters | 800 | 22 to 28 px | tight (-0.03em) |
| Names (instruments, vibes, screen titles) | 800 | 16 to 22 px | tight (-0.02em) |
| Buttons and chips | 600, 700 when on | 12.5 to 15 px | normal |
| Small labels and dial names | 600 | 11 to 12 px | slightly open (+0.02em) |
| The word DROP | 900 | 22 to 30 px | wide (+0.24em) |

- DM Sans has no width axis, so narrow and wide cuts are not available; spacing does that job.
- Numbers that change while playing must not shift: tabular figures, or a fixed-width box where the font lacks them.
- Sentence case. No all-capital labels except DROP.
- The font ships with the app.

**Icons**
- Material Symbols, outlined, weight 300, shipped with the app as SVG.
- An icon always sits beside its word, never in place of it. The exceptions are the vibe arrows, play and stop, and record.
- Where they go: the tab bar, instrument names (dial names included), mode switches (Lead, Arp, Pad, Drone), page chips (Notes, Feel, Sound, FX, and every other page chip), effect buttons, punch pads, New jam, Back, New idea, Morph, DROP, and group headings.

| Thing | Icon |
|---|---|
| Play, Chords, Drums, Bass, Synth, Layer 1, Layer 2, Mix | grid_view, piano, adjust, graphic_eq, airwave, layers, stacks, tune |
| Lead, Arp, Pad, Drone | show_chart, stairs, cloud, horizontal_rule |
| Notes, Feel, Sound, FX | music_note, gesture, tune, bolt |
| New jam, Back, New idea, Morph, DROP | add, undo, casino, all_inclusive, keyboard_double_arrow_down |
| Cut, Filter, Stutter, Echo, Wash, Riser, Chorus | content_cut, filter_alt, fast_rewind, repeat, water, trending_up, blur_on |
| Beat, Kick · Clap, Hats, Rhythm, Key, Master, Levels, Audio | apps, radio_button_checked, grain, timeline, key, speaker, equalizer, headphones |
| Wave, Sequencer, Motion, Direction, Rate, Octaves | waves, view_week, motion_blur, swap_vert, speed, height |
| Pulse | timeline |
| Kit, Steps, Mod, Space | adjust, view_week, speed, water |

- The set has no drum icon; `adjust` (a pad seen from above) stands in. The row that builds each remaining effect and feature picks its icon from the same set and adds it to this table.
- An icon may be drawn by hand only where the set has nothing usable, at the same line weight.

**Motion**

Movement shows where things are and what is about to happen. Every animation is tied to the clock or to a touch.

| What | How it moves |
|---|---|
| Anything sounding (the playing section, an instrument that is on, the tablet pads of the playing column) | A lighter band of its own colour travels across the tile once per bar. This is the only gradient in the app. |
| Anything queued for the next bar | The hatching marches, and a ring in its colour pulses on each beat. On the bar line the tile fills with a quick wipe. |
| Lanes | The playhead sweeps; a note brightens as the playhead crosses it. |
| An instrument's label | Brightens briefly on each note it plays. |
| Dials | The arc follows the value; a dial being moved by a macro, Morph, the wobble or a punch pad shows that movement. |
| Beat lights | Step on each beat; the first is brighter. |
| DROP | During the build the tile fills from the left with marching stripes and the segments count down. While on, a slow wide band. On wind-down it drains. |
| Morph, when on | Its icon turns slowly. |
| Record, when recording | The dot pulses. |
| Tab bar | The active marker slides to the chosen tab. |

- Only transforms, opacity and background position are animated, in one loop, so it stays cheap.
- With the system's reduce-motion setting, or the app's own switch on the Mix tab, movement stops and the states stay readable by fill and hatching alone.
- Audio comes first: under load the animation drops frames.

**Other**
- The XY pad has a dot grid, hairline crosshairs and a readout of the value in the corner.
- The beat indicator is four square lights.
- DROP is a full-width yellow tile with its icon and four bar segments that count down.

## 9. Phase 3: tablet

Settled on 23 Nov 2026. On a tablet the app should feel like a synth and pad controller you want to jam on for hours: more on screen at once, fewer taps, things that move with the music. Sections 1 to 8 still hold; this section says what changes when the screen is larger. `docs/design/look/groovebox-v3-tablet-1-landscape-advanced.jpg` and `groovebox-v3-tablet-2-portrait-simple.jpg` are the reference.

### 9.1 Three layouts

| Layout | When | Orientation |
|---|---|---|
| Phone | under 600 px wide | portrait only |
| Tablet portrait | 600 px wide or more, taller than wide | free |
| Tablet landscape | 900 px wide or more, wider than tall | free |

- **Rotating mid-jam** changes the layout with no gap in the audio and nothing lost.
- **Extra space shows more at once.** It is not used to make the phone layout bigger.
- **Nothing scrolls on a tablet in either mode,** the saved-jams list excepted. Advanced uses pages only where a panel cannot fit at 1024 x 768.
- The text-fit rule and the thumb-reach order of section 8.6 apply. On a tablet held in two hands the bottom corners are the thumb zones: sections and transport bottom left, the XY pad bottom right in landscape.

### 9.2 Tablet landscape: the desk

Two halves, both always on screen.

- **Left: the pads.** The punch pads on top; under them the instruments-by-sections grid as large pads, each row labelled with the instrument and what it is playing, the pads of the playing section showing their notes; then the section strip as the grid's column labels; then the DROP button and the transport bar side by side.
- **Right: one instrument.** A rail of seven buttons (Chords, Drums, Bass, Synth, Layer 1, Layer 2, Mix) and the chosen one's panel under it.
- **Advanced panels show everything at once, with no pages:**
  - Layers: mode and lead style, the phrase row, the Notes and Feel groups of six knobs side by side, the XY pad and the Sound group.
  - Drums: every voice by 16 steps as one grid, with the voice controls beside it.
  - Bass and Synth: all patch knobs, the rhythm picker and the XY pad.
  - Every instrument panel also shows its two effect slots with their knobs.
  - Mix: a fader and meter per instrument, the master controls and the lo-fi master.
  - Chords: the editor and the progression library side by side.
- **Simple panels** are the picker, the four macro dials at a large size, and the XY pad.
- The header carries New jam, Songs, the vibe control and the mode switch.

### 9.3 Tablet portrait

- **Top:** the chosen instrument's panel, laid out as in landscape where it fits, otherwise in two rows.
- **Bottom dock, always on screen:** the punch pads; the five instrument lanes (Simple) or the pad grid (Advanced); the DROP button with Morph; the section strip; the transport bar; the tab bar.

### 9.4 Punch pads

Six momentary performance effects, all synthesized, all landing in time.

| Pad | While held or after a tap |
|---|---|
| Cut | Drums and bass go silent while held; they return on the next bar line after release. |
| Filter | The master filter sweeps down while held and opens again on the next beat after release. |
| Stutter | The last half beat repeats while held; normal play resumes on the next beat. |
| Echo | One tap throws the mix into the delay for a bar. |
| Wash | One tap throws the mix into the reverb for a bar. |
| Riser | A noise riser sweeps upward while held and falls away on release. |

- Several can be held at once.
- On a phone they are a page of the Mix tab.
- Stutter replaces row L5.
- The DROP button of section 8.9 is on both tablet layouts: beside the transport bar in landscape, above the section strip in portrait.

### 9.5 It moves with the music

- A pad pulses when its instrument sounds, from a level meter per instrument.
- Step rows and the drum grid show the playing step.
- A dial moved by a macro, the filter wobble or a punch pad shows that movement.
- One animation loop drives all of it. Audio comes first: under load the animation drops frames or switches off, and it can be switched off in the Mix tab.

### 9.6 Many fingers

- Any number of controls can be used at once: two dials, the XY pad and a pad, several pads together.
- No control cancels another's touch.
