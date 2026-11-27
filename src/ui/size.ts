/**
 * The size class (T1, spec 9.1): phone, tablet portrait or tablet landscape, chosen by the screen's size. One source of
 * truth for the UI: the shell reads it and switches layout live, and a rotation changes only what is shown, never the
 * engine (nothing here or in its listeners calls the engine). Display only.
 *
 * Reading of spec 9.1's table: a screen under 600 px on its short side is a phone in either orientation (a phone turned
 * sideways in a browser stays a phone; the APK locks phones to portrait). A tablet taller than wide is portrait when it
 * is 960 px tall or more, the least height that holds the header, a panel of the phone's height and the dock. Any other
 * tablet (wider than tall, square, or taller than wide but under 960 px tall) gets the desk from 800 px wide, the least
 * width that holds the rail of seven beside the pads; a tablet that fits neither (under 800 px wide and under 960 px
 * tall) is portrait.
 */
export type SizeClass = "phone" | "portrait" | "landscape";

export const SIZE_CLASSES: readonly SizeClass[] = ["phone", "portrait", "landscape"];

/** Spec 9.1: under this width (the short side) the phone layout. */
export const TABLET_MIN_PX = 600;
/** Spec 9.1: from this height, and taller than wide, the tablet portrait layout (the dock). */
export const PORTRAIT_MIN_H_PX = 960;
/** Spec 9.1: from this width the tablet landscape layout (the desk) when the dock does not fit. */
export const LANDSCAPE_MIN_PX = 800;

/** The layout for a screen of `w` x `h` CSS px. */
export function sizeClass(w: number, h: number): SizeClass {
  if (!(w > 0 && h > 0)) return "phone";
  if (Math.min(w, h) < TABLET_MIN_PX) return "phone";
  if (h > w && h >= PORTRAIT_MIN_H_PX) return "portrait";
  if (w >= LANDSCAPE_MIN_PX) return "landscape";
  return "portrait";
}

/** A forced class from the URL (`?size=phone|portrait|landscape`), for smoke and screenshots; null when none. */
export function parseForced(search: string): SizeClass | null {
  const v = new URLSearchParams(search).get("size");
  return SIZE_CLASSES.includes(v as SizeClass) ? (v as SizeClass) : null;
}

/** Tab body height (CSS px) from which the XY pad and sends sit under every page (moved from App.tsx for its test). */
export const ROOMY_PX = 560;
/**
 * T1 slice c: on tablet portrait the panel is wide, so its dials and pads are taller than a phone's; the XY pad and the
 * sends sit under every page only from this body height (at 800 x 1280 the panel has about 575 px and pages them).
 */
export const ROOMY_PORTRAIT_PX = 640;

/** Whether a tab body of `height` CSS px shows the XY pad and the sends under every page, for the layout shown. */
export function roomyFor(layout: SizeClass, height: number): boolean {
  return height >= (layout === "portrait" ? ROOMY_PORTRAIT_PX : ROOMY_PX);
}

/** The tabs the tablet rail and dock pick from (spec 9.2: Chords, Drums, Bass, Synth, Layer 1, Layer 2, Mix). */
export const PANEL_TABS = ["chords", "drums", "bass", "synth", "layer1", "layer2", "mix"] as const;
export type PanelTab = (typeof PANEL_TABS)[number];

/**
 * The panel a tablet shows for the chosen tab: the pads are always on screen, so Play picks no panel and the last
 * panel stays; any other tab is its own panel.
 */
export function tabletPanel(tab: string, last: PanelTab): PanelTab {
  return (PANEL_TABS as readonly string[]).includes(tab) ? (tab as PanelTab) : last;
}

type Listener = (c: SizeClass) => void;

/**
 * The live size class: measured from the window on every resize and orientation change, or forced. Listeners hear a
 * change only when the class itself changes.
 */
export class SizeWatch {
  private forcedClass: SizeClass | null;
  private measured: SizeClass;
  private listeners = new Set<Listener>();
  private last: SizeClass;

  constructor(
    private readonly measure: () => { w: number; h: number },
    forced: SizeClass | null = null,
  ) {
    this.forcedClass = forced;
    const m = measure();
    this.measured = sizeClass(m.w, m.h);
    this.last = this.current;
  }

  get current(): SizeClass {
    return this.forcedClass ?? this.measured;
  }

  get forced(): SizeClass | null {
    return this.forcedClass;
  }

  /** Re-measure (on resize); tells the listeners if the class changed. */
  update(): void {
    const m = this.measure();
    this.measured = sizeClass(m.w, m.h);
    this.emit();
  }

  /** Force a class (null: follow the screen again). */
  force(c: SizeClass | null): void {
    this.forcedClass = c;
    this.emit();
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const c = this.current;
    if (c === this.last) return;
    this.last = c;
    for (const fn of this.listeners) fn(c);
  }
}

/** The app's one watch, wired to the window: resize and orientation changes re-measure; the root carries `data-size`. */
export function startSizeWatch(win: Window = window): SizeWatch {
  const watch = new SizeWatch(() => ({ w: win.innerWidth, h: win.innerHeight }), parseForced(win.location.search));
  const root = win.document.documentElement;
  const mark = (c: SizeClass): void => {
    root.dataset.size = c;
  };
  mark(watch.current);
  watch.on(mark);
  const re = (): void => watch.update();
  win.addEventListener("resize", re);
  win.addEventListener("orientationchange", re);
  return watch;
}
