/** Reusable controls: Dial, XYPad, SendBar, Toggle, and the drag and long-press hooks. No hover states. */
import type { ComponentChildren } from "preact";
import { useRef, useState } from "preact/hooks";
import { Icon, iconThing, type IconThing } from "./icons.tsx";
import { chipPage, dragValue, fraction } from "./logic.ts";


type PE = PointerEvent & { currentTarget: HTMLElement };

/**
 * Vertical drag from anywhere on an element: up raises, down lowers. Returns the pointer handlers.
 * The value is read at the start of each drag, so the control stays in sync with outside changes.
 */
export function useVerticalDrag(
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
  step = 0,
  span?: number,
): {
  onPointerDown: (e: PE) => void;
  onPointerMove: (e: PE) => void;
  onPointerUp: (e: PE) => void;
  onPointerCancel: (e: PE) => void;
} {
  const drag = useRef<{ id: number; y: number; start: number; last: number } | null>(null);
  return {
    onPointerDown(e) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, y: e.clientY, start: value, last: value };
    },
    onPointerMove(e) {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const v = dragValue(d.start, e.clientY - d.y, min, max, step, span);
      if (v !== d.last) {
        d.last = v;
        onChange(v);
      }
    },
    onPointerUp() {
      drag.current = null;
    },
    onPointerCancel() {
      drag.current = null;
    },
  };
}

/**
 * Long-press (500 ms, finger held still) on an element; a short tap calls `onTap`. A press that
 * fired the long action does not also tap.
 */
export function useLongPress(onTap: () => void, onLong: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const origin = useRef<[number, number]>([0, 0]);
  const clear = (): void => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown(e: PointerEvent) {
      fired.current = false;
      origin.current = [e.clientX, e.clientY];
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        timer.current = null;
        onLong();
      }, ms);
    },
    onPointerMove(e: PointerEvent) {
      const [x, y] = origin.current;
      if (Math.hypot(e.clientX - x, e.clientY - y) > 12) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClick() {
      if (fired.current) {
        fired.current = false;
        return;
      }
      clear();
      onTap();
    },
    onContextMenu(e: Event) {
      e.preventDefault();
    },
  };
}

// ---- Dial -------------------------------------------------------------------------

/** Ring radius and centre in the dial's 78 x 78 drawing. */
const R = 30;
const C = 39;
const pt = (a: number, r = R): [number, number] => [C + r * Math.cos((a * Math.PI) / 180), C + r * Math.sin((a * Math.PI) / 180)];
function arc(a0: number, a1: number): string {
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
/** A short radial line at angle `a` from radius r0 to r1. */
function tick(a: number, r0: number, r1: number): string {
  const [x0, y0] = pt(a, r0);
  const [x1, y1] = pt(a, r1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
/** The three tick marks (minimum, middle, maximum), outside the ring. */
const TICKS = [135, 270, 405].map((a) => tick(a, R + 5, R + 9)).join("");

export interface DialProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Text in the middle; defaults to the value as 0..100. */
  display?: string;
  color: string;
  onChange: (v: number) => void;
  /** Draw the arc from the middle (for bipolar values such as the filter sweep). */
  bipolar?: boolean;
  id?: string;
  /** The name under the dial when it is more than its label's words (an instrument's icon and name). */
  name?: ComponentChildren;
}

/**
 * A large dial turned by dragging up and down from anywhere on it, never by tracing a circle. Drawn as
 * spec 8.12 says: a square-cut arc on a dark track, three ticks, a short white pointer at the value,
 * the value in the middle and the name under it.
 */
export function Dial({ label, value, min, max, step = 0, display, color, onChange, bipolar, id, name }: DialProps) {
  const drag = useVerticalDrag(value, min, max, onChange, step);
  const f = fraction(value, min, max);
  const end = 135 + 270 * f;
  const from = bipolar ? Math.min(270, end) : 135;
  const to = bipolar ? Math.max(270, end) : end;
  const text = display ?? String(Math.round(f * 100));
  return (
    <div
      class="dial"
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={text}
      data-dial={id ?? label.toLowerCase()}
      {...drag}
    >
      <div class="knob">
        <svg viewBox="0 0 78 78" aria-hidden="true">
          <path d={TICKS} class="ticks" />
          <path d={arc(135, 405)} class="track" />
          {to - from > 0.5 && <path d={arc(from, to)} style={{ stroke: color }} class="arc" />}
          <path d={tick(end, R - 5, R + 5)} class="pointer" />
        </svg>
        <div class="val">{text}</div>
      </div>
      <label>{name ?? label}</label>
    </div>
  );
}

// ---- XY pad -------------------------------------------------------------------------

export interface XYPadProps {
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  xLabel: string;
  yLabel: string;
  readout?: string;
  id?: string;
}

/** Filter cutoff (x) and resonance (y), both 0..1. Acts at once while the finger moves. */
export function XYPad({ x, y, onChange, xLabel, yLabel, readout, id }: XYPadProps) {
  const active = useRef<number | null>(null);
  const move = (e: PE): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const ny = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
    onChange(nx, ny);
  };
  return (
    <div
      class="xy"
      data-xy={id}
      role="group"
      aria-label={`${xLabel} and ${yLabel}`}
      data-value={`${Math.round(x * 100)} ${Math.round(y * 100)}`}
      style={{ "--fx": x, "--fy": 1 - y }}
      onPointerDown={(e: PE) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        move(e);
      }}
      onPointerMove={(e: PE) => {
        if (active.current === e.pointerId) move(e);
      }}
      onPointerUp={() => (active.current = null)}
      onPointerCancel={() => (active.current = null)}
    >
      <svg class="dots" aria-hidden="true">
        <defs>
          <pattern id={`xy-dots-${id ?? "pad"}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#xy-dots-${id ?? "pad"})`} />
      </svg>
      <div class="hx" />
      <div class="hy" />
      <div class="dot" />
      <div class="ly">{yLabel}</div>
      <div class="lx">{xLabel}</div>
      {readout && <div class="rv">{readout}</div>}
    </div>
  );
}

