---
paths:
  - "**/*.{js,ts,tsx}"
---

# Biome Linting

## `noExcessive*`-rules

Somes rules like `noExcessiveLinesPerFile`, `noExcessiveCognitiveComplexity`, etc., are there as
general guidelines to avoid slipping into creating hard to read code.

Do not be too zealous respecting those rules, though.

Sometimes, a long function is better than forcing to split into 10 functions that do practically
nothing.
Same with cognitive complexity, sometimes a function might have a lot of `if` statements, but if
they're just early returns or precondition checks, it's fine.

Hence, use judgment and disable the rule just for the function when you think refactoring the code
just to avoid the lint warning would make it harder to follow.
