---
paths:
  - "**/*.{cs}"
---

# C# Code Style

- You are working with C# strict null settings (`<Nullable>true</Nullable>`).
- Use the very latest C# 12 language features.
- Use the init and required modifiers when appropriate rather than ctor-based params.
- Use the compiler-synthesized `field` for backing fields rather than manually declaring them.
- Choose appropriate datastructure types: is it a class, a struct, a readonly struct, a record class, a record struct, a readonly record struct, a ref struct, a readonly ref struct...?
