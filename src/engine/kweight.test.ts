/** P10 review S7: the energy worklet's K-weighting (ITU-R BS.1770), run on sines outside a browser. */
import { describe, expect, it } from "vitest";
import { JUMP_SOURCE } from "./continuity.ts";

type Proc = { process(inputs: Float32Array[][]): boolean; port: { onmessage: () => void; postMessage(d: unknown): void } };

function energyProcessor(): new () => Proc {
  const procs: Record<string, new () => Proc> = {};
  class Base {
    port = { onmessage: () => {}, postMessage: (_d: unknown) => {} };
  }
  new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", JUMP_SOURCE)(Base, (n: string, c: new () => Proc) => (procs[n] = c), 48000);
  return procs["groove-energy"];
}

function read(hz: number): { k: number; flat: number; peak: number } {
  const P = energyProcessor();
  const p = new P();
  let out: { kl: number; l: number; peak: number; n: number } | null = null;
  p.port.postMessage = (d: unknown) => (out = d as typeof out);
  const n = 128;
  for (let b = 0; b < 1500; b++) {
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = 0.5 * Math.sin((2 * Math.PI * hz * (b * n + i)) / 48000);
    p.process([[x, x]]);
  }
  p.port.onmessage();
  const o = out!;
  return { k: o.kl / o.n, flat: o.l / o.n, peak: o.peak };
}

describe("P10 review S7: the drop's loudness is K-weighted", () => {
  it("lifts the top by about 4 dB, leaves 1 kHz near 0 dB and cuts the sub-bass", () => {
    const db = (r: { k: number; flat: number }) => 10 * Math.log10(r.k / r.flat);
    expect(db(read(4000))).toBeGreaterThan(3.5);
    expect(db(read(4000))).toBeLessThan(4.5);
    expect(Math.abs(db(read(1000)))).toBeLessThan(1);
    expect(db(read(20))).toBeLessThan(-6);
    expect(read(4000).peak).toBeCloseTo(0.5, 2);
  });
});
