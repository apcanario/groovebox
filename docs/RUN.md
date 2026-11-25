# How a chat runs

Every build chat starts from the same two lines, which also resume a chat that stopped:

```
Clone apcanario/groovebox (shallow, push access).
Groovebox, next bundle. Thin main chat on Sonnet 5.5; every agent a fresh Opus 5.5 agent. Read docs/RUN.md and work the next open bundle of docs/BACKLOG.md in full, unattended.
```

Pedro may add a third line starting `Notes:` with what he heard on the phone.

## 1. The main chat is thin

- It runs on Sonnet 5.5. It records the model it actually ran as.
- It reads `CLAUDE.md`, this file, and the rows of the bundle in `docs/BACKLOG.md`. It does not read source files, the spec or review reports.
- One chat works one whole bundle, row by row, in order.
- It launches agents one at a time, each a fresh Agent on model `opus`, and reads only each agent's reply (six lines at most) and the output of the scripts.
- Scripts judge the result, not the chat: `npm run check` and `npm run smoke`. The smoke runs in parts (`PARTS` in `tools/smoke.py`: core, vibes, additions, effects, drop, morph, cost; morph plays ten minutes of Ambient), each in its own browser, in order, and passes only when every part is green. Each part that passes is recorded in `.smoke-ledger.json` against a fingerprint of `src/`, `public/`, `index.html`, `package.json`, `package-lock.json` and `tools/`; a failed or killed part leaves no record. If a restart kills the smoke, run `npm run smoke` again: on the same fingerprint it skips the parts already green and reruns the rest; any change to those files runs every part. `npm run smoke -- --fresh` ignores the ledger. `tools/smoke_parts.py` fails the smoke if a check sits in no part. Run one smoke at a time.
- If the session refuses to run the repo's scripts, stop, say so in one line and ask. Never work around it.
- Where a choice is open, take the most reasonable reading, record it under Choices in the changelog and carry on. Ask only if blocked. Pedro vetoes afterwards; he does not confirm beforehand.

## 2. Notes first

Before any row, handle what is waiting:

1. Pedro's `Notes:` line, if there is one.
2. The **Carried** list at the top of `docs/BACKLOG.md`.

Give both to the first builder as fixes to make before the row's own work. A note that is a matter of taste (too loud, too harsh, too busy) is a fix like any other. A note that contradicts `docs/SPEC.md` changes the spec: the builder edits the spec in the same commit and the changelog says so.

## 3. One row, three agents

For each row of the bundle, in order:

**Builder.** Prompt it with: the row id; "read `CLAUDE.md`, `docs/SPEC.md` and row <id> in `docs/BACKLOG.md`, then build the row in full"; the notes and carried items that apply; "run `npm run check` and `npm run smoke` until both pass, commit on `main` without pushing, reply in six lines or fewer: what was built, what was left out and why".

**Reviewer.** A new agent that has not seen the build. Prompt it with: the row id and the commit before the builder started; "read `CLAUDE.md`, `docs/SPEC.md` and the row, then review `git diff <base>..HEAD` against them; run `npm run check` and `npm run smoke`; write `docs/reviews/<row>.md` listing every finding as error, should-fix or minor, each with file, line and the fix; end with a verdict: pass, fix or rebuild; change no source file; reply in six lines or fewer with the verdict and the counts". The reviewer looks hardest at: anything in the row's Done-when list that is not true, spec rules broken (section 7 above all), stuck notes and clicks on parameter changes, controls smaller than 48 px, logic without tests.

**Fixer.** A new agent. "Read `docs/reviews/<row>.md` and apply every finding, minor ones included; where a finding is wrong, say why in the report instead; run both scripts until they pass; commit; reply in six lines or fewer."

- Verdict **rebuild:** discard the builder's commits (`git reset --hard <base>`), run a new builder with the review report as extra input, then review again. One rebuild per row. A second rebuild verdict stops the chat with a report.
- Verdict **pass** with no findings: skip the fixer.

## 4. Close the row

1. The chat runs `npm run check` and `npm run smoke` itself. Both must pass.
2. Update `docs/BACKLOG.md`: move the row to Done. Add anything found but not fixed to **Carried**, with the row it belongs to.
3. Update `README.md` as `CLAUDE.md` says: what the app does today, and the status table.
4. Add the row to `docs/CHANGELOG.md`: date, row, models that ran, what changed, script results, choices taken.
5. Commit and push `main`. Check the Pages deploy if the session can see it; if it cannot, say it is unverified.
6. Start the next row of the bundle. Each row is pushed before the next begins.

## 4b. Close the bundle

After the last row of the bundle is pushed, one more fresh agent, the **player**, checks the bundle as a whole on the final build. Prompt it with: the rows of the bundle; "read `CLAUDE.md`, the spec sections the bundle names and those rows; build; run `npm run check`, `npm run smoke` and, once it exists, `python3 tools/shots.py`; then go through every Done-when line of every row in the bundle again and say for each whether it is true now, looking at the screenshots for anything a script cannot judge (cut-off or wrapped text, a control under 48 px, a screen that differs from `docs/design/look/`); check that `README.md` describes what the app does now; write `docs/reviews/bundle-<n>.md` with every finding; change no source file; reply in six lines or fewer".

- Any finding goes to a fixer agent as in section 3, then the chat runs both scripts again and pushes.
- A finding that cannot be fixed in this chat goes to **Carried** with the row it belongs to.

## 4c. Keeping quality across a long chat

- A bundle has up to four rows and each row is three or four agents. The main chat stays thin so that this fits: it never reads source, the spec or a report.
- The reviewer checks that every Done-when line marked "(tested)" has a test that would fail if the line were false, and lists each one that does not as an error.
- From row P1 on, the reviewer of any row that changes a screen runs `python3 tools/shots.py` and looks at the screenshots.
- If the chat is running out of room, it stops after closing the current row (never mid-row), and gives the reply. The same starter resumes at the next row.
- A row is never skipped. If a row cannot be finished, the chat stops there and says why.

## 5. The reply

One reply at the end of the chat, in this order:

1. **Built:** per row, three lines at most.
2. **Review:** verdict and counts per row, how many findings were applied, and the player's result for the bundle.
3. **Choices:** each open choice taken, one line each, so Pedro can veto.
4. **Listen for:** three to five specific things to try on the phone, each a thing he can hear or feel. This is the only test that matters.
5. **For Pedro by hand:** only what no agent can do. Repeat every open item from the backlog's By-hand list until he says it is done.
6. **Next:** always the last thing in the reply, never left out, also when the chat stopped early. One line naming the next open bundle and what it builds, then the starter in a code block with an empty third line `Notes:` for Pedro to fill. Everything the next chat must fix is already in the backlog's Carried list, so the starter never changes. When every row before G7 is Done, the next bundle is G7 Retouch, and the line says it needs his notes to run.

## 6. When to leave this model

Building a row from the spec does not need Fable. Use a Fable chat only when the spec itself has to change shape: a new instrument, a different screen model, a new way of generating notes. That chat rewrites `docs/SPEC.md` and the backlog rows, and builds nothing.
