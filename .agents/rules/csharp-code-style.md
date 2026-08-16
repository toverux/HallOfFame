---
version: 2.0.0
paths:
  - '**/*.cs'
---

# C# Code Style

Detect project facts first, then apply guidelines.
Mechanical conventions at end are defaults — yield to what surrounding code already does.

## Detect language version and project settings

Before first edit, discover:

- C# language version (`<LangVersion>`, else inferred from target framework).
- Target .NET version(s).
- Project role: reusable library, ASP.NET Core or console app, or UI app (WPF/WinForms/MAUI). Decides `ConfigureAwait` branch below.
- Whether `TreatWarningsAsErrors` enabled.
- Whether `Nullable` enabled.
- Whether `ImplicitUsings` enabled — decides `using` directives you add or omit.

Store these facts in the project's persistent instruction files (ex. AGENTS.md) so you never rediscover them. Tell the user you recorded them there and why.
When settings differ across projects, record them as a table with one row per project; when every project shares the same settings, record them once under an "all projects" note.

## Language version and features

- Use newest C# features available in detected version.
- Write code producing no warnings — when one fires, decide deliberately: fix code or suppress inline with justification.
- (C# 9) Prefer `is` and `is not` over `==` and `!=` where applicable.
- (C# 11) Use `init` and `required` modifiers where they fit, not constructor parameters.
- (C# 14) Use compiler-synthesized `field` keyword for backing fields, not manual declaration.
- (C# 14) Declare extension methods and properties in `extension(Receiver) { ... }` blocks grouped by receiver type, not classic `this`-parameter extension methods.
- Choose data structure type deliberately, from options language version offers:
  - `class` for reference-type objects with identity, mutable state, or inheritance; default choice.
  - `struct` for small, short-lived values allocated inline, avoid GC pressure.
  - (C# 7.2) `readonly struct` for value never mutating after construction — removes defensive copies.
  - (C# 7.2) `ref struct` for a value that must stay on the stack, ex. wrapping a `Span<T>` — it cannot be boxed or heap-allocated.
  - (C# 7.2) `readonly ref struct` for a stack-only value that is also immutable.
  - (C# 9) `record class` for immutable reference-type data compared by value, with `with`-expression copies (DTOs, domain models).
  - (C# 10) `record struct` for small value-type data compared by value, no heap allocation.
  - (C# 10) `readonly record struct` for same as fully immutable value — default small value object.

## Types and members

- Reach for records by default for data-carrying types (DTOs, API contracts, value objects, immutable models) — value equality and `with`-copies free. Keep plain classes for entities with identity, behavior, or mutable lifecycle.
- Mark concrete classes `sealed` by default; open for inheritance only when designed as base.
- (C# 12) Use primary constructor for dependency-capture case (services, controllers, handlers) where parameters only read. Fall back to classic constructor when parameter needs `readonly` enforcement, validation, or transformation before storage.
- Mark a field `readonly` whenever it is assigned only at declaration or in the constructor. Prefer immutable shapes (init-only properties, `readonly struct`). When a field must stay mutable, add a comment saying why.
- Prefer local function over lambda for named in-method helper (real stack frames, recursion, no delegate allocation). Reserve lambdas for LINQ and delegates passed as arguments. Mark non-capturing local function or lambda `static` (static local functions from C# 8, static lambdas from C# 9).
- Return multiple values as named tuple `(int Count, string Name)` for lightweight local or private results, or as `record` when shape is public, reused, or deserves name. Reserve `out` parameters for `Try*` pattern.
- (C# 8) Use `using` declaration (`using var x = ...;`) when resource lives to end of scope, and `using (...)` block only to dispose earlier. Prefer `await using` for resources with async teardown. `sealed` disposable implements plain `Dispose()` without `protected virtual Dispose(bool)` and finalizer ceremony.

## Nullability, guards, and errors

- With `Nullable` enabled, annotate reference type `?` only when genuinely nullable. Use `?.`, `??`, `??=` only over genuinely nullable values — never as defensive padding over values flow analysis already proves non-null.
- Prove non-null through checks, pattern matching, early guards — not `!` null-forgiving operator. Use `!` only where non-nullness provable but inexpressible to compiler (ex. after `TryGetValue` guarded by its `bool`), with comment saying why.
- Trust nullable annotations, don't validate arguments routinely. Validate only at trust boundaries (public API surface, deserialization, external input). Prefer framework throw-helpers over handwritten `if`/`throw`: (.NET 6) `ArgumentNullException.ThrowIfNull`, (.NET 7) `ArgumentException.ThrowIfNullOrEmpty`, (.NET 8) `ThrowIfNullOrWhiteSpace` and `ArgumentOutOfRangeException.ThrowIf*`.
- Throw always-on exception for broken invariant — `InvalidOperationException`, or (.NET 7) `throw new UnreachableException()` for unreachable code — so violations surface in production too. Reserve `Debug.Assert` for expensive checks you're content to strip from release builds.
- Handle operational failures (I/O, bad external input) with idiomatic exceptions, not `Result<T>` type. Reuse framework exception types; add custom one only when callers must catch it distinctly.
- Preserve stack with `throw;` not `throw ex;`. Wrap with inner exception when adding context (`throw new X(message, ex)`). Catch only what you can handle — avoid bare `catch (Exception)` outside top-level boundary.
- Name exception variables `ex` by default (catch clauses, `Assert.Throws` results, etc.).

## Collections and LINQ

- (C# 12) Initialize collections with collection expressions and spreads (`[]`, `[a, b, c]`, `[.. first, .. second]`) in target-typed positions (fields, properties, returns, arguments), over `new[] { ... }`, `new List<T> { ... }`, and `.Concat(...).ToList()`. Materialize fluent chain with `.ToArray()` or `.ToList()` at tail. Reach for spread only when it reads better than chain.
- Write LINQ in method (fluent) syntax by default. Switch to query syntax only where it genuinely reads better (multiple joins, `let` bindings, complex group-by).
- Use LINQ for declarative map/filter/reduce where it reads clearly. Use `foreach` when body has side effects (never side effect inside `Select` or `Where`), when early exit with accumulating state, or in measured hot path — drop to loop whenever it reads clearer.
- At public boundaries, return narrowest read-only abstraction that fits (`IReadOnlyList<T>` / `IReadOnlyCollection<T>`, or `IEnumerable<T>` for lazy sequence) when collection is shared or aliased internal state a caller could mutate into side effect. A freshly produced collection the caller solely owns may be returned as a plain `List<T>` or array. Accept `IEnumerable<T>` on parameters unless you need count or random access.

## Control flow

- (C# 8) Prefer `switch` expression over `switch` statement when branch yields value. Use pattern matching (type, property, and from C# 9 relational and logical `and`/`or`/`not`) to collapse conditional chains — as deep as it reads clearly, backing off to plainer forms when pattern turns cryptic. Let unmatched `switch` expression throw, or use `throw new UnreachableException()` in `default`, per invariant rule above.
- Flatten nesting with guard clauses and early returns so happy path stays at left margin. Use ternary for simple one-line either/or selection. Nest or chain ternaries only when that genuinely reads better than alternatives.

## Strings

- Build strings with `$"..."` interpolation over `+` concatenation and `string.Format`. (C# 11) Use raw string literals (`"""`) for multi-line or embedded-quote content (JSON, SQL, regex). Use `StringBuilder` for iterative accumulation. Use `nameof(member)` over hard-coded member name.

## Async

- Suffix async method names with `Async`, matching surrounding code where it already settled a convention.
- Return `Task` / `Task<T>` by default. `ValueTask` only in measured hot path that usually completes synchronously.
- Use `async void` only for event handlers. Every other async method returns `async Task`.
- Accept `CancellationToken` as last parameter (`= default` on public APIs) and flow through to inner async calls.
- Await results, don't block on them (`.Result`, `.Wait()`, `.GetAwaiter().GetResult()`). Prefer `await` over returning `Task` directly, except trivial pass-through.
- Apply `ConfigureAwait(false)` to every context-independent await in library or shared code. Omit in app code with no synchronization context (ASP.NET Core, console). In UI app, capture context only when resuming onto UI thread, per project role from detection.

## Mechanical conventions

Defaults, not law: where surrounding code already follows a convention, match it instead of imposing these.

- Use `var` everywhere language allows.
- (C# 9) Use target-typed `new()` for fields and properties where type already on line. Use explicit `new Type()` in return and argument positions where type not on screen. For collection-typed members, use collection expression `[]` instead (see Collections and LINQ).
- (C# 10) Declare namespaces file-scoped (`namespace Foo;`). Use block only for file needing more than one namespace.
- Use expression-bodied members for any member that is single expression on one readable line. Keep block bodies for multi-statement members and for constructors and finalizers.
- State every access modifier explicitly, including `private` members and `internal` types.
- Qualify every instance member access with `this.` (fields, properties, methods, events) and every static member with declaring type name (`OrderService.MaxRetries` even inside `OrderService`). Bare member name never written.
- Name instance fields `camelCase` without leading underscore, constants and `static readonly` fields `PascalCase`, boolean members with affirmative `Is`/`Has`/`Can`/`Should` prefix. Two-letter acronyms all-caps (`IOStream`), longer ones PascalCase (`HtmlNode`); `Id` and `Ok` treated as words. Name sole type parameter `T`, several descriptively (`TKey`, `TValue`, `TResult`). Give each variable distinct name — no shadowing from outer scope.
- Order type's members by kind — constants, fields, constructors, properties, methods, nested types — public before private within each group. Inside method body, order local functions by call flow: entry logic first, helpers below.
- Place `using` directives at top of file above namespace, `System.*` first then rest alphabetical.
- Write one attribute per line, not several stacked in one `[...]`.
- Keep XML-doc tag content flush with `///`, never indented under tag.
- Keep each type small enough to navigate without `#region`.
