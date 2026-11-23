/**
 * Text always fits its tile (spec 8.6): on every control, text that is too wide is drawn smaller until
 * it fits, down to 10 px. Controls never wrap (white-space: nowrap in style.css). Display only.
 */
import { fitSize } from "./logic.ts";

/** Everything that counts as a tile, chip, button, dial or pill. */
export const FIT_CONTROLS = "button, .pill, .dial, .dial .val, .send, .meter, .tile";

const MIN_PX = 10;
const done = new WeakMap<Element, string>();

/** Elements inside `c` (or `c` itself) that hold text directly. */
function leaves(c: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  const walk = (el: Element): void => {
    if (!(el instanceof HTMLElement) || el.getClientRects().length === 0) return;
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim()) {
        out.push(el);
        break;
      }
    }
    for (const ch of el.children) walk(ch);
  };
  walk(c);
  return out;
}

function textRect(el: HTMLElement): DOMRect | null {
  const r = document.createRange();
  r.selectNodeContents(el);
  const b = r.getBoundingClientRect();
  return b.width || b.height ? b : null;
}

/** Whether any text of the control passes its edge. */
export function overflows(c: HTMLElement, ls: HTMLElement[] = leaves(c)): boolean {
  if (c.scrollWidth > c.clientWidth + 0.5) return true;
  const box = c.getBoundingClientRect();
  for (const l of ls) {
    if (l !== c && l.scrollWidth > l.clientWidth + 0.5 && getComputedStyle(l).display !== "inline") return true;
    const t = textRect(l);
    if (t && (t.left < box.left - 0.5 || t.right > box.right + 0.5)) return true;
  }
  return false;
}

/** What a control was last fitted for: its size and its text. Read without walking its tree. */
function keyOf(c: HTMLElement): string {
  return `${c.clientWidth}x${c.clientHeight}|${c.textContent ?? ""}`;
}

function fit(c: HTMLElement): void {
  const key = keyOf(c);
  if (done.get(c) === key) return;
  const ls = leaves(c);
  for (const l of ls) l.style.fontSize = "";
  if (overflows(c, ls)) {
    // The widest text gives way first; then the others, until the control fits.
    const order = [...ls].sort((a, b) => (textRect(b)?.width ?? 0) - (textRect(a)?.width ?? 0));
    for (const l of order) {
      const start = parseFloat(getComputedStyle(l).fontSize);
      const px = fitSize(start, (p) => {
        l.style.fontSize = `${p}px`;
        return !overflows(c, ls);
      }, MIN_PX);
      l.style.fontSize = `${px}px`;
      if (!overflows(c, ls)) break;
    }
  }
  done.set(c, keyOf(c));
}

/**
 * Fit every control on screen. Cheap when nothing changed: each control remembers the size and text it
 * last fitted, and is only measured again when one of them changes.
 */
export function fitAll(root: ParentNode = document): void {
  for (const c of root.querySelectorAll<HTMLElement>(FIT_CONTROLS)) fit(c);
}

let queued = 0;
/** Fit on the next frame (several renders in one frame share one pass). */
export function fitSoon(): void {
  if (queued) return;
  queued = requestAnimationFrame(() => {
    queued = 0;
    fitAll();
  });
}

/**
 * Readouts that change while playing (bar counter, beat lights, record clock) and are sized in CSS to
 * fit: changes inside them do not start a fit pass, so the step clock costs no layout.
 */
export const NO_FIT = "[data-nofit]";

function worthFitting(records: MutationRecord[]): boolean {
  return records.some((r) => {
    const el = r.target instanceof Element ? r.target : r.target.parentElement;
    return !el || !el.closest(NO_FIT);
  });
}

/** Fit now and after every change to the page (any component's render) and every resize. */
export function startFit(root: HTMLElement): () => void {
  const mo = new MutationObserver((records) => {
    if (worthFitting(records)) fitSoon();
  });
  mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", fitSoon);
  fitSoon();
  return () => {
    mo.disconnect();
    window.removeEventListener("resize", fitSoon);
  };
}
