import { describe, expect, it } from "vitest";
import { Aim } from "./drop.ts";

/** P10b review S1: the wind-down starts each ramp from the value a param will have on the bar line, not where it is now. */
describe("Aim: a param's value at a future time, from how it was last set", () => {
  it("a setTargetAtTime just before the bar line: the value on the bar line is part-way, not the old one", () => {
    const a = new Aim(1);
    a.target(1, 0, 0.15);
    // A Width move 0.1 s before the bar line at 1.0 s, tau 0.05: two time constants on, 86% of the way to 0.5.
    a.target(0.5, 0.9, 0.05);
    expect(a.at(0.9)).toBeCloseTo(1, 9);
    expect(a.at(1.0)).toBeCloseTo(0.5 + 0.5 * Math.exp(-2), 9);
    expect(a.at(10)).toBeCloseTo(0.5, 9);
  });

  it("a second setting starts from where the first had got to", () => {
    const a = new Aim(0);
    a.target(1, 0, 0.1);
    a.target(0, 0.1, 0.1);
    const v = 1 - Math.exp(-1);
    expect(a.at(0.2)).toBeCloseTo(v * Math.exp(-1), 9);
  });

  it("a set value then a linear ramp (the bloom's reverb, the build's levels)", () => {
    const a = new Aim(0.3);
    a.set(0, 2);
    a.ramp(0.45, 2, 4);
    expect(a.at(2)).toBe(0);
    expect(a.at(3)).toBeCloseTo(0.225, 9);
    expect(a.at(5)).toBeCloseTo(0.45, 9);
  });
});
