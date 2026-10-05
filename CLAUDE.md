# Research website — repo rules for agents

This is a **single static site**, deployed to GitHub Pages with **no build
step**. Keep it that way: plain HTML/CSS/JS, no bundler, no framework, no npm.
The only Python is the standard-library preview server (`serve.py`).

**Read [`STYLE.md`](STYLE.md) before changing any layout or visuals.** It is the
contract for how this site looks; the points below are the enforced hard rules.
A deeper guide for building pages lives in
[`.claude/skills/research-website/`](.claude/skills/research-website/SKILL.md).

## Design discipline (enforced)

- **Reuse the design system.** `assets/css/styles.css` is the shared Applied
  Intuition design system. Do **not** fork or rewrite it — put site-specific
  styles in `assets/css/site.css`, built only from the existing design tokens
  (`--blue`, `--ink`, `--gray`, the type and spacing scales). **Never hard-code
  a hex color or font stack that a token already covers.**
- **One accent color.** Applied Blue `#006CFA` is the only accent. It marks the
  single most important thing in view and nothing else. Everything structural is
  ink/gray. In charts, extra series are distinguished by texture/dash/marker,
  never a second hue.
- **Consistent treatment, ordered by priority.** Sibling items share one card,
  spread, and nav style — no item is visually dominant. The *order* carries the
  emphasis: sequence by importance, not alphabetically.
- **Never fabricate.** Unreleased papers/links render as a disabled
  `btn-disabled` "(on release)" / "(in preparation)" token, and unknown numbers
  as `.tbd` — never a fake URL, number, or claim.
- **Keep motion quiet and accessible.** Scroll-reveal and one-shot chart
  animations only; everything must honor `prefers-reduced-motion` and work with
  JavaScript disabled. The static HTML is the product; JS only enriches it.
- **Compose from existing components.** Build pages from the blocks in
  `components.html` (open it in the browser — it is the live catalog). Don't
  invent new ornament.

## Charts

Charts are declarative and data-driven — you should never edit `charts.js` to
change numbers. Add a JSON file under `assets/data/`, then:

```html
<div class="chart-wrap">
  <div class="chart" data-chart="line"
       data-src="assets/data/my-data.json"
       data-fallback="assets/figures/my-data.png"></div>
</div>
```

Types: `bar` (grouped/stacked), `line`, `scatter` (+bubble), `area`
(stacked/overlap), `hbar`, `donut`. JSON schemas:
[`.claude/skills/research-website/references/charts.md`](.claude/skills/research-website/references/charts.md).
Always provide a `data-fallback` static image so the chart degrades gracefully.

## Video / heavy media: never commit to git

`.mp4`, `.mov`, `.gif`, `.webm` are git-ignored. Host heavy media on a
CDN-backed store (e.g. a Hugging Face **dataset** repo) and embed the **resolve**
URL directly in `<video src="...">`. Resolve URLs are CDN-backed, support
`Range` requests (seeking), and send correct CORS headers for in-browser embeds.
Do **not** use HF `hf://buckets/...` URLs — browsers can't speak the Xet
protocol. Add `data-autoplay` to a `<video>` to have it play only while on
screen.

## Preview

```sh
uv run serve.py           # http://127.0.0.1:8888, no-cache, binds 0.0.0.0
uv run serve.py --port N  # if 8888 is taken
```

The site is fully static — just refresh the browser after editing files.

## Deploy

Push to `main`; `.github/workflows/pages.yml` publishes the repo root to GitHub
Pages (enable Settings → Pages → Source: GitHub Actions once).
