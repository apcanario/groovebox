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

/** What is kept between launches: the generator's next seed, the vibes left in the bag, and the last one drawn. */
export interface BagState {
  seed: number;
  bag: string[];
  last: string | null;
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
    return { seed: s.seed as number, bag: s.bag, last: typeof s.last === "string" ? s.last : null };
  } catch {
    return null;
  }
}

/** A fresh bag: every vibe once, shuffled (Fisher-Yates), never starting on `last` when there is a choice. */
function refill(ids: readonly string[], last: string | null, rng: Rng): string[] {
  const bag = [...ids];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (bag.length > 1 && bag[0] === last) {
    const j = 1 + rng.int(bag.length - 1);
    [bag[0], bag[j]] = [bag[j], bag[0]];
  }
  return bag;
}

/**
 * Draw the next vibe from the bag. `seed` seeds the generator when there is no bag yet, and is the whole draw when
 * there is no storage. Returns the vibe and a seed for the rest of the same draw (key and bpm).
 */
export function drawFromBag(seed: number, store: BagStorage | null, ids: readonly string[] = TOP_IDS): { id: string; roll: number } | null {
  if (!ids.length) return null;
  const state = store ? readState(store) : null;
  const rng = createRng(state ? state.seed : seed);
  if (!store) return { id: rng.pick(ids), roll: rng.int(0x7fffffff) };
  const last = state?.last ?? null;
  // A vibe no longer a top vibe leaves the bag; a new one joins at the next refill.
  let bag = (state?.bag ?? []).filter((id) => ids.includes(id) && id !== last);
  if (!bag.length) bag = refill(ids, last, rng);
  const id = bag.shift()!;
  const roll = rng.int(0x7fffffff);
  const next: BagState = { seed: rng.int(0x7fffffff), bag, last: id };
  try {
    store.setItem(BAG_KEY, JSON.stringify(next));
  } catch {
    // Storage full or refused: this draw still stands.
  }
  return { id, roll };
}

/** The launch jam (spec 10.1): a top vibe from the bag, with its key and bpm rolled in the same draw. */
export function drawLaunch(seed: number, store: BagStorage | null, ids: readonly string[] = TOP_IDS): { id: string; song: Song } | null {
  const got = drawFromBag(seed, store, ids);
  if (!got) return null;
  const song = rollVibe(got.id, createRng(got.roll));
  return song ? { id: got.id, song } : null;
}
