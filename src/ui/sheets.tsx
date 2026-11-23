/**
 * The frame's sheets (P1): the section sheet, opened by holding a section in the strip, and the Songs
 * sheet, opened from the header on every tab. The saved-songs list is the one thing in the app that scrolls.
 */
import { useEffect, useState } from "preact/hooks";
import { MAX_SONG_NAME, type SongEntry } from "../store/library.ts";
import { LIMITS, MAX_SECTION_NAME } from "../engine/song.ts";
import type { Ctx } from "./App.tsx";
import { Sheet } from "./components.tsx";
import { sectionLetter } from "./logic.ts";

export interface SectionSheetProps {
  ctx: Ctx;
  index: number;
  /** Advanced shows "Edit without playing". */
  advanced: boolean;
  /** The section edited without playing, or null when following. */
  chosen: number | null;
  onChoose: (i: number | null) => void;
  onClose: () => void;
}

/** Hold a section: rename, copy, add, delete, and (Advanced) edit it without playing. */
export function SectionSheet({ ctx, index, advanced, chosen, onChoose, onClose }: SectionSheetProps) {
  const { engine, song, playing, pos } = ctx;
  const s = song.sections[index];
  const [name, setName] = useState(s?.name ?? "");
  if (!s) return null;
  const full = song.sections.length >= LIMITS.sections[1];
  const last = song.sections.length <= LIMITS.sections[0];
  const busy = pos.playing && index === playing;
  const why = last ? "The only section can't be deleted." : busy ? "Switch away before deleting the playing section." : "";
  const editing = chosen === index;
  return (
    <Sheet onClose={onClose}>
      <h2>
        Section {sectionLetter(index)} · {s.name}
      </h2>
      <form
        class="rename"
        onSubmit={(e) => {
          e.preventDefault();
          if (engine.renameSection(index, name)) onClose();
        }}
      >
        <input
          id="section-name"
          value={name}
          maxLength={MAX_SECTION_NAME}
          aria-label="Section name"
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn" id="section-rename" disabled={!name.trim()}>
          Rename
        </button>
      </form>
      <div class="menu">
        {advanced && (
          <button
            class={`btn${editing ? " on" : ""}`}
            id="section-edit"
            disabled={index === playing}
            onClick={() => {
              onChoose(editing ? null : index);
              onClose();
            }}
          >
            {editing ? "Stop editing" : "Edit without playing"}
          </button>
        )}
        <button
          class="btn"
          id="section-copy"
          disabled={full}
          onClick={() => {
            if (engine.copySection(index) >= 0) onClose();
          }}
        >
          Copy
        </button>
        <button
          class="btn"
          id="section-add"
          disabled={full}
          onClick={() => {
            if (engine.addSection() >= 0) onClose();
          }}
        >
          Add section
        </button>
        <button
          class="btn danger"
          id="section-delete"
          disabled={last || busy}
          onClick={() => {
            if (engine.deleteSection(index)) onClose();
          }}
        >
          Delete
        </button>
        <button class="btn" id="section-close" onClick={onClose}>
          Close
        </button>
      </div>
      {full && <p class="note">Four sections is the most a song holds.</p>}
      {why && <p class="note">{why}</p>}
      {advanced && index === playing && <p class="note">This section is playing: edits reach it as you make them.</p>}
    </Sheet>
  );
}

/** Songs kept on the phone (G5): rename the open one, open another, start a new one, delete. */
export function SongsSheet({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { engine, keeper, song } = ctx;
  const [name, setName] = useState(song.name);
  const [list, setList] = useState<SongEntry[] | null>(null);
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const read = (): void => void keeper.list().then((l) => live && setList(l));
    read();
    const off = keeper.onChange(read);
    return () => {
      live = false;
      off();
    };
  }, [keeper]);
  const idle = keeper.idle();
  const act = async (fn: () => Promise<boolean>): Promise<void> => {
    setBusy(true);
    try {
      if (await fn()) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet onClose={onClose}>
      <h2>Songs</h2>
      <form
        class="rename"
        onSubmit={(e) => {
          e.preventDefault();
          if (engine.renameSong(name)) void keeper.flush().then(onClose);
        }}
      >
        <input
          id="song-name"
          value={name}
          maxLength={MAX_SONG_NAME}
          aria-label="Song name"
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
        />
        <button type="submit" class="btn" id="song-rename" disabled={!name.trim()}>
          Rename
        </button>
      </form>
      <div class="songlist">
        {(list ?? []).map((e) => (
          <button
            key={e.id}
            class={`btn song${e.id === keeper.id ? " on" : ""}`}
            data-song={e.id}
            aria-current={e.id === keeper.id}
            disabled={busy || (!idle && e.id !== keeper.id)}
            onClick={() => (e.id === keeper.id ? onClose() : void act(() => keeper.open(e.id)))}
          >
            <span>{e.id === keeper.id ? song.name : e.name}</span>
            <small>{new Date(e.updated).toLocaleDateString()}</small>
          </button>
        ))}
      </div>
      <div class="menu">
        <button class="btn" id="song-new" disabled={busy || !idle} onClick={() => void act(() => keeper.create())}>
          New song
        </button>
        <button
          class="btn danger"
          id="song-delete"
          disabled={busy || !idle}
          onClick={() => (sure ? void act(() => keeper.remove(keeper.id)) : setSure(true))}
        >
          {sure ? "Tap to delete" : "Delete song"}
        </button>
        <button class="btn" id="songs-close" onClick={onClose}>
          Close
        </button>
      </div>
      {!idle && <p class="note">Stop to open, add or delete a song.</p>}
      {sure && idle && <p class="note">Deletes “{song.name}” and its last take's log. The MP3s you saved stay.</p>}
      {!keeper.persistent && <p class="note">This browser cannot keep songs: they are lost when the page closes.</p>}
    </Sheet>
  );
}
