/**
 * A minimal test harness with the Vitest call shape (describe, it, expect), run by Node's built-in
 * TypeScript support. No dependency. Swapping to Vitest later is a change of import line.
 */
type Fn = () => void;
interface Case {
  name: string;
  fn: Fn;
}

const cases: Case[] = [];
const prefix: string[] = [];

export function describe(name: string, fn: Fn): void {
  prefix.push(name);
  fn();
  prefix.pop();
}

export function it(name: string, fn: Fn): void {
  cases.push({ name: [...prefix, name].join(" › "), fn });
}

function show(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return show(a) === show(b);
}

class Expectation {
  private readonly v: unknown;
  constructor(v: unknown) {
    this.v = v;
  }
  private fail(msg: string): never {
    throw new Error(msg);
  }
  toBe(x: unknown): void {
    if (!Object.is(this.v, x)) this.fail(`expected ${show(this.v)} to be ${show(x)}`);
  }
  toEqual(x: unknown): void {
    if (!deepEqual(this.v, x)) this.fail(`expected ${show(this.v)} to equal ${show(x)}`);
  }
  not = {
    toEqual: (x: unknown): void => {
      if (deepEqual(this.v, x)) this.fail(`expected ${show(this.v)} not to equal ${show(x)}`);
    },
    toBe: (x: unknown): void => {
      if (Object.is(this.v, x)) this.fail(`expected ${show(this.v)} not to be ${show(x)}`);
    },
  };
  toBeTruthy(): void {
    if (!this.v) this.fail(`expected ${show(this.v)} to be truthy`);
  }
  toBeGreaterThan(x: number): void {
    if (!((this.v as number) > x)) this.fail(`expected ${show(this.v)} > ${x}`);
  }
  toBeLessThan(x: number): void {
    if (!((this.v as number) < x)) this.fail(`expected ${show(this.v)} < ${x}`);
  }
  toContain(x: unknown): void {
    const v = this.v as unknown[] | string;
    if (!v.includes(x as never)) this.fail(`expected ${show(v)} to contain ${show(x)}`);
  }
  toHaveLength(n: number): void {
    const len = (this.v as { length: number }).length;
    if (len !== n) this.fail(`expected length ${len} to be ${n}`);
  }
  toThrow(): void {
    try {
      (this.v as Fn)();
    } catch {
      return;
    }
    this.fail("expected function to throw");
  }
}

export function expect(v: unknown): Expectation {
  return new Expectation(v);
}

/** Run every registered case; returns the number of failures. */
export function run(): number {
  let failed = 0;
  for (const c of cases) {
    try {
      c.fn();
    } catch (e) {
      failed++;
      console.log(`FAIL ${c.name}\n     ${(e as Error).message}`);
    }
  }
  console.log(`${cases.length - failed} passed, ${failed} failed, ${cases.length} tests`);
  return failed;
}
