/**
 * The progression library (P4, spec 8.4): one data file per progression under `src/data/progressions/`, each
 * tagged with its feels and the vibes it suits, stored as degrees of its mood's scale so it plays in any key.
 * Simple Chords shows them four at a time as cards. Adding a progression is one new file. No audio dependency.
 */
import { validChords, type ChordStep } from "../engine/song.ts";
import { FEELS, MAX_DATA_NAME, readData, type DataFiles, type Feel, type ProgressionDef } from "./data.ts";
import { MOODS, MOOD_TABLE, type Mood } from "./scales.ts";

/**
 * The launch set of spec 8.2 by style id (the file name under `src/styles/`), in the order of its table. Row P8
 * adds the sixteen not written yet under exactly these ids, so the library's tags already point at them.
 */
export const LAUNCH_VIBES = [
  "deepHouse",
  "tropicalHouse",
  "progressive",
  "acidHouse",
  "afroHouse",
  "deepTechno",
  "melodicTechno",
  "minimalTechno",
  "dubTechno",
  "drumAndBass",
  "twoStep",
  "breakbeat",
  "dubstep",
  "futureGarage",
  "loFi",
  "ambient",
  "drone",
  "downtempo",
  "synthwave",
  "idm",
  "edm",
  "trance",
  "electro",
  "trap",
] as const;

/** Each feel's word on its chip (spec 8.4). */
export const FEEL_LABEL: Record<Feel, string> = {
  bright: "Bright",
  warm: "Warm",
  dreamy: "Dreamy",
  dark: "Dark",
  tense: "Tense",
  uplifting: "Uplifting",
};

/** Cards on one page of Simple Chords (spec 8.4: four, and More chords shows the next four). */
export const CARDS_PER_PAGE = 4;

/** Everything wrong with a progression file; empty when it loads. */
export function checkProgression(p: ProgressionDef): string[] {
  const out: string[] = [];
  if (typeof p.order !== "number" || !Number.isFinite(p.order)) out.push("order: must be a number");
  if (typeof p.name !== "string" || !p.name || p.name.length > MAX_DATA_NAME) out.push(`name: 1..${MAX_DATA_NAME} characters`);
  if (!Array.isArray(p.feels) || !p.feels.length || !p.feels.every((f) => (FEELS as readonly string[]).includes(f)))
    out.push("feels: one or more of the six feels");
  if (!Array.isArray(p.vibes) || !p.vibes.length || !p.vibes.every((v) => (LAUNCH_VIBES as readonly string[]).includes(v)))
    out.push("vibes: one or more style ids of the launch set");
  if (!MOODS.includes(p.mood)) return [...out, `mood: unknown ${p.mood}`];
  if (p.voicing !== MOOD_TABLE[p.mood].voicing) out.push(`voicing: the mood ${p.mood} plays ${MOOD_TABLE[p.mood].voicing}`);
  if (!Array.isArray(p.chords) || p.chords.length < 2 || p.chords.length > 8) out.push("chords: 2 to 8");
  else if (!validChords(progressionChords(p))) out.push("chords: degrees 0..6, lengths of half, one or two bars");
  return out;
}

/** A folder of progression files read into ids (in order) and progressions by id; a broken file throws. */
export function readProgressions(files: DataFiles): { ids: string[]; byId: Record<string, ProgressionDef> } {
  return readData<ProgressionDef>(files, checkProgression);
}

const library = readProgressions(import.meta.glob("../data/progressions/*.ts", { eager: true }));

/** Every progression, in order, and each by id. */
export const PROGRESSION_IDS: readonly string[] = library.ids;
export const PROGRESSIONS: Readonly<Record<string, ProgressionDef>> = library.byId;

/** A progression as the song's chord steps. */
export function progressionChords(p: ProgressionDef): ChordStep[] {
  return p.chords.map(([degree, bars]) => ({ degree, bars }));
}

/** The progressions of one feel that suit a vibe, in order. An unknown vibe (a song from before P3) gets every vibe's. */
export function progressionsFor(vibe: string | undefined, feel: Feel, ids: readonly string[] = PROGRESSION_IDS, byId = PROGRESSIONS): string[] {
  const known = vibe !== undefined && (LAUNCH_VIBES as readonly string[]).includes(vibe);
  return ids.filter((id) => byId[id].feels.includes(feel) && (!known || byId[id].vibes.includes(vibe!)));
}

/** Whether a section plays this progression now: the song's mood and the section's chords are its own. */
export function isProgression(p: ProgressionDef, mood: Mood, chords: readonly ChordStep[]): boolean {
  return p.mood === mood && p.chords.length === chords.length && p.chords.every(([d, b], i) => chords[i].degree === d && chords[i].bars === b);
}

/** The id of the progression a section plays, among `ids`, or null. */
export function findProgression(mood: Mood, chords: readonly ChordStep[], ids: readonly string[] = PROGRESSION_IDS, byId = PROGRESSIONS): string | null {
  return ids.find((id) => isProgression(byId[id], mood, chords)) ?? null;
}

/** The cards of one page: `page` wraps, so More chords always turns to a next page. */
export function cardPage(list: readonly string[], page: number): { shown: string[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / CARDS_PER_PAGE));
  const p = ((page % pages) + pages) % pages;
  return { shown: list.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE), page: p, pages };
}

/** The feel Simple Chords opens on: the playing progression's first feel, else the mood's own. */
export function openingFeel(mood: Mood, chords: readonly ChordStep[]): Feel {
  const id = findProgression(mood, chords);
  return id ? PROGRESSIONS[id].feels[0] : MOOD_TABLE[mood]?.feel ?? FEELS[0];
}

/** The card page that holds `id` in `list`, else the first. */
export function pageOf(list: readonly string[], id: string | null): number {
  const i = id === null ? -1 : list.indexOf(id);
  return i < 0 ? 0 : Math.floor(i / CARDS_PER_PAGE);
}
