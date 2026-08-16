---
version: 2.0.0
paths:
  - '**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'
---

# TypeScript Code Style

Detect project facts first, then apply these guidelines.
A formatter owns mechanical layout — quote style, semicolons, trailing commas, arrow parens, import order — so this is a taste-only guide.
Write strict-clean code (no implicit `any`, every `null`/`undefined` handled) even where the project tsconfig does not enforce it.
These rules do not apply in detail to scratchpad/throwaway scripts.

## Detect project settings

Before first edit, discover:

- tsconfig strictness posture: `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.
- TypeScript version — gates version-tagged features below.
- Runtime and environment (Node, Bun, Deno, browser).

Store these facts in the project's persistent instruction files (ex. AGENTS.md) so you never rediscover them. Tell the user you recorded them there and why.
When settings differ across projects, record them as a table with one row per project; when every project shares the same settings, record them once under an "all projects" note.

## Strictness

- Never `any`: create types, derive from existing ones, or reach for `unknown` when the value is genuinely unknown.
- Use TypeScript's built-in utility types where they fit, and the `type-fest` package for advanced ones.

## The type system

- Declare object shapes with `interface`; `type` for unions, intersections, mapped and conditional types, tuples, function types, aliases of primitives.
- Write member signatures property-style over method-style — property-style gets stricter checking under `strictFunctionTypes` — keeping method shorthand for object literals.
- Model closed value sets as string-literal unions, not `enum`. When you also need the values at runtime, declare an `as const` object and derive the union with `type X = (typeof X)[keyof typeof X]`.
- Model variant data as discriminated unions with literal discriminant, checked exhaustively (see `never` default below), not optional-field grab-bags or class hierarchies.
- `Map`/`Set` for dynamic or non-string-keyed collections that grow, shrink, or need ordered iteration; object types or `Record<K, V>` for fixed-shape or known-key records.
- Simple element types as `T[]`, complex ones (unions, function types) as `Array<T>`. Same for readonly forms `readonly T[]` and `ReadonlyArray<T>`.
- Annotate return types on named functions, methods, standalone function declarations; let short expression-arrow callbacks (`.map(x => …)`) infer theirs.
- Prove types through guards and validation, not `as`. Reserve `as` for a type the compiler genuinely cannot infer (poorly-typed dependencies, real inference gaps), never to silence a mismatch.
- Prefer `as const` to freeze literals and tuples, and (TS 4.9) `satisfies` to check a value against a type without widening it. Keep `as unknown as X` for hard boundaries only, with a comment.

## Nullability

- Prefer `undefined` over `null`. Restrict `null` to serialization and interop boundaries.
- Mark a property optional with `?:` when it may be absent; type it `: T | undefined` when it must be present but may hold `undefined`. Combine them (`?: T | undefined`) only when both absence and explicit `undefined` are meaningful — it matters most under `exactOptionalPropertyTypes`.
- Optional chaining (`?.`) only over genuinely nullable values, never as defensive padding.

## Immutability

- Prefer immutable data structures. When a field must stay mutable, add a comment saying why.
- Mark class and object properties `readonly` wherever they are assigned only at construction, use `Readonly<T>` when a whole type is readonly, and use the readonly array forms for arrays you do not mutate, parameters included.
- Build new values with immutable transforms, not mutating in place. Drop to mutation only in a measured hot path.

## Functions

- Prefer `function` declarations for named standalone functions: hoisting lets the more important functions sit at the top (the deeper a function sits in the call stack, the deeper it sits in the file), helpers at the bottom. Same ordering for nested functions.
- Reserve arrow functions for callbacks, short expressions, and where lexical `this` is needed.

## Control flow

- Use `==` and `!=` by default. Reserve `===` and `!==` for when strict equality specifically required (ex. distinguishing `null` from `undefined`). Use `== null` to test null-or-undefined together.
- Lean on truthiness for concise conditions where falsy cases intended (`if (value)`, `if (list.length)`). Switch to explicit check when specific falsy value is valid input — empty string especially, which `if (str)` silently conflates with absence.
- Choose `??` over `||` when `0`, `''`, or `false` are values to keep; `||` when any falsy value should fall back.
- Flatten nesting with guard clauses and early returns so the happy path stays at the left margin. Ternary for simple one-line either/or selection; nest or chain ternaries only when that reads better than `if`/`else`.
- Array methods (`map`, `filter`, `reduce`, `find`, `some`, `every`) for declarative transforms. `for...of` for side effects, early exit, or accumulation with control flow. Never `.forEach`.
- Drop to an index loop only for a measured hot path or when the index is genuinely needed.

## Classes

- State every access modifier explicitly (`public`, `private`, `protected`). Reach for a `#private` field only when true runtime privacy is required.
- Declare fields explicitly and assign them in the constructor, not parameter properties.

