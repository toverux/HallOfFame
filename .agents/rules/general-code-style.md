---
paths:
  - "**/*"
---

# General Code Style

These rules are general guidelines applying to every language.

## Formatting

- Let the code breathe. Use ample line breaks to improve readability to separate logical blocks of
  code, variable creation and usage, etc.
- NEVER inline `{}` blocks, always break.
- AVOID passing more than 4 params in a function (unless you can't do otherwise), use an object
  instead.

## Comments and Docblocks

- Do not hesitate to use a lot of comments for anything that's not completely self-explanatory in a
  few adjacent lines' scope.
- Comments should explain intent, not describe what the code obviously does.
- Don't be overly descriptive in comments and don't overly cross-reference files.
- Comments and docblocks should describe the code as it is now, not narrate code that was deleted or
  changed (no "this used to…", "the old X is gone", etc.). Only reference removed code when there is
  a solid, lasting reason the present code cannot stand without it: e.g., a wire- or API-compat.
  constraint, or a non-obvious gotcha the removal left behind, and then state the constraint, not
  the chronology.
- Write in active voice.
- In docblocks and comments, always end sentences with a period.
- Use Oxford commas.
- When writing docblocks, wrap sentences to facilitate legibility between logical components. Ex:
  - Bad:
    The cow is white. The (lf)
    dog is brown.
  - Good:
    The cow is white. (lf)
    The dog is brown.
- When not using Markdown and actual links, reference links to files in the project using wikilink;
  bad: `document.md`, good: [[document.md]].
- Respect a strict 100-character line length limit, including in comments (including the docblock
  formatting). However, do NOT verify this with external tools like `awk`, this is too
  token-intensive.
- In docblocks, always break into multi-line docblocks *except* if it's just for one JSDoc
  annotation (ex. `/** @public */`).
