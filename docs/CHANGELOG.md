# Changelog

Newest first. One entry per row: date, row, the model that actually ran, what changed, checks, choices taken.

| Date | Row | Models | What changed | Checks | Choices |
|---|---|---|---|---|---|
| 22 Nov 2026 | Spec change, no row | Fable 5.2 main chat | Pedro heard the spike on Pages: works, slight treble crackle (carried as C1). Spec: section switches and instrument on/off now land together on the next bar line, with a pending state in the UI. Backlog: G1 and G2 updated, bundle 5 (G7 Retouch) added for post-MVP notes. | Docs only. | None. |
| 22 Nov 2026 | G0 Sound spike | Fable 5.2 main chat, no agents | Repo set up (Vite, TypeScript, Tone.js 15.1), Pages workflow, one-page spike: kick, hats, clap, bass with sub, chord stabs, pad, lead, shared reverb and delay, sidechain pump, limiter, layer mutes, XY filter pad, bpm, diagnostics. `tools/smoke.py` added. Spec, run model and backlog written. | `check` pass, `smoke` pass (master -26 to -8 dB, all 7 layers audible). Not yet heard by Pedro. | Layer levels set by meter, not by ear. Buffer size selectable with `?hint=`. |
