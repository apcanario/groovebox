/** Macro dials (spec 8.3) against a song: where each dial stands. No audio dependency. */
import { findMacro, macroKey, sectionScoped, targetPos, type MacroId, type MacroTarget } from "../music/macros.ts";
import { sectionSwing, type InstrumentId, type Song } from "./song.ts";
import { KICK_KEYS, kickSetting, type KickKey } from "../music/kick.ts";

/** The value a target reads now in a section of a song. */
export function targetNow(song: Song, section: number, inst: InstrumentId, t: MacroTarget): number {
  const s = song.sections[section];
  switch (t.kind) {
    case "patch":
      // A kick setting a song never set reads its default (F2).
      return (KICK_KEYS as readonly string[]).includes(t.key)
        ? kickSetting(song.patches[inst], t.key as KickKey)
        : (song.patches[inst][t.key] as number);
    case "swing":
      return sectionSwing(s);
    case "gen":
      return inst === "layer1" || inst === "layer2" ? s[inst].gen[t.key] : 0;
    case "arp":
      return inst === "layer1" || inst === "layer2" ? s[inst].arp[t.key] : 0;
    case "pad":
      return inst === "layer1" || inst === "layer2" ? s[inst].pad[t.key] : 0;
  }
}

/**
 * Where a macro dial stands: the position stored in the song when it was last moved (spec 8.3: editing the
 * values in Advanced does not move it), else where its first value sits now.
 */
export function macroPosition(song: Song, section: number, inst: InstrumentId, id: MacroId): number {
  const def = findMacro(inst, id);
  const s = song.sections[section];
  if (!def || !s) return 0;
  const stored = (sectionScoped(def) ? s.macros : song.macros)?.[macroKey(inst, id)];
  if (stored !== undefined) return stored;
  return targetPos(def.targets[0], targetNow(song, section, inst, def.targets[0]));
}
