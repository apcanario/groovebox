/**
 * Styles (spec 8.2): one data file per style under `src/styles/`, read here into the vibe list, and a style
 * turned into a song document. Patches are data files under `src/data/patches/`. Adding a style is one new
 * file in `src/styles/`: the picker, the vibe arrows and the tests list whatever is there. No audio dependency.
 */
import {
  checkPatch,
  defaultLayerPattern,
  defaultPatch,
  INSTRUMENTS,
  LIMITS,
  validateSong,
  type InstrumentId,
  type LayerPattern,
  type Patch,
  type Section,
  type Song,
} from "../engine/song.ts";
import {
  MAX_DATA_NAME,
  STYLE_FAMILIES,
  checkNamed,
  readData,
  type DataFiles,
  type PatchDef,
  type StyleDef,
  type StyleFamily,
  type StyleLayer,
  type StyleLead,
  type StylePatch,
  type StyleFx,
} from "./data.ts";
import { LEAD_STYLES } from "./lead.ts";
import { checkDropRecipe } from "./drop.ts";
import { checkMorphRecipe } from "./morph.ts";
import { EFFECTS, MAX_ACTIVE_FX, fxSlot, type FxRack } from "./effects.ts";
import { BASS_PRESETS, DRUM_PRESETS, SYNTH_PRESETS } from "./presets.ts";
import { deriveSeed, type Rng } from "./random.ts";
import { MOODS, NOTE_NAMES } from "./scales.ts";

// ---- Patches -------------------------------------------------------------------------------

/**
 * What is wrong with a patch file: its name, its instrument, and (P3 review M2) every value range-checked as
 * the song check does, laid over the instrument's defaults, so an unused patch file is checked too.
 */
export function checkPatchDef(p: PatchDef): string[] {
  const out = checkNamed(p);
  if (!["drums", "bass", "synth", "layer"].includes(p.instrument)) return [...out, "instrument: unknown"];
  if (!p.values || typeof p.values !== "object") return [...out, "values: not an object"];
  const inst: InstrumentId = p.instrument === "layer" ? "layer1" : p.instrument;
  checkPatch({ ...defaultPatch(inst), ...p.values }, "values", out);
  return out;
}

const patchData = readData<PatchDef>(import.meta.glob("../data/patches/*.ts", { eager: true }), checkPatchDef);

/** Every patch, in picker order, and each by id. */
export const PATCH_IDS: readonly string[] = patchData.ids;
export const PATCHES: Readonly<Record<string, PatchDef>> = patchData.byId;

/** Which kind of patch an instrument takes. */
export function patchFor(inst: InstrumentId): PatchDef["instrument"] {
  return inst === "layer1" || inst === "layer2" ? "layer" : inst;
}

/** A style's patch for one instrument: the instrument's defaults, the patch's values, then the style's changes. */
export function resolvePatch(inst: InstrumentId, ref: StylePatch, patches: Readonly<Record<string, PatchDef>> = PATCHES): Patch {
  const id = typeof ref === "string" ? ref : ref.patch;
  const def = patches[id];
  if (!def) throw new Error(`unknown patch ${id}`);
  if (def.instrument !== patchFor(inst)) throw new Error(`patch ${id} is for ${def.instrument}, not ${inst}`);
  if (typeof ref !== "string" && ref.kick && inst !== "drums") throw new Error(`patch ${id}: kick settings on ${inst}, not the drums`);
  return { ...defaultPatch(inst), ...def.values, ...(typeof ref === "string" ? {} : { ...ref.set, ...ref.kick }) };
}

// ---- Styles ---------------------------------------------------------------------------------

/** A seed from a style's id (FNV-1a), so a vibe loads the same notes every time. Not a random choice. */
export function styleSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return h & 0x7fffffff;
}

/** A layer of one section: the defaults, the style's lead for the layer (P6), then the section's own settings. */
function layerPattern(l: StyleLayer, lead: StyleLead | undefined, seed: number): LayerPattern {
  const d = defaultLayerPattern(l.mode, seed);
  const out: LayerPattern = { mode: l.mode, arp: { ...d.arp, ...l.arp }, pad: { ...d.pad, ...l.pad }, gen: { ...d.gen, ...lead, ...l.gen, seed } };
  if (l.drone) out.drone = { ...l.drone };
  return out;
}

