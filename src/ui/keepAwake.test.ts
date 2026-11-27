import { describe, expect, it } from "vitest";
import source from "./keepAwake.ts?raw";
import { KEEP_AWAKE_PLUGIN, holdNativeKeepAwake, nativeBridge, setNativeKeepAwake, type NativeBridge } from "./keepAwake.ts";

function fake(opts: { native?: boolean; plugin?: boolean; fail?: "reject" | "throw" } = {}) {
  const calls: unknown[][] = [];
  const cap: NativeBridge = {
    isNativePlatform: () => opts.native ?? true,
    isPluginAvailable: (n) => (opts.plugin ?? true) && n === KEEP_AWAKE_PLUGIN,
    nativePromise: (p, m, o) => {
      calls.push([p, m, o]);
      if (opts.fail === "throw") throw new Error("bridge gone");
      return opts.fail === "reject" ? Promise.reject(new Error("refused")) : Promise.resolve({});
    },
  };
  return { cap, calls };
}

describe("native keep-awake bridge (G6, spec section 2)", () => {
  it("finds no bridge in a browser", () => {
    expect(nativeBridge({})).toBeNull();
    expect(nativeBridge(null)).toBeNull();
    expect(nativeBridge({ Capacitor: {} })).toBeNull();
    expect(setNativeKeepAwake(true)).toBe(false);
  });

  it("ignores a Capacitor web shim or a shell without the plugin", () => {
    expect(nativeBridge({ Capacitor: fake({ native: false }).cap })).toBeNull();
    expect(nativeBridge({ Capacitor: fake({ plugin: false }).cap })).toBeNull();
  });

  it("asks the shell to keep the screen on while playing and lets it sleep on stop", () => {
    const { cap, calls } = fake();
    const bridge = nativeBridge({ Capacitor: cap });
    expect(bridge).toBe(cap);
    expect(setNativeKeepAwake(true, bridge)).toBe(true);
    expect(setNativeKeepAwake(false, bridge)).toBe(true);
    expect(calls).toEqual([
      ["KeepAwake", "set", { on: true }],
      ["KeepAwake", "set", { on: false }],
    ]);
  });

  it("swallows a refused or broken call", async () => {
    expect(setNativeKeepAwake(true, fake({ fail: "reject" }).cap)).toBe(true);
    expect(setNativeKeepAwake(true, fake({ fail: "throw" }).cap)).toBe(false);
    await Promise.resolve();
  });

  it("useWakeLock's native side: off on mount, on with Play, off again with Stop and on unmount (G6 review M5)", () => {
    const { cap, calls } = fake();
    // Mount, stopped: the shell is told off; that run's cleanup sends nothing more.
    const mount = holdNativeKeepAwake(false, cap);
    expect(calls).toEqual([["KeepAwake", "set", { on: false }]]);
    mount();
    expect(calls).toHaveLength(1);
    // Play: on. Stop: the play run's cleanup lets the screen sleep, then the stopped run sends off.
    const play = holdNativeKeepAwake(true, cap);
    play();
    const stopped = holdNativeKeepAwake(false, cap);
    expect(calls.slice(1)).toEqual([
      ["KeepAwake", "set", { on: true }],
      ["KeepAwake", "set", { on: false }],
      ["KeepAwake", "set", { on: false }],
    ]);
    stopped();
    // Unmount while playing: off.
    calls.length = 0;
    holdNativeKeepAwake(true, cap)();
    expect(calls).toEqual([
      ["KeepAwake", "set", { on: true }],
      ["KeepAwake", "set", { on: false }],
    ]);
  });

  it("useWakeLock's native side does nothing in a browser", () => {
    const release = holdNativeKeepAwake(true, null);
    release();
    expect(holdNativeKeepAwake(true)).toBeTypeOf("function");
  });

  it("imports nothing: no Capacitor, no Tone in the web build", () => {
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
