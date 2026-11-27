/**
 * T2 (spec 9.1, 9.2, 9.3): an Advanced instrument panel on a tablet (the desk, and the dock's panel in portrait) shows
 * every page at once, with no page chips, where it fits. Whether it fits is measured, not guessed: the panel is drawn whole, and if its tab body then holds more than it
 * shows, it falls back to the phone's pages for that body size and that shape of panel (a layer's mode, a lead's Pulse
 * page), so nothing ever scrolls. A new body size or a new shape tries the whole panel again. Display only.
 */
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { Ctx } from "../App.tsx";

/** Whether a body of this size overflows (its content is taller or wider than it shows). */
export function overflowing(el: { scrollHeight: number; clientHeight: number; scrollWidth: number; clientWidth: number }): boolean {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

/**
 * The panel's whole form on a tablet: true while it fits. `shape` names what changes the panel's content (a mode, a
 * style); `on` is false where the panel has no whole form (Simple); the returned ref goes on the panel's section, whose
 * parent is the tab body measured.
 */
export function useFull(ctx: Ctx, shape: string, on = true): [boolean, { current: HTMLElement | null }] {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const key = `${size}|${shape}`;
  const tablet = ctx.tablet && on;
  const full = tablet && failed !== key;
  // The body's size, watched: a new size tries the whole panel again.
  useLayoutEffect(() => {
    const body = ref.current?.parentElement;
    if (!tablet || !body) return;
    const read = (): void => setSize(`${body.clientWidth}x${body.clientHeight}`);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(body);
    return () => ro.disconnect();
  }, [tablet]);
  // After every render of the whole panel: if the body overflows, the pages for this size and shape.
  useLayoutEffect(() => {
    const section = ref.current;
    const body = section?.parentElement;
    if (full && size && section && body && (overflowing(body) || overflowing(section))) setFailed(key);
  });
  return [full, ref];
}
