import "./style.css";
import { Engine, LAYERS, type LatencyHint, type LayerId } from "./engine";

const engine = new Engine();

const params = new URLSearchParams(location.search);
const hintParam = params.get("hint");
const hint: LatencyHint = hintParam === "balanced" || hintParam === "playback" ? hintParam : "interactive";

const COLORS: Record<LayerId, string> = {
  kick: "#ff6b6b",
  hats: "#e9c46a",
  clap: "#f4a261",
  bass: "#2a9d8f",
  chords: "#6aa3c9",
  pad: "#9b5de5",
  lead: "#ff6b6b",
};

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header>
    <h1>Groovebox</h1>
    <span class="tag">step 0 · sound spike</span>
  </header>

  <div class="top">
    <button id="play" class="play" aria-label="Play"><i></i></button>
    <div class="pill">
      <button id="bpm-down" aria-label="Slower">−</button>
      <div><b id="bpm">122</b><span>bpm</span></div>
      <button id="bpm-up" aria-label="Faster">+</button>
    </div>
    <div class="pill meter"><div><b id="level">–</b><span>dB</span></div></div>
  </div>

  <div class="layers">
    ${LAYERS.map(
      (id) => `<button class="layer on" data-layer="${id}" style="--c:${COLORS[id]}">${id}</button>`,
    ).join("")}
  </div>

  <div id="xy" class="xy">
    <div class="hx"></div><div class="hy"></div><div class="dot"></div>
    <div class="ly">RESONANCE ↑</div><div class="lx">CHORD CUTOFF →</div>
  </div>

  <label class="slider">
    <span>PUMP</span>
    <input id="pump" type="range" min="0" max="95" value="60">
  </label>

  <div class="diag">
    <div><span>buffer</span><b id="d-hint">${hint}</b></div>
    <div><span>sample rate</span><b id="d-sr">–</b></div>
    <div><span>output latency</span><b id="d-lat">–</b></div>
    <div><span>worst UI stall</span><b id="d-stall">–</b></div>
    <div><span>playing for</span><b id="d-time">0:00</b></div>
  </div>

  <p class="hints">If it crackles, reload with a larger buffer:
    <a href="?hint=interactive">fast</a> · <a href="?hint=balanced">balanced</a> · <a href="?hint=playback">safe</a>
  </p>
`;

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

// ---- Transport -------------------------------------------------------------
const playBtn = $<HTMLButtonElement>("#play");
let startedAt = 0;
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
    return;
  }
  playBtn.disabled = true;
  try {
    await engine.init(hint);
    applyXY();
    engine.setPump(Number($<HTMLInputElement>("#pump").value) / 100);
    engine.play();
    startedAt = performance.now();
    worstStall = 0;
    playBtn.classList.add("on");
    void keepAwake(true);
    const i = engine.info();
    $("#d-sr").textContent = `${i.sampleRate} Hz`;
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
  const current = Number($("#bpm").textContent);
  const next = Math.max(80, Math.min(180, current + delta));
  $("#bpm").textContent = String(next);
  engine.bpm = next;
};
$("#bpm-down").addEventListener("click", () => setBpm(-2));
$("#bpm-up").addEventListener("click", () => setBpm(2));

// ---- Layer mutes -----------------------------------------------------------
document.querySelectorAll<HTMLButtonElement>(".layer").forEach((btn) => {
  btn.addEventListener("click", () => {
    const on = btn.classList.toggle("on");
    engine.setLayer(btn.dataset.layer as LayerId, on);
  });
});

// ---- XY pad ----------------------------------------------------------------
const xy = $<HTMLDivElement>("#xy");
let xyX = 0.6;
let xyY = 0.2;

function applyXY(): void {
  xy.style.setProperty("--x", `${xyX * 100}%`);
  xy.style.setProperty("--y", `${(1 - xyY) * 100}%`);
  engine.setFilter(xyX, xyY);
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
  engine.setPump(Number((e.target as HTMLInputElement).value) / 100);
});

// ---- Diagnostics -----------------------------------------------------------
// A stalled main thread is what makes scheduled notes arrive late, so track the worst gap.
let worstStall = 0;
let lastTick = performance.now();
setInterval(() => {
  const now = performance.now();
  const stall = now - lastTick - 50;
  lastTick = now;
  if (engine.playing && stall > worstStall) worstStall = stall;
}, 50);

setInterval(() => {
  if (!engine.playing) return;
  const secs = Math.floor((performance.now() - startedAt) / 1000);
  $("#d-time").textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  $("#d-stall").textContent = `${Math.round(worstStall)} ms`;
  const i = engine.info();
  $("#d-lat").textContent = i.outputLatencyMs ? `${i.outputLatencyMs} ms` : `${i.baseLatencyMs} ms (base)`;
  const db = engine.level();
  $("#level").textContent = Number.isFinite(db) ? db.toFixed(0) : "–";
}, 250);

// Exposed for automated smoke tests.
(window as unknown as { __groovebox: Engine }).__groovebox = engine;