## Modules

- Export with named exports and an inline `export` on the declaration. Avoid default exports except where a framework or tool requires one. Never a trailing grouped `export { … }` block.
- Keep the module's exported interface toward the top of the file, consistent with the function ordering above.
- Import types with type-only imports so they are erased from the output (required under `verbatimModuleSyntax`). Use `import * as ns` for utility modules where it reads better.

## Async

- Never leave a promise floating: `await` it, `void` it for deliberate fire-and-forget, or attach a handler.
- Run independent async work concurrently, preferring `Promise.allSettled` and inspecting each result. Reserve `Promise.all` for genuine all-or-nothing work — its fail-fast drops other results and can orphan rejections.
- Give a function that only returns a promise an explicit `Promise<T>` return type and return the promise directly. Add `async` only where you actually `await`.
- Await a promise inside `try` with `return await` so the rejection is caught and the stack preserved. Elsewhere return the promise directly.
- Name async functions like any other — no `Async` suffix. The type carries it.

## Assertions, guards and errors

For values that must hold if the program is sound:

- Prove narrowing through checks, guards, early returns, not the `!` non-null assertion.
- Assert an invariant in server or CLI code with `import assert from 'node:assert/strict'`, using `assert()` for type guards too (`assert(typeof value == 'string')`). Throw a standard `Error` in client code. Use a project-provided assertion helper if one exists.
- Assert an unreachable path with the offending value, typing it `never` and throwing — ex. a `switch` default, paired with `noFallthroughCasesInSwitch`.
- Reserve `!` for a measured hot path where the call would cost too much, with the lint warning silenced.

For operational errors — I/O, bad external input, anything that can happen when the program is sound:

- Throw an `Error` or a subclass, never a string or object literal. These are never assertions.
- Subclass `Error` only when callers must catch it distinctly; reuse built-ins (`TypeError`, `RangeError`, …) otherwise. A custom error class may sit lower in the file.
- Add context by wrapping with `{ cause }` (`throw new Error(message, { cause: err })`).
- Treat a caught error as `unknown` and narrow it before use, not assuming `.message`.
- Return a discriminated-union result instead of throwing for expected, routine outcomes the caller must branch on.

## Strings

- Template literals for strings containing English sentences, even without interpolation: single and double quotes inside the sentence stay painless.

## Naming

- Variables, functions, methods, properties in `camelCase`. Types, interfaces, classes, type parameters in `PascalCase`. Genuinely fixed module-level primitive constants in `CONSTANT_CASE`.
- Give interfaces no `I` prefix and type aliases no `T` prefix.
- Name boolean members affirmatively with an `is`/`has`/`can`/`should` prefix.
- Treat acronyms as words: `HtmlNode`, `userId`, `parseUrl`, `httpClient`.
- Name a sole type parameter `T`, and several descriptively with a `T` prefix (`TKey`, `TValue`, `TResult`).
- Give private members no leading underscore.
- Keep short names to their idiomatic roles: `i` for an index, `x`/`y`/`z` for coordinates, `a`/`b` for comparison operands (ex. a sorting comparator), `_` for a discard.
- Name files by the project or framework convention, defaulting to kebab-case.

## TSDoc

- Let the type signature carry the types. TSDoc adds only what the signature cannot express.
