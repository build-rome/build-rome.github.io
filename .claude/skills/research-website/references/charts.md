# Chart library reference (`charts.js` → `RWCharts`)

Every chart is a `.chart` host element with `data-chart="<type>"` and a data
source. `RWCharts.init()` runs on `DOMContentLoaded`, finds every host, loads
its data, and renders. Call `RWCharts.init(rootEl)` again after injecting charts
dynamically (tabs do this automatically).

## Host markup

```html
<div class="chart-wrap">
  <div class="chart"
       data-chart="line"                       <!-- required: chart type -->
       data-src="assets/data/scaling.json"      <!-- data source (fetched) -->
       data-fallback="assets/figures/scaling.png"  <!-- shown if fetch fails -->
       data-alt="Scaling curve"></div>          <!-- alt text for the fallback -->
</div>
```

Alternatively pass data inline (no fetch) with `data-json='{...}'`.

## Shared conventions

- **Hero series:** set `"highlight": true` on the one series that matters → it
  renders in Applied Blue. All other series are neutral (ink/gray), told apart by
  dash/marker/hatch. This is the house rule — do not add a second hue.
- **`"palette": "categorical"`** (top-level, optional): opt into a multi-hue
  palette for peer series with no hero. Breaks the one-accent rule; use rarely.
- **Number formats** (`yFormat`, `xFormat`, `valueFormat`): `"si"` (1.2M / 340K),
  `"int"`, `"f1"`, `"f2"`, `"pct"` (0.42 → 42%), `"pct1"`, or `"plain"` (default).
  String/categorical labels pass through unchanged.
- **`title`**, **`note`** (optional): a centered title above and a small note
  below the chart.
- **`width`, `height`** (optional): override the SVG viewBox; charts are
  responsive to their container regardless.

---

## `bar` — grouped or stacked vertical bars

```json
{
  "type": "bar",
  "mode": "grouped",            // "grouped" | "stacked"
  "title": "Throughput by hardware tier",
  "yLabel": "samples / sec",
  "yFormat": "si",
  "note": "Higher is better.",
  "groups": [
    { "key": "a100", "label": "A100" },
    { "key": "h100", "label": "H100" }
  ],
  "series": [
    { "name": "Ours", "highlight": true, "values": { "a100": 1250000, "h100": 2100000 } },
    { "name": "Baseline A", "values": { "a100": 420000, "h100": 760000 } }
  ]
}
```

`series[].values` is keyed by `groups[].key`. Grouped mode prints the exact value
atop each bar; both modes toggle series from the legend.

## `line` — multi-series line chart

```json
{
  "type": "line",
  "title": "Score vs. training steps",
  "xLabel": "training steps", "yLabel": "closed-loop score",
  "xFormat": "si", "yFormat": "f2",
  "series": [
    { "name": "Ours", "highlight": true, "points": [[0, 0.08], [100000, 0.52], [1200000, 0.9]] },
    { "name": "Baseline", "points": [[0, 0.06], [100000, 0.33], [1200000, 0.6]] }
  ]
}
```

`points` are `[x, y]` pairs (numeric x). The hero line is solid and draws on;
neutral lines use dash patterns. Every vertex is hoverable.

## `scatter` — points, with optional bubble size

```json
{
  "type": "scatter",
  "title": "Accuracy vs. latency",
  "xLabel": "latency (ms)", "yLabel": "accuracy",
  "xFormat": "int", "yFormat": "f2",
  "series": [
    { "name": "Ours", "highlight": true, "points": [[14, 0.91, 120], [22, 0.93, 340]] },
    { "name": "Baselines", "points": [[38, 0.86, 210], [72, 0.9, 1300]] }
  ]
}
```

`points` are `[x, y]` or `[x, y, size]`. If any point has a 3rd value, all points
scale as bubbles (area ∝ value). Each series uses a distinct marker shape
(circle, square, triangle, diamond).

## `area` — stacked or overlapping filled areas

```json
{
  "type": "area",
  "mode": "stacked",            // "stacked" | "overlap"
  "title": "Scenario hours per month",
  "xLabel": "month", "yLabel": "scenario-hours (K)",
  "yFormat": "int",
  "x": ["Jan", "Feb", "Mar", "Apr"],
  "series": [
    { "name": "Urban", "highlight": true, "values": [12, 18, 27, 39] },
    { "name": "Highway", "values": [8, 11, 15, 19] }
  ]
}
```

`x` is the shared axis (numbers or category strings). `series[].values` is a
parallel array. Stacked mode uses hatch fills for neutral series; overlap mode
uses translucent fills.

## `hbar` — ranked horizontal bars

```json
{
  "type": "hbar",
  "title": "Leaderboard (HD-Score)",
  "xLabel": "HD-Score", "xFormat": "f2",
  "items": [
    { "label": "Ours", "value": 0.49, "highlight": true },
    { "label": "Prior SOTA", "value": 0.42 }
  ]
}
```

One bar per item, in the order given (rank them yourself). The `highlight` item
is blue. `labelWidth` (optional) widens the label gutter for long names.

## `donut` — composition

```json
{
  "type": "donut",
  "title": "Training mix",
  "centerLabel": "12.4M",
  "centerSub": "scenarios",
  "valueFormat": "int",
  "items": [
    { "label": "Intersections", "value": 4200 },
    { "label": "Merges", "value": 3100 }
  ]
}
```

Wedges use a sequential blue ramp (override per item with `"color": "#..."`).
Percentages are computed automatically and shown in the legend and on hover. Use
sparingly — one composition per chart.

---

## Fallback & accessibility

- Always set `data-fallback` to a static image (an exported PNG/SVG of the same
  chart) so the page still shows the figure if JS/fetch fails.
- Each SVG gets `role="img"` and an `aria-label` from the chart `title`.
- Animations are disabled and everything renders at final state under
  `prefers-reduced-motion`.
