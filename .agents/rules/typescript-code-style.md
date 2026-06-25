---
paths:
  - "**/*.{js,ts,tsx}"
---

# TypeScript Code Style

## TypeScript Strictness

- You are working with TypeScript's strictest settings.
- Never ever use `any`. Create types if necessary, derive from existing types, etc.
- Use `unknown` when the value is genuinely unknown.
- Use TypeScript built-in types when applicable.
- In interfaces, use property-style over method-style method signatures; property-style function
  declarations allow for stricter type checking when `strictFunctionTypes` is enabled.
  Still use method shorthand in implementations.

## Style

- Use named function hoisting to place the more important functions at the top.
  The deeper a function is in the call stack, the deeper it is in a file.
- Also use hoisting for functions inside functions, putting helper functions at the very bottom.
- Use template literals for strings containing English sentences. This applies even when there are
  no interpolations. This makes it easier to use single and double quotes inside the sentence.

## Nullability

- Prefer `undefined` over `null` in general.
- Restrict `null` to serialization and interoperability boundaries.
- Use optional chaining (`?.`) very sparsely, when you are sure the value can be null/undefined.

## Type Safety and Guards

- NEVER use `===` unless strict equality (with null or undefined for example) is specifically
  required. Instead, use `==`.
- When using the `!` non-null assertion for a good reason, you will need to silence Biome's
  `lint/style/noNonNullAssertion`.

## Readonly Data

- Prefer using immutable data structures whenever possible. When fields of a structure are mutable,
  add comments about it and explain why.
- Mark class and object properties as `readonly` whenever possible.
- Use `Readonly<T>` when all properties of a type are readonly.
