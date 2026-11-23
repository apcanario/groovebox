/**
 * Simple mode's macro dials (spec 8.3): each moves several ordinary values at once. The mapping is
 * data, here beside the patch definitions; the engine applies it, so a macro move is an ordinary edit
 * of patch and section values that Advanced shows. Pure, no audio dependency.
 *
 * A target is a patch key (shared by every section) or a value of the edited section (a layer's lead,
 * arp or pad settings, or the drums' swing). A macro whose targets include a section value keeps its
 * position per section; the others keep it per song.
 */
import type { NumericPatchKey } from "../engine/song.ts";

export type MacroId = "punch" | "hats" | "swing" | "level" | "bright" | "weight" | "space" | "busy" | "evolve";

/** Instruments with macros: the five of the song. */
export type MacroInstrument = "drums" | "bass" | "synth" | "layer1" | "layer2";

/** Where a target value lives. */
export type MacroTarget =
  | { kind: "patch"; key: NumericPatchKey; from: number; to: number; exp?: boolean }
  | { kind: "gen"; key: "density" | "hits" | "lock"; from: number; to: number; whole?: boolean }
  | { kind: "arp"; key: "rate"; from: number; to: number }
  | { kind: "pad"; key: "motion" | "brightness"; from: number; to: number }
  | { kind: "swing"; from: number; to: number };

export interface MacroDef {
  id: MacroId;
  /** The dial's name: a plain word (spec 8.1). */
  label: "Punch" | "Hats" | "Swing" | "Level" | "Bright" | "Weight" | "Space" | "Busy" | "Evolve";
  targets: MacroTarget[];
}

const level: MacroDef = { id: "level", label: "Level", targets: [{ kind: "patch", key: "level", from: 0, to: 1 }] };
const space: MacroDef = {
  id: "space",
  label: "Space",
  targets: [
    { kind: "patch", key: "delay", from: 0, to: 0.6 },
    { kind: "patch", key: "reverb", from: 0, to: 0.8 },
  ],
};
/** Bright on the layers: the XY cutoff (their filter has no envelope). */
const layerBright: MacroDef = { id: "bright", label: "Bright", targets: [{ kind: "patch", key: "cutoff", from: 0.15, to: 0.95 }] };
/** Busy: how many notes the lead plays (hits and density) and how fast the arp runs (a quarter, an eighth, a sixteenth). */
const busy: MacroDef = {
  id: "busy",
  label: "Busy",
  targets: [
    { kind: "gen", key: "hits", from: 3, to: 14, whole: true },
    { kind: "gen", key: "density", from: 0.4, to: 1 },
    { kind: "arp", key: "rate", from: 4, to: 1 },
  ],
};
/** Evolve: the inverse of Lock (spec 8.3); on a pad, how far its filter drifts. */
const evolve: MacroDef = {
  id: "evolve",
  label: "Evolve",
  targets: [
    { kind: "gen", key: "lock", from: 1, to: 0 },
    { kind: "pad", key: "motion", from: 0, to: 1 },
  ],
};

/** The four dials of each Simple instrument tab, in the order of spec 8.3's table. */
export const MACROS: Record<MacroInstrument, readonly MacroDef[]> = {
  drums: [
    {
      id: "punch",
      label: "Punch",
      targets: [
        { kind: "patch", key: "drive", from: 0, to: 0.8 },
        { kind: "patch", key: "kickDecay", from: 0.75, to: 0.3 },
        { kind: "patch", key: "pitch", from: 0.25, to: 0.55 },
      ],
    },
    {
      id: "hats",
      label: "Hats",
      targets: [
        { kind: "patch", key: "hatLevel", from: 0, to: 1 },
        { kind: "patch", key: "openLevel", from: 0, to: 1 },
        { kind: "patch", key: "hatDecay", from: 0.3, to: 0.7 },
      ],
    },
    { id: "swing", label: "Swing", targets: [{ kind: "swing", from: 0, to: 0.3 }] },
    level,
  ],
  bass: [
    {
      id: "bright",
      label: "Bright",
      targets: [
        { kind: "patch", key: "cutoff", from: 0.1, to: 0.75 },
        { kind: "patch", key: "envAmount", from: 0.15, to: 0.8 },
      ],
    },
    {
      id: "weight",
      label: "Weight",
      targets: [
        { kind: "patch", key: "sub", from: 0.2, to: 1 },
        { kind: "patch", key: "drive", from: 0, to: 0.6 },
      ],
    },
    {
      // Drive belongs to Weight (its "low drive"), so two dials never fight over one value.
      id: "punch",
      label: "Punch",
      targets: [
        { kind: "patch", key: "attack", from: 0.03, to: 0.001, exp: true },
        { kind: "patch", key: "decay", from: 0.6, to: 0.1, exp: true },
      ],
    },
    level,
  ],
  synth: [
    {
      id: "bright",
      label: "Bright",
      targets: [
        { kind: "patch", key: "cutoff", from: 0.15, to: 0.9 },
        { kind: "patch", key: "envAmount", from: 0.05, to: 0.7 },
      ],
    },
    {
      id: "punch",
      label: "Punch",
      targets: [
        { kind: "patch", key: "attack", from: 0.08, to: 0.002, exp: true },
        { kind: "patch", key: "decay", from: 0.8, to: 0.12, exp: true },
        { kind: "patch", key: "drive", from: 0, to: 0.5 },
      ],
    },
    space,
    level,
  ],
  layer1: [busy, evolve, layerBright, space],
  layer2: [busy, evolve, layerBright, space],
};

/** The value a target takes at a dial position 0..1. Seconds move on a curve; whole numbers round. */
export function targetValue(t: MacroTarget, pos: number): number {
  const p = Math.max(0, Math.min(1, pos));
  if (t.kind === "patch" && t.exp) return t.from * Math.pow(t.to / t.from, p);
  if (t.kind === "arp") return p < 1 / 3 ? 4 : p < 2 / 3 ? 2 : 1;
  const v = t.from + (t.to - t.from) * p;
  return t.kind === "gen" && t.whole ? Math.round(v) : v;
}

/** The dial position a value sits at on a target (the inverse of targetValue), 0..1. */
export function targetPos(t: MacroTarget, v: number): number {
  let p: number;
  if (t.kind === "patch" && t.exp) p = Math.log(Math.max(1e-6, v) / t.from) / Math.log(t.to / t.from);
  else if (t.kind === "arp") p = v >= 4 ? 0 : v >= 2 ? 0.5 : 1;
  else p = t.to === t.from ? 0 : (v - t.from) / (t.to - t.from);
  return Math.max(0, Math.min(1, p));
}

/** A macro keeps its position per section when any target is a section value. */
export function sectionScoped(def: MacroDef): boolean {
  return def.targets.some((t) => t.kind !== "patch");
}

/** Where a macro position is stored: "drums.swing", "layer1.busy". */
export const macroKey = (inst: MacroInstrument, id: MacroId): string => `${inst}.${id}`;

/** A macro of an instrument, or undefined. */
export function findMacro(inst: string, id: string): MacroDef | undefined {
  return (MACROS as Record<string, readonly MacroDef[] | undefined>)[inst]?.find((m) => m.id === id);
}

/** Every stored macro key, for validation. */
export const MACRO_KEYS: readonly string[] = Object.entries(MACROS).flatMap(([inst, defs]) => defs.map((d) => `${inst}.${d.id}`));
