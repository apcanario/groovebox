/** Unit test entry: `node tests/run.ts`. Lists every test file; exits non-zero on any failure. */
import { run } from "./harness.ts";
import "../src/music/music.test.ts";
import "../src/engine/engine.test.ts";

declare const process: { exitCode?: number };
process.exitCode = run() > 0 ? 1 : 0;
