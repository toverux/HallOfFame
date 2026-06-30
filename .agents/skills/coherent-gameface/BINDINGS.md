# C# <-> UI bindings (Cohtml)

Cohtml bridges C# (the mod's logic) and JS (the React UI) through a JS global called **`engine`** plus a data-model system. This codebase wraps the raw `engine` calls in a typed facade, so **add new bindings there, not by calling `engine.*` directly** in components (see `HallOfFame/UI/src/bindings` and the `AGENTS.md` notes on it).

## The `engine` JS global

| Call | Behavior |
| --- | --- |
| `engine.on(name, handler)` / `engine.off(name, handler)` | Subscribe / unsubscribe to a C# event (many handlers allowed). |
| `engine.call(name, ...args)` | Call a C# handler that **returns a value**; returns a Promise. |
| `engine.trigger(name, ...args)` | Fire an event to C#; **no return value**. |
| `engine.whenReady` | A Promise *property* (not a method): `engine.whenReady.then(...)`. |
| `engine.createJSModel(name, obj)` | Register a JS object as a named data model. |
| `engine.updateWholeModel(model)` + `engine.synchronizeModels()` | Mark a model dirty, then flush dirty models to the DOM (once per frame). |

**Engine events vs DOM events:** `engine.on/trigger` cross the C#/JS boundary and never return a value (use `engine.call` for returns); ordinary `addEventListener` DOM events stay in JS. They coexist.

## The model-shape caching gotcha (the important one)

**Cohtml caches a model's shape by its type name and has no polymorphism.** Two payloads that share a type name must expose the **same set of *present* properties**. Consequences:

- Omitting a property (e.g. dropping `creator` when there is none) **changes the shape** and breaks the cached binding.
- **Presence is what matters, not value.** A property that is present but `null` keeps the same shape, so nullity alone never needs a distinct type name.
- So each optional sub-object's *presence* must be encoded into the type name, producing a distinct shape variant per combination.

This is implemented in the outbound writers in `HallOfFame/Utils/Writers` - see `ScreenshotValueWriter.cs:26` for the canonical example and the full reasoning. When you add or remove an optional field on a bound type, update its type-name encoding accordingly.

## Where the C# side lives

- **Outbound C# -> UI writers:** `HallOfFame/Utils/Writers` (`IWriter<T>` implementations). Domain records hold only inbound `[DecodeAlias]` data; the outbound wire format lives in the writers.
- **Typed TS facade:** `HallOfFame/UI/src/bindings`, one module per binding group (`slideshow`, `common`, `capture`) plus the generic `input-action` factory. Each module keeps its `bindValue`/`trigger` calls private and exports typed hooks/commands.

## HTML data binding (`data-bind-*`)

Gameface also supports a mustache/`data-bind-*` binding system (`data-bind-value`, `data-bind-for`, `data-bind-if`, `data-bind-<event>`, etc.) for non-framework pages. **This codebase uses React, not `data-bind-*`**, so this is informational only - don't introduce `data-bind` attributes into the React tree.
