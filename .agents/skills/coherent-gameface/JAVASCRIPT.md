# JavaScript in Cohtml

The JS VM is **Google V8** (on CS2 specifically), so the *language* is full modern JavaScript. What's missing is the *platform around it*: the DOM is a subset, and most Web/global APIs are absent. Treat it as "a standards-shaped runtime with holes," not a browser. Confirm edge cases via `localhost:9444`.

## Engine and language level

- **V8.** Because CS2 is a V8 platform, V8-only features like `window.onerror` (and the `error` event) work.
- Native `Promise`, `async`/`await`, classes, modules, `Map`/`Set`/`Proxy`, optional chaining `?.`, nullish coalescing `??`, generators, typed arrays - all work (V8). Coherent's recommended target is ES2015, but the underlying V8 is far newer.
- The project's build transpiles/bundles the TS/JSX, so author normally; don't hand-ship raw ESM assuming the engine parses your exact syntax.

## DOM API

**Supported:** `querySelector`/`querySelectorAll`, `getElementById`, `getElementsByClassName`/`TagName`, `createElement`/`createComment`, `appendChild`/`insertBefore`/`removeChild`/`cloneNode`, `innerHTML`/`textContent`, `setAttribute`/`getAttribute`, `classList`, `dataset` (read-only), `style` + CSS Typed OM, `addEventListener`/`removeEventListener`/`dispatchEvent`, `getBoundingClientRect`, `offsetWidth/Height`, `clientWidth/Height`, `scrollWidth/Height`.

**Observers:**

| Observer | Status |
| --- | --- |
| `MutationObserver` | Works. |
| `ResizeObserver` | Works, but reports with **up to 2 frames of delay**. |
| `IntersectionObserver` | **Absent.** Implement visibility detection manually. |

**`getComputedStyle` and measurements are one frame behind.** Cohtml lays out once per frame, so reads reflect the *previous* frame and are unavailable on the first frame. Defer reads with `requestAnimationFrame` (often nested). The Typed-OM object can lag ~2-3 frames behind a change.

**Other gotchas:** `parentNode`/`parentElement` may not return the parent for a detached node not referenced from JS. Cohtml keeps a single shared whitespace text node, so **storing a JS reference to a whitespace node and reusing it later is undefined behavior** (this is what breaks Svelte/SolidJS-style reactivity; React is fine).

## Web / global APIs

| API | Status | Use instead / note |
| --- | --- | --- |
| `fetch` | **Absent** | Use `XMLHttpRequest`. The mod's HTTP also goes through C# (`HallOfFame/Http`). |
| `XMLHttpRequest` | Full, native | The in-page HTTP path; also exposes `responseArrayBuffer()`/`responseBlob()`. |
| `setTimeout`/`setInterval` | Works | - |
| `requestAnimationFrame` | Works | The tool for deferring style/layout reads. |
| `requestIdleCallback`/`setImmediate` | Absent | - |
| `console` | Works | `log`/`warn`/`error`/`info`/`debug`/`assert`/`time*`; shows in DevTools. |
| `localStorage` | Works | Backed by the host. |
| `sessionStorage` | **Absent** | - |
| `URL`/`URLSearchParams` | **Absent** | Parse manually. |
| `FormData`, `File`/`FileReader` | **Absent** | - |
| `btoa`/`atob`, `TextEncoder`/`TextDecoder` | **Absent** | - |
| `IndexedDB`, `document.cookie` | **Absent** | - |
| Web Workers / Service Workers | **Absent** | No JS background threads. |
| `WebSocket` | Partial | Only if the host implements it. |
| Web Components (`customElements`, Shadow DOM, `<template>`/`<slot>`) | Works | - |
| WebGL | **Absent** | Canvas is 2D-only. |
| `navigator` | Minimal | Only `userAgent` + `getGamepads()`. |
| `location` / `history` | Works | No top-level navigation. |

There is **no built-in network/resource stack** - real I/O is routed through C# (the `IAsyncResourceHandler` on the engine side, and this mod's binding layer; see [BINDINGS.md](BINDINGS.md)).

## Events and input

**Supported events:** `click`, `dblclick`, `auxclick`, `mousedown`/`up`/`move`, `mouseenter`/`leave`/`over`/`out`, `wheel`, `keydown`/`keyup`/`keypress`, `focus`/`blur`/`focusin`/`focusout`, `input`, `change`, `scroll`, `resize`, `load`, `touchstart`/`move`/`end`, `transitionend`, `animationend`, `gamepadconnected`/`disconnected`, `popstate`, Web-Animations `finish`, XHR `ProgressEvent`s.

**Key gotchas:**

- **Pointer Events are NOT supported** - `pointerdown`/`up`/`move`/etc. and pointer capture. Use mouse and touch events.
- **Only `animationend`/`transitionend` fire** - not `animationstart`/`animationiteration`. (Relevant to the panel animations in `upload-progress.tsx`.)
- **`event.target`/`event.currentTarget` are valid only inside the handler's call stack.** Stash the event and read them later (in a Promise/timeout) and they return `null`.
- **Hover only updates when a mouse-move or scroll is forwarded to the engine** - not automatically each frame - so hover state can appear "stuck."
- Not supported: `contextmenu`, drag-and-drop, clipboard (`copy`/`cut`/`paste`), `submit`/`reset`/`invalid`, composition events, `touchcancel`.

## Codebase gotcha

Re-setting an image's `src` to the **same URL does not re-fire `onload`**, which would deadlock an awaiting task - guard by skipping identical URLs (`ImagePreloaderUISystem.cs:109`). See the image cache model in [GRAPHICS-AND-FONTS.md](GRAPHICS-AND-FONTS.md).
