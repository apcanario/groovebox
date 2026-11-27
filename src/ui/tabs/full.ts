/**
 * T2 (spec 9.1, 9.2, 9.3): an Advanced instrument panel on a tablet (the desk, and the dock's panel in portrait) shows
 * every page at once, with no page chips, where it fits. Whether it fits is measured, not guessed, and decided from the
 * tab body's size alone (T2 review E2): when a body size is new, the whole panel is drawn once for every shape it can
 * take, each at its worst-case content (a layer in every mode and lead style, eight chords, the longest section name,
 * a switch waiting for the next bar), before the screen is painted; if any of them overflows with less than FIT_SLACK
 * px to spare in height, the panel takes the phone's pages at that size. The answer is kept per panel and body size,
 * so nothing that changes in a jam (a chord added, a mode picked, the edited section following the playing one) can
 * switch a panel between whole and paged. Display only.
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { MAX_SECTION_NAME, LAYER_MODES, type InstrumentId, type LayerInstrument, type Section } from "../../engine/index.ts";
import type { Ctx } from "../App.tsx";
import { MAX_CHORDS } from "../logic.ts";

/** Height a whole panel must have to spare at its worst case (T2 review S1): no fit that rests on a rounding pixel. */
export const FIT_SLACK = 8;

/** Whether a box of this size overflows (its content is taller or wider than it shows), a pixel of rounding allowed. */
export function overflowing(el: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number }): boolean {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

/** What the walk's 48 px check looks at (tools/shots.py SMALL), inside a probed panel. Text is fitted after the
 * render by fit.ts, so it is not judged here. */
const CONTROLS = "button, a, input, [role=slider], [role=switch], [role=group]";

/**
 * Why a whole panel drawn in this box does not fit, or null: taller or wider than its box, or a control under 48 px
 * on either side. Measured, not set by a CSS floor (T2 review E1).
 */
export function cramped(section: HTMLElement, body: HTMLElement): string | null {
  if (overflowing(section)) return `needs ${section.scrollWidth}x${section.scrollHeight + FIT_SLACK}, has ${section.clientWidth}x${section.clientHeight + FIT_SLACK}`;
  if (body.scrollWidth > body.clientWidth + 1) return `needs ${body.scrollWidth} px across, has ${body.clientWidth}`;
  for (const el of section.querySelectorAll<HTMLElement>(CONTROLS)) {
    const r = el.getBoundingClientRect();
    if ((r.width || r.height) && (r.width < 47.5 || r.height < 47.5)) return `a control is ${Math.round(r.width)}x${Math.round(r.height)} px`;
  }
  return null;
}

/** A view of the context with the edited section's content replaced: what a probe draws. */
export type Shape = (ctx: Ctx) => Ctx;

function withSection(ctx: Ctx, f: (s: Section) => Section, toggle?: InstrumentId): Ctx {
  const sections = ctx.song.sections.map((s, i) => (i === ctx.edit ? f(s) : s));
  const pending = toggle ? { ...ctx.pending, toggles: [{ section: ctx.edit, instrument: toggle }] } : ctx.pending;
  return { ...ctx, song: { ...ctx.song, sections }, pending };
}

/** The longest name a section can have, in wide letters. */
const LONG_NAME = "W".repeat(MAX_SECTION_NAME);

/** An instrument panel's worst case: the longest name and its switch waiting for the next bar ("off at the next bar"). */
export function instShapes(inst: InstrumentId): Shape[] {
  return [(ctx) => withSection(ctx, (s) => ({ ...s, name: LONG_NAME, on: { ...s.on, [inst]: true } }), inst)];
}

/** Chords: the sequence full (eight chords of the longest length label), the longest section name. */
export const CHORD_SHAPES: Shape[] = [
  (ctx) => withSection(ctx, (s) => ({ ...s, name: LONG_NAME, chords: Array.from({ length: MAX_CHORDS }, (_, i) => ({ degree: i % 7, bars: 0.5 as const })) })),
];

/** A layer: every mode, and in Lead every style kind (Pulse adds its own dials; the others have none). */
export function layerShapes(id: LayerInstrument): Shape[] {
  const out: Shape[] = [];
  for (const mode of LAYER_MODES) {
    const styles = mode === "generative" ? (["pulse", "hook"] as const) : ([null] as const);
    for (const style of styles) {
      out.push((ctx) =>
        withSection(
          ctx,
          (s) => ({ ...s, name: LONG_NAME, on: { ...s.on, [id]: true }, [id]: { ...s[id], mode, ...(style ? { gen: { ...s[id].gen, style } } : {}) } }),
          id,
        ),
      );
    }
  }
  return out;
}

/** Mix has no content that changes its size. */
export const MIX_SHAPES: Shape[] = [(ctx) => ctx];

/** The decisions so far, by panel and tab body size: true where the panel is whole. */
const decided = new Map<string, boolean>();

/** The key a decision is kept under: the panel and the body's size, nothing else. */
export function fitKey(panel: string, width: number, height: number): string {
  return `${panel}|${width}x${height}`;
}

/** Forget every decision (tests). */
export function forgetFits(): void {
  decided.clear();
}

export interface Full {
  /** The whole panel is shown (or probed). */
  full: boolean;
  /** What the panel draws from: the context, or during a probe the worst case being measured. */
  view: Ctx;
  /** Set while the whole panel is drawn only to be measured (before the screen is painted). */
  probe: boolean;
  ref: { current: HTMLElement | null };
}

/**
 * The panel's whole form on a tablet, decided by body size. `panel` names the panel; `shapes` are its worst cases;
 * `on` is false where the panel has no whole form (Simple). The returned ref goes on the panel's section, whose parent
 * is the tab body measured.
 */
export function useFull(ctx: Ctx, panel: string, shapes: Shape[], on = true): Full {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState("");
  const [probeAt, setProbeAt] = useState<{ key: string; i: number }>({ key: "", i: 0 });
  const [, setDone] = useState(0);
  const tablet = ctx.tablet && on;
  const key = `${panel}|${size}`;
  const known = size ? decided.get(key) : undefined;
  const probing = tablet && known === undefined;
  const i = probeAt.key === key ? probeAt.i : 0;
  // The body's size, watched: a new size is measured again.
  useLayoutEffect(() => {
    const body = ref.current?.parentElement;
    if (!tablet || !body) return;
    const read = (): void => setSize(`${body.clientWidth}x${body.clientHeight}`);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(body);
    return () => ro.disconnect();
  }, [tablet]);
  // A probe drawn: measure it with FIT_SLACK px taken from its height, then the next shape or the answer.
  useLayoutEffect(() => {
    const section = ref.current;
    const body = section?.parentElement;
    if (!probing || !size || !section || !body || section.dataset.probe === undefined) return;
    const why = cramped(section, body);
    const fits = why === null;
    if (!fits || i + 1 >= shapes.length) {
      decided.set(key, fits);
      // For the walk's messages and the review: what was measured.
      body.dataset.fit = fits ? `${panel} whole` : `${panel} paged: ${why} (shape ${i + 1} of ${shapes.length})`;
      setDone((n) => n + 1);
    } else setProbeAt({ key, i: i + 1 });
  });
  if (!tablet) return { full: false, view: ctx, probe: false, ref };
  if (probing) return { full: true, view: shapes[Math.min(i, shapes.length - 1)](ctx), probe: true, ref };
  return { full: !!known, view: ctx, probe: false, ref };
}

/** The props a probed whole panel's section carries: marked (style.css takes FIT_SLACK px off its height). */
export function probeProps(f: Full): Record<string, string> {
  return f.probe ? { "data-probe": "", "aria-hidden": "true" } : {};
}

