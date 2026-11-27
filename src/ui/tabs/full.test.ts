import { describe, expect, it } from "vitest";
import { overflowing } from "./full.ts";

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
