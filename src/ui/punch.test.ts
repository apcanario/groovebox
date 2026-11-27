import { describe, expect, it } from "vitest";
import { PadPointers, punchLook } from "./logic.ts";

describe("punch pad look (T3 slice b)", () => {
  it("is off with no start, or once its end has passed", () => {
    expect(punchLook({ held: false, start: null, end: null }, 5)).toBe("off");
    expect(punchLook({ held: false, start: 1, end: 4 }, 4)).toBe("off");
    expect(punchLook({ held: false, start: 1, end: 4 }, 9)).toBe("off");
  });
  it("waits for its start line, then is in", () => {
    expect(punchLook({ held: true, start: 2, end: null }, 1.9)).toBe("pending");
    expect(punchLook({ held: true, start: 2, end: null }, 2)).toBe("on");
    expect(punchLook({ held: true, start: 2, end: null }, 30)).toBe("on");
  });
  it("shows a scheduled end after release, and a tap's bar", () => {
    expect(punchLook({ held: false, start: 2, end: 3 }, 2.5)).toBe("ending");
    expect(punchLook({ held: false, start: 2, end: 4 }, 1)).toBe("pending");
  });
});

describe("punch pad pointers (spec 9.6)", () => {
  it("presses a pad once for two fingers and lets it go with the last", () => {
    const p = new PadPointers<string>();
    expect(p.down("cut", 1)).toBe(true);
    expect(p.down("cut", 2)).toBe(false);
    expect(p.up(1)).toBe(null);
    expect(p.held("cut")).toBe(true);
    expect(p.up(2)).toBe("cut");
    expect(p.held("cut")).toBe(false);
  });
  it("holds several pads at once, each let go by its own finger", () => {
    const p = new PadPointers<string>();
    expect(p.down("cut", 1)).toBe(true);
    expect(p.down("filter", 2)).toBe(true);
    expect(p.down("riser", 3)).toBe(true);
    expect(p.up(2)).toBe("filter");
    expect(p.held("cut") && p.held("riser")).toBe(true);
    expect(p.up(1)).toBe("cut");
    expect(p.up(3)).toBe("riser");
  });
  it("ignores an unknown or repeated release and a repeated press", () => {
    const p = new PadPointers<string>();
    expect(p.up(7)).toBe(null);
    expect(p.down("echo", 7)).toBe(true);
    expect(p.down("echo", 7)).toBe(false);
    expect(p.up(7)).toBe("echo");
    expect(p.up(7)).toBe(null);
  });
  it("lets every held pad go once when the pads leave the screen", () => {
    const p = new PadPointers<string>();
    p.down("cut", 1);
    p.down("cut", 2);
    p.down("wash", 3);
    expect(p.clear().sort()).toEqual(["cut", "wash"]);
    expect(p.clear()).toEqual([]);
  });
});
