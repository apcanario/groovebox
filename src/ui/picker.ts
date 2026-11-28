/**
 * The vibe picker's plan (F1, spec 10.1): the top vibes in two columns, a line, the other vibes in two columns. Where
 * both groups fit the screen's height at 48 px a tile, both show; where they do not, the line carries a "More" switch
 * that swaps the top group for the others and back, and the group's place keeps the top group's height so the switch
 * does not move under the thumb. Pure: no DOM, no audio. The sizes here are the CSS's (`.pick*` in style.css).
 */

/** A tile row: the smallest touch target (spec 8.6). */
export const PICK_ROW = 48;
/** Between tiles of one group (spec 8.12). */
export const PICK_GAP = 2;
/** Between the sheet's parts: the title row, a group, the line (spec 8.12). */
export const PICK_GROUP = 10;
/** The sheet's padding, top and bottom together, and its 1 px top border. */
export const PICK_PAD = 25;
/** The title row: the title and "Surprise me". */
export const PICK_HEAD = 48;
/** The line between the groups: its word and rule; with the "More" switch it is a 48 px row. */
export const PICK_LINE = 28;
/** Tiles side by side, in both groups. */
export const PICK_COLS = 2;

/** The height of `n` tiles in `cols` columns of 48 px rows. */
export function groupHeight(n: number, cols = PICK_COLS): number {
  const rows = Math.ceil(n / cols);
  return rows ? rows * PICK_ROW + (rows - 1) * PICK_GAP : 0;
}

/** The sheet's height with both groups showing. */
export function bothHeight(top: number, other: number): number {
  return PICK_PAD + PICK_HEAD + PICK_GROUP + groupHeight(top) + PICK_GROUP + PICK_LINE + (other ? PICK_GROUP + groupHeight(other) : 0);
}

/** The sheet's height with one group at a time: the larger group's place, then the line as a 48 px row. */
export function swapHeight(top: number, other: number): number {
  return PICK_PAD + PICK_HEAD + PICK_GROUP + Math.max(groupHeight(top), groupHeight(other)) + PICK_GROUP + PICK_ROW;
}

export interface PickerPlan {
  /** Both groups on screen; else one at a time, with the "More" switch. */
  both: boolean;
  /** The height the group's place keeps while groups swap (the larger group's), px. */
  place: number;
}

/** Whether both groups fit a screen `height` px tall, and the place a swapped group keeps. */
export function pickerPlan(height: number, top: number, other: number): PickerPlan {
  return {
    both: other === 0 || bothHeight(top, other) <= height,
    place: Math.max(groupHeight(top), groupHeight(other)),
  };
}