// ---- Send bar -------------------------------------------------------------------------

export interface SendBarProps {
  label: string;
  value: number; // 0..1
  color: string;
  onChange: (v: number) => void;
  id?: string;
}

/** A horizontal amount: touch or drag anywhere on the bar to set it. */
export function SendBar({ label, value, color, onChange, id }: SendBarProps) {
  const active = useRef<number | null>(null);
  const set = (e: PE): void => {
    const r = e.currentTarget.getBoundingClientRect();
    onChange(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100) / 100);
  };
  return (
    <div
      class="send"
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      data-send={id ?? label.toLowerCase()}
      onPointerDown={(e: PE) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = e.pointerId;
        set(e);
      }}
      onPointerMove={(e: PE) => {
        if (active.current === e.pointerId) set(e);
      }}
      onPointerUp={() => (active.current = null)}
      onPointerCancel={() => (active.current = null)}
    >
      <div class="fill" style={{ width: `${value * 100}%`, background: color }} />
      <span>{label}</span>
      <b>{Math.round(value * 100)}</b>
    </div>
  );
}

// ---- Toggle ---------------------------------------------------------------------------

/** An instrument's on/off for a section: filled when on, dark with its colour's edge when off, hatched while it waits for the bar. */
export function Toggle({
  on,
  pending,
  color,
  label,
  onToggle,
  id,
}: {
  on: boolean;
  pending: boolean;
  color: string;
  label: string;
  onToggle: () => void;
  id?: string;
}) {
  return (
    <button
      class={`tog${on ? " on" : " off"}${pending ? " pending" : ""}`}
      style={{ "--c": color }}
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-toggle={id}
      onClick={onToggle}
    >
      {pending ? "Next bar" : on ? "On" : "Off"}
    </button>
  );
}

/** A bottom sheet over the screen; tapping the shade closes it. */
export function Sheet({ children, onClose }: { children: ComponentChildren; onClose: () => void }) {
  return (
    <div class="shade" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog">
        {children}
      </div>
    </div>
  );
}

// ---- Chips and pages (G3) -------------------------------------------------------------

