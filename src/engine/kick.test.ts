/**
 * F2 (spec 10.5): the kick voice never clicks when its settings move. Every setting is read when a hit starts; a move
 * of Punch, Click, Root, Tune (the Pitch dial) or the key while a hit sounds touches nothing of that hit (no call on
 * its synths, no automation), and the next hit plays the new shape. Length is the Decay dial, read by Drums.trigger at
 * the hit, as built. Tone is replaced by recorders.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ calls: [] as { who: string; what: string; args: unknown[] }[] }));

vi.mock("tone", () => {
  const recorder = (who: string) =>
    class {
      envelope: Record<string, number>;
      constructor(opts: { envelope?: Record<string, number> }) {
        this.envelope = new Proxy({ ...(opts?.envelope ?? {}) }, {
          set: (o, k, v) => {
            h.calls.push({ who, what: `envelope.${String(k)}`, args: [v] });
            o[k as string] = v;
            return true;
          },
        });
        return new Proxy(this, {
          set: (o, k, v) => {
            h.calls.push({ who, what: `set ${String(k)}`, args: [v] });
            (o as Record<string, unknown>)[k as string] = v;
            return true;
          },
        });
      }
      connect() {
        return this;
      }
      triggerAttackRelease(...args: unknown[]) {
        h.calls.push({ who, what: "triggerAttackRelease", args });
      }
    };
  return { MembraneSynth: recorder("body"), NoiseSynth: recorder("click"), Filter: recorder("filter"), Gain: recorder("mono") };
});

import { KickVoice } from "./kick.ts";
import { KICK_KEYS, sweepStartHz } from "../music/kick.ts";
import { kickHz } from "../music/sound.ts";

const out = {} as never;

describe("the kick voice (spec 10.5)", () => {
  let k: KickVoice;
  beforeEach(() => {
    k = new KickVoice(out, 0.05);
    h.calls.length = 0;
  });

  it("at its defaults plays the membrane kick: 4.5x over 45 ms down to the Pitch dial's body, no click", () => {
    k.hit(1, 0.2, 0.9);
    const body = h.calls.filter((c) => c.who === "body");
    expect(body.find((c) => c.what === "set octaves")?.args[0]).toBe(4.5);
    expect(body.find((c) => c.what === "set pitchDecay")?.args[0]).toBe(0.045);
    expect(body.find((c) => c.what === "envelope.decay")?.args[0]).toBe(0.2);
    const t = body.find((c) => c.what === "triggerAttackRelease")!;
    expect(t.args[0]).toBeCloseTo(kickHz(0.4), 9);
    expect(t.args.slice(1)).toEqual([0.2, 1, 0.9]);
    expect(h.calls.filter((c) => c.who === "click")).toEqual([]);
  });

  it("a sweep of every axis while a hit sounds touches nothing of it; the next hit plays the new shape", () => {
    k.hit(1, 0.4, 1);
    const before = h.calls.length;
    for (let i = 0; i <= 20; i++) {
      const v = i / 20;
      for (const key of KICK_KEYS) k.set(key, v);
      k.setPitch(v);
      k.setKey(i % 2 ? "C" : "G");
    }
    expect(h.calls.length).toBe(before); // no call on the sounding hit's synths: nothing steps
    k.set("kickPunch", 1);
    k.set("kickClick", 1);
    k.set("kickRoot", 1);
    k.setKey("A");
    k.hit(2, 0.4, 1);
    const next = h.calls.slice(before);
    // Root on: Punch 1 starts the sweep at sweepStartHz(1), over the body at 55 Hz.
    expect(next.find((c) => c.who === "body" && c.what === "set octaves")?.args[0]).toBeCloseTo(sweepStartHz(1) / 55, 9);
    expect(next.find((c) => c.who === "body" && c.what === "triggerAttackRelease")?.args[0]).toBeCloseTo(55, 6);
    const click = next.find((c) => c.who === "click" && c.what === "triggerAttackRelease")!;
    expect(click.args[1]).toBe(2); // the click starts with the hit
    expect(click.args[2]).toBeCloseTo(0.5, 9);
    expect(k.last?.bodyHz).toBeCloseTo(55, 6);
  });

  it("settings are clamped to 0..1 and the shape reads what the next hit plays", () => {
    k.set("kickPunch", 3);
    k.set("kickClick", -1);
    expect(k.values).toEqual({ kickPunch: 1, kickClick: 0, kickRoot: 0 });
    expect(k.shape().sweepRatio).toBe(7);
    expect(k.shape().clickGain).toBe(0);
  });
});
