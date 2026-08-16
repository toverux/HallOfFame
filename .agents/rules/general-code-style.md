---
version: 2.0.0
paths:
  - '**/*'
---

# General Code Style

Language-agnostic style rules.
Apply every rule to all code you write or edit.

## Formatting

- Let code breathe: separate logical blocks, and variable assignment from usage, with single blank lines (never consecutive).
- Break every `{}` block across multiple lines, even a short one.
- Max 4 parameters per function; beyond that, group them into an object.
  Symmetry with neighboring code beats this rule.
- Carrier decides em dashes (—): prose documents (Markdown, text docs, specs, changelogs) allow them, sparingly; source code forbids them, comments and docblocks included.
  In code, punctuate with commas, semicolons, colons, or `--` (sparingly) instead.
- Strict 100-character line limit in source files, comments and docblock decoration included.
  Exceptions:
  - One-line lint warning suppression comments.
  - Long strings that read worse split across lines.
  - AGENTS.md and other Markdown docs meant for agents (ex. skills, rules).
  - Any file where limit not applicable or desirable.

## Comments and Docblocks

- Comment anything not self-explanatory within a few adjacent lines. Each comment must earn its place: a few high-value comments beat blanket coverage.
- Explain intent and non-obvious why; code already says what it does.
- Pitch comments at durable altitude: capture rule or invariant that stays true.
  Transient specifics (measured values, one-off observations, counts, dates) rot into misleading noise. Same for over-description and heavy cross-referencing of other files.
- Describe code as it is now. Never narrate deleted or changed code ("this used to…", "the old X is gone").
  Reference removed code only when present code cannot stand without it (wire- or API-compatibility constraint, non-obvious gotcha the removal left behind). Then state constraint, not chronology.
- Active voice, period at end of every sentence, Oxford commas.
- In docblocks, wrap lines at sentence or logical boundaries so each stays legible alone:
  Bad:
  ```
  The cow is white. The (lf)
  dog is brown.
  ```
  Good:
  ```
  The cow is white. (lf)
  The dog is brown.
  ```
