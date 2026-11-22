/** Euclidean rhythm: `hits` onsets spread as evenly as possible over `steps`, shifted by `rotate`. */
export function euclid(hits: number, steps = 16, rotate = 0): boolean[] {
  const n = Math.max(1, Math.round(steps));
  const k = Math.max(0, Math.min(n, Math.round(hits)));
  const base: boolean[] = [];
  for (let i = 0; i < n; i++) base.push(k > 0 && (i * k) % n < k);
  const r = ((Math.round(rotate) % n) + n) % n;
  return base.map((_, i) => base[(i - r + n) % n]);
}
