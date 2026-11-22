import * as Tone from "tone";

/**
 * Step 0 sound spike: the heaviest patch we expect to run, hard-coded.
 * Drums, bass, chord stabs, pad and lead, shared reverb and delay sends,
 * sidechain pump keyed to the kick, limiter on the master.
 */

export const LAYERS = ["kick", "hats", "clap", "bass", "chords", "pad", "lead"] as const;
export type LayerId = (typeof LAYERS)[number];

export type LatencyHint = "interactive" | "balanced" | "playback";

interface Chord {
  root: string; // bass note
  notes: string[]; // chord voicing
}

// A minor, deep house: i9 - VImaj9 - iv9 - v7
const PROGRESSION: Chord[] = [
  { root: "A1", notes: ["A3", "C4", "E4", "G4", "B4"] },
  { root: "F1", notes: ["F3", "A3", "C4", "E4", "G4"] },
  { root: "D2", notes: ["D3", "F3", "A3", "C4", "E4"] },
  { root: "E2", notes: ["E3", "G3", "B3", "D4"] },
];

const STAB_STEPS = new Set([0, 3, 6, 11, 14]);
const BASS_STEPS = new Set([2, 6, 10, 11, 14]);
const LEAD_STEPS = new Set([0, 2, 5, 7, 9, 11, 14]); // 7 hits spread over 16 steps
const LEAD_LOOP = 5; // lead note loop of 5 against 16 steps, so it drifts and realigns

export class Engine {
  private built = false;
  private step = 0;
  private leadIndex = 0;
  private pumpDepth = 0.6;

  private duck!: Tone.Gain;
  private gains = {} as Record<LayerId, Tone.Gain>;
  private chordFilter!: Tone.Filter;
  private meter!: Tone.Meter;

  private kick!: Tone.MembraneSynth;
  private hats!: Tone.NoiseSynth;
  private clap!: Tone.NoiseSynth;
  private bass!: Tone.MonoSynth;
  private sub!: Tone.Synth;
  private chords!: Tone.PolySynth;
  private pad!: Tone.PolySynth;
  private lead!: Tone.Synth;

