import { describe, expect, it } from "vitest";
import source from "./keepAwake.ts?raw";
import { KEEP_AWAKE_PLUGIN, nativeBridge, setNativeKeepAwake, type NativeBridge } from "./keepAwake.ts";

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

  it("imports nothing: no Capacitor, no Tone in the web build", () => {
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
