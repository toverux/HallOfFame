# CSS in Cohtml

Cohtml implements a curated subset of CSS3. Unrecognized properties and values are dropped silently. When in doubt, confirm against `localhost:9444` (see [SKILL.md](SKILL.md)). This codebase's SCSS already encodes most of the workarounds below; the cited `file:line` references are working examples to copy.

## Layout model (the defining difference)

- **Flex-only.** Every element defaults to `display: flex; box-sizing: border-box`. `display: block` and `display: inline` are *simulated* via flex and behave differently, so don't reach for them to get browser parity.
- **No CSS Grid.** Every `grid-*` property is unsupported. There is no grid in this codebase; don't introduce one.
- **No `gap` / `row-gap` / `column-gap`.** Space flex children with `margin` instead. This codebase defines a `--buttons-gap` var and applies it as `margin-left` (`menu-controls.module.scss`), never as `gap`.
- **Non-standard flex defaults:** `flex-shrink: 0` (not 1); `min-width`/`min-height: auto` is treated as `0`.
- **Flex caveats:** `flex-basis: content` is unsupported; `flex-basis: auto` may fall back to resolving as `content` when a sibling uses a percentage basis, so **avoid mixing `%` and `auto` flex-bases among siblings**. `flex` "does not work correctly together with `text-align`". `order` and the `flex-flow` shorthand are unsupported.
- **`align-content` / `align-items` / `align-self` / `justify-content` are partial** (limited value sets, e.g. `justify-content` supports only `flex-start`/`flex-end`/`center`/`space-between`/`space-around`).
- **`position`** is partial: `relative`, `absolute`, `fixed` (nested fixed contexts only partially). `top`/`right`/`bottom`/`left`/`z-index` work. **`float` and `clear` are unsupported.**
- **Percentages on absolutely-positioned elements resolve against the direct parent**, not the nearest positioned ancestor.
- **Overflow clips absolutely-positioned children** (unlike browsers). `overflow`/`-x`/`-y` otherwise work.

### Layout-bug workarounds proven in this repo

These are real Cohtml layout bugs the codebase already routes around; reuse the pattern rather than rediscovering it.

- **Can't animate `width`/`height` from `0` to `auto`** -> use the old `max-width`/`max-height` transition trick (`menu-controls.module.scss:168`).
- **Images won't stretch to a flex container's height** (depends on parent flex config) -> set an explicit `height` on the container (`menu-controls.module.scss:214`).
- **A `<span>` can randomly collapse** (layout-engine bug) -> `white-space: nowrap` (`menu-controls.module.scss:225`).
- **A text node gets broken across two lines** -> force `display: flex` on it (`screenshot-upload-panel.module.scss:384`).
- **Some flex configs misbehave** -> `align-items: flex-start` partly to dodge an engine bug (`menu-controls.module.scss:207`).

## `calc()` and `var()`

- **`calc()`**: cannot mix `%` with other units - `calc(100% - 20px)` is **unsupported**. Also unsupported inside `@keyframes`. This codebase replaces `calc(100% - Xrem)` with a JS-computed percentage width (`screenshot-upload-panel-utils.ts:18`).
- **`var()`**: works in most places but **silently fails in some contexts** (reason undocumented), and has **no fallback-value support** and no use inside `@keyframes`. Where SASS needs literal values, this codebase copies the vanilla values into `vanilla-vars.scss` rather than relying on `var()` (`vanilla-vars.scss:5`).

## Colors

- **No CSS4 `color()` / color-manipulation functions**, and only a limited set of named colors.
- Pre-resolve color math at **build time with SASS** (`color.change`, `color.adjust`) so the engine only ever sees literal colors (used throughout `screenshot-upload-panel.module.scss`, `menu-controls.module.scss`).
- For a **runtime-adjustable translucent fill**, you can't tweak alpha via a color function. Use a separate absolutely-positioned block with `opacity` to fake it, keeping the themed `var()` color intact (`screenshot-upload-panel.module.scss:94`).

## Selectors