  /** Must be called from a tap: browsers only start audio after a user gesture. */
  async init(hint: LatencyHint): Promise<void> {
    if (this.built) return;
    Tone.setContext(new Tone.Context({ latencyHint: hint }));
    await Tone.start();

    // Master: everything -> limiter -> out
    const limiter = new Tone.Limiter(-1).toDestination();
    const master = new Tone.Gain(0.7).connect(limiter);
    this.meter = new Tone.Meter({ smoothing: 0.6 });
    master.connect(this.meter);

    // Music bus is ducked by the kick; drums bypass the duck.
    this.duck = new Tone.Gain(1).connect(master);
    const drumBus = new Tone.Gain(1).connect(master);

    // One shared reverb and one shared delay, fed by per-layer sends.
    const reverb = new Tone.Reverb({ decay: 3.2, wet: 1 });
    await reverb.ready;
    reverb.connect(this.duck);
    const delay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.36, wet: 1 });
    delay.connect(this.duck);

    const layer = (id: LayerId, level: number, bus: Tone.Gain, rev = 0, del = 0): Tone.Gain => {
      const out = new Tone.Gain(1); // mute point
      const trim = new Tone.Gain(level).connect(bus);
      out.connect(trim);
      if (rev > 0) out.connect(new Tone.Gain(rev).connect(reverb));
      if (del > 0) out.connect(new Tone.Gain(del).connect(delay));
      this.gains[id] = out;
      return out;
    };

    // Kick: sine with a fast pitch drop, a little drive.
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 4.5,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.36, sustain: 0, release: 0.05 },
    });
    const kickDrive = new Tone.Distortion({ distortion: 0.18, wet: 0.5 });
    this.kick.chain(kickDrive, layer("kick", 0.95, drumBus));

    // Hats: filtered white noise.
    this.hats = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
    });
    this.hats.chain(new Tone.Filter(8500, "highpass"), layer("hats", 0.4, drumBus));

    // Clap: band-passed pink noise with a touch of reverb.
    this.clap = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.002, decay: 0.17, sustain: 0, release: 0.02 },
    });
    this.clap.chain(new Tone.Filter({ frequency: 1500, type: "bandpass", Q: 1.1 }), layer("clap", 0.9, drumBus, 0.25));

    // Bass: filtered saw plus a sine sub.
    const bassOut = layer("bass", 0.55, this.duck);
    this.bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { Q: 2.5, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.08 },
      filterEnvelope: { attack: 0.005, decay: 0.16, sustain: 0.15, release: 0.1, baseFrequency: 80, octaves: 3.2 },
    });
    this.bass.connect(bassOut);
    this.sub = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.08 },
    });
    this.sub.connect(bassOut);

    // Chord stabs: detuned saws through the filter the XY pad controls.
    this.chords = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 24 },
      envelope: { attack: 0.004, decay: 0.24, sustain: 0.1, release: 0.3 },
    });
    this.chords.maxPolyphony = 12;
    this.chordFilter = new Tone.Filter({ frequency: 1800, type: "lowpass", Q: 3, rolloff: -24 });
    this.chords.chain(this.chordFilter, layer("chords", 0.3, this.duck, 0.3, 0.3));

    // Pad: slow detuned saws, dark filter, lots of reverb.
    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 34 },
      envelope: { attack: 0.7, decay: 0.6, sustain: 0.8, release: 1.8 },
    });
    this.pad.maxPolyphony = 12;
    this.pad.chain(new Tone.Filter(850, "lowpass"), layer("pad", 0.09, this.duck, 0.6));

    // Lead: plucky triangle into the delay.
    this.lead = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.003, decay: 0.16, sustain: 0.05, release: 0.2 },
    });
    this.lead.chain(new Tone.Filter(3200, "lowpass"), layer("lead", 0.16, this.duck, 0.35, 0.55));

    const transport = Tone.getTransport();
    transport.bpm.value = 122;
    transport.scheduleRepeat((time) => this.tick(time), "16n");
    this.built = true;
  }

  private tick(time: number): void {
    const s = this.step % 16;
    const chord = PROGRESSION[Math.floor(this.step / 16) % PROGRESSION.length];
    const sixteenth = Tone.Time("16n").toSeconds();

    if (s % 4 === 0) {
      this.kick.triggerAttackRelease("G1", "8n", time);
      // Sidechain pump: drop the music bus on the kick, let it swell back.
      const g = this.duck.gain;
      g.cancelScheduledValues(time);
      g.setValueAtTime(1 - this.pumpDepth, time);
      g.setTargetAtTime(1, time + 0.02, 0.075);
    }
    if (s % 4 === 2) this.hats.triggerAttackRelease("16n", time, 1);
    else if (s % 2 === 1) this.hats.triggerAttackRelease("32n", time, 0.25);
    if (s === 4 || s === 12) this.clap.triggerAttackRelease("16n", time);

    if (BASS_STEPS.has(s)) {
      const len = sixteenth * 0.9;
      this.bass.triggerAttackRelease(chord.root, len, time, 0.9);
      this.sub.triggerAttackRelease(chord.root, len, time, 0.8);
    }
    if (STAB_STEPS.has(s)) {
      this.chords.triggerAttackRelease(chord.notes, sixteenth * 1.4, time, s === 0 ? 0.9 : 0.65);
    }
    if (s === 0) {
      this.pad.triggerAttackRelease(chord.notes.slice(0, 4), Tone.Time("1m").toSeconds() * 0.9, time, 0.7);
    }
    if (LEAD_STEPS.has(s)) {
      const note = chord.notes[this.leadIndex % Math.min(LEAD_LOOP, chord.notes.length)];
      this.lead.triggerAttackRelease(Tone.Frequency(note).transpose(12).toNote(), sixteenth * 0.8, time, 0.8);
      this.leadIndex++;
    }
    this.step++;
  }

  get playing(): boolean {
    return this.built && Tone.getTransport().state === "started";
  }

  play(): void {
    this.step = 0;
    this.leadIndex = 0;
    Tone.getTransport().start("+0.05");
  }

  stop(): void {
    Tone.getTransport().stop();
    this.pad.releaseAll();
    this.chords.releaseAll();
    this.duck.gain.cancelScheduledValues(Tone.now());
    this.duck.gain.setValueAtTime(1, Tone.now());
  }

  setLayer(id: LayerId, on: boolean): void {
    this.gains[id]?.gain.rampTo(on ? 1 : 0, 0.03);
  }

  /** x and y are 0..1 from the XY pad. */
  setFilter(x: number, y: number): void {
    const hz = 120 * Math.pow(2, x * 6.6); // 120 Hz .. ~11.6 kHz
    this.chordFilter.frequency.rampTo(hz, 0.03);
    this.chordFilter.Q.rampTo(0.5 + y * 13.5, 0.03);
  }

  setPump(depth: number): void {
    this.pumpDepth = Math.max(0, Math.min(0.95, depth));
  }

  get bpm(): number {
    return Math.round(Tone.getTransport().bpm.value);
  }

  set bpm(v: number) {
    Tone.getTransport().bpm.value = Math.max(80, Math.min(180, v));
  }

  /** Master level before the limiter, in dB. */
  level(): number {
    const v = this.meter.getValue();
    return typeof v === "number" ? v : v[0];
  }

  info(): { sampleRate: number; baseLatencyMs: number; outputLatencyMs: number } {
    const raw = Tone.getContext().rawContext as unknown as AudioContext;
    return {
      sampleRate: raw.sampleRate,
      baseLatencyMs: Math.round((raw.baseLatency ?? 0) * 1000),
      outputLatencyMs: Math.round((raw.outputLatency ?? 0) * 1000),
    };
  }
}