/** One row of choices, one of them on. `data-<name>` carries each value for tests. */
export function Chips<T extends string>({
  name,
  options,
  value,
  label,
  onPick,
  cols,
}: {
  name: string;
  options: readonly T[];
  value: T | null;
  label: (v: T) => string;
  onPick: (v: T) => void;
  cols?: number;
}) {
  return (
    <div class="chips" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o}
          class={`chip${value === o ? " on" : ""}`}
          {...{ [`data-${name}`]: o }}
          aria-pressed={value === o}
          onClick={() => onPick(o)}
        >
          {label(o)}
        </button>
      ))}
    </div>
  );
}

/** Most chips one row holds before the rest go to further pages (P3: pickers list whatever exists). */
export const CHIPS_PER_ROW = 5;

/**
 * A picker that lists whatever exists without scrolling (spec 8.6): up to CHIPS_PER_ROW chips in one row; when
 * there are more, the row shows a page of them and a last chip, More, that turns to the next page (wrapping).
 * It opens on the page holding the chosen value.
 */
export function PagedChips<T extends string>({
  name,
  options,
  value,
  label,
  onPick,
  what,
}: {
  name: string;
  options: readonly T[];
  value: T | null;
  label: (v: T) => string;
  onPick: (v: T) => void;
  /** What the options are, for the More chip's label ("beats"). */
  what: string;
}) {
  const [page, setPage] = useState(() => chipPage(options, value, CHIPS_PER_ROW).page);
  const { pages, page: p, shown, pad } = chipPage(options, value, CHIPS_PER_ROW, page);
  if (pages === 1) return <Chips name={name} options={options} value={value} label={label} onPick={onPick} />;
  return (
    <div class="chips" style={{ gridTemplateColumns: `repeat(${CHIPS_PER_ROW}, minmax(0, 1fr))` }}>
      {shown.map((o) => (
        <button
          key={o}
          class={`chip${value === o ? " on" : ""}`}
          {...{ [`data-${name}`]: o }}
          aria-pressed={value === o}
          onClick={() => onPick(o)}
        >
          {label(o)}
        </button>
      ))}
      {Array.from({ length: pad }, (_, i) => (
        <i key={`gap${i}`} aria-hidden="true" />
      ))}
      <button
        class="chip more"
        data-more={name}
        data-page-of={`${p + 1}/${pages}`}
        aria-label={`More ${what}: page ${p + 1} of ${pages}, tap for the next`}
        onClick={() => setPage((p + 1) % pages)}
      >
        More
      </button>
    </div>
  );
}

/** A page chip's icon: every page chip carries one (spec 8.12's table; P1b review M1). */
function PageIcon({ label }: { label: string }) {
  const t = iconThing(label);
  return t ? <Icon thing={t} /> : null;
}

/** A group heading over a chip row, with its icon beside the word (spec 8.12; P1b review M2). */
export function GroupLabel({ thing, children, split }: { thing: IconThing; children?: ComponentChildren; split?: ComponentChildren }) {
  return (
    <div class={`glabel${split ? " split" : ""}`}>
      <span class="gl">
        <Icon thing={thing} />
        {children ?? thing}
      </span>
      {split && <span>{split}</span>}
    </div>
  );
}

/** Page chips at the top of a tab (spec 8.6): where a tab holds more than fits one screen. */
export function Pager<K extends string>({
  pages,
  page,
  onPage,
  id,
}: {
  pages: readonly (readonly [K, string])[];
  page: K;
  onPage: (k: K) => void;
  id: string;
}) {
  return (
    <div class={`seg pager${pages.length > 6 ? " many" : ""}`} style={{ gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))` }}>
      {pages.map(([k, label]) => (
        <button key={k} class={k === page ? "on" : ""} data-page={`${id}:${k}`} aria-pressed={k === page} onClick={() => onPage(k)}>
          <PageIcon label={label} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** A horizontal level meter: `fill` 0..1, `peak` 0..1 marked as a line. */
export function Meter({ fill, peak, text }: { fill: number; peak: number; text: string }) {
  return (
    <div class="meter" id="meter" aria-label={`Master level ${text}`}>
      <div class="fill" style={{ width: `${fill * 100}%` }} />
      <div class="pk" style={{ left: `${peak * 100}%` }} />
      <span>Master</span>
      <b>{text}</b>
    </div>
  );
}
