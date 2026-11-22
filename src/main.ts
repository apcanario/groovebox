import "./style.css";
import { Engine, INSTRUMENTS, type InstrumentId, type LatencyHint } from "./engine/index.ts";

/** G1 test screen: play, section buttons, instrument toggles. The real shell comes in G2. */
const engine = new Engine();

const params = new URLSearchParams(location.search);
const hintParam = params.get("hint");
const hint: LatencyHint = hintParam === "interactive" || hintParam === "playback" ? hintParam : "balanced";

const COLORS: Record<InstrumentId, string> = {
  drums: "#ff6b6b",
  bass: "#2a9d8f",
  synth: "#6aa3c9",
  layer1: "#e9c46a",
  layer2: "#9b5de5",
};
const NAMES: Record<InstrumentId, string> = {
  drums: "Drums",
  bass: "Bass",
  synth: "Synth",
  layer1: "Layer 1",
  layer2: "Layer 2",
};

const song = engine.getSong();
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header>
    <h1>Groovebox</h1>
    <span class="tag">G1 · engine test</span>
  </header>

  <div class="top">
    <button id="play" class="play" aria-label="Play"><i></i></button>
    <div class="pill">
      <button id="bpm-down" aria-label="Slower">−</button>
      <div><b id="bpm">${song.bpm}</b><span>bpm</span></div>
      <button id="bpm-up" aria-label="Faster">+</button>
    </div>
    <div class="pill meter"><div><b id="bar">–</b><span>bar</span></div></div>
  </div>

  <div class="label">${song.key} ${song.mood} · section</div>
  <div class="sections">
    ${song.sections
      .map(
        (s, i) =>
          `<button class="layer" data-section="${i}" style="--c:var(--coral)">${String.fromCharCode(65 + i)}<small>${s.name}</small></button>`,
      )
      .join("")}
  </div>

  <div class="label">instruments in the playing section</div>
  <div class="insts">
    ${INSTRUMENTS.map(
      (id) => `<button class="layer" data-inst="${id}" style="--c:${COLORS[id]}">${NAMES[id]}</button>`,
    ).join("")}
  </div>

  <div id="xy" class="xy">
    <div class="hx"></div><div class="hy"></div><div class="dot"></div>
    <div class="ly">RESONANCE ↑</div><div class="lx">SYNTH CUTOFF →</div>
  </div>

  <label class="slider">
    <span>PUMP</span>
    <input id="pump" type="range" min="0" max="95" value="60">
  </label>

  <div class="diag">
    <div><span>buffer</span><b id="d-hint">${hint}</b></div>
    <div><span>sample rate</span><b id="d-sr">–</b></div>
    <div><span>output latency</span><b id="d-lat">–</b></div>
    <div><span>level</span><b id="d-level">–</b></div>
  </div>

  <div class="hints"${import.meta.env.MODE === "single" ? " hidden" : ""}>
    <p>If it crackles, reload with a larger buffer:</p>
    <div class="seg">
      <a href="?hint=interactive"${hint === "interactive" ? ' class="on"' : ""}>fast</a>
      <a href="?hint=balanced"${hint === "balanced" ? ' class="on"' : ""}>balanced</a>
      <a href="?hint=playback"${hint === "playback" ? ' class="on"' : ""}>safe</a>
    </div>
  </div>
`;

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

// ---- Render ------------------------------------------------------------------
function render(): void {
  const pos = engine.position();
  const pending = engine.pending();
  const on = engine.sectionOn(pos.section)!;
  document.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((b) => {
    const i = Number(b.dataset.section);
    b.classList.toggle("on", i === pos.section);
    b.classList.toggle("pending", pending.section === i);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-inst]").forEach((b) => {
    const id = b.dataset.inst as InstrumentId;
    b.classList.toggle("on", on[id]);
    b.classList.toggle("pending", pending.toggles.some((t) => t.section === pos.section && t.instrument === id));
  });
  $("#bar").textContent = pos.playing ? String(pos.bar + 1) : "–";
}
engine.onPosition(render);

// ---- Transport -------------------------------------------------------------
const playBtn = $<HTMLButtonElement>("#play");
let wakeLock: WakeLockSentinel | null = null;

async function keepAwake(on: boolean): Promise<void> {
  try {
    if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    // Wake lock is a convenience; ignore refusals.
  }
}

playBtn.addEventListener("click", async () => {
  if (engine.playing) {
    engine.stop();
    playBtn.classList.remove("on");
    void keepAwake(false);
    render();
    return;
  }
  playBtn.disabled = true;
  try {
    await engine.init(hint);
    applyXY();
    engine.setMix("pump", Number($<HTMLInputElement>("#pump").value) / 100);
    engine.play();
    playBtn.classList.add("on");
    void keepAwake(true);
    $("#d-sr").textContent = `${engine.info().sampleRate} Hz`;
  } catch (err) {
    $("#d-hint").textContent = `audio failed: ${String(err)}`;
  } finally {
    playBtn.disabled = false;
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && engine.playing) void keepAwake(true);
});

const setBpm = (delta: number): void => {
  engine.bpm = engine.bpm + delta;
  $("#bpm").textContent = String(engine.bpm);
};
$("#bpm-down").addEventListener("click", () => setBpm(-2));
$("#bpm-up").addEventListener("click", () => setBpm(2));

// ---- Sections and instruments ----------------------------------------------------
document.querySelectorAll<HTMLButtonElement>("[data-section]").forEach((b) => {
  b.addEventListener("click", () => {
    engine.switchSection(Number(b.dataset.section));
    render();
  });
});
document.querySelectorAll<HTMLButtonElement>("[data-inst]").forEach((b) => {
  b.addEventListener("click", () => {
    engine.toggleInstrumentInPlaying(b.dataset.inst as InstrumentId);
    render();
  });
});

// ---- XY pad: Synth filter ------------------------------------------------------------
const xy = $<HTMLDivElement>("#xy");
const patch = song.patches.synth;
let xyX = patch.cutoff;
let xyY = patch.resonance;

function applyXY(): void {
  xy.style.setProperty("--x", `${xyX * 100}%`);
  xy.style.setProperty("--y", `${(1 - xyY) * 100}%`);
  engine.setParam("synth", "cutoff", xyX);
  engine.setParam("synth", "resonance", xyY);
}

function onXY(e: PointerEvent): void {
  const r = xy.getBoundingClientRect();
  xyX = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  xyY = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
  applyXY();
}
xy.addEventListener("pointerdown", (e) => {
  xy.setPointerCapture(e.pointerId);
  onXY(e);
});
xy.addEventListener("pointermove", (e) => {
  if (xy.hasPointerCapture(e.pointerId)) onXY(e);
});
xy.style.setProperty("--x", `${xyX * 100}%`);
xy.style.setProperty("--y", `${(1 - xyY) * 100}%`);

$<HTMLInputElement>("#pump").addEventListener("input", (e) => {
  engine.setMix("pump", Number((e.target as HTMLInputElement).value) / 100);
});

// ---- Diagnostics (display only; nothing is scheduled from here) ------------------------
setInterval(() => {
  if (!engine.playing) return;
  const i = engine.info();
  $("#d-lat").textContent = i.outputLatencyMs ? `${i.outputLatencyMs} ms` : `${i.baseLatencyMs} ms (base)`;
  const db = engine.level();
  $("#d-level").textContent = Number.isFinite(db) ? `${db.toFixed(0)} dB` : "–";
}, 250);

render();

// Exposed for automated smoke tests.
(window as unknown as { __groovebox: Engine }).__groovebox = engine;
