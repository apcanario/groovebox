/**
 * Level continuity, for the smoke test (P6 review S2; P9 needs the same check): an AudioWorklet on one
 * instrument's output keeps the largest sample-to-sample jump and the largest sample since it was last read.
 * A click is a jump far above what the sound's own waveform makes; the smoke test compares the two ratios.
 */

const JUMP_SOURCE = `
class GrooveJump extends AudioWorkletProcessor {
  constructor() {
    super();
    this.last = 0;
    this.jump = 0;
    this.peak = 0;
    this.port.onmessage = () => {
      this.port.postMessage({ jump: this.jump, peak: this.peak });
      this.jump = 0;
      this.peak = 0;
    };
  }
  process(inputs) {
    const a = inputs[0] && inputs[0][0];
    if (!a) return true;
    for (let i = 0; i < a.length; i++) {
      const x = a[i], d = Math.abs(x - this.last);
      if (d > this.jump) this.jump = d;
      if (Math.abs(x) > this.peak) this.peak = Math.abs(x);
      this.last = x;
    }
    return true;
  }
}
registerProcessor("groove-jump", GrooveJump);
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

export class JumpWatch {
  private constructor(readonly node: AudioWorkletNode) {}

  static async make(ctx: JumpContext): Promise<JumpWatch> {
    if (!loaded.has(ctx)) {
      const url = URL.createObjectURL(new Blob([JUMP_SOURCE], { type: "text/javascript" }));
      try {
        await (ctx.rawContext as { audioWorklet: { addModule(url: string): Promise<void> } }).audioWorklet.addModule(url);
        loaded.add(ctx);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
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
