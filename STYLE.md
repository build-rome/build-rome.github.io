# The design contract

This is the graphic-design contract for any site built from this template, and
the house style for the whole family. The brief: design as if placing a
full-page ad for a top research lab in *Science* or *Nature* — confident,
editorial, evidence-forward, and quiet. Every rule below serves one goal: **the
work is the hero; the design gets out of its way.**

Treat these as binding. When a change would violate one, change the change.

---

## 1. One message per viewport
A reader should be able to glance at any screenful and state its single point.
Lead with that point — headline first, evidence second, caveats last. If a
section is making two arguments, split it into two.

## 2. One accent color, spent sparingly
Applied Blue (`#006CFA`) is the only accent on the page. It works *because* it
is rare: it marks the one thing that matters in a given view (a key phrase, the
active nav item, the primary action, the hero data series) and nothing else.
Everything structural is ink (`#111`) and gray. A second accent color, or blue
used decoratively, kills the effect — don't. In charts, distinguish extra series
by **texture, dash, or marker shape**, never by a second hue.

## 3. Disciplined typographic hierarchy
Three roles, no improvising:
- **Applied Sans Display** — headlines and big numbers. Tight tracking, heavy.
- **Applied Sans Text** — UI, labels, captions, buttons, eyebrows.
- **XCharter (serif)** — running prose and leads, for an editorial, printed feel.

Hierarchy is built from **size, weight, and space** — not from color and not
from more typefaces. If two things need to feel different, change their scale,
not their hue.

## 4. Generous negative space and a real grid
White space is a design element, not leftover room. Keep wide top-and-bottom
section padding, a bounded reading measure (~56–72ch), and a consistent left
edge that prose, headings, and figures all share. When in doubt, remove
something and add space. Crowding reads as anxiety; space reads as confidence.

## 5. The page is white; dark is reserved
This is a light, editorial document, not a "hero-with-a-dark-gradient" landing
page. The background is white, sections alternate white and a faint gray-soft
for rhythm, and the **only** dark surfaces are the footer and the mats behind
video/figures. Resist the reflex to drop a dark, glowing hero on top — it reads
as generic and fights the brand. Contrast comes from type, space, and the blue
accent, not from inverting the page.

## 6. Editorial motifs, used consistently
The brand's quiet signatures carry the identity: the **black-square eyebrow**
marker, **ALL-CAPS mono eyebrows**, **blue caption/figure labels**, thin
hairline rules between sections, numbered or top-ruled feature blocks. Reuse
them; don't invent new ornament. Consistency *is* the polish.

## 7. Show the work, full-bleed when it earns it
Video and figures are the proof. Give them room: 16:9 frames, contained (never
cropped), in a quiet dark mat with a hairline border. Pair each with a single
plain-spoken sentence of context. Let media run wider than the text column when
the content rewards it (`.bleed`, `.split`).

## 8. Aspirational, plain-spoken copy
Headlines make one confident claim in the register of "Physical AI that Moves
the World" — a statement, not a description. Body copy is direct and concrete;
no hype words, no stacked adjectives, no jargon a smart non-specialist couldn't
follow. Confidence comes from specificity (numbers, benchmarks, mechanisms),
not from volume.

## 9. Consistent treatment, order carries emphasis
Sibling items (projects, results, methods) use the same card, spread size, and
nav weight — the visual system never plays favorites. What *does* carry emphasis
is **sequence**: order by importance, not alphabetically. Let the information
architecture reflect the truth of the relationship; keep the treatment uniform
and let order do the ranking.

## 10. Never fabricate
Unpublished results and unreleased links render as an explicit, muted "on
release" / "in preparation" token (`.btn-disabled`) or the `.tbd`
"to be filled" cell — never an invented number, placeholder URL, or overstated
claim. Credibility is the whole point of the *Science* register; one fabricated
cell forfeits it.

## 11. Quiet, purposeful motion
Motion exists only to direct attention: a gentle scroll-reveal, charts that
animate once when they enter view, videos that play on screen and pause off it.
Nothing bounces, spins, or competes with reading. All motion honors
`prefers-reduced-motion`, and the page is fully legible with animation — and
JavaScript — disabled.

## 12. Accessible and robust by default
Semantic landmarks, real heading order, `alt`/`aria` where needed, visible focus
states, AA contrast on every text/background pair (including the dark fields).
Progressive enhancement: the static HTML is the product; JS only enriches it.

## 13. Static, dependency-free, fast
No build step, no framework, no runtime dependencies. Vendored fonts, hand-
written CSS over shared tokens, a few KB of vanilla JS. Heavy media lives on a
CDN-backed store (e.g. an HF dataset repo), lazy-loaded. The page should feel
instant.

---

### The test
Before shipping a change, ask: *Could this run as a full page in a science
journal next to the best labs in the world, and would the work — not the
decoration — be the first thing a reader remembers?* If not, simplify until the
answer is yes.
