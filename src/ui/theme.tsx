/** Names, colours and tab icons. Colours are the tokens of src/style.css. */
import type { InstrumentId } from "../engine/song.ts";
import { Icon, type IconThing } from "./icons.tsx";

export const INST_COLOR: Record<InstrumentId, string> = {
  drums: "var(--coral)",
  bass: "var(--teal)",
  synth: "var(--blue)",
  layer1: "var(--purple)",
  layer2: "var(--yellow)",
};

export const INST_NAME: Record<InstrumentId, "Drums" | "Bass" | "Synth" | "Layer 1" | "Layer 2"> = {
  drums: "Drums",
  bass: "Bass",
  synth: "Synth",
  layer1: "Layer 1",
  layer2: "Layer 2",
};

/** The colour of each tab's marker and active icon. */
export const TAB_COLOR: Record<Tab, string> = {
  play: "var(--coral)",
  chords: "var(--yellow)",
  mix: "var(--orange)",
  ...INST_COLOR,
};

/** An instrument's icon and name (spec 8.12: an icon beside every instrument name). */
export function InstName({ id }: { id: InstrumentId }) {
  return (
    <>
      <Icon thing={INST_NAME[id]} />
      <span class="nm">{INST_NAME[id]}</span>
    </>
  );
}

export const TABS = ["play", "chords", "drums", "bass", "synth", "layer1", "layer2", "mix"] as const;
export type Tab = (typeof TABS)[number];

export const TAB_NAME: Record<Tab, IconThing> = {
  play: "Play",
  chords: "Chords",
  mix: "Mix",
  ...INST_NAME,
};

/** The tab bar's icon (spec 8.12's table), drawn above the tab's word. */
export function TabIcon({ tab }: { tab: Tab }) {
  return <Icon thing={TAB_NAME[tab] as IconThing} />;
}
