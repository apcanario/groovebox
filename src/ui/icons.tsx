/**
 * Icons (spec 8.12): Material Symbols, outlined, weight 300, shipped as SVG. An icon always sits beside
 * its word, never in place of it; the exceptions (vibe arrows, play and stop, record) are drawn shapes.
 */
import { ICON_PATHS, type IconName } from "./icon-paths.ts";

export type { IconName };

/**
 * The spec's icon table, thing by thing. Things that do not exist yet (Drone, the Notes, Feel and FX
 * pages, Back, Morph, DROP and the effects) are listed so the rows that build them use the same icon.
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
} as const satisfies Record<string, IconName>;

export type IconThing = keyof typeof ICON_FOR;

/** One icon, sized by the font size of its control (1.35em by default in style.css). */
export function Icon({ name, thing }: { name?: IconName; thing?: IconThing }) {
  const n: IconName = name ?? ICON_FOR[thing!];
  return (
    <svg class="ic" viewBox="0 -960 960 960" aria-hidden="true" data-icon={n}>
      <path d={ICON_PATHS[n]} />
    </svg>
  );
}
