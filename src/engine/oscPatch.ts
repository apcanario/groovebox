/**
 * Tone 15.1.22 leak (G5 review E1): Oscillator._start connects its frequency and detune signals to each new native
 * oscillator and never disconnects them, so every ended oscillator stays reachable from the instrument's signals.
 * `patchOscillatorEnd` disconnects them when the oscillator ends. Drop it once Tone fixes the leak.
 *
 * P8: the disconnect must name the native AudioParams. Tone's disconnect() resolves a ToneAudioNode or an AudioParam;
 * a Tone Param is neither, so passing one fell to a bare disconnect() that cut the signal from every oscillator, the
 * one now playing too: a short note's ended oscillator left the next note at 0 Hz, a held DC level (the silent bass
 * in Acid house and Dubstep). Kept free of Tone so the unit test can drive it (P8 review S1).
 */

/** The native AudioParam under a Tone Param or Signal (a Signal wraps a Param, a Param an AudioParam). */
export function nativeParam(p: unknown): AudioParam {
  let q = p as { _param?: unknown };
  while (q._param) q = q._param as { _param?: unknown };
  return q as unknown as AudioParam;
}

/** What the patch needs of Tone.Oscillator's prototype. */
export interface OscillatorProto {
  _start(t: unknown): void;
}
interface Started {
  _oscillator: { onended: (n: unknown) => void; frequency: unknown; detune: unknown };
  frequency: { disconnect(dst: unknown): unknown };
  detune: { disconnect(dst: unknown): unknown };
}

/** Disconnects that threw since load (P8 review S1): the smoke test requires none, so a Tone change cannot hide. */
export const oscPatchStats = { throws: 0, disconnects: 0 };

export function patchOscillatorEnd(proto: OscillatorProto): void {
  const start = proto._start;
  proto._start = function (this: Started, t: unknown): void {
    start.call(this, t);
    const node = this._oscillator;
    const end = node.onended;
    node.onended = (n: unknown): void => {
      try {
        this.frequency.disconnect(nativeParam(node.frequency));
        this.detune.disconnect(nativeParam(node.detune));
        oscPatchStats.disconnects++;
      } catch {
        // Counted, not hidden: the smoke test fails on any.
        oscPatchStats.throws++;
      } finally {
        end(n);
      }
    };
  };
}
