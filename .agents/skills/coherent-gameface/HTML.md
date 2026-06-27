# HTML in Cohtml

Cohtml parses any markup, but only a subset of elements carry real semantics or default styling. **An unsupported tag is not an error** - it is laid out as a generic flex box with no special behavior. So a `<table>` or `<select>` "renders" but does nothing useful. Verify against `localhost:9444` when unsure.

## Supported elements

`<html>`, `<head>`, `<title>`, `<body>`, `<div>`, `<p>`, `<span>`, `<a>`, `<b>`, `<i>`, `<strong>`, `<h1>`-`<h6>`, `<header>`, `<footer>`, `<nav>`, `<img>`.

- `<a>` does **not** restyle its hierarchy (link text is not underlined by default).
- `<p>` and `<span>` default to `display: flex; flex-direction: row` (see the flex-only model in [CSS.md](CSS.md)).

## Partially supported (with caveats)

| Element | Caveat |
| --- | --- |
| `<input>` | Only `text`, `button`, and `password` types. |
| `<button>` | Behaves like a regular element with predefined styles. |
| `<textarea>` | Partial. |
| `<canvas>` | 2D context only, no WebGL (see [GRAPHICS-AND-FONTS.md](GRAPHICS-AND-FONTS.md)). |
| `<video>` | No controls; WebM/VP8-VP9 only (see [GRAPHICS-AND-FONTS.md](GRAPHICS-AND-FONTS.md)). |
| `<link>` | Only `rel="stylesheet"` and `media`. |
| `<script>` | Only `src`, `type`, `async`, `defer` attributes. |
| `<style>` | Attributes (e.g. `media`) not supported. |
| `<br>` | Only inside a tag that already has text; `<br>` *between* tags is disabled. Gameface merges consecutive text segments into one node. |
| `<!-- -->` | Comments are stripped and absent from the DOM. |

## Not supported (rendered as inert flex boxes)

- **Form controls** except text/button/password `<input>`: `<form>`, `<select>`, `<option>`, `<label>`, `<fieldset>`, `<datalist>`, `<output>`. Gameface ships a JS **component library** that polyfills these as custom elements if you genuinely need them, but this codebase builds its own controls in React instead.
- **The entire table family:** `<table>`, `<tr>`, `<td>`, `<th>`, `<thead>`, `<tbody>`, `<tfoot>`, `<caption>`, `<col>`, `<colgroup>`. Build tabular layouts with flex.
- **Lists:** `<ul>`, `<ol>`, `<li>`, `<dl>`, `<dt>`, `<dd>` (no default markers).
- **Embedding:** `<iframe>`, `<frame>`, `<object>`, `<embed>`, `<audio>`.
- **Misc:** `<details>`, `<summary>`, `<dialog>`, `<progress>`, `<meter>`, `<hr>`, `<pre>`, `<blockquote>`, `<sub>`, `<sup>`, `<em>`, `<section>`, `<article>`, `<aside>`, `<main>`, `<figure>`.

## Behavioral notes

- **Most elements lack default user-agent styles** (headings, lists, `<textarea>`, `<blockquote>`, ...) - set margins/sizes/weights explicitly.
- **Include `<!DOCTYPE html>`** - its absence triggers legacy layout behaviors.
- Everything defaults to flex + `border-box`; see [CSS.md](CSS.md) for the layout consequences.