- **Simple selectors all work:** type, `.class`, `#id`, `*`, attribute (`[attr~=value]`).
- **Combinators (` `, `>`, `+`, `~`) are conditional** - they require the engine flag `EnableComplexCSSSelectorsStyling`; disabling complex selectors is a documented perf win.
- **Pseudo-classes supported:** `:active`, `:focus`, `:hover`, `:root`, `:first-child`, `:last-child`, `:only-child`, and `:nth-child()` (partial - no `[ of <selector> ]` syntax). Structural ones (`:first-child` etc.) force style rematching of siblings, so use them sparingly.
- **Pseudo-classes NOT supported (common ones):** `:not()`, `:checked`, `:disabled`, `:enabled`, `:empty`, `:nth-of-type()`, `:first-of-type`, `:last-of-type`, `:required`, `:valid`/`:invalid`, `:read-only`, `:link`, `:visited`, `:target`, `:scope`, `:host`. (This codebase uses none of them, nor `:has()`.)
- **Pseudo-elements:** `::before`/`::after` work; `::selection` is partial (only `color`/`background-color`); `::first-letter`/`::first-line` unsupported.
- `!important` is supported.

## Animations and transitions

- `@keyframes`, `animation`/`animation-*`, and `transition`/`transition-*` are fully supported. Web Animations' `finish` event fires.
- **No `var()` or `calc()` inside `@keyframes`.**
- Only `animationend` and `transitionend` fire - **`animationstart` and `animationiteration` do not**.
- A property that creates a stacking context does so *when the animation starts* (in browsers, immediately), so `z-index`/ordering can differ until the animation begins.

## Transforms, filters, effects

- **Transforms work** (`translate*`, `scale*`, `rotate*`, `matrix`/`matrix3d`, `perspective`, `skewX`/`skewY`). The `skew(x, y)` shorthand is unsupported. `transform-origin` lacks z-offset; `backface-visibility` is evaluated per-element, not per-subtree.
- **`filter` is partial:** all filters work except `url()` SVG filters; **multiple filters are merged into a single color-matrix pass**, so chained filters can visually cancel differently than in a browser. **`backdrop-filter` is unsupported.** Custom `coh-color-matrix` / `coh-axis-blur` filters exist and are animatable.
- **`mask` is partial** (e.g. `mask-image` only PNGs with alpha, no multiple images, no GIFs). `clip-path` supports basic shapes only. An element **cannot use `mask: url(#...)` and `clip-path: url(#...)` at once** (clip-path wins).
- `box-shadow` and `text-shadow` work. `mix-blend-mode` and `isolation` work.
- **Gradients:** `linear-gradient` and `radial-gradient` only - **no `conic-gradient`**.

## Text and sizing

- **`font-size` units are limited** to `px`, `em`, `rem`, `vw`, `vh`. `font` has no system keywords (`caption`, `icon`, ...).
- **`white-space`** supports only `normal`, `nowrap`, `pre`, `pre-wrap`. `text-overflow` supports `clip`/`ellipsis` for generic text (not input fields). `text-decoration` is partial (no `blink`, solid style only). `word-break`, `word-wrap`, `writing-mode`, `direction`, `tab-size` are unsupported.
- **`user-select` is `none` by default**; `all` is unsupported.
- **`object-fit` / `object-position` are unsupported.** For cover-fit images, use a `<div>` with `background-size: cover` instead of `<img>` (`menu-splashscreen.tsx:68`). See [GRAPHICS-AND-FONTS.md](GRAPHICS-AND-FONTS.md).
- **`aspect-ratio` is partial** (limitations when combined with dimensional constraints; don't mix `px` and `%` with it). This codebase computes aspect-dependent sizes in JS instead.
- `max-width`/`max-height` don't support `none`. `box-sizing` defaults to `border-box`. `visibility: collapse` unsupported.

## Wholly unsupported (silently dropped)

`gap`/grid/`float`/`clear`; all `list-style-*`; all `outline-*`; all `column-*` (multi-column); all table-layout props (`border-collapse`, `border-spacing`, `caption-side`, `empty-cells`); `object-fit`/`object-position`; `will-change`; `scroll-behavior`; `touch-action`; `resize`; `zoom`; `quotes`; `counter-increment`/`counter-reset`. Borders are `solid`/`none`/`hidden` only. Media queries support feature queries but **not media types** (`screen` is always implied).
