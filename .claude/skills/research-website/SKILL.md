---
name: research-website
description: Use when building or editing a research project website from this template — landing pages, technical-report pages, or project index pages in the Applied Intuition house style (white editorial "Science/Nature" register, one blue accent, Applied Sans + XCharter, static/no-build). Covers scaffolding a page, the component catalog, the declarative chart library (bar/line/scatter/area/hbar/donut), sortable tables, video hosting, serving, and deploy.
---

# Building a research website

This template produces static, dependency-free research pages in the Applied
Intuition house style: a white, editorial page that would sit as a full-page ad
in *Science* or *Nature*. **The work is the hero; the design gets out of its
way.** No build step, no framework — plain HTML/CSS/JS over a shared design
system.

## Before you start

1. **Read [`STYLE.md`](../../../STYLE.md)** — the 13-rule design contract. It is
   binding. The single most important rules: *one message per viewport*, *one
   accent color (Applied Blue) spent sparingly*, *never fabricate*, *the page is
   white — dark is reserved*.
2. **Read [`CLAUDE.md`](../../../CLAUDE.md)** — the enforced hard rules (reuse
   tokens, no hard-coded hex, static-only, honesty tokens, quiet motion).
3. **Open `components.html` in the browser** (via `serve.py`) — it is the live
   catalog of every block and chart with copy-paste snippets. Build by lifting
   from it, not by inventing.

## The workflow

1. **Serve it:** `uv run serve.py` → http://127.0.0.1:8888 (and
   `/components.html`). No build; refresh after edits.
2. **Start from `index.html`.** It has the correct header / hero / section /
   footer skeleton. Rewrite the copy; keep the structure and class names.
3. **Compose from components.** Pull blocks from `components.html`. See
   [`references/components.md`](references/components.md) for the catalog.
4. **Add evidence.** Charts (below), sortable tables, figures, video.
5. **Custom CSS goes in `assets/css/site.css`**, built only from the tokens in
   [`references/design-tokens.md`](references/design-tokens.md). Never edit
   `styles.css`; never hard-code a color/font a token already covers.
6. **Verify:** check it renders, animates on scroll, works with JS disabled, and
   passes the STYLE.md "science journal" test. Screenshot it if you can.

## Charts (the common ask)

Charts are **declarative and data-driven** — never edit `charts.js` to change
numbers. Drop a JSON file in `assets/data/`, then point a host at it:

```html
<div class="chart-wrap">
  <div class="chart" data-chart="bar"
       data-src="assets/data/throughput.json"
       data-fallback="assets/figures/throughput.png"></div>
</div>
<script src="assets/js/charts.js"></script>
```

Six types: `bar` (grouped/stacked), `line`, `scatter` (+bubble), `area`
(stacked/overlap), `hbar`, `donut`. The library animates once on scroll-in,
shows exact values on hover, toggles series from the legend, honors
`prefers-reduced-motion`, and swaps in `data-fallback` if the fetch fails.

**House rule for series color:** the *hero* series carries `"highlight": true`
and renders in Applied Blue; every other series is neutral (ink/gray) and is
told apart by dash pattern (lines), marker shape (scatter), or hatch
(bars/areas) — **never a second hue**. Only reach for the categorical palette
(`"palette": "categorical"`) when you truly have many peer series and no hero;
prefer not to.

Full JSON schema for every type: [`references/charts.md`](references/charts.md).

## Tables

Add `class="data"` to a `<table>`; add `class="sortable"` to any `<th>` to make
its column click-sortable (`tables.js` wires it). Mark a leader row with
`class="is-best"` or a winning cell with `class="best"`. Unknown values are
`<td class="tbd"></td>` — renders "to be filled", sorts last. Never invent a
number.

## Video & heavy media

Never commit `.mp4/.mov/.gif` (git-ignored). Host on a CDN-backed store (e.g. a
Hugging Face **dataset** repo) and embed the **resolve** URL in
`<video src="...">`. Wrap in `.media-frame` for the 16:9 dark mat; add
`data-autoplay muted loop playsinline` so it plays only while on screen. Do NOT
use `hf://buckets/...` URLs (browsers can't read the Xet protocol).

## Deploy

Push to `main`; `.github/workflows/pages.yml` publishes the repo root to GitHub
Pages (enable Settings → Pages → Source: GitHub Actions once).

## Red flags — stop if you catch yourself

- Adding a second accent color, or a dark glowing hero → violates STYLE.md 2 & 5.
- Hard-coding `#....` or a font stack in `site.css` → use a token.
- Editing `styles.css` or `charts.js` for a one-off → use `site.css` / JSON data.
- Writing a placeholder URL or an invented number → use the honesty tokens.
- Adding a bundler, framework, or npm dependency → this template is static.
- Bouncy/spinning motion, or motion that ignores `prefers-reduced-motion`.
