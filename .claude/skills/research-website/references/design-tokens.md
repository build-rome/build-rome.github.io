# Design tokens

All defined in `:root` in `assets/css/styles.css`. **Build every custom style in
`site.css` from these** — never hard-code a value a token already covers.

## Color

| Token | Value | Use |
|---|---|---|
| `--blue` | `#006CFA` | The one accent. The single most important thing in view. |
| `--blue-dark` | `#0052bd` | Primary button hover. |
| `--blue-muted` | `#3d7fc4` | Muted blue (tbd text, subtle marks). |
| `--blue-wash` / `--blue-wash-2` | `#eef4ff` / `#e0ecff` | Light blue surfaces, the `mark.hl` swipe. |
| `--ink` | `#111111` | All structural text and rules. |
| `--gray` | `#767676` | Secondary text, captions, eyebrows. |
| `--gray-line` | `#e4e4e4` | Hairline borders. |
| `--gray-soft` | `#f6f7f9` | Alternating section tint, card wells. |
| `--white` | `#ffffff` | Page background. |
| `--dark-mat` | `#0d1117` | The quiet dark behind video/figures. |

### Chart palette
The hero series is `--blue`. Neutral series use `--series-1..4` (ink→gray) and
are distinguished by texture/dash/marker. `--seq-1..6` is a sequential blue ramp
(donut wedges). `--cat-1..6` is an optional categorical palette — breaks the
one-accent rule; use only for many peer series with no hero.

## Type

| Token | Stack | Role |
|---|---|---|
| `--font-display` | Applied Sans Display | Headlines, big numbers. |
| `--font-sans` | Applied Sans Text | UI, labels, captions, buttons, eyebrows. |
| `--font-serif` | XCharter | Running prose, leads (body default). |
| `--font-mono` | system mono | Eyebrows, bylines, code, copyright. |

Scale: `--fs-eyebrow` `.72rem`, `--fs-meta` `.82rem`, `--fs-body` `1.0625rem`,
`--fs-lead` `1.3rem`, `--fs-h3` `1.18rem`, `--fs-h2` `2.2rem`,
`--fs-title` `clamp(2.05rem, 5vw, 3.6rem)`.

## Spacing

`--space-1` `.5rem` · `--space-2` `1rem` · `--space-3` `1.5rem` ·
`--space-4` `2.5rem` · `--space-5` `4rem` · `--space-6` `6rem` (section padding).

## Layout

`--reading` `720px` · `--wide` `1280px` · `--header-h` `60px` ·
`--header-gap` `14px` · `--radius` `10px` · `--shadow`, `--shadow-lift`.

## Example override (in `site.css`)

```css
/* GOOD — built from tokens */
.my-callout { border-left: 3px solid var(--blue); padding-left: var(--space-3); }

/* BAD — hard-coded values a token already covers */
.my-callout { border-left: 3px solid #006CFA; padding-left: 24px; }
```
