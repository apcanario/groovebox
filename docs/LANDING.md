# Landing the plan

This file exists only on the branch `plan`. It tells one fresh Opus agent, the **lander**, how to put the phase 2 and 3 plan onto `main`. The main chat reads nothing but this heading and the last section; it launches the lander with "follow `docs/LANDING.md` on `origin/plan` to the letter; reply in six lines or fewer".

The branch `plan` is one commit on top of `main` as it was at `ffc6939` (bundles 1 to 3 built, G5 not started). `main` has moved since: the G5 chat changed some of the same documents. A shallow clone cannot merge the two branches, so the landing is done file by file.

## 1. Fetch

```
git fetch --depth=1 origin plan
```

Do not run `git merge`. If `README.md` already exists on `main` with a line reading "Landed: plan", the plan is already landed: stop and say so.

## 2. Files that are new on the plan

Take them as they are:

```
git checkout origin/plan -- README.md docs/archive docs/design/look docs/design/phase2 tools/landed.py docs/landing-base
```

If `main` already has a `README.md`, keep the plan's version and move anything `main`'s said that the plan's does not into the plan's "What it does today".

## 3. Files both sides changed

For each of `docs/SPEC.md`, `docs/BACKLOG.md`, `docs/CHANGELOG.md`, `docs/RUN.md` and `CLAUDE.md`, do a three-way merge. The common base is in `docs/landing-base/`:

```
git show origin/plan:docs/SPEC.md > /tmp/plan-SPEC.md
git merge-file docs/SPEC.md docs/landing-base/SPEC.md /tmp/plan-SPEC.md
```

(and the same for the others; `CLAUDE.md`'s base is `docs/landing-base/CLAUDE.md`). `git merge-file` exits with the number of conflicts and leaves markers. Resolve every one by these rules:

- **`docs/SPEC.md`:** keep everything the plan added (sections 8 and 9, the "No samples" lines). Keep anything G5 changed in sections 1 to 7. Where both changed the same line, keep G5's fact and the plan's rule, written as one line.
- **`docs/BACKLOG.md`:** the plan's bundle table and bundles 4 to 9 stay exactly as the plan has them. From `main` keep: every Carried item, every By-hand item, and the Done list. If `main` shows G5 as Done, delete the plan's "## Save and record" section and make sure G5 is in Done with `main`'s wording. If G5 is not Done on `main`, keep that section as it is. Row G6 lives in bundle 7 only; remove any other copy.
- **`docs/CHANGELOG.md`:** keep every line from both sides, newest first.
- **`docs/RUN.md`** and **`CLAUDE.md`:** the plan's version, plus any line `main` added that the plan does not have.

## 4. Finish

1. If G5 is Done on `main`: in `README.md`, move saving, recording and MP3 export from "Being built now" into "What it does today", and set G5 to Done in the status table. Write what G5 actually built, from `main`'s changelog line, not from the plan.
2. Add the line `Landed: plan` as the last line of `README.md`, after a blank line.
3. Delete `docs/landing-base/`. Do not copy `docs/LANDING.md` to `main`.
4. Add one line to `docs/CHANGELOG.md`: the date, "Plan landed, no row", the model, "Phase 2 and 3 plan (spec sections 8 and 9, bundles 4 to 9, README, archive, mockups) merged onto main after G5", and how many conflicts were resolved by hand.
5. Run `python3 tools/landed.py`. It must print `LANDED`. Then `npm ci`, `npm run check`, `npm run smoke`. All must pass.
6. Commit as "Land the phase 2 and 3 plan" and push `main`.

## For the main chat

After the lander replies, run `python3 tools/landed.py` yourself. If it prints `LANDED`, carry on with `docs/RUN.md` and the next open bundle (bundle 4). If it does not, stop and report its output; do not start a bundle on a half-landed plan.
