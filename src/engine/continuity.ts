/**
 * Level continuity, for the smoke test (P6 review S2; P9 needs the same check): an AudioWorklet on one
 * instrument's output keeps the largest sample-to-sample jump and the largest sample since it was last read (of
 * either channel).
 * A click is a jump far above what the sound's own waveform makes; the smoke test compares the two ratios.
 */

const JUMP_SOURCE = `
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
`;

/**
 * The parts of Tone's context the watch needs. Tone's `addAudioWorkletModule` loads one module per context (the
 * recorder's), so the watch's module goes through the context's own `audioWorklet`.
 */
export interface JumpContext {
  readonly rawContext: unknown;
  createAudioWorkletNode(name: string, options?: Partial<AudioWorkletNodeOptions>): AudioWorkletNode;
}

const loaded = new WeakSet<JumpContext>();

/** Largest sample-to-sample jump and largest sample over a stretch of audio. */
export interface Jumps {
  jump: number;
  peak: number;
}

/** Load the watches' worklet module once per context. */
async function loadModule(ctx: JumpContext): Promise<void> {
  if (!loaded.has(ctx)) {
    const url = URL.createObjectURL(new Blob([JUMP_SOURCE], { type: "text/javascript" }));
    try {
      await (ctx.rawContext as { audioWorklet: { addModule(url: string): Promise<void> } }).audioWorklet.addModule(url);
      loaded.add(ctx);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
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
