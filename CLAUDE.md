# Groovebox

A phone groovebox for Pedro: a web app (later wrapped in an APK) for jamming deep house, chill techno and simple drum and bass. One user, one phone, headphones.

## Read first
- `docs/SPEC.md` is what the app is. Decisions there are settled; do not reopen them.
- `docs/RUN.md` is how a chat works a row. Follow it.
- `docs/BACKLOG.md` is the queue. `docs/CHANGELOG.md` is the record.

## Stack
TypeScript, Vite, Tone.js. Preact from row G2. No other runtime dependency without a line in the changelog saying why.

## Commands
- `npm ci` installs.
- `npm run check` type-checks and builds (from G1 it also runs the unit tests). It must pass before any commit.
- `npm run smoke` builds, then plays the app in headless Chrome and checks that every layer makes sound. It must pass before any push.
- `npm run dev` serves locally.

## Rules
- Work on `main`. A push to `main` deploys to GitHub Pages.
- Never push with `check` or `smoke` failing.
- Every push that changes the app also updates `docs/BACKLOG.md` and `docs/CHANGELOG.md` in the same commit. Backlog: done rows leave the queue, nothing is worked that is not a row, Carried holds every known fix. Changelog: one line per row, newest first, no essays.
- The smoke test proves sound comes out. It cannot judge how it sounds. Only Pedro's ears do that, so never claim a sound is good.
- All audio code sits behind the engine layer in `src/engine/`. UI code never imports Tone.js.
- Every random choice comes from the seeded generator, never `Math.random()`.
- Phone first: portrait, one thumb, controls at least 48 px, no hover states.
- Tone: direct. No flattery, no filler.
