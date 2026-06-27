# Fonts, images, video, SVG, canvas

## Fonts

- **Formats:** TrueType/OpenType only - `.ttf`, `.otf`, `.ttc`, `.otc`. **No WOFF/WOFF2/SVG/EOT.** Load via `@font-face`.
- **No generic families:** `serif`/`sans-serif`/`monospace` keywords are accepted but substituted with one configured fallback family, not real generic fonts.
- The **`load` event fires only after fonts have loaded** (differs from browsers), so text can be missing for the first frames.
- Glyphs render via **single-channel SDF** by default, which softens fine detail and sharp corners at large sizes; MSDF is available only via pre-generated atlases. **Text stroke requires SDF on.**

## Images

- **Formats:** PNG, JPEG, BMP, TGA, DDS, PSD, plus compressed ASTC/PKM/KTX. **GIFs are unsupported** for `background-image`, `border-image`, and `mask-image`.
- **No `object-fit`.** For cover/contain fitting, use a `<div>` with `background-size: cover`/`contain` instead of `<img>` (`menu-splashscreen.tsx:68`).
- **Percentage `width`/`height` on inline images are unsupported** - size their container instead.

### Image cache model (preload, and re-preload on scrollback)

Cohtml evicts images from its cache quickly, so images must be preloaded to display instantly and **re-preloaded when revisited**:

- The mod preloads images into Cohtml's cache via an injected `new Image()` script before showing them (`HallOfFame/Systems/ImagePreloaderUISystem.cs`).
- Scrolling back to a previously shown screenshot **must re-preload it** because it has likely been evicted (`HallOfFame/Services/ScreenshotCarousel.cs:86`).
- Re-setting an image `src` to the **same URL does not re-fire `onload`** (`ImagePreloaderUISystem.cs:109`); guard against it to avoid deadlocking the awaiting task.

## Video

`<video>` is partial: **no controls**, and only **WebM with VP8/VP9 video + Vorbis audio**. Transparent video (alpha channel, `yuva420p`) is supported for overlay/particle effects.

## SVG

- Usable inline, as `background-image`, as `<img>` src, or via `border-image-source`. The engine supports a **subset of SVG 2.0**, styleable/animatable with standard CSS.
- **Not supported:** `<foreignObject>`; `<tspan>` (ignored and merged into the parent `<text>`); pattern paint servers; `<marker>`; `vector-effects`; **SMIL animation** (use CSS/Web animations); scripting/interactivity inside the SVG.
- An element **can't use `mask: url(#...)` and `clip-path: url(#...)` simultaneously** (clip-path wins).
- **Inline SVGs are never GPU-cached**, and **auto-sizing of containers with inline SVG children is not supported** - give such containers explicit sizes.
- When CSS-animating SVG presentation attributes (`width`, `font-size`, ...), include units even though the SVG attribute itself may be unitless. Path interpolation needs matching command sequences; prefer quadratic/cubic curves over elliptical arcs.

## Canvas

- **2D context only** (`getContext("2d")`); **no WebGL**, no context attributes.
- **Unsupported methods include:** `getImageData`/`putImageData`/`createImageData`, `toDataURL`/`toBlob`, `clip`, `setLineDash`/`getLineDash`, `roundRect`, `isPointInPath`, `createRadialGradient`/`createConicGradient`.
- Gradients in canvas are limited: `createLinearGradient` doesn't apply to `strokeRect()`/`fillText()`/`strokeText()`; radial/conic gradients and `CanvasPattern` as a fill/stroke style are unsupported. `globalCompositeOperation` supports only `source-over`. Shadows, `filter`, and `imageSmoothing*` are unsupported.
- Supported: path drawing (`beginPath`/`moveTo`/`lineTo`/`arc`/`bezierCurveTo`/`rect`...), `fillRect`/`clearRect`, transforms, and `drawImage` (from image/canvas/video).
