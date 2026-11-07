---
name: hof-translate
description: Translate the locale keys a change added, reworded or removed into the mod's other 13 locales. Use whenever en-US.json changes, when a locale file lacks keys the source holds, or when a Crowdin pull or push is wanted.
---

# Translating the mod's strings

Every change to [`en-US.json`](../../../HallOfFame/Locales/en-US.json) reaches the other 13 locale files of [`Locales/`](../../../HallOfFame/Locales) in the same change: a key added or reworded is translated, a key removed is removed.
The files are flat JSON, keyed `HallOfFame.<Area>.<KEY>` for the mod's own strings and in the game's formats for its settings (`Options.OPTION[…]`); the `cs2-modding` skill's localization reference holds those formats, the `{KEY=…}` references and the placeholders.

**Crowdin** is set up when `CROWDIN_PROJECT_ID` in `mise.toml`'s `[env]` holds a project ID: volunteers then translate on Crowdin, and steps 2 and 7 apply. Without it, skip them.

`<base>` throughout is the commit before the change's first one, `HEAD` for a change not yet committed.

## 1. The keys

```
git diff <base> -- HallOfFame/Locales/en-US.json
```

Every added or reworded key is owed to every locale.
The source follows the en-US section of [`languages.md`](languages.md) too: fix its typography here, before it is translated.
A reworded key keeps its translation only where the English lost or gained a clause with no change of meaning; a changed meaning is retranslated.

## 2. The volunteers' pending work (Crowdin)

```
mise l10n:pull --base <base>
```

It lists Crowdin's current translation of each key, with author and date, where it differs from the working tree.
The volunteers' work sits on Crowdin until pulled: a translation written in the repo meanwhile would be pushed over theirs.
`--write` puts their text into the locale files, in source key order.
Commit what it wrote on its own, as `feat(i18n): new Crowdin translations`, with the user's go-ahead, before translating anything: step 7 pushes every locale edit since its `--base` as the agent's, and takes this commit as that base.
Where the user declines the commit, stop before step 7 and tell them why: the pulled text shares the locale files with the agent's edits, and the push cannot leave it out.
A volunteer string is fixed, never restyled: a wrong meaning, grammar, a typo, a placeholder or a `<…>` span, typography, the file's form of address, a game term written otherwise.

## 3. The game's terms

Where a string points the player at something the game names (a menu, a tool, an info view, a setting, a building category), the translation uses the game's term in that language as the game writes it, so the player finds it.
Only the term binds, never the game's practice: [`languages.md`](languages.md) draws the line.

The game's dictionaries ship in `$CSII_INSTALLATIONPATH/Cities2_Data/Content/Game/Locale.cok`, a zip of one `<locale>.loc` per language; a `.loc` is a .NET `BinaryWriter` stream: a `ushort` version, three strings (system language, locale ID, localized name), an `int` count, then that many key and value strings, each string 7-bit-length-prefixed UTF-8.
Decode it with a script into one JSON per language.
Without the file, with the game running, dump them through the unity-devtools `eval` tool instead, one file per language, then set the active locale back:

```
var lm = Game.SceneFlow.GameManager.instance.localizationManager; var active = lm.activeLocaleId; lm.SetActiveLocale("de-DE"); System.IO.File.WriteAllText("<dir>/game-loc-de-DE.json", Newtonsoft.Json.JsonConvert.SerializeObject(lm.activeDictionary.entries)); lm.SetActiveLocale(active); lm.activeLocaleId
```

`lm.GetSupportedLocales()` lists the languages; the file is an array of `{Key, Value}`; under Proton, `<dir>` is a Windows path and `Z:/` is the Linux `/`.
Find each term's key in the English dump by its value, then read that key in every other dump.
A string that only needs the game's term can reference it instead, `{KEY=<the game's key>}`, which follows the game's translation everywhere.
The game ships no nl-NL and no pt-PT: [`languages.md`](languages.md) says what those two borrow.

## 4. One translator per locale

One agent per locale, default model, in parallel, the briefing in the prompt:

- Where each string shows: the panel, what sits beside it, how narrow (a column header, a button, a tooltip, a paragraph).
- The placeholders and `<…>` spans, verbatim, and what fills or shows them.
- The file's voice and terms: the agent reads the whole file first.
- The game's terms from step 3, and three parts of [`languages.md`](languages.md) pasted whole: Every locale, the locale's section, and the locale's section under This mod's locale files.
- Idiomatic prose, not word-for-word English; the `humanizer` skill over the longer strings.
- Insert in source key order, after the key that precedes in en-US; edit nothing else.
- Report: parse and key count, and the choices worth a second look.

Done when every locale parses and holds the en-US key set in en-US order, and a script, not an eye, passes every new or reworded string, en-US's included:

- its `{…}` tokens are the source's, byte for byte, as many of each;
- it holds as many `<…>` spans as the source;
- outside `{…}`, no straight ' or ", no three dots, no em dash, en dash or spaced hyphen;
- no character a **Banned** line of [`languages.md`](languages.md) lists, under Every locale or under its own locale;
- fr-FR: U+00A0 before : ; ? ! and inside « », never a plain space or none, "Cities: Skylines II" aside;
- ja-JP, zh-HANS, zh-HANT: no half-width , : ; ! ? ( ) touching their own script.

## 5. Cross-review

Every new string is read again by a second model and discussed to agreement.
With the `codex` CLI installed (`codex --version` answers), the reviewer is Codex: [`codex-review.md`](codex-review.md) has the model probe, the commands and Codex's known quirks; probe the model before dispatching.
Without it, the reviewer is a fresh agent per locale, briefed as in step 4.
One moderator agent per locale, in parallel, each with its own scratch directory; the moderator judges each finding on the merits, applies what is right, disputes the rest with reasons, and resumes the same reviewer until it has no open disagreement or conceded.
Volunteer strings go in with the errors-only rule of step 2.

Done when each moderator reports no open disagreement, and the step 4 check still passes.

## 6. Preview in the game

Where a string's room is in doubt (a button, a header, a narrow panel), see it in the running game before the next build: push it into the live dictionary through the unity-devtools `eval` tool, then raise the change event the UI listens to.

```
var lm = Game.SceneFlow.GameManager.instance.localizationManager; lm.activeDictionary.Add("<key>", "<value>", false); typeof(Colossal.Localization.LocalizationManager).GetMethod("NotifyActiveDictionaryChanged", (System.Reflection.BindingFlags)36).Invoke(lm, null)
```

It holds until the game restarts; the locale file stays the source.
`lm.SetActiveLocale("<locale>")` shows another language.

## 7. The push (Crowdin)

Run `mise l10n:push --base <base>` and show its preview to the user; add `--push` only on their explicit go-ahead.
It adds each translation unapproved and AI-flagged, so proofreaders see it as text to review and a volunteer's later suggestion wins the export.
Where the string already holds an approved translation, a volunteer's or a reworded key's old one, it approves the edit instead, since the approved text wins the export and the next pull would revert the edit; the preview names each of those keys, `over approved #<id>`.

The script diffs `--base` against the working tree: where step 2 made a pull commit, pass that commit as `--base` in place of `<base>`, since a base reaching back across a pull commit pushes volunteers' translations as though they were the agent's.