/** The song a style starts: everything it sets (spec 8.2), its four sections, named after the style. */
export function styleSong(id: string, def: StyleDef, patches: Readonly<Record<string, PatchDef>> = PATCHES): Song {
  const base = styleSeed(id);
  const sections: Section[] = def.sections.map((s, i) => {
    const on = Object.fromEntries(INSTRUMENTS.map((inst) => [inst, s.on.includes(inst)])) as Record<InstrumentId, boolean>;
    const sec: Section = {
      name: s.name,
      on,
      chords: s.chords.map(([degree, bars]) => ({ degree, bars })),
      drums: def.swing === undefined ? { preset: s.beat } : { preset: s.beat, swing: def.swing },
      bass: { rhythm: s.bass },
      synth: { rhythm: s.synth },
      layer1: layerPattern(s.layer1, def.leads?.layer1, deriveSeed(base, 2 * i)),
      layer2: layerPattern(s.layer2, def.leads?.layer2, deriveSeed(base, 2 * i + 1)),
    };
    return sec;
  });
  const patchesOut = Object.fromEntries(INSTRUMENTS.map((inst) => [inst, resolvePatch(inst, def.patches[inst], patches)])) as Record<InstrumentId, Patch>;
  const slot = (f: StyleFx) => fxSlot(f.effect, f.on ?? false, f.knobs);
  const fx = Object.fromEntries(INSTRUMENTS.map((inst) => [inst, def.fx[inst].map(slot) as FxRack])) as Record<InstrumentId, FxRack>;
  return {
    version: 1,
    name: def.name,
    key: def.key,
    mood: def.mood,
    bpm: def.bpm,
    patches: patchesOut,
    sections,
    mix: { ...def.mix },
    style: id,
    fx,
  };
}

/** Everything wrong with a style file; empty when it loads. */
export function checkStyle(def: StyleDef, id: string, patches: Readonly<Record<string, PatchDef>> = PATCHES): string[] {
  const out = checkNamed(def);
  if (def.name?.length > MAX_DATA_NAME) out.push(`name: at most ${MAX_DATA_NAME} characters`);
  if (!(STYLE_FAMILIES as readonly string[]).includes(def.family)) out.push("family: unknown");
  if (!(def.bpm >= LIMITS.bpm[0] && def.bpm <= LIMITS.bpm[1])) out.push(`bpm: must be ${LIMITS.bpm[0]}..${LIMITS.bpm[1]}`);
  if (!(NOTE_NAMES as readonly string[]).includes(def.key)) out.push("key: unknown");
  if (def.top !== undefined && typeof def.top !== "boolean") out.push("top: must be true or false");
  if (def.bpmRange !== undefined) {
    const r = def.bpmRange;
    const ok =
      Array.isArray(r) &&
      r.length === 2 &&
      r.every((b) => Number.isInteger(b) && b >= LIMITS.bpm[0] && b <= LIMITS.bpm[1]) &&
      r[0] <= def.bpm &&
      def.bpm <= r[1];
    if (!ok) out.push(`bpmRange: two whole bpms in ${LIMITS.bpm[0]}..${LIMITS.bpm[1]}, low first, around the style's bpm`);
  }
  if (!MOODS.includes(def.mood)) out.push(`mood: unknown ${def.mood}`);
  if (!Array.isArray(def.sections) || def.sections.length !== 4) out.push("sections: must be four (intro, groove, break, outro)");
  for (const id of ["layer1", "layer2"] as const)
    if (!def.leads?.[id] || !(LEAD_STYLES as readonly string[]).includes(def.leads[id].style)) out.push(`leads.${id}: needs a lead style`);
  if (def.start !== undefined && !(Number.isInteger(def.start) && def.start >= 0 && def.start < 4)) out.push("start: must be 0..3");
  // P9: two effects per instrument, and no more on at once than the cap allows.
  let fxOn = 0;
  for (const inst of INSTRUMENTS) {
    const r = def.fx?.[inst];
    if (!Array.isArray(r) || r.length !== 2) {
      out.push(`fx.${inst}: needs two effects`);
      continue;
    }
    for (const [i, f] of r.entries()) {
      if (!(EFFECTS as readonly string[]).includes(f?.effect)) out.push(`fx.${inst}[${i}]: unknown effect`);
      if (f?.on) fxOn++;
    }
  }
  out.push(...checkDropRecipe(def.drop));
  out.push(...checkMorphRecipe(def.morph));
  if (fxOn > MAX_ACTIVE_FX) out.push(`fx: ${fxOn} slots on, more than the ${MAX_ACTIVE_FX} the app plays at once`);
  for (const [i, s] of (def.sections ?? []).entries()) {
    if (!DRUM_PRESETS.includes(s.beat)) out.push(`sections[${i}].beat: unknown ${s.beat}`);
    if (!BASS_PRESETS.includes(s.bass)) out.push(`sections[${i}].bass: unknown ${s.bass}`);
    if (!SYNTH_PRESETS.includes(s.synth)) out.push(`sections[${i}].synth: unknown ${s.synth}`);
    for (const inst of s.on ?? []) if (!(INSTRUMENTS as readonly string[]).includes(inst)) out.push(`sections[${i}].on: unknown ${inst}`);
  }
  if (out.length) return out;
  try {
    for (const e of validateSong(styleSong(id, def, patches))) out.push(`song: ${e}`);
  } catch (err) {
    out.push(err instanceof Error ? err.message : String(err));
  }
  return out;
}

