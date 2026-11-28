/**
 * The launch bag (F1, spec 10.1): the vibe the app opens on is drawn from a shuffle bag of the top vibes, so each
 * comes up once before any repeats and never the one the last launch drew. The bag lives in local storage; without
 * storage the draw is plain seeded random. Every choice comes from the seeded generator. No audio dependency.
 */
import type { Song } from "../engine/song.ts";
import { createRng, type Rng } from "../music/random.ts";
import { rollVibe, TOP_IDS } from "../music/styles.ts";

/** The part of local storage the bag uses (a Map-backed one in the tests). */
export interface BagStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BAG_KEY = "groovebox.vibeBag";

/**
 * What is kept between launches: the generator's next seed, the vibes left in the bag, the last one drawn (by a
 * launch, the dice or "Surprise me") and the last one a launch drew (F1 review S4: a dice draw between two launches
 * must not let the next launch repeat the last launch's vibe).
 */
export interface BagState {
  seed: number;
  bag: string[];
  last: string | null;
  lastLaunch: string | null;
}

/** Local storage, or null where there is none or it refuses (private mode, a blocked frame). */
export function localBagStorage(): BagStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readState(store: BagStorage): BagState | null {
  try {
    const raw = store.getItem(BAG_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<BagState>;
    if (!Number.isInteger(s.seed) || !Array.isArray(s.bag) || !s.bag.every((v) => typeof v === "string")) return null;
    const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
    return { seed: s.seed as number, bag: s.bag, last: str(s.last), lastLaunch: str(s.lastLaunch) };
  } catch {
    return null;
  }
}

/** A fresh bag: every vibe once, shuffled (Fisher-Yates), never starting on one of `avoid` when there is a choice. */
function refill(ids: readonly string[], avoid: readonly (string | null)[], rng: Rng): string[] {
  const bag = [...ids];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (bag.length > 1 && avoid.includes(bag[0])) {
    const ok = bag.map((_, i) => i).filter((i) => i > 0 && !avoid.includes(bag[i]));
    if (ok.length) {
      const j = ok[rng.int(ok.length)];
      [bag[0], bag[j]] = [bag[j], bag[0]];
    }
  }
  return bag;
}

/**
 * Draw the next vibe from the bag. `seed` seeds the generator when there is no bag yet, and is the whole draw when
 * there is no storage. `launch`: a cold start's draw, which never gives the vibe the last launch drew (spec 10.1)
 * and is remembered as such; the dice and "Surprise me" pass false. Returns the vibe and a seed for the rest of the
 * same draw (key and bpm).
 */
export function drawFromBag(
  seed: number,
  store: BagStorage | null,
  ids: readonly string[] = TOP_IDS,
  launch = false,
): { id: string; roll: number } | null {
  if (!ids.length) return null;
  const state = store ? readState(store) : null;
  const rng = createRng(state ? state.seed : seed);
  if (!store) return { id: rng.pick(ids), roll: rng.int(0x7fffffff) };
  const last = state?.last ?? null;
  const lastLaunch = state?.lastLaunch ?? null;
  const avoid = launch ? [last, lastLaunch] : [last];
  // A vibe no longer a top vibe leaves the bag; a new one joins at the next refill.
  let bag = (state?.bag ?? []).filter((id) => ids.includes(id) && id !== last);
  // A launch skips the last launch's vibe, which stays in the bag for a later draw.
  let at = bag.findIndex((id) => !avoid.includes(id));
  if (at < 0) {
    bag = refill(ids, avoid, rng);
    at = 0;
  }
  const [id] = bag.splice(at, 1);
  const roll = rng.int(0x7fffffff);
  const next: BagState = { seed: rng.int(0x7fffffff), bag, last: id, lastLaunch: launch ? id : lastLaunch };
  try {
    store.setItem(BAG_KEY, JSON.stringify(next));
  } catch {
    // Storage full or refused: this draw still stands.
  }
  return { id, roll };
}

/**
 * A top vibe from the bag, with its key and bpm rolled in the same draw: the launch jam (spec 10.1) when `launch`,
 * else the dice and "Surprise me".
 */
export function drawLaunch(
  seed: number,
  store: BagStorage | null,
  ids: readonly string[] = TOP_IDS,
  launch = false,
): { id: string; song: Song } | null {
  const got = drawFromBag(seed, store, ids, launch);
  if (!got) return null;
  const song = rollVibe(got.id, createRng(got.roll));
  return song ? { id: got.id, song } : null;
}
