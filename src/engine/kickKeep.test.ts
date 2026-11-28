/**
 * F2 review S5: the kick's settings across a sound change and a vibe switch, on the real Engine and its real graph
 * (Drums.apply, the KickVoice), with every Tone node replaced by a do-nothing stand-in: no audio runs here.
 * - A sound pick (setPatch) is a patch file, and no patch file holds the kick's settings: Punch, Click and Root stay.
 * - A vibe switch loads the vibe's song: a vibe without kick settings (the ten other vibes) puts the kick back on
 *   KICK_DEFAULTS after a top vibe, so Deep techno to Trance gives the membrane kick again.
 */
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  // Any property is a do-nothing function returning the same stand-in, `new` included (0 as a number).
  const anything: unknown = new Proxy(function () {}, {
    // No `_param`: nativeParam walks that chain to the native AudioParam.
    get: (_t, k) => (k === "then" || k === "_param" ? undefined : k === Symbol.toPrimitive ? () => 0 : anything),
    apply: () => anything,
    construct: () => anything as object,
  });
  const graph: { drums: unknown } = { drums: null };
  return { anything, graph };
});

// Tone's nodes are stand-ins: the kick voice's settings and Drums.apply are what is tested, not sound.
vi.mock("tone", () => {
  const ctx = { currentTime: 0, sampleRate: 48000, rawContext: {}, latencyHint: "balanced" };
  const transport = { state: "stopped", ticks: 0, PPQ: 192, bpm: { value: 120, rampTo: () => undefined, setValueAtTime: () => undefined },
    start: () => undefined, stop: () => undefined, scheduleRepeat: () => 0 };
  const own: Record<string, unknown> = { setContext: () => undefined, start: async () => undefined, getContext: () => ctx,
    getTransport: () => transport, getDraw: () => ({ schedule: () => undefined }), now: () => ctx.currentTime };
  return new Proxy(own, { get: (o, k) => (k in o ? o[k as string] : k === "then" ? undefined : h.anything), has: () => true });
});
// The graph: a stand-in, but its drums are the real Drums (its apply and its KickVoice), built without its constructor.
vi.mock("./audio.ts", async (orig) => {
  const real = await orig<typeof import("./audio.ts")>();
  const { KickVoice } = await import("./kick.ts");
  return {
    ...real,
    Graph: {
      build: async () => {
        const drums = Object.create(real.Drums.prototype) as Record<string, unknown>;
        Object.assign(drums, { kick: new KickVoice(h.anything as never, 0.05), channel: h.anything, gains: new Proxy({}, { get: () => h.anything }),
          kickDrive: h.anything, decays: {}, trims: {}, percPitch: 0.5 });
        h.graph.drums = drums;
        const instruments = new Proxy({}, { get: (_t, k) => (k === "drums" ? drums : h.anything) });
        return new Proxy({}, { get: (_t, k) => (k === "instruments" ? instruments : k === "then" ? undefined : h.anything) });
      },
    },
  };
});

import { Engine } from "./index.ts";
import { KICK_DEFAULTS } from "../music/kick.ts";
import { PATCH_IDS, PATCHES, vibeSong } from "../music/styles.ts";

async function engineWith(id: string): Promise<Engine> {
  const e = new Engine();
  await e.init();
  e.loadSong(vibeSong(id)!, 0);
  return e;
}

describe("the kick's settings through a sound pick and a vibe switch (F2 review S5)", () => {
  it("a top vibe's kick settings reach the kick voice", async () => {
    const e = await engineWith("deepTechno");
    const want = vibeSong("deepTechno")!.patches.drums;
    expect(e.kickState()!.settings).toEqual({ kickPunch: want.kickPunch, kickClick: want.kickClick, kickRoot: want.kickRoot });
    expect(e.kickState()!.settings).not.toEqual(KICK_DEFAULTS);
  });

  it("setPatch keeps Punch, Click and Root, for every drum sound", async () => {
    const e = await engineWith("deepTechno");
    e.setParams("drums", { kickPunch: 0.83, kickClick: 0.61 });
    const before = e.kickState()!.settings;
    const drums = PATCH_IDS.filter((id) => PATCHES[id].instrument === "drums");
    expect(drums).toContain("boom");
    for (const id of drums) {
      expect(e.setPatch("drums", id), id).toBe(true);
      expect(e.kickState()!.settings, id).toEqual(before);
      const p = e.getSong().patches.drums;
      expect([p.kickPunch, p.kickClick, p.kickRoot], id).toEqual([before.kickPunch, before.kickClick, before.kickRoot]);
    }
  });

  it("a vibe without kick settings, loaded over a top vibe, puts the kick on its defaults", async () => {
    for (const other of ["trance", "tropicalHouse", "dubstep"]) {
      const e = await engineWith("deepTechno");
      e.setParams("drums", { kickPunch: 0.9, kickClick: 0.9 });
      e.loadSong(vibeSong(other)!, 0);
      expect(e.kickState()!.settings, other).toEqual(KICK_DEFAULTS);
    }
  });
});
