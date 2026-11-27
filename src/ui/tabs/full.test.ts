import { describe, expect, it } from "vitest";
import { overflowing } from "./full.ts";
import { faderValue } from "../logic.ts";

describe("a whole panel falls back to pages when it overflows (T2, spec 9.1)", () => {
  it("fits when the content is no larger than the body, a pixel of rounding allowed", () => {
    expect(overflowing({ scrollHeight: 664, clientHeight: 664, scrollWidth: 673, clientWidth: 673 })).toBe(false);
    expect(overflowing({ scrollHeight: 665, clientHeight: 664, scrollWidth: 674, clientWidth: 673 })).toBe(false);
  });
  it("overflows when the content is taller or wider than the body", () => {
    expect(overflowing({ scrollHeight: 694, clientHeight: 664, scrollWidth: 673, clientWidth: 673 })).toBe(true);
    expect(overflowing({ scrollHeight: 664, clientHeight: 664, scrollWidth: 700, clientWidth: 673 })).toBe(true);
  });
});

describe("the Mix panel's faders on the desk (T2, spec 9.2)", () => {
  it("are full at the top of the track, empty at the bottom, in hundredths, clamped", () => {
    expect(faderValue(100, 100, 300)).toBe(1);
    expect(faderValue(400, 100, 300)).toBe(0);
    expect(faderValue(250, 100, 300)).toBe(0.5);
    expect(faderValue(130.4, 100, 300)).toBe(0.9);
    expect(faderValue(40, 100, 300)).toBe(1);
    expect(faderValue(900, 100, 300)).toBe(0);
    expect(faderValue(200, 100, 0)).toBe(0);
  });
});
