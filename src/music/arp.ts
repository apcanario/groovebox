/** Arp: plays the current chord's notes. Pure. */
import type { Rng } from "./random.ts";

export const ARP_DIRECTIONS = ["up", "down", "updown", "random"] as const;
export type ArpDirection = (typeof ARP_DIRECTIONS)[number];

export interface ArpParams {
  direction: ArpDirection;
  rate: 1 | 2 | 4; // steps per note: 16ths, 8ths, quarters
  octaves: 1 | 2 | 3;
  gate: number; // 0.1..1, fraction of the note's slot
}

/** The note order the arp cycles through. */
export function arpSequence(notes: number[], p: ArpParams): number[] {
  const base = [...notes].sort((a, b) => a - b);
  const up: number[] = [];
  for (let o = 0; o < p.octaves; o++) for (const n of base) up.push(n + 12 * o);
  if (p.direction === "down") return up.reverse();
  if (p.direction === "updown") return up.length > 2 ? [...up, ...up.slice(1, -1).reverse()] : up;
  return up;
}

/** Note for the arp's `index`-th hit. Random direction draws from the seeded generator. */
export function arpNote(notes: number[], p: ArpParams, index: number, rng: Rng): number {
  const seq = arpSequence(notes, p);
  if (p.direction === "random") return rng.pick(seq);
  return seq[index % seq.length];
}
