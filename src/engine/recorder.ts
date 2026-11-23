/**
 * MP3 export of the live master output (spec section 6, row G5). An AudioWorklet on the audio thread
 * copies the limiter's output into 16-bit blocks and posts them straight to the encoder worker; the
 * main thread never holds the samples, so memory stays flat for long jams.
 */

/** The capture processor, loaded from a Blob URL so it needs no build step of its own. */
const TAP_SOURCE = `
class GrooveTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 4096;
    this.l = new Int16Array(this.size);
    this.r = new Int16Array(this.size);
    this.n = 0;
    this.frames = 0;
    this.out = null;
    this.on = true;
    this.port.onmessage = (e) => {
      if (e.data.type === "port") this.out = e.data.port;
      else if (e.data.type === "stop") {
        this.send();
        this.on = false;
        if (this.out) this.out.postMessage({ type: "end" });
        this.port.postMessage({ type: "stopped", frames: this.frames });
      }
    };
  }
  send() {
    if (!this.n || !this.out) return;
    const l = this.l.slice(0, this.n), r = this.r.slice(0, this.n);
    this.out.postMessage({ type: "chunk", l, r }, [l.buffer, r.buffer]);
    this.n = 0;
  }
  process(inputs) {
    if (!this.on) return false;
    const input = inputs[0];
    const a = input[0], b = input[1] || input[0];
    const len = a ? a.length : 128;
    for (let i = 0; i < len; i++) {
      let x = a ? a[i] : 0, y = b ? b[i] : 0;
      x = x > 1 ? 1 : x < -1 ? -1 : x;
      y = y > 1 ? 1 : y < -1 ? -1 : y;
      this.l[this.n] = x < 0 ? x * 32768 : x * 32767;
      this.r[this.n] = y < 0 ? y * 32768 : y * 32767;
      if (++this.n === this.size) this.send();
    }
    this.frames += len;
    return true;
  }
}
registerProcessor("groove-tap", GrooveTap);
`;

export const MP3_KBPS = 160;

export interface Take {
  /** The MP3 (disk-backed where the browser allows). */
  file: File;
  bytes: number;
  /** Length of the audio captured, in seconds. */
  seconds: number;
  sampleRate: number;
}

/** The parts of Tone's context the recorder needs (its wrapper, not the native context). */
export interface TapContext {
  readonly sampleRate: number;
  addAudioWorkletModule(url: string): Promise<void>;
  createAudioWorkletNode(name: string, options?: Partial<AudioWorkletNodeOptions>): AudioWorkletNode;
}

const loaded = new WeakSet<TapContext>();

/** Loads the capture processor into a context once; call it before the first take so the take starts at once. */
export async function prepareTap(ctx: TapContext): Promise<void> {
  if (loaded.has(ctx)) return;
  const url = URL.createObjectURL(new Blob([TAP_SOURCE], { type: "text/javascript" }));
  try {
    await ctx.addAudioWorkletModule(url);
    loaded.add(ctx);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** One take: started on construction, finished by `stop()`. */
export class Recorder {
  readonly node: AudioWorkletNode;
  private worker: Worker;
  /** Bytes of MP3 written so far (reported by the worker about once a second). */
  bytes = 0;
  private done: Promise<Take>;

  constructor(ctx: TapContext, name: string) {
    if (!loaded.has(ctx)) throw new Error("capture processor not loaded");
    this.node = ctx.createAudioWorkletNode("groove-tap", {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
    });
    this.worker = new Worker(new URL("./mp3.worker.ts", import.meta.url), { type: "module" });
    const ch = new MessageChannel();
    this.node.port.postMessage({ type: "port", port: ch.port1 }, [ch.port1]);
    this.worker.postMessage({ type: "init", port: ch.port2, sampleRate: ctx.sampleRate, kbps: MP3_KBPS, name }, [ch.port2]);
    this.done = new Promise<Take>((resolve, reject) => {
      this.worker.onerror = (e) => reject(new Error(`MP3 encoder failed: ${e.message}`));
      this.worker.onmessage = (e: MessageEvent) => {
        const m = e.data as { type: string; bytes: number; frames: number; file?: File; sampleRate?: number };
        if (m.type === "progress") this.bytes = m.bytes;
        else if (m.type === "done" && m.file) {
          this.bytes = m.bytes;
          this.worker.terminate();
          resolve({ file: m.file, bytes: m.bytes, seconds: m.frames / (m.sampleRate ?? ctx.sampleRate), sampleRate: m.sampleRate ?? ctx.sampleRate });
        }
      };
    });
  }

  /** Ends the take; resolves when the last frame is encoded and the file is closed. */
  stop(): Promise<Take> {
    this.node.port.postMessage({ type: "stop" });
    return this.done;
  }
}
