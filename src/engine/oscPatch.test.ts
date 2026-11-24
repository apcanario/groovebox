/** P8 review S1: the oscillator-leak patch against a model of Tone 15.1.22's disconnect and Chrome's AudioParam. */
import { describe, expect, it } from "vitest";
import { oscPatchStats, patchOscillatorEnd, type OscillatorProto } from "./oscPatch.ts";

/** A native AudioParam. */
class NativeParam {}
/** A Tone Param: wraps a native AudioParam, and is not a ToneAudioNode, so Tone's disconnect cannot resolve it. */
class ToneParam {
  constructor(readonly _param: NativeParam) {}
}
/** A Tone Signal feeding native params, with Tone's disconnect(): a named AudioParam, else a bare disconnect(). */
class Signal {
  readonly to = new Set<NativeParam>();
  connect(p: NativeParam): void {
    this.to.add(p);
  }
  disconnect(dst?: unknown): void {
    if (dst instanceof NativeParam) {
      // Chrome throws InvalidAccessError for a connection that does not exist.
      if (!this.to.delete(dst)) throw new Error("InvalidAccessError");
    } else this.to.clear(); // ToneAudioNode.js disconnect(): neither a node nor an AudioParam
  }
}
interface Node {
  onended: (n: unknown) => void;
  frequency: ToneParam;
  detune: ToneParam;
  ended: number;
}
/** Tone.Oscillator as far as _start goes: a new native oscillator, the signals connected to its params. */
class Osc {
  frequency = new Signal();
  detune = new Signal();
  _oscillator!: Node;
  _start(): void {
    const node: Node = { frequency: new ToneParam(new NativeParam()), detune: new ToneParam(new NativeParam()), ended: 0, onended: () => node.ended++ };
    this.frequency.connect(node.frequency._param);
    this.detune.connect(node.detune._param);
    this._oscillator = node;
  }
}

function patched(): typeof Osc {
  class P extends Osc {}
  patchOscillatorEnd(P.prototype as unknown as OscillatorProto);
  return P;
}

describe("the oscillator-leak patch (P8)", () => {
  it("cuts only the ended oscillator: the next note, already started, keeps its pitch and detune", () => {
    const P = patched();
    const osc = new P();
    const throws = oscPatchStats.throws;
    osc._start(); // a short note
    const a = osc._oscillator;
    osc._start(); // the next note starts before the first one's ended event
    const b = osc._oscillator;
    a.onended(null);
    expect(osc.frequency.to.has(b.frequency._param)).toBe(true);
    expect(osc.detune.to.has(b.detune._param)).toBe(true);
    // The leak stays stopped: the ended oscillator is no longer reachable.
    expect(osc.frequency.to.has(a.frequency._param)).toBe(false);
    expect(osc.detune.to.has(a.detune._param)).toBe(false);
    expect(a.ended).toBe(1);
    b.onended(null);
    expect(osc.frequency.to.size).toBe(0);
    expect(oscPatchStats.throws).toBe(throws);
  });

  it("counts a disconnect that throws instead of hiding it, and still runs Tone's own end", () => {
    const P = patched();
    const osc = new P();
    osc._start();
    const a = osc._oscillator;
    const throws = oscPatchStats.throws;
    a.onended(null);
    a.onended(null); // the second disconnect finds no connection
    expect(oscPatchStats.throws).toBe(throws + 1);
    expect(a.ended).toBe(2);
  });

  it("models the bug: the G5 patch's bare Tone Param cuts the playing oscillator too", () => {
    const osc = new Osc();
    osc._start();
    const a = osc._oscillator;
    osc._start();
    const b = osc._oscillator;
    osc.frequency.disconnect(a.frequency); // what the G5 patch passed
    expect(osc.frequency.to.has(b.frequency._param)).toBe(false);
  });
});
