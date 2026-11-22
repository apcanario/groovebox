/** Seeded random generator (mulberry32). Every random choice in the app comes from here. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

/** Derive an independent seed from a seed and a stream number. */
export function deriveSeed(seed: number, stream: number): number {
  return createRng((seed ^ Math.imul(stream + 1, 0x9e3779b1)) >>> 0).int(0x7fffffff);
}
