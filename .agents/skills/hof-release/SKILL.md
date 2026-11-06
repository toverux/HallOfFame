---
name: hof-release
description: Release a new version of the mod: choose the version, rewrite the changelog from the commits, commit, push, and publish the GitHub release.
disable-model-invocation: true
---

# Release a version

Steps run by hand, around one human gate: the user reviews the changelog before anything is committed.
The csproj's `<Version>` is the one version source; the build copies it, [`ChangeLog.md`](../../../HallOfFame/ChangeLog.md) and [`LongDescription.md`](../../../HallOfFame/LongDescription.md) into [`PublishConfiguration.xml`](../../../HallOfFame/Properties/PublishConfiguration.xml).
Invoking this skill is the express go-ahead the commit boundary in `AGENTS.md` asks for.

## 1. Preflight

```
git switch <default branch> && git pull --rebase
git status -s
git describe --tags --abbrev=0
git log --oneline <last tag>..HEAD
```

The release commit goes on the default branch, on a clean tree, at the pushed tip: the tag names that commit, and a pushed tag is not moved afterwards.
Stop and ask the user where the tree is dirty, the branch has diverged, or a tag for the version already exists.
With no tag yet, this is the first release: its range is the whole history.

Every git pull in this procedure is `--rebase`: a plain `git pull` over an unpushed local commit writes a merge commit into the release range.

## 2. Pull the pending Crowdin translations and credit their translators

Only when Crowdin is set up (`CROWDIN_PROJECT_ID` in `mise.toml`'s `[env]` holds a project ID); otherwise go to step 3.
Nothing syncs Crowdin to the repo on its own: volunteers' work arrives when it is pulled, and a release is when.

```
mise l10n:pull --all
mise l10n:pull --all --write
git diff --stat HallOfFame/Locales
```

The preview names each changed string's translator and date; read it before writing, since a pull takes Crowdin's current text whole, a volunteer's fix and a volunteer's regression alike.

Then bring the translators credited in `LongDescription.md` up to date from Crowdin's top-members report, in unit strings over the project's whole life, per target language (the project's Reports page, or the Crowdin MCP's `generate_report_top_members` where installed): the list holds, alphabetically under each language, the members with at least one translation still the current one there. Add the missing, drop those left with none; a removed user has no name to credit.
toverux stays under French alone, its other languages holding the AI translations it pushed; Andeeta is ThemisC2's second account, already listed.
The first release with volunteer translations starts that list, under a heading of its own at the end of the description.

Commit the pulled files and the list on their own, before the release commit: as `feat(i18n): new Crowdin translations` where the pull changed files, the body naming the languages and the translators' handles; as `docs: update the translators credited in the mod description` where only the list changed.
Those languages and handles are changelog material; note them for step 5.

## 3. Build Release

```
mise build -c Release
```

The game must be closed: the build deploys over the assembly the game holds open.
Assume it is closed; if the build fails on the locked file, pause and ask the user to close the game.

## 4. Choose the version

`<year>.<feature>.<patch>`, read off the last tag:

- The current year is past the last tag's year → `<year>.0.0`.
- Some change in the log is a new capability the player can see → feature + 1, patch 0.
- Fixes, translations and internals only → patch + 1.

The first release keeps the csproj's version.

## 5. Rewrite the changelog

`ChangeLog.md` is replaced whole: it carries this release's entries only, no version heading, because Paradox Mods and the GitHub release both render it as-is.

Read the full commit messages, bodies included (`git log <last tag>..HEAD`), and rule on every commit in the range before writing: it earns a bullet, or it is invisible to the player.

The changelog carries **user-visible changes only**: whatever changes or improves what the player gets, a new capability, a different behaviour or appearance, a fixed bug, a speed-up, a new translation.
Internal work is left out entirely, however large the diff: refactors, tests, docs, tooling, robustness the player cannot perceive.

Write for a player who has the mod installed and wants to know what is different in the game:

- One bullet per visible change, named in the player's terms rather than the code's.
- Commit type is a hint, not the rule: a `refactor` that removes a stutter earns a bullet, a `feat` that only adds a binding for later work does not.
- New or refreshed translations: one bullet naming the languages, thanking the translators by the handles step 2 noted.
- Compatibility with a game version: its own bullet, players search for it.
- A release built around one theme may open with a bold headline and a paragraph, then the bullets.

Read two or three past releases (`git show <tag>:HallOfFame/ChangeLog.md`) to match the voice, not the scope: older entries carry internal-only lines this skill leaves out.
Write plain UTF-8 with LF endings and `- ` bullets.

## 6. Gate: the user reviews

Show the version you chose and the changelog you wrote, then stop and wait.

The user edits `ChangeLog.md` directly, so re-read it from disk when they hand back: their text, not yours, is what goes into the commit, the publish configuration and the release body.

## 7. Bump the version

Set `<Version>` in [`HallOfFame.csproj`](../../../HallOfFame/HallOfFame.csproj), then copy it and the changelog into the publish configuration without a build:

```
dotnet msbuild HallOfFame/HallOfFame.csproj -t:PokePublishConfiguration
git diff HallOfFame/Properties/PublishConfiguration.xml
```

The diff shows the new `ModVersion` and the changelog as `<ChangeLog>` text, so the tagged commit is true without the next build.

## 8. Commit and push

```
git add HallOfFame/ChangeLog.md HallOfFame/HallOfFame.csproj HallOfFame/Properties/PublishConfiguration.xml
git commit -m "chore(release): version <version>"
git push
```

## 9. Tag and publish the GitHub release

`gh release create` creates the tag itself, so there is no `git tag` to run:

```
gh release create "v<version>" --title "v<version>" --target "$(git rev-parse HEAD)" --notes-file HallOfFame/ChangeLog.md
git fetch --tags
```

`--target` pins the tag to the release commit, wherever the branch has moved since the push; `git fetch --tags` brings the new tag back down so the local repo matches.

Report the release URL it prints.

Publishing to Paradox Mods stays the user's move: `mise publish` builds Release and uploads the new version, and needs the game closed. Close by telling them that is what is left.
