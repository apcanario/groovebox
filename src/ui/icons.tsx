/**
 * Icons (spec 8.12): Material Symbols, outlined, weight 300, shipped as SVG. An icon always sits beside
 * its word, never in place of it; the exceptions (vibe arrows, play and stop, record) are drawn shapes.
 */
import { ICON_PATHS, type IconName } from "./icon-paths.ts";

export type { IconName };

/**
 * The spec's icon table, thing by thing. Things that do not exist yet (Drone, the FX
 * page, Morph, DROP and the effects) are listed so the rows that build them use the same icon.
 */
export const ICON_FOR = {
  Play: "grid_view",
  Chords: "piano",
  Drums: "adjust",
  Bass: "graphic_eq",
  Synth: "airwave",
  "Layer 1": "layers",
  "Layer 2": "stacks",
  Mix: "tune",
  Lead: "show_chart",
  Arp: "stairs",
  Pad: "cloud",
  Drone: "horizontal_rule",
  Notes: "music_note",
  Feel: "gesture",
  Sound: "tune",
  FX: "bolt",
  // P6: Pulse's own page (its Euclidean rhythm), from the set already shipped.
  Pulse: "timeline",
  // P7: the drums' Kit page (Perc, Shaker, the drum sounds), the Mod page (FM, LFO, drift), the Mix tab's Space page.
  Kit: "adjust",
  Steps: "view_week",
  Mod: "speed",
  Space: "water",
  "New jam": "add",
  Back: "undo",
  "New idea": "casino",
  Morph: "all_inclusive",
  DROP: "keyboard_double_arrow_down",
  Cut: "content_cut",
  Filter: "filter_alt",
  Stutter: "fast_rewind",
  Echo: "repeat",
  Wash: "water",
  Riser: "trending_up",
  Chorus: "blur_on",
  // Page chips and group headings that are not in P6's set (P1b review M1, M2).
  Beat: "apps",
  "Kick · Clap": "radio_button_checked",
  Hats: "grain",
  Rhythm: "timeline",
  Key: "key",
  Master: "speaker",
  Levels: "equalizer",
  Audio: "headphones",
  Wave: "waves",
  Sequencer: "view_week",
  Motion: "motion_blur",
  Direction: "swap_vert",
  Rate: "speed",
  Octaves: "height",
} as const satisfies Record<string, IconName>;

export type IconThing = keyof typeof ICON_FOR;

/** The thing a label names: the whole label ("Kick · Clap"), else its part before " · " ("Lead · B"). */
/** Short page words that stand for a thing of the table (P7: "Kick" where "Kick · Clap" does not fit). */
const SHORT: Record<string, IconThing> = { Kick: "Kick · Clap" };

export function iconThing(label: string): IconThing | null {
  if (label in SHORT) return SHORT[label];
  for (const t of [label, label.split(" · ")[0]]) if (t in ICON_FOR) return t as IconThing;
  return null;
}

/** One icon, sized by the font size of its control (1.35em by default in style.css). */
export function Icon({ name, thing }: { name?: IconName; thing?: IconThing }) {
  const n: IconName = name ?? ICON_FOR[thing!];
  return (
    <svg class="ic" viewBox="0 -960 960 960" aria-hidden="true" data-icon={n}>
      <path d={ICON_PATHS[n]} />
    </svg>
  );
}
