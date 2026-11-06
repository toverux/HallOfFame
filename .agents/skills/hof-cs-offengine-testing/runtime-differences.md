# Where .NET 10 differs from the game's runtime

Measured with the same program on CoreCLR (.NET 10) and upstream Mono 6.14.1, the closest runtime to the game's, which runs Unity's own fork of Mono.
A result that goes through one of these passes off-engine and can still be wrong in game: write the code so it holds on both, then check it in game, through the unity eval.

| Behaviour | Mono (the game) | CoreCLR (the tests) | Write instead |
|---|---|---|---|
| `float`/`double` `ToString()` | 15 or 7 significant digits: `0.3`, `0.3333333`, `1.677722E+07`, `1E+07` | Shortest round-trip: `0.30000000000000004`, `0.33333334`, `16777216`, `10000000` | An explicit format (`"0.##"`, `"N0"`), never a default `ToString` in text a test compares or a player reads. |
| Float to int overflow | `(int)3.9e9f` and `(int)float.NaN` are `int.MinValue` | Saturates: `int.MaxValue`, and `0` for NaN | Clamp before converting; an out-of-range cast is a bug on both. |
| Culture-aware compare | `string.Compare("a-b", "ab", CurrentCulture)` is `1` | `-1` | `StringComparison.Ordinal` for anything but text sorted for a player. |
| `string.GetHashCode()` | Stable across runs | Randomized per process | A hash never persisted, sent, or relied on for an order; `HashSet<string>` order comes out the same on both only by chance. |
| Code page 1252 | `Encoding.GetEncoding(1252)` works | `NotSupportedException` | UTF-8. |
| Explicit layout | Loads a type overlapping an object field with a non-object field | `TypeLoadException` (`com.rlabrecque.steamworks.net`'s `OptionValue`) | Keep such types out of the tests; the game's own assemblies all load. |

Measured the same on both, so a test can rely on them: `Math.Round(2.5)` is `2`, `Array.Sort` orders equal keys alike, `OrderBy` is stable, `"i".ToUpper(tr-TR)` is `İ`, and `Math.Sin` and `Math.Pow` return the same doubles.
