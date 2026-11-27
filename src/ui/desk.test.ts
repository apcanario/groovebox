import { describe, expect, it } from "vitest";
import { defaultSong } from "../engine/song.ts";
import { padLabel, padView, rowPlays, type PadInput } from "./desk.ts";
import { plays } from "./logic.ts";
import appSource from "./App.tsx?raw";
import deskSource from "./tabs/DeskPads.tsx?raw";

const base: PadInput = { playing: 1, notesFor: 1, queued: null, toggles: [], running: true };

describe("desk pads (T1 slice b, spec 9.2)", () => {
  it("a pad is on or off as the song says, for every section and instrument", () => {
    const song = defaultSong();
    song.sections.forEach((s, i) => {
      for (const id of ["drums", "bass", "synth", "layer1", "layer2"] as const) expect(padView(song, i, id, base).on).toBe(s.on[id]);
    });
  });

  it("the playing column is live, and only the column the lanes were read for draws notes", () => {
    const song = defaultSong();
    expect(padView(song, 1, "drums", base)).toMatchObject({ live: true, notes: true });
    expect(padView(song, 0, "drums", base)).toMatchObject({ live: false, notes: false });
    // A switch landed in the heard bar before the lanes caught up: notes follow the lanes, the band the position.
    expect(padView(song, 2, "bass", { ...base, notesFor: 2 })).toMatchObject({ live: false, notes: true });
    expect(padView(song, 1, "bass", { ...base, notesFor: null }).notes).toBe(false);
  });

  it("a waiting toggle shows its hatched frame on that pad only", () => {
    const song = defaultSong();
    const s = { ...base, toggles: [{ section: 2, instrument: "synth" as const }] };
    expect(padView(song, 2, "synth", s).pending).toBe(true);
    expect(padView(song, 2, "bass", s).pending).toBe(false);
    expect(padView(song, 1, "synth", s).pending).toBe(false);
  });

  it("the column a section switch lands on is outlined while playing, never the playing one", () => {
    const song = defaultSong();
    expect(padView(song, 2, "drums", { ...base, queued: 2 }).next).toBe(true);
    expect(padView(song, 1, "drums", { ...base, queued: 2 }).next).toBe(false);
    expect(padView(song, 2, "drums", { ...base, queued: 2, running: false }).next).toBe(false);
    expect(padView(song, 1, "drums", { ...base, queued: 1 }).next).toBe(false);
  });

  it("a row says what its instrument plays, or Next bar while its toggle waits", () => {
    const song = defaultSong();
    expect(rowPlays(song, 0, { toggles: [] }, "drums", true)).toBe(plays(song, 0, "drums"));
    expect(rowPlays(song, 0, { toggles: [{ section: 0, instrument: "drums" }] }, "drums", true)).toBe("Next bar");
    expect(rowPlays(song, 0, { toggles: [{ section: 0, instrument: "drums" }] }, "drums", false)).toBe(plays(song, 0, "drums"));
  });

  it("names a pad by instrument, section, state and wait", () => {
    expect(padLabel("Bass", "C", { on: true, pending: true, live: false, next: false, notes: false })).toBe("Bass in section C: on, switching on the next bar");
    expect(padLabel("Drums", "A", { on: false, pending: false, live: true, next: false, notes: true })).toBe("Drums in section A: off, playing");
  });
});

describe("desk layout rules", () => {
  it("the desk's pads never touch Tone.js and never draw random numbers", () => {
    expect(deskSource).not.toMatch(/from ["'][^"']*tone/i);
    expect(deskSource).not.toMatch(/Math\.random/);
  });
  it("App.tsx picks the desk's pads for landscape (a match on its source)", () => {
    expect(appSource).toMatch(/const pads = land \?/);
    expect(appSource).toMatch(/<DeskPads ctx=\{ctx\} \/>/);
  });
});
