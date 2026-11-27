/**
 * T3: a fake AudioContext for unit tests on the audio clock. Its AudioParams keep their automation events and
 * work out their value at any time (set, linear and exponential ramps, cancel, cancel-and-hold), as the Web Audio
 * spec does for those events; `currentTime` is set by the test. Only what the punch rack uses is here.
 */

type Ev = { kind: "set" | "lin" | "exp"; v: number; t: number };

export class FakeParam {
  events: Ev[] = [];
  constructor(private readonly ctx: { currentTime: number }, private initial: number) {}

  get value(): number {
    return this.at(this.ctx.currentTime);
  }
  set value(v: number) {
    this.initial = v;
  }

  /** The value at audio time `t`. */
  at(t: number): number {
    let v = this.initial;
    let t0 = 0;
    for (const e of this.events) {
      if (e.kind === "set") {
        if (e.t > t) return v;
        v = e.v;
        t0 = e.t;
        continue;
      }
      if (t < e.t) {
        const k = e.t > t0 ? (t - t0) / (e.t - t0) : 1;
        if (t < t0) return v;
        if (e.kind === "lin") return v + (e.v - v) * k;
        return v > 0 && e.v > 0 ? v * Math.pow(e.v / v, k) : v;
      }
      v = e.v;
      t0 = e.t;
    }
    return v;
  }

  private add(e: Ev): this {
    if (!Number.isFinite(e.t) || !Number.isFinite(e.v)) throw new Error(`non-finite automation ${JSON.stringify(e)}`);
    const i = this.events.findIndex((x) => x.t > e.t);
    if (i < 0) this.events.push(e);
    else this.events.splice(i, 0, e);
    return this;
  }

  setValueAtTime(v: number, t: number): this {
    return this.add({ kind: "set", v, t });
  }
  linearRampToValueAtTime(v: number, t: number): this {
    return this.add({ kind: "lin", v, t });
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    if (v <= 0) throw new Error("exponential ramp to a value <= 0");
    return this.add({ kind: "exp", v, t });
  }
  setTargetAtTime(): this {
    throw new Error("setTargetAtTime is not modelled by the fake");
  }
  cancelScheduledValues(t: number): this {
    this.events = this.events.filter((e) => e.t < t);
    return this;
  }
  cancelAndHoldAtTime(t: number): this {
    const v = this.at(t);
    const spanning = this.events.find((e) => e.t >= t && e.kind !== "set" && this.startOf(e) < t);
    this.events = this.events.filter((e) => e.t < t);
    if (spanning) this.add({ kind: spanning.kind, v, t });
    else this.add({ kind: "set", v, t });
    return this;
  }

  private startOf(e: Ev): number {
    const i = this.events.indexOf(e);
    return i > 0 ? this.events[i - 1].t : 0;
  }
}

export class FakeNode {
  readonly outs = new Set<FakeNode>();
  connect<T>(n: T): T {
    this.outs.add(n as unknown as FakeNode);
    return n;
  }
  disconnect(n?: FakeNode): void {
    if (n) this.outs.delete(n);
    else this.outs.clear();
  }
}

export class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  startAt: number | null = null;
  stopAt: number | null = null;
  start(t: number): void {
    this.startAt = t;
  }
  stop(t: number): void {
    this.stopAt = t;
  }
}

export class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  readonly sources: FakeSource[] = [];
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam(this, 1) });
  }
  createDelay(_max: number) {
    return Object.assign(new FakeNode(), { delayTime: new FakeParam(this, 0) });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: "lowpass", frequency: new FakeParam(this, 350), Q: new FakeParam(this, 1) });
  }
  createConvolver() {
    return Object.assign(new FakeNode(), { buffer: null as unknown });
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (c: number) => data[c] };
  }
  createBufferSource() {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
}
