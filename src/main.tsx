import "./style.css";
import { render } from "preact";
import { Engine, type LatencyHint } from "./engine/index.ts";
import { App } from "./ui/App.tsx";

const engine = new Engine();
const hintParam = new URLSearchParams(location.search).get("hint");
const hint: LatencyHint = hintParam === "interactive" || hintParam === "playback" ? hintParam : "balanced";

render(<App engine={engine} hint={hint} />, document.querySelector<HTMLDivElement>("#app")!);

// Exposed for automated smoke tests.
(window as unknown as { __groovebox: Engine }).__groovebox = engine;
