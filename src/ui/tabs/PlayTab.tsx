/** Play tab (spec section 5): instruments by sections. Switches land on the next bar line. */
import { useEffect, useState } from "preact/hooks";
import { MAX_SONG_NAME, type SongEntry } from "../../store/library.ts";
import { INSTRUMENTS, LIMITS, MAX_SECTION_NAME, type InstrumentId } from "../../engine/song.ts";
import type { Ctx } from "../App.tsx";
import { Sheet, useLongPress } from "../components.tsx";
import { sectionLetter } from "../logic.ts";
import { INST_COLOR, INST_NAME } from "../theme.tsx";

function ColumnHeader({ ctx, i, onMenu }: { ctx: Ctx; i: number; onMenu: (i: number) => void }) {
  const { song, playing, pending, edit } = ctx;
  const press = useLongPress(
    () => ctx.engine.switchSection(i),
    () => onMenu(i),
  );
  const s = song.sections[i];
  const queued = pending.section === i;
  return (
    <button
      class={`colhead${i === playing ? " playing" : ""}${queued ? " pending" : ""}${i === edit ? " edit" : ""}`}
      data-col={i}
      aria-label={`Switch to section ${sectionLetter(i)} ${s.name}; hold for options`}
      {...press}
    >
      <b>{sectionLetter(i)}</b>
      <span>{s.name}</span>
    </button>
  );
}

function SectionMenu({ ctx, index, onClose }: { ctx: Ctx; index: number; onClose: () => void }) {
  const { engine, song, playing, pos } = ctx;
  const s = song.sections[index];
  const [name, setName] = useState(s?.name ?? "");
  if (!s) return null;
  const full = song.sections.length >= LIMITS.sections[1];
  const last = song.sections.length <= LIMITS.sections[0];
  const busy = pos.playing && index === playing;
  const why = last ? "The only section can't be deleted." : busy ? "Switch away before deleting the playing section." : "";
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
    </Sheet>
  );
}

/** Songs kept on the phone (G5): rename the open one, open another, start a new one, delete. */
function SongsSheet({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
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

export function PlayTab({ ctx }: { ctx: Ctx }) {
  const { engine, song, pending, playing } = ctx;
  const [menu, setMenu] = useState<number | null>(null);
  const [songs, setSongs] = useState(false);
  const cols = song.sections.length;
  const isPending = (sec: number, id: InstrumentId): boolean =>
    pending.toggles.some((t) => t.section === sec && t.instrument === id);
  return (
    <section class="playtab">
      <button class="btn songbar" id="songs-open" aria-label={`Song ${song.name}: open the song list`} onClick={() => setSongs(true)}>
        <span>Song</span>
        <b>{song.name}</b>
      </button>
      <div class="grid" style={{ gridTemplateColumns: `76px repeat(${cols}, 1fr)` }}>
        <div class="corner">hold a column for options</div>
        {song.sections.map((_, i) => (
          <ColumnHeader key={i} ctx={ctx} i={i} onMenu={setMenu} />
        ))}
        {INSTRUMENTS.map((id) => [
          <button key={id} class="rowhead" data-row={id} style={{ "--c": INST_COLOR[id] }} onClick={() => ctx.goTab(id)}>
            {INST_NAME[id]}
          </button>,
          ...song.sections.map((s, i) => {
            const p = isPending(i, id);
            return (
              <button
                key={`${id}${i}`}
                class={`cell${s.on[id] ? " on" : ""}${p ? " pending" : ""}${i === playing ? " live" : ""}`}
                style={{ "--c": INST_COLOR[id] }}
                data-cell={`${i}:${id}`}
                aria-pressed={s.on[id]}
                aria-label={`${INST_NAME[id]} in section ${sectionLetter(i)}: ${s.on[id] ? "on" : "off"}${p ? ", switching on the next bar" : ""}`}
                onClick={() => engine.toggleInstrument(i, id)}
              />
            );
          }),
        ])}
      </div>
      {cols < LIMITS.sections[1] && (
        <button class="btn wide" id="add-section" onClick={() => engine.addSection()}>
          + Add section
        </button>
      )}
      {songs && <SongsSheet ctx={ctx} onClose={() => setSongs(false)} />}
      {menu !== null && <SectionMenu ctx={ctx} index={menu} onClose={() => setMenu(null)} key={menu} />}
    </section>
  );
}
