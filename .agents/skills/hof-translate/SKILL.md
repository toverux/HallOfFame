---
name: hof-translate
description: Translate the locale keys a feature added or reworded into every locale and prepare their Crowdin push. Use when en-US.json gained or changed keys, when a locale file lacks keys the source holds, or when a Crowdin push preview is wanted.
---

# Translating a feature's strings

A feature stays open until every locale file holds a translation of each key it added or reworded, pushed through Crowdin (the localization guideline in `CLAUDE.md`).
Six steps: the keys, the volunteers' pending work, the game's own names, one translator per locale, a cross-review with Codex, the push.
`<base>` throughout is the commit before the feature's first one.

## 1. The keys

```
git diff <base> -- HallOfFame/Locales/en-US.json
```

Every added or reworded key is owed to every locale.
A reworded key keeps a volunteer's translation only where the English lost or gained a clause with no change of meaning; a changed meaning is retranslated.
Removed keys are removed from every locale in the same change.

## 2. The volunteers' pending work

```
mise l10n:pull --base <base>
```

It lists Crowdin's current translation of each key, with author and date, where it differs from the working tree.
The volunteers' work sits on Crowdin until pulled: a translation written in the repo meanwhile would be pushed over theirs.
`--write` puts their text into the locale files, in source key order.
A volunteer string is fixed, never restyled: a wrong meaning, grammar, a typo, a placeholder, the file's form of address, a name the game spells otherwise.

## 3. The game's own names

Where a string names something the game names (a photo mode setting, an option, a season, an asset category), the translation reuses the game's word in that language, so the player finds the control.
Dump the game's dictionaries from the running game through the unity-devtools `eval` tool, one file per language, then set the active locale back:

```
var lm = Game.SceneFlow.GameManager.instance.localizationManager; lm.SetActiveLocale("de-DE"); System.IO.File.WriteAllText("Z:/tmp/hof-loc-de-DE.json", Newtonsoft.Json.JsonConvert.SerializeObject(lm.activeDictionary.entries)); lm.SetActiveLocale("en-US"); lm.activeLocaleId
```

`lm.GetSupportedLocales()` lists the languages; the file is an array of `{Key, Value}`; `Z:/` is the game's view of `/` under Proton.
Find each name's key in the English dump by its value, then read that key in every other dump.
The game ships no nl-NL and no pt-PT: `languages.md` says what those two borrow.

## 4. One translator per locale

One agent per locale, default model, in parallel, the briefing in the prompt:

- Where each string shows: the panel, what sits beside it, how narrow (a column header, a chip, a tooltip, a paragraph).
- The placeholders, verbatim, and what fills them (`{WHEN}` is a relative date the game supplies).
- The file's voice and terms: the agent reads the whole file first.
- The game's names from step 3, and the shared paragraph and the locale's section of [`languages.md`](languages.md).
- Idiomatic prose, not word-for-word English; the `humanizer:humanizer` skill over the longer strings; no dashes.
- Insert in source key order, after the key that precedes in en-US; edit nothing else.
- Report: parse and key count, and the choices worth a second look.

Done when every locale parses, holds the en-US key set in en-US order, every placeholder of every new key intact, and no straight quote or dash in new text: check it with a script, not by eye.

## 5. Cross-review with Codex

Every new string is read again by Codex, and discussed to agreement: [`codex-review.md`](codex-review.md) has the model probe, the commands and Codex's known quirks.
Probe the model before dispatching.
One Opus moderator per locale, in parallel, each with its own scratch directory; the moderator judges each finding on the merits, applies what is right, disputes the rest with reasons, and resumes the same Codex session until it has no open disagreement or conceded.
Volunteer strings go in with the errors-only rule of step 2.

Done when each moderator reports no open disagreement, and the step 4 check still passes.

## 6. The push

The guideline's two modes, previewed from a tree holding only that mode's edits (`git stash push -- <the other mode's files>` around the preview), the previews shown to the user, `--push` only on their explicit go-ahead:

- Approved, for a locale volunteers translate: today every locale but ja-JP and zh-HANT, whose files are machine translations from commit 3d59102.
- Unapproved and AI-flagged (`--no-approve`), for those two.
