---
name: hof-release
description: Release a new version of the mod: bump the version, rewrite the changelog from the commits, commit, tag, push, and publish the GitHub release.
disable-model-invocation: true
---

# Release a version

Nine steps run by hand — there is no release script — around one human gate: the user reviews the changelog before anything is committed.

## 1. Preflight

```
git switch main && git pull --rebase
git status -s
git tag --sort=-v:refname | head -1
git log --oneline <last-tag>..HEAD
```

The release commit goes on `main`, on a clean tree, at the pushed tip: the tag names that commit, and a pushed tag is not moved afterwards.
Stop and ask the user where the tree is dirty, the branch has diverged, or a tag for the version already exists.

Every pull in this procedure is `--rebase`, here and in step 2.
The repo keeps a linear history and this branch is `main`: a plain `git pull` over an unpushed local commit writes a `Merge branch 'main' of …` commit into the release range, which then has to be undone before the release commit lands on top.

## 2. Merge the pending Crowdin translations

Crowdin keeps its work in one open PR titled "New Crowdin updates", off the `l10n-main` branch:

```
gh pr list --state open --head l10n-main
gh pr merge <n> --squash --delete-branch --subject "feat(i18n): new Crowdin updates (#<n>)" --body ""
git pull --rebase
```

Go straight to the build where no such PR is open.

Squash, always, and set the subject by hand: GitHub would otherwise squash under the PR's own title, which carries no conventional-commit prefix (`git log --oneline --grep=Crowdin` shows the shape the repo keeps).
Deleting the branch is routine — Crowdin recreates it on its next sync.

The languages this brings in are changelog material; note them for step 5.

## 3. Build Release

```
mise build -c Release
```

The game must be closed: the build deploys over the assembly the game holds open.
Assume the game is closed, it will fail anyway if it's not. Then pause and warn the user.

## 4. Choose the version

`<year>.<feature>.<patch>`, read off the last tag:

- The current year is past the last tag's year → `<year>.0.0`.
- Some change in the log is a new capability the player can see → feature + 1, patch 0.
- Fixes, translations and internals only → patch + 1.

## 5. Rewrite the changelog

`HallOfFame/ChangeLog.md` is replaced whole: it carries this release's entries only, no version heading, because Paradox Mods and the GitHub release both render it as-is.

Read the full commit messages, bodies included — `git log <last-tag>..HEAD` — and rule on every commit in the range before writing: it earns a bullet, or it is invisible to the player.

The changelog carries **user-visible changes only** — whatever changes or improves what the player gets: a new capability, a different behavior or appearance, a fixed bug, a speed-up, a new translation.
Internal work is left out entirely, however large the diff: refactors, tests, docs, tooling, robustness the player cannot perceive.

Write for a player who has the mod installed and wants to know what is different in the game:

- One bullet per visible change, named in the player's terms rather than the code's.
- Commit type is a hint, not the rule: a `refactor` that removes a stutter earns a bullet, a `feat` that only adds a binding for later work does not.
- New or refreshed translations: one bullet naming the languages, thanking the translator by the handle the commit gives.
- Compatibility with a game version: its own bullet, players search for it.
- A release built around one theme may open with a bold headline and a paragraph, then the bullets — see `git show v2026.0.0:HallOfFame/ChangeLog.md`.

Read two or three past releases (`git show <tag>:HallOfFame/ChangeLog.md`) to match the voice — the voice, not the scope: older entries carry internal-only lines this skill leaves out.
Write plain UTF-8 with LF endings and `- ` bullets; earlier revisions carry a BOM, which the build strips on read, so dropping it changes nothing.

## 6. Gate: the user reviews

Show the version you chose and the changelog you wrote, then stop and wait.

The user edits `HallOfFame/ChangeLog.md` directly, so re-read it from disk when they hand back: their text, not yours, is what goes into the commit, the XML and the release body.

## 7. Bump the version in four places

- `HallOfFame/HallOfFame.csproj` — `<Version>` and `<FileVersion>`.
- `HallOfFame/UI/mod.json` — `version`.
- `HallOfFame/Properties/PublishConfiguration.xml` — `<ModVersion Value="…" />`, and the `<ChangeLog>` element's body, which is the changelog verbatim, its last line closed by `</ChangeLog>` with no newline between.

The csproj's `SetupAttributes` target pokes those two XML values from `<Version>` and `ChangeLog.md` on every build, so a later build would sync them anyway; writing them now keeps the tagged commit true without one.

## 8. Commit and push

```
git add HallOfFame/ChangeLog.md HallOfFame/HallOfFame.csproj HallOfFame/UI/mod.json HallOfFame/Properties/PublishConfiguration.xml
git commit -m "chore(release): version <version>"
git push
```

Invoking this skill is the express go-ahead the agent instructions commit boundary asks for.

## 9. Tag and publish the GitHub release

`gh release create` creates the tag itself, so there is no `git tag` to run:

```
gh release create "v<version>" --title "v<version>" --target "$(git rev-parse HEAD)" --notes-file HallOfFame/ChangeLog.md
git fetch --tags
```

`--target` pins the tag to the release commit, wherever `main` has moved since the push; the `v` prefix matches every tag in the repo; `git fetch --tags` brings the new tag back down so the local repo matches.

Report the release URL it prints.

Publishing to Paradox Mods stays the user's move: `mise publish` builds Release and uploads the new version, and needs the game closed. Close by telling them that is what is left.
