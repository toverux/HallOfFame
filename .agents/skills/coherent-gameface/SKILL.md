---
name: coherent-gameface
description: How the game's UI engine (Coherent Gameface / Cohtml) differs from a real browser, and the workarounds this codebase already uses. Use when writing or debugging the HTML/CSS/JS UI under HallOfFame/UI/src, when a CSS property, HTML element, or Web API behaves unexpectedly in-game, or when the user mentions cohtml, gameface, or coherent.
---

# Coherent Gameface (Cohtml)

The game's React UI does not run in a browser. It runs in **Coherent Gameface**, whose HTML/CSS/layout engine (**Cohtml**) and GPU renderer (**Renoir**) are a clean-room, from-scratch implementation of a **curated subset** of HTML5/CSS3 built for game UI. It is **not** Chromium, not WebKit, not a WebView. (The old *Coherent UI* product was Chromium-based; Gameface is its from-scratch successor. Don't conflate them.) Only the JavaScript VM is off-the-shelf: **V8** (on Cities: Skylines II specifically).

**The cardinal rule: verify features against Gameface's support, not against what Chrome does.** A subset means holes. Unknown HTML tags still render (as generic flex boxes) but carry no semantics or default styling; unknown CSS is silently dropped; missing Web APIs are simply `undefined`. There are no warnings. A feature that "should obviously work" may do nothing, and you will only notice in-game.

## Golden rules (true everywhere, regardless of what you are editing)

1. **Layout is flex-only.** Every element defaults to `display: flex; box-sizing: border-box`, with `flex-shrink: 0` (not 1) and `min-width/min-height: auto` resolving to `0`. There is **no CSS Grid and no `gap`**; `display: block`/`inline` are *simulated* with flex and behave differently. Lay things out with flexbox or absolute positioning, nothing else. Full detail and this codebase's layout-bug workarounds: [CSS.md](CSS.md).

2. **Layout is one frame behind.** Cohtml lays out once per frame, so styles and measurements read from JS reflect the *previous* frame and are empty on the first frame. Defer reads with `requestAnimationFrame` (often nested). See [JAVASCRIPT.md](JAVASCRIPT.md).

3. **JavaScript is a subset on V8.** No `fetch` (use `XMLHttpRequest`), no Pointer Events (use mouse/touch), no `IntersectionObserver`, no `URL`/`URLSearchParams`/`FormData`/`sessionStorage`. `window.onerror` works because CS2 is a V8 platform. Modern syntax is fine - the project's build transpiles it. See [JAVASCRIPT.md](JAVASCRIPT.md).

4. **No runtime CSS color math, and `var()` is flaky in places.** There are no CSS4 `color()`/color-mod functions, and `var()` silently fails in some contexts. This codebase pre-resolves colors at build time with SASS and hardcodes vanilla variable values. See [CSS.md](CSS.md).

## Verify live, don't guess

The running game exposes a **Gameface DevTools / CDP endpoint at `localhost:9444`** (Gameface's default `DebuggerPort`). When you are unsure whether a property, element, or API actually works in this engine, **test it there instead of assuming** - the docs target a newer Gameface than CS2 ships, so the live runtime is the ground truth. (See the `game-ui-cdp-access` memory for how to drive it.)

## Reference (open the file for what you are touching)

- **Editing CSS / SCSS** -> [CSS.md](CSS.md): selectors, properties, the flex layout model, `calc()`/`var()`/color limits, animations, transforms, text, and the proven layout-bug workarounds from this repo.
- **Writing HTML / JSX markup** -> [HTML.md](HTML.md): which elements and attributes exist, the missing form/table/list families, and the simulated-display defaults.
- **Writing JS / TS logic** -> [JAVASCRIPT.md](JAVASCRIPT.md): engine/ES level, DOM API coverage, Web/global APIs, observers, and the events/input model.
- **Wiring C# <-> UI data** -> [BINDINGS.md](BINDINGS.md): the `engine` global, the model-binding shape-caching gotcha, and where this repo's binding facade lives.
- **Fonts, images, video, SVG, canvas** -> [GRAPHICS-AND-FONTS.md](GRAPHICS-AND-FONTS.md): supported formats, the image-cache eviction/preload model, and SVG/canvas limits.

## Sources

Official support tables: <https://docs.coherent-labs.com/unity-gameface/content_development/supported_features_tables/> and the "Differences to traditional browsers" page. The docs target Gameface ~3.0.x; **CS2 ships an older build**, so treat the tables as a guide and confirm edge cases via `localhost:9444`.
