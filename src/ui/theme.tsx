/** Names, colours and tab icons. Colours are the tokens of src/style.css. */
import type { InstrumentId } from "../engine/song.ts";

export const INST_COLOR: Record<InstrumentId, string> = {
  drums: "var(--coral)",
  bass: "var(--teal)",
  synth: "var(--blue)",
  layer1: "var(--purple)",
  layer2: "var(--yellow)",
};

export const INST_NAME: Record<InstrumentId, string> = {
  drums: "Drums",
  bass: "Bass",
  synth: "Synth",
  layer1: "Layer 1",
  layer2: "Layer 2",
};

export const TABS = ["play", "chords", "drums", "bass", "synth", "layer1", "layer2", "mix"] as const;
export type Tab = (typeof TABS)[number];

export const TAB_NAME: Record<Tab, string> = {
  play: "Play",
  chords: "Chords",
  mix: "Mix",
  ...INST_NAME,
};

/** Line icons from docs/design/layer1-tab.html. */
export function TabIcon({ tab }: { tab: Tab }) {
  switch (tab) {
    case "play":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "chords":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v10M15 4v10M9 14v6M15 14v6" />
        </svg>
      );
    case "drums":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="12" cy="8" rx="8" ry="3.5" />
          <path d="M4 8v8c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5V8" />
        </svg>
      );
    case "bass":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 15c3 0 3-8 6-8s3 10 6 10 3-6 6-6" />
        </svg>
      );
    case "synth":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 17l5-10v10l5-10v10l5-10v10h3" />
        </svg>
      );
    case "layer1":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
      );
    case "layer2":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
        </svg>
      );
    case "mix":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3v18M12 3v18M18 3v18" />
          <rect x="4" y="13" width="4" height="4" rx="1" class="knob" />
          <rect x="10" y="6" width="4" height="4" rx="1" class="knob" />
          <rect x="16" y="11" width="4" height="4" rx="1" class="knob" />
        </svg>
      );
  }
}
