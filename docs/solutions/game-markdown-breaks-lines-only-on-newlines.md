---
date: 2026-09-14
area: UI
symptoms:
  - '`<br>` in a screenshot description renders as a space, not a line break'
  - 'A class passed in a `FormattedText` or `FormattedParagraphs` theme drops the vanilla styling of that element'
tags: [cs2-ui, markdown, formatted-text, cohtml, theme]
---

# The game's markdown breaks lines only on newlines

## Problem

Creator text rendered through the game's `MarkdownRenderer` and `FormattedParagraphs` breaks a line
only on a newline: a `<br>` reads as a space. A class passed in either component's theme also
replaces the vanilla class instead of joining it.

## Root cause

The markdown renderer turns each `<br>` into a `br` element (`index.js:43067`, `index.js:43081`),
and in Cohtml, where every element lays out as a flex box, a `br` breaks nothing.
`FormattedParagraphs` splits its text on newlines and renders each non-blank line as a paragraph of
its own (`index.js:37804`), which is the break that works.

Themes spread over the vanilla class map, `{ ...vanillaTheme, ...theme }` (`index.js:37758`), so
each key passed replaces that element's vanilla class.

## Fix

Write line breaks as newlines. To style an element on top of the game's look, concatenate the mod
class onto the vanilla one (`game-ui/common/text/formatted-text.module.scss`, `classes`);
substitute only where dropping the vanilla rules is the point.

## Prevention

Copy that tells creators which formatting works names the newline, not `<br>`.
