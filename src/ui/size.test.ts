import { describe, expect, it } from "vitest";
import sizeSource from "./size.ts?raw";
import { parseForced, sizeClass, SizeWatch, tabletPanel } from "./size.ts";

describe("size class (spec 9.1)", () => {
  it("chooses the layout at the sizes T1 names", () => {
    expect(sizeClass(360, 640)).toBe("phone");
    expect(sizeClass(412, 915)).toBe("phone");
    expect(sizeClass(390, 844)).toBe("phone");
    expect(sizeClass(800, 1280)).toBe("portrait");
    expect(sizeClass(768, 1024)).toBe("portrait");
    expect(sizeClass(1280, 800)).toBe("landscape");
    expect(sizeClass(1024, 768)).toBe("landscape");
  });

  it("holds the table's edges", () => {
    expect(sizeClass(599, 1000)).toBe("phone");
    expect(sizeClass(600, 1000)).toBe("portrait");
    expect(sizeClass(899, 600)).toBe("portrait");
    expect(sizeClass(900, 600)).toBe("landscape");
    expect(sizeClass(800, 800)).toBe("portrait");
  });

  it("keeps a phone turned sideways a phone", () => {
    expect(sizeClass(915, 412)).toBe("phone");
    expect(sizeClass(640, 360)).toBe("phone");
  });

  it("treats an unmeasured window as a phone", () => {
    expect(sizeClass(0, 0)).toBe("phone");
    expect(sizeClass(NaN, 800)).toBe("phone");
  });

  it("reads a forced class from the URL", () => {
    expect(parseForced("?size=landscape")).toBe("landscape");
    expect(parseForced("?hint=playback&size=portrait")).toBe("portrait");
    expect(parseForced("?size=phone")).toBe("phone");
    expect(parseForced("?size=big")).toBeNull();
    expect(parseForced("")).toBeNull();
  });

  it("keeps the last panel while Play is chosen on a tablet", () => {
    expect(tabletPanel("play", "chords")).toBe("chords");
    expect(tabletPanel("play", "bass")).toBe("bass");
    expect(tabletPanel("mix", "bass")).toBe("mix");
    expect(tabletPanel("layer2", "chords")).toBe("layer2");
  });
});

describe("SizeWatch", () => {
  const watch = (sizes: { w: number; h: number }[], forced: Parameters<typeof SizeWatch.prototype.force>[0] = null) => {
    let i = 0;
    return new SizeWatch(() => sizes[Math.min(i++, sizes.length - 1)], forced);
  };

  it("follows rotation live and tells listeners only when the class changes", () => {
    const sizes = [
      { w: 800, h: 1280 },
      { w: 800, h: 1279 },
      { w: 1280, h: 800 },
      { w: 1280, h: 800 },
      { w: 800, h: 1280 },
    ];
    const w = watch(sizes);
    const heard: string[] = [];
    w.on((c) => heard.push(c));
    expect(w.current).toBe("portrait");
    for (let k = 1; k < sizes.length; k++) w.update();
    expect(heard).toEqual(["landscape", "portrait"]);
    expect(w.current).toBe("portrait");
  });

  it("can be forced and released", () => {
    const w = watch([{ w: 390, h: 844 }]);
    const heard: string[] = [];
    const off = w.on((c) => heard.push(c));
    w.force("landscape");
    expect(w.current).toBe("landscape");
    expect(w.forced).toBe("landscape");
    w.update(); // a resize does not undo a forced class
    expect(w.current).toBe("landscape");
    w.force(null);
    expect(w.current).toBe("phone");
    off();
    w.force("portrait");
    expect(heard).toEqual(["landscape", "phone"]);
  });

  it("starts from a forced class", () => {
    expect(watch([{ w: 390, h: 844 }], "portrait").current).toBe("portrait");
  });
});

describe("a rotation never touches the engine", () => {
  it("the size layer imports nothing but itself: no engine, no Tone.js", () => {
    expect(sizeSource).not.toMatch(/^import /m);
    expect(sizeSource).not.toMatch(/from ["'][^"']*(engine|tone)/i);
  });
});
