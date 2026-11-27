/**
 * T3 review S1 (spec 9.4: "Drums and bass go silent while held"): Cut also silences what the Drop adds to the drums and
 * the bass, the overlay's own drums, the bass's wide upper layer and the build's roll. The overlay is built on the
 * fake context, Tone's connect replaced by the native one; every path from those voices to the drum or duck bus is
 * walked, and each passes one of the gains the overlay gives the Cut pad. On the fake clock the Cut pad holds every
 * one of them at 0 from its start line, the drop on.
 */
import { describe, expect, it, vi } from "vitest";
import { FakeContext, FakeNode, FakeParam } from "./fixtures/fakeAudio.ts";

const h = vi.hoisted(() => ({ ctx: null as unknown }));
vi.mock("tone", () => ({
  getContext: () => ({ rawContext: h.ctx }),
  connect: (a: { connect: (b: unknown) => unknown }, b: unknown) => a.connect(b),
}));

import { DropOverlay } from "./drop.ts";
import { PunchRack } from "./punch.ts";
import audioSrc from "./audio.ts?raw";
import dropSrc from "./drop.ts?raw";

/** Every node reachable from `from`, and whether each path to `to` passes a node in `via`. */
function allPathsPass(from: FakeNode, to: FakeNode, via: Set<unknown>): { reached: boolean; clean: boolean } {
  let reached = false;
  let clean = true;
  const walk = (n: FakeNode, passed: boolean, seen: Set<FakeNode>): void => {
    if (seen.has(n)) return;
    const p = passed || via.has(n);
    if (n === to) {
      reached = true;
      if (!p) clean = false;
      return;
    }
    const next = new Set(seen).add(n);
    for (const o of n.outs) walk(o, p, next);
  };
  walk(from, false, new Set());
  return { reached, clean };
}

describe("Cut silences the Drop's drums and bass too (T3 review S1)", () => {
  const ctx = new FakeContext();
  h.ctx = ctx;
  const duck = new FakeNode();
  const drums = new FakeNode();
  const reverb = new FakeNode();
  const drop = new DropOverlay({ duck, drums, reverb } as never);
  const o = drop as unknown as Record<string, unknown> & { groups: Record<string, { l: FakeNode; r: FakeNode }> };
  const cuts = drop.cutGains() as unknown as FakeParam[];
  const cutNodes = new Set(
    [o.drumCut, o.bassCut, o.rollBus].filter((n): n is FakeNode & { gain: FakeParam } => !!n && cuts.includes((n as { gain: FakeParam }).gain)),
  );

  it("gives the pad three gains: the overlay's drums, the bass's upper layer, the build's roll", () => {
    expect(cuts.length).toBe(3);
    expect(cutNodes.size).toBe(3);
  });

  it("every path from the overlay's drums and bass layer to the buses passes one of them; the synth and leads do not", () => {
    for (const g of ["drums", "bass"]) {
      for (const side of [o.groups[g].l, o.groups[g].r]) {
        const d = allPathsPass(side, drums, cutNodes);
        const u = allPathsPass(side, duck, cutNodes);
        expect(d.reached || u.reached).toBe(true);
        expect(d.clean && u.clean).toBe(true);
      }
    }
    for (const g of ["synth", "leads"]) expect(allPathsPass(o.groups[g].l, duck, cutNodes)).toEqual({ reached: true, clean: false });
    // The roll's bus reaches the drum bus through the build's fx bus, behind its cut gain; the riser's does not pass it.
    expect(allPathsPass(o.rollBus as FakeNode, drums, cutNodes)).toEqual({ reached: true, clean: true });
    expect(allPathsPass(o.fxBus as FakeNode, drums, cutNodes).clean).toBe(false);
  });

  it("the roll plays into its cut bus, and the graph gives every cut gain to the punch rack", () => {
    const roll: string = dropSrc.slice(dropSrc.indexOf("  roll(t: number"), dropSrc.indexOf("  cliff(t: number"));
    expect(roll).toMatch(/this\.rollBus/);
    expect(roll).not.toMatch(/this\.fxBus/);
    expect(audioSrc).toMatch(/new PunchRack\([\s\S]*?\.\.\.drop\.cutGains\(\)[\s\S]*?\]\);/);
  });

  it("with the drop on, Cut holds the channels and every overlay cut gain at 0 from its start line", () => {
    const c2 = new FakeContext();
    const chan = [new FakeParam(c2, 1), new FakeParam(c2, 1)];
    // The overlay's gains on the rack's clock (the same param objects, read at the rack's times).
    const all = [...chan, ...cuts];
    const rack = new PunchRack(c2 as unknown as BaseAudioContext, () => ({ at: 10, beats: 0, bpm: 120 }), all as unknown as AudioParam[], () => undefined);
    c2.currentTime = 10.3;
    ctx.currentTime = 10.3;
    rack.press("cut", true);
    for (const p of all) {
      expect(p.at(10.36)).toBe(1);
      expect(p.at(10.375)).toBe(0);
    }
    c2.currentTime = 11.1;
    rack.press("cut", false);
    for (const p of all) {
      expect(p.at(11.99)).toBe(0);
      expect(p.at(12)).toBe(1);
    }
  });
});