/** A folder of style files read into ids (in picker order) and styles by id; a broken file throws. */
export function readStyles(files: DataFiles, patches: Readonly<Record<string, PatchDef>> = PATCHES): { ids: string[]; byId: Record<string, StyleDef> } {
  return readData<StyleDef>(files, (def, id) => checkStyle(def, id, patches));
}

const styles = readStyles(import.meta.glob("../styles/*.ts", { eager: true }));

export const STYLES: Readonly<Record<string, StyleDef>> = styles.byId;

/** One tile of the vibe picker. */
export interface VibeTile {
  id: string;
  name: string;
  family: StyleFamily;
}

/** The vibe picker's tiles (spec 8.2): every style that exists, in order, grouped by family. */
export function vibeTiles(ids: readonly string[] = styles.ids, byId: Readonly<Record<string, StyleDef>> = STYLES): VibeTile[] {
  const fam = (id: string): number => STYLE_FAMILIES.indexOf(byId[id].family);
  return [...ids]
    .sort((a, b) => fam(a) - fam(b) || byId[a].order - byId[b].order || (a < b ? -1 : 1))
    .map((id) => ({ id, name: byId[id].name, family: byId[id].family }));
}

/** Every style, in picker order (family order, then each file's order). */
export const STYLE_IDS: readonly string[] = vibeTiles(styles.ids, styles.byId).map((t) => t.id);

/** The vibe an arrow loads: the next (`dir` 1) or previous (-1) tile, wrapping; from no vibe, the first or last. */
export function stepVibe(current: string | undefined, dir: 1 | -1, tiles: readonly VibeTile[] = vibeTiles()): string | null {
  if (!tiles.length) return null;
  const i = tiles.findIndex((t) => t.id === current);
  if (i < 0) return tiles[dir === 1 ? 0 : tiles.length - 1].id;
  return tiles[(i + dir + tiles.length) % tiles.length].id;
}

/** The song a vibe loads, by id; null for an unknown id. */
export function vibeSong(id: string): Song | null {
  const def = STYLES[id];
  return def ? styleSong(id, def) : null;
}

/** The section a vibe plays first: its groove unless the style says otherwise. */
export function vibeStart(id: string): number {
  return STYLES[id]?.start ?? 1;
}


// ---- F1 (spec 10.1, 10.2): the top vibes and the launch draw ------------------------------------------------------

/** Spec 10.2's order of the top vibes, which the picker's top group follows (F1 review M2, the phase 4 mock). */
export const TOP_ORDER: readonly string[] = [
  "deepTechno",
  "melodicTechno",
  "minimalTechno",
  "dubTechno",
  "deepHouse",
  "progressive",
  "drumAndBass",
  "twoStep",
  "breakbeat",
  "loFi",
  "ambient",
  "drone",
  "downtempo",
  "synthwave",
];

/**
 * The top vibes (spec 10.2), in picker order: the styles whose file says `top: true`, in TOP_ORDER, then any other
 * top style in family order (F7's Signature goes first in TOP_ORDER when it lands).
 */
export const TOP_IDS: readonly string[] = [
  ...TOP_ORDER.filter((id) => STYLES[id]?.top === true),
  ...STYLE_IDS.filter((id) => STYLES[id].top === true && !TOP_ORDER.includes(id)),
];

/** The bpm a launch draw may roll for a style: its `bpmRange`, else its bpm plus or minus 2, inside the app's limits. */
export function vibeBpmRange(def: StyleDef): [number, number] {
  const [lo, hi] = def.bpmRange ?? [def.bpm - 2, def.bpm + 2];
  return [Math.max(LIMITS.bpm[0], lo), Math.min(LIMITS.bpm[1], hi)];
}

/**
 * The song a launch draw opens (spec 10.1): the vibe's song with a key rolled from the twelve and a whole bpm rolled
 * inside its range, both from `rng`, so one vibe does not open the same twice. Null for an unknown id.
 */
export function rollVibe(id: string, rng: Rng, byId: Readonly<Record<string, StyleDef>> = STYLES): Song | null {
  const def = byId[id];
  if (!def) return null;
  const key = rng.pick(NOTE_NAMES);
  const [lo, hi] = vibeBpmRange(def);
  const bpm = lo + rng.int(hi - lo + 1);
  return { ...styleSong(id, def), key, bpm };
}
