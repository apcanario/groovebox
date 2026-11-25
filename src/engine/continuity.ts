/**
 * Level continuity, for the smoke test (P6 review S2; P9 needs the same check): an AudioWorklet on one
 * instrument's output keeps the largest sample-to-sample jump and the largest sample since it was last read (of
 * either channel).
 * A click is a jump far above what the sound's own waveform makes; the smoke test compares the two ratios.
 */

export const JUMP_SOURCE = `
// P9 review E3: last starts from the first sample seen (no jump from silence on the first read); M9: both
// channels, the larger jump and sample of the two.
class GrooveJump extends AudioWorkletProcessor {
  constructor() {
    super();
    this.last = [null, null];
    this.jump = 0;
    this.peak = 0;
    this.port.onmessage = () => {
      this.port.postMessage({ jump: this.jump, peak: this.peak });
      this.jump = 0;
      this.peak = 0;
    };
  }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || !inp.length) return true;
    for (let c = 0; c < Math.min(2, inp.length); c++) {
      const a = inp[c];
      let last = this.last[c] === null ? a[0] : this.last[c];
      for (let i = 0; i < a.length; i++) {
        const x = a[i], d = Math.abs(x - last);
        if (d > this.jump) this.jump = d;
        if (Math.abs(x) > this.peak) this.peak = Math.abs(x);
        last = x;
      }
      this.last[c] = last;
    }
    return true;
  }
}
registerProcessor("groove-jump", GrooveJump);

// P9: how far a sound after the effects (input 1) differs from the sound going in (input 0), both channels (M9).
class GrooveDiff extends AudioWorkletProcessor {
  constructor() {
    super();
    this.d = 0; this.r = 0; this.n = 0;
    this.port.onmessage = () => {
      const n = Math.max(1, this.n);
      this.port.postMessage({ diff: Math.sqrt(this.d / n), ref: Math.sqrt(this.r / n) });
      this.d = 0; this.r = 0; this.n = 0;
    };
  }
  process(inputs) {
    const A = inputs[0], B = inputs[1];
    if (!A || !A.length || !B || !B.length) return true;
    for (let c = 0; c < 2; c++) {
      const a = A[c] || A[0], b = B[c] || B[0];
      for (let i = 0; i < a.length; i++) { const e = b[i] - a[i]; this.d += e * e; this.r += a[i] * a[i]; }
      this.n += a.length;
    }
    return true;
  }
}
registerProcessor("groove-diff", GrooveDiff);

// P10: energy of the left and right channels, of their mid and side, and the largest sample since the last read. A
// stretch with no input counts as silence (the Drop's loudness and width, measured over whole bars).
// P10 review S7: the energy is K-weighted as in ITU-R BS.1770 (a +4 dB shelf above about 1.5 kHz, then a high-pass at
// 38 Hz), so the drop's added top end counts as the ear hears it; the unweighted energy, the width and the peak are
// read from the signal itself.
class GrooveEnergy extends AudioWorkletProcessor {
  constructor() {
    super();
    this.l = 0; this.r = 0; this.m = 0; this.s = 0; this.n = 0; this.pk = 0; this.kl = 0; this.kr = 0;
    const fs = sampleRate;
    let K = Math.tan(Math.PI * 1681.974450955533 / fs), Q = 0.7071752369554196;
    const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    let a0 = 1 + K / Q + K * K;
    this.s1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    K = Math.tan(Math.PI * 38.13547087602444 / fs); Q = 0.5003270373238773;
    a0 = 1 + K / Q + K * K;
    this.s2 = [1, -2, 1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    // Per channel, per stage: x1, x2, y1, y2.
    this.z = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    this.port.onmessage = () => {
      this.port.postMessage({ l: this.l, r: this.r, m: this.m, s: this.s, n: this.n, peak: this.pk, kl: this.kl, kr: this.kr });
      this.l = 0; this.r = 0; this.m = 0; this.s = 0; this.n = 0; this.pk = 0; this.kl = 0; this.kr = 0;
    };
  }
  bq(c, z, x) {
    const y = c[0] * x + c[1] * z[0] + c[2] * z[1] - c[3] * z[2] - c[4] * z[3];
    z[1] = z[0]; z[0] = x; z[3] = z[2]; z[2] = y;
    return y;
  }
  process(inputs) {
    const inp = inputs[0];
    if (!inp || !inp.length) { this.n += 128; return true; }
    const a = inp[0], b = inp[1] || inp[0], z = this.z;
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i], m = 0.5 * (x + y), d = 0.5 * (x - y);
      this.l += x * x; this.r += y * y; this.m += m * m; this.s += d * d;
      const p = Math.max(Math.abs(x), Math.abs(y));
      if (p > this.pk) this.pk = p;
      const wx = this.bq(this.s2, z[1], this.bq(this.s1, z[0], x)), wy = this.bq(this.s2, z[3], this.bq(this.s1, z[2], y));
      this.kl += wx * wx; this.kr += wy * wy;
    }
    this.n += a.length;
    return true;
  }
}
registerProcessor("groove-energy", GrooveEnergy);
`;

