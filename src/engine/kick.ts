/**
 * F2 (spec 10.5): the kick, four parts, replacing the membrane voice. A click of a few milliseconds (band-passed
 * noise); a pitch sweep from `sweepRatio` times the body down to it; a sine body; its tail, the amp envelope's decay
 * (Length). Both parts go into the caller's node: the drive as built (4x oversampled), then the C1 trim.
 *
 * The sweep, body and tail are one sine voice (Tone's MembraneSynth is exactly that: a sine with an exponential pitch
 * fall and an amp envelope), so the defaults (KICK_DEFAULTS) play the old kick sample for sample. Every setting is read
 * when a hit starts (`hit`) and nothing of a sounding hit is touched: a move of any axis acts from the next kick and
 * can never step one that sounds (kick.test.ts).
 */
import * as Tone from "tone";
import { KICK_DEFAULTS, KICK_KEYS, KICK_SWEEP_S, kickShape, sweepRatio, type KickKey, type KickSettings, type KickShape } from "../music/kick.ts";
import type { KeyName } from "../music/scales.ts";

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/** The click's band and envelope: a short burst high enough to read as the beater, under the drums' 10 kHz top. */
const CLICK_HZ = 3500;
const CLICK_Q = 0.9;

export class KickVoice {
  private readonly body: Tone.MembraneSynth;
  private readonly click: Tone.NoiseSynth;
  private readonly settings: KickSettings = { ...KICK_DEFAULTS };
  private pitch = 0.4;
  private key: KeyName = "A";
  /** The last hit's shape, for the smoke (`engine.kickShape()`). */
  last: KickShape | null = null;

  constructor(out: Tone.ToneAudioNode, release: number) {
    this.body = new Tone.MembraneSynth({
      pitchDecay: KICK_SWEEP_S,
      octaves: sweepRatio(KICK_DEFAULTS.kickPunch),
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release },
    });
    this.body.connect(out);
    this.click = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.0005, decay: 0.004, sustain: 0, release: 0.002 },
    });
    // F2 slice c: the click is folded to one channel before the drive. Tone's noise is stereo, and while a click and its
    // filter's tail sound the drive's input turned stereo and back, which restarted its 4x oversampler: a step of about
    // a fifth of the kick's level on every hit with Click above 0, 40 to 110 ms in (tools/smoke.py, walk_kick_still).
    // The fold averages the two channels, so it carries the noise up by the square root of 2 to keep the click's level.
    const mono = new Tone.Gain(Math.SQRT2);
    mono.channelCount = 1;
    mono.channelCountMode = "explicit";
    const bp = new Tone.Filter({ frequency: CLICK_HZ, type: "bandpass", Q: CLICK_Q });
    this.click.connect(mono);
    mono.connect(bp);
    bp.connect(out);
  }

  /** One kick setting (KICK_KEYS), from the next hit. */
  set(key: KickKey, v: number): void {
    this.settings[key] = clamp01(v);
  }
  /** The Pitch dial (Tune with Root off), from the next hit. */
  setPitch(v: number): void {
    this.pitch = clamp01(v);
  }
  /** The song's key: the body's pitch with Root on, from the next hit. */
  setKey(key: KeyName): void {
    this.key = key;
  }
  /** The settings now (a copy). */
  get values(): KickSettings {
    return { ...this.settings };
  }
  /** What the next hit plays. */
  shape(): KickShape {
    return kickShape(this.settings, this.pitch, this.key);
  }

  /** One hit at `time`: `decay` the tail (seconds, the Length axis as `drumDecay` gives it), `vel` 0..1. */
  hit(time: number, decay: number, vel: number): void {
    const s = this.shape();
    this.last = s;
    this.body.octaves = s.sweepRatio;
    this.body.pitchDecay = s.sweepS;
    this.body.envelope.decay = decay;
    this.body.triggerAttackRelease(s.bodyHz, decay, time, vel);
    if (s.clickGain > 0) {
      this.click.envelope.decay = s.clickS;
      this.click.triggerAttackRelease(s.clickS, time, vel * s.clickGain);
    }
  }
}

export { KICK_KEYS };
