# Component catalog

The authoritative, live version of this catalog is **`components.html`** — open
it in the browser (`serve.py`) to see every block rendered with a copy-paste
snippet. This file is the quick text index. Class names are defined in
`assets/css/styles.css`.

## Page skeleton

```html
<body class="js">  <!-- the inline <script> adds "js" for progressive enhancement -->
  <a class="skip-link" href="#top">Skip to content</a>
  <header class="site-header"><div class="header-pill"> …brand + nav… </div></header>
  <main id="top">
    <section class="hero"> … </section>
    <section id="…"> … </section>
  </main>
  <footer class="site-footer"> … </footer>
  <script src="assets/js/main.js"></script>
  <script src="assets/js/charts.js"></script>
  <script src="assets/js/tables.js"></script>
</body>
```

`<section>`s auto-alternate white / gray-soft by position; the hero stays plain.

## Layout primitives

| Class | Purpose |
|---|---|
| `.wide` | Standard content container (max 1280px). |
| `.reading` | Narrow reading column (max 720px) for prose-heavy sections. |
| `.bleed` | Extra-wide band for large figures that earn the room. |
| `.split` / `.split--rev` | Two-column figure-and-text (figure is the wider column; `--rev` flips sides). |
| `.col-2` / `.col-3` | Equal multi-column text grids. |
| `.prose` | Caps a text block to ~72ch inside a `.wide` band. |

## Typography & motifs

- `.eyebrow` — ALL-CAPS mono label with the black-square marker. Every section opens with one.
- `h1`/`h2`/`h3` — Applied Sans Display. `.hero h1 .accent` colors a phrase blue.
- `.lead` — larger serif standfirst under a headline.
- `mark.hl` — the highlighter swipe; use on ONE load-bearing claim per view.
- `blockquote.pull` — pull quote with a blue rule and optional `<cite>`.

## Buttons, badges, honesty tokens

- `.btn`, `.btn-primary` (one primary per view), `.btn-disabled` (an unreleased
  resource: `(on release)` / `(in preparation)`).
- `.status-badge`, `--venue`, `--prep`; `.inline-badge` after a title.
- `.tbd` (empty cell/span → renders "to be filled").

## Content blocks

| Class | Purpose |
|---|---|
| `.statline` | Row of big blue stat numbers with captions. |
| `.results-head` + `.results-badge` | Section heading with one big number floated right. |
| `.card-grid` / `.card` | Cards; `.card .stat` for a big number. |
| `.contribs` / `.contrib` | Numbered contribution triad with blue top rules. |
| `.figure` + `.figure-stage` + `figcaption` (`.fig-label`) | Bordered figure with a blue-labeled caption. |
| `.media-frame` | 16:9 dark mat for `<video>` / interactive media. |
| `.threeup` | Three-up media strip (triptych / before-after-diff). |
| `.placeholder` | Dashed "coming soon" panel. |

## Interactive (wired by `main.js`)

- **Tabs:** `.tabs[data-tabs]` → `.tabs-nav` (with `.tabs-slider` + `.tab-btn`s)
  and `.tab-panel[data-panel]`s. A blue thumb slides to the active tab; charts in
  hidden panels render on first show.
- **Sortable tables:** `table.data` with `th.sortable`. See `tables.js`. Use
  `.is-best` / `.best` for leaders, `.group-row` for section headers, `.tbd` for
  unknowns, `.data--text` for description (non-numeric) tables.
- **BibTeX:** the house pattern is a `<button id="bibtex-btn">BibTeX</button>` in the hero `.actions` row that copies a hidden `<pre id="bibtex-src" hidden>…</pre>` to the clipboard and flashes "BibTeX copied" (`main.js` wires it). For multiple citations, give each button `data-bibtex-src="<id>"` pointing at its own source. (A displayed `.bibtex` block, if you ever want one, also gets an inline Copy button.)
- **Charts:** see [`charts.md`](charts.md).

## Motion

Add `.reveal` to any block for a gentle scroll-in fade (disabled under
`prefers-reduced-motion`). Add `data-autoplay` to a `<video>` so it plays only
while on screen.