/**
 * The parts of Tone's context the watch needs. Tone's `addAudioWorkletModule` loads one module per context (the
 * recorder's), so the watch's module goes through the context's own `audioWorklet`.
 */
export interface JumpContext {
  readonly rawContext: unknown;
  createAudioWorkletNode(name: string, options?: Partial<AudioWorkletNodeOptions>): AudioWorkletNode;
}

/** One load per context, shared by watches made at the same moment (a second load of the module would throw). */
const loaded = new WeakMap<JumpContext, Promise<void>>();

/** Largest sample-to-sample jump and largest sample over a stretch of audio. */
export interface Jumps {
  jump: number;
  peak: number;
}

/** Load the watches' worklet module once per context. */
function loadModule(ctx: JumpContext): Promise<void> {
  let p = loaded.get(ctx);
  if (!p) {
    const url = URL.createObjectURL(new Blob([JUMP_SOURCE], { type: "text/javascript" }));
    p = (ctx.rawContext as { audioWorklet: { addModule(url: string): Promise<void> } }).audioWorklet
      .addModule(url)
      .finally(() => URL.revokeObjectURL(url));
    p.catch(() => loaded.delete(ctx));
    loaded.set(ctx, p);
  }
  return p;
}

export class JumpWatch {
  private constructor(readonly node: AudioWorkletNode) {}

  static async make(ctx: JumpContext): Promise<JumpWatch> {
    await loadModule(ctx);
    return new JumpWatch(
      ctx.createAudioWorkletNode("groove-jump", { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: "explicit", channelInterpretation: "speakers" }),
    );
  }

  /** The largest jump and sample since the last read; the watch starts over. */
  read(): Promise<Jumps> {
    return new Promise((resolve) => {
      this.node.port.onmessage = (e: MessageEvent) => resolve(e.data as Jumps);
      this.node.port.postMessage("read");
    });
  }
}

/** P9: the RMS of the difference between two signals (after and before the effects) and of the first. */
export class DiffWatch {
  private constructor(readonly node: AudioWorkletNode) {}

  static async make(ctx: JumpContext): Promise<DiffWatch> {
    await loadModule(ctx);
    return new DiffWatch(
      ctx.createAudioWorkletNode("groove-diff", { numberOfInputs: 2, numberOfOutputs: 0, channelCount: 2, channelCountMode: "explicit", channelInterpretation: "speakers" }),
    );
  }

  read(): Promise<{ diff: number; ref: number }> {
    return new Promise((resolve) => {
      this.node.port.onmessage = (e: MessageEvent) => resolve(e.data as { diff: number; ref: number });
      this.node.port.postMessage("read");
    });
  }
}

/** P10: what an energy watch read: the mean energy of the two channels, their side over mid, and the largest sample. */
export interface Energy {
  /** Mean square of left and right together, K-weighted (ITU-R BS.1770; 0 for silence). */
  energy: number;
  /** The same, unweighted. */
  flat: number;
  /** RMS of the side over RMS of the mid (0: mono). */
  width: number;
  /** Largest sample of either channel. */
  peak: number;
  /** Samples read. */
  n: number;
}

/** P10: energy, stereo width and peak of a signal since the last read (the Drop's level follower and the smoke test). */
export class EnergyWatch {
  private constructor(readonly node: AudioWorkletNode) {}

  static async make(ctx: JumpContext): Promise<EnergyWatch> {
    await loadModule(ctx);
    return new EnergyWatch(
      ctx.createAudioWorkletNode("groove-energy", { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 2, channelCountMode: "explicit", channelInterpretation: "speakers" }),
    );
  }

  read(): Promise<Energy> {
    return new Promise((resolve) => {
      this.node.port.onmessage = (e: MessageEvent) => {
        const d = e.data as { l: number; r: number; m: number; s: number; n: number; peak: number; kl: number; kr: number };
        const n = Math.max(1, d.n);
        resolve({ energy: (d.kl + d.kr) / (2 * n), flat: (d.l + d.r) / (2 * n), width: d.m > 0 ? Math.sqrt(d.s / d.m) : 0, peak: d.peak, n: d.n });
      };
      this.node.port.postMessage("read");
    });
  }
}
