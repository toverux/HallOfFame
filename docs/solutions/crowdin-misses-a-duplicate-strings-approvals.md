---
date: 2026-10-11
area: l10n/crowdin
symptoms:
  - '`GET /approvals?stringId=` returns nothing for a key whose translation shows approved'
  - '`mise l10n:push` previews `approve existing` again for a translation it already approved'
tags: [crowdin, approvals, duplicate-strings, l10n-push]
---

# Crowdin misses a duplicate string's approvals

## Problem

Two keys with the same English text, like `PLAYSET_KIND[Assets]` and another `Assets`, are one
string on Crowdin: the later one is a duplicate (`isDuplicate`, `masterStringId`). Asking whether
the duplicate is approved by its own string id answers no, even right after approving it.

## Root cause

Crowdin files a duplicate's approvals under its master string. `GET /approvals?stringId=<duplicate>`
lists the master's approvals filtered by the duplicate's id, so it finds none; the translation
itself is approved.

## Fix

Ask by translation, `GET /approvals?translationId=<id>`, where the question is whether one
translation is approved: `approvedTranslationId` in `.agents/scripts/crowdin-push-translations.ts`.
By string id the lookup holds only for a string that is not a duplicate; `search_strings` with the
`isDuplicate` and `masterStringId` fields tells which keys are.

## Prevention

Read a key's approval state by translation id, in the scripts and through the Crowdin MCP alike.
