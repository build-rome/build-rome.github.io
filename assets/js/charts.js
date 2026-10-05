/* ==========================================================================
   RWCharts — a small, dependency-free SVG chart library for the research
   website template. One module, six chart types, all in the house style.
   ---------------------------------------------------------------------------
   USAGE (declarative — the normal path):

     <div class="chart-wrap">
       <div class="chart" data-chart="line"
            data-src="assets/data/scaling.json"
            data-fallback="assets/figures/scaling.png"></div>
     </div>
     <script src="assets/js/charts.js"></script>

   RWCharts.init() runs automatically on DOMContentLoaded: it finds every
   `.chart[data-chart]`, loads its JSON (from `data-src`, or inline `data-json`),
   renders it, and — if the fetch fails — swaps in the `data-fallback` image so
   the page degrades gracefully. Call RWCharts.init() again after injecting
   charts dynamically.

   TYPES: bar (grouped|stacked), line, scatter (+bubble), area (stacked|overlap),
   hbar, donut. See .claude/skills/research-website/references/charts.md for the
   JSON schema of each.

   HOUSE STYLE: one accent. The *hero* series is Applied Blue; every other
   series is ink/gray, distinguished by dash pattern (lines), marker shape
   (scatter), or hatch (bars/areas) — never by a second hue. Everything is
   print- and greyscale-safe, animates once on scroll-in, honors
   prefers-reduced-motion, and shows exact values on hover.
   ========================================================================== */
(function () {
  "use strict";

  var SVGNS = "http://www.w3.org/2000/svg";

  /* ---- palette (mirrors the tokens in styles.css) ------------------------ */
  var BLUE = "#006CFA";
  var INK = "#1f2937";
  var GRAY = "#767676";
  var LINE = "#e4e4e4";
  var SERIES = ["#1f2937", "#6b7280", "#9aa3af", "#c3c9d2"]; // non-hero neutrals
  var SEQ = ["#003a86", "#0052bd", "#006CFA", "#4d97fb", "#99c3fd", "#cfe1fe"];
  var CAT = ["#006CFA", "#e8710a", "#12a594", "#8b5cf6", "#d6409f", "#eab308"];
  // dash patterns for non-hero lines; hero line is solid
  var DASH = ["", "7 4", "2 3", "9 3 2 3", "1 4", "12 4"];
  // hatch styles for non-hero bars/areas (told apart by texture, not shade)
  var HATCH = ["diag", "cross", "dots", "vert", "back", "horiz"];
  var HATCH_FG = "#5b6573", HATCH_BG = "#eceef1", HATCH_STROKE = "#b9bfc8";

  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- tiny DOM helpers -------------------------------------------------- */
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function text(x, y, s, attrs) {
    var t = el("text", attrs || {});
    t.setAttribute("x", x); t.setAttribute("y", y);
    t.textContent = s;
    return t;
  }
  function svgRoot(w, h, label) {
    return el("svg", {
      viewBox: "0 0 " + w + " " + h, width: "100%",
      "font-family": "'Applied Sans Text',sans-serif",
      role: "img", "aria-label": label || "chart"
    });
  }

  /* ---- number formatting ------------------------------------------------- */
  function fmt(v, kind) {
    if (v == null) return "";
    if (typeof v === "string") return v;   // categorical labels pass through
    if (isNaN(v)) return "";
    switch (kind) {
      case "si":
        if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
        if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
        return String(v);
      case "int": return String(Math.round(v));
      case "f1": return v.toFixed(1);
      case "f2": return v.toFixed(2);
      case "pct": return (v * 100).toFixed(0) + "%";
      case "pct1": return (v * 100).toFixed(1) + "%";
      default:
        // trim needless trailing zeros
        return (Math.round(v * 1000) / 1000).toString();
    }
  }

  /* ---- "nice" axis ticks ------------------------------------------------- */
  function niceNum(range, round) {
    var exp = Math.floor(Math.log(range) / Math.LN10);
    var frac = range / Math.pow(10, exp);
    var nice;
    if (round) nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
    else nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
    return nice * Math.pow(10, exp);
  }
  function ticks(min, max, count) {
    if (min === max) { max = min + 1; }
    var range = niceNum(max - min, false);
    var step = niceNum(range / (Math.max(2, count) - 1), true);
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var out = [];
    // guard against float drift
    for (var v = lo; v <= hi + step * 0.5; v += step) out.push(Math.round(v / step) * step);
    return out;
  }

  /* ---- color / texture selection ----------------------------------------- */
  function seriesColor(i, highlight, palette) {
    if (highlight) return BLUE;
    if (palette === "categorical") return CAT[i % CAT.length];
    return SERIES[i % SERIES.length];
  }
  function hatchOf(i) { return HATCH[i % HATCH.length]; }
  function makePattern(id, kind) {
    var s = kind === "dots" ? 8 : 7;
    var p = el("pattern", { id: id, patternUnits: "userSpaceOnUse", width: s, height: s });
    p.appendChild(el("rect", { x: 0, y: 0, width: s, height: s, fill: HATCH_BG }));
    function ln(x1, y1, x2, y2) {
      return el("line", { x1: x1, y1: y1, x2: x2, y2: y2, stroke: HATCH_FG, "stroke-width": 1.4, "stroke-linecap": "square" });
    }
    if (kind === "diag" || kind === "cross") p.appendChild(ln(0, s, s, 0));
    if (kind === "back" || kind === "cross") p.appendChild(ln(0, 0, s, s));
    if (kind === "vert") p.appendChild(ln(s / 2, 0, s / 2, s));
    if (kind === "horiz") p.appendChild(ln(0, s / 2, s, s / 2));
    if (kind === "dots") p.appendChild(el("circle", { cx: s / 2, cy: s / 2, r: 1.5, fill: HATCH_FG }));
    return p;
  }

  /* ---- shared tooltip ---------------------------------------------------- */
  function makeTip(host) {
    var tip = document.createElement("div");
    tip.className = "chart-tooltip";
    host.appendChild(tip);
    return {
      show: function (ev, html) {
        var r = host.getBoundingClientRect();
        tip.style.left = (ev.clientX - r.left) + "px";
        tip.style.top = (ev.clientY - r.top) + "px";
        tip.style.opacity = 1;
        tip.innerHTML = html;
      },
      hide: function () { tip.style.opacity = 0; }
    };
  }

  /* ---- optional title + note + legend ------------------------------------ */
  function addTitle(host, data) {
    if (!data.title) return;
    var h = document.createElement("p");
    h.className = "chart-title";
    h.textContent = data.title;
    host.insertBefore(h, host.firstChild);
  }
  function addNote(host, data) {
    if (!data.note) return;
    var n = document.createElement("p");
    n.className = "chart-note";
    n.textContent = data.note;
    host.appendChild(n);
  }
  // legend for series-based charts; clicking a key toggles and re-draws
  function addLegend(host, series, hidden, swatchFor, redraw) {
    var legend = document.createElement("div");
    legend.className = "chart-legend";
    series.forEach(function (s, i) {
      var key = document.createElement("span");
      key.className = "key " + (hidden[i] ? "off" : "on");
      key.setAttribute("role", "button");
      key.setAttribute("tabindex", "0");
      key.appendChild(swatchFor(s, i));
      key.appendChild(document.createTextNode(s.name));
      function toggle() {
        hidden[i] = !hidden[i];
        key.className = "key " + (hidden[i] ? "off" : "on");
        redraw();
      }
      key.addEventListener("click", toggle);
      key.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
      legend.appendChild(key);
    });
    host.appendChild(legend);
  }
  function swatchBox(color) {
    var sw = document.createElement("span");
    sw.className = "swatch";
    sw.style.background = color;
    return sw;
  }

  /* ---- reveal-on-scroll -------------------------------------------------- */
  function onReveal(host, cb) {
    if (reduceMotion || !("IntersectionObserver" in window)) { cb(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { cb(); io.disconnect(); } });
    }, { threshold: 0.2 });
    io.observe(host);
  }

  /* ======================================================================
     BAR — grouped or stacked vertical bars
     ====================================================================== */
  function renderBar(host, data) {
    var W = data.width || 920, H = data.height || 460;
    var ml = 66, mr = 20, mt = 20, mb = 76;
    var pw = W - ml - mr, ph = H - mt - mb;
    var stacked = data.mode === "stacked";
    var groups = data.groups, series = data.series;
    var yFmt = data.yFormat || "si";
    var hidden = series.map(function () { return false; });
    var palette = data.palette;
    var grown = false;

    var tip = makeTip(host);
    var svg = svgRoot(W, H, data.title || "bar chart");
    host.appendChild(svg);

    function maxVal() {
      var m = 0;
      groups.forEach(function (g) {
        if (stacked) {
          var sum = 0;
          series.forEach(function (s, i) { if (!hidden[i]) sum += (s.values[g.key] || 0); });
          if (sum > m) m = sum;
        } else {
          series.forEach(function (s, i) { if (!hidden[i]) { var v = s.values[g.key] || 0; if (v > m) m = v; } });
        }
      });
      return m;
    }

    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var defs = el("defs", {});
      series.forEach(function (s, i) { if (!s.highlight && !palette) defs.appendChild(makePattern("rwpat-" + i, hatchOf(i))); });
      svg.appendChild(defs);

      var tk = ticks(0, maxVal() || 1, 6);
      var vmax = tk[tk.length - 1] || 1;
      var yOf = function (v) { return mt + ph * (1 - v / vmax); };
      var baseY = mt + ph;

      tk.forEach(function (gv) {
        var y = yOf(gv);
        svg.appendChild(el("line", { x1: ml, y1: y, x2: W - mr, y2: y, stroke: LINE }));
        svg.appendChild(text(ml - 10, y + 5, fmt(gv, yFmt), { "text-anchor": "end", "font-size": 15, fill: GRAY }));
      });

      var groupW = pw / groups.length;
      groups.forEach(function (g, gi) {
        var gcx = ml + gi * groupW + groupW / 2;
        svg.appendChild(text(gcx, H - mb + 28, g.label, { "text-anchor": "middle", "font-size": 17, "font-weight": 700, fill: INK }));

        var vis = series.map(function (s, i) { return { s: s, i: i }; }).filter(function (o) { return !hidden[o.i]; });

        if (stacked) {
          var acc = 0;
          vis.forEach(function (o) {
            var v = o.s.values[g.key] || 0;
            var y0 = yOf(acc), y1 = yOf(acc + v);
            acc += v;
            var barW = Math.min(70, groupW - 26);
            var x = gcx - barW / 2;
            var fill = o.s.highlight ? BLUE : (palette ? seriesColor(o.i, false, palette) : "url(#rwpat-" + o.i + ")");
            var rect = el("rect", { x: x, y: y1, width: barW, height: Math.max(0, y0 - y1), rx: 2, "class": "rw-bar", fill: fill });
            if (!o.s.highlight && !palette) { rect.setAttribute("stroke", HATCH_STROKE); rect.setAttribute("stroke-width", 1); }
            animBar(rect);
            bindTip(rect, o.s, g, v);
            svg.appendChild(rect);
          });
        } else {
          var barW2 = Math.min(48, (groupW - 26) / Math.max(1, vis.length));
          var start = gcx - (barW2 * vis.length) / 2;
          vis.forEach(function (o, bi) {
            var v = o.s.values[g.key] || 0;
            var x = start + bi * barW2, y = yOf(v);
            var fill = o.s.highlight ? BLUE : (palette ? seriesColor(o.i, false, palette) : "url(#rwpat-" + o.i + ")");
            var rect = el("rect", { x: x, y: y, width: Math.max(4, barW2 - 4), height: Math.max(0, baseY - y), rx: 2, "class": "rw-bar", fill: fill });
            if (!o.s.highlight && !palette) { rect.setAttribute("stroke", HATCH_STROKE); rect.setAttribute("stroke-width", 1); }
            rect.style.transitionDelay = (gi * 0.06 + bi * 0.04) + "s";
            animBar(rect);
            bindTip(rect, o.s, g, v);
            svg.appendChild(rect);
            var vt = text(x + (barW2 - 4) / 2, y - 7, fmt(v, yFmt), {
              "text-anchor": "middle", "font-size": 14, "font-weight": o.s.highlight ? 700 : 400,
              fill: o.s.highlight ? BLUE : INK, "class": "rw-val"
            });
            vt.style.transition = "opacity .5s ease"; vt.style.transitionDelay = (gi * 0.06 + bi * 0.04 + 0.3) + "s";
            vt.style.opacity = (grown || reduceMotion) ? "1" : "0";
            svg.appendChild(vt);
          });
        }
      });

      svg.appendChild(el("line", { x1: ml, y1: baseY, x2: W - mr, y2: baseY, stroke: INK, "stroke-width": 1.5 }));
      if (data.yLabel) {
        var yl = text(16, mt + ph / 2, data.yLabel, { "font-size": 14, fill: GRAY, "text-anchor": "middle" });
        yl.setAttribute("transform", "rotate(-90 16 " + (mt + ph / 2) + ")");
        svg.appendChild(yl);
      }
    }

    function animBar(rect) {
      rect.style.cursor = "pointer";
      rect.style.transformBox = "fill-box";
      rect.style.transformOrigin = "bottom";
      rect.style.transition = "transform .8s cubic-bezier(.2,.7,.2,1)";
      rect.style.transform = (grown || reduceMotion) ? "scaleY(1)" : "scaleY(0)";
    }
    function bindTip(rect, s, g, v) {
      rect.addEventListener("mousemove", function (ev) {
        tip.show(ev, "<b>" + s.name + "</b> · " + g.label + " · " + fmt(v, yFmt));
      });
      rect.addEventListener("mouseleave", tip.hide);
    }

    draw();
    onReveal(host, function () {
      grown = true;
      svg.querySelectorAll(".rw-bar").forEach(function (b) { b.style.transform = "scaleY(1)"; });
      svg.querySelectorAll(".rw-val").forEach(function (t) { t.style.opacity = "1"; });
    });
    addLegend(host, series, hidden, function (s, i) {
      return swatchBox(s.highlight ? BLUE : (palette ? seriesColor(i, false, palette) : HATCH_FG));
    }, draw);
    addNote(host, data);
    addTitle(host, data);
  }

  /* ======================================================================
     LINE — multi-series line chart, draw-on animation
     ====================================================================== */
  function renderLine(host, data) {
    var W = data.width || 920, H = data.height || 460;
    var ml = 62, mr = 24, mt = 22, mb = 60;
    var pw = W - ml - mr, ph = H - mt - mb;
    var series = data.series;
    var xFmt = data.xFormat || "plain", yFmt = data.yFormat || "f2";
    var hidden = series.map(function () { return false; });
    var palette = data.palette;
    var shown = false;

    var tip = makeTip(host);
    var svg = svgRoot(W, H, data.title || "line chart");
    host.appendChild(svg);

    function extent() {
      var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      series.forEach(function (s, i) {
        if (hidden[i]) return;
        s.points.forEach(function (p) {
          if (p[0] < xmin) xmin = p[0]; if (p[0] > xmax) xmax = p[0];
          if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1];
        });
      });
      if (!isFinite(xmin)) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
      return { xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
    }

    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var e = extent();
      var yt = ticks(Math.min(0, e.ymin), e.ymax, 6);
      var ymin = yt[0], ymax = yt[yt.length - 1];
      var xt = ticks(e.xmin, e.xmax, 6);
      var xOf = function (x) { return ml + pw * (x - e.xmin) / ((e.xmax - e.xmin) || 1); };
      var yOf = function (y) { return mt + ph * (1 - (y - ymin) / ((ymax - ymin) || 1)); };

      yt.forEach(function (gv) {
        var y = yOf(gv);
        svg.appendChild(el("line", { x1: ml, y1: y, x2: W - mr, y2: y, stroke: LINE }));
        svg.appendChild(text(ml - 10, y + 5, fmt(gv, yFmt), { "text-anchor": "end", "font-size": 14, fill: GRAY }));
      });
      xt.forEach(function (gv) {
        if (gv < e.xmin - 1e-9 || gv > e.xmax + 1e-9) return;
        var x = xOf(gv);
        svg.appendChild(text(x, H - mb + 26, fmt(gv, xFmt), { "text-anchor": "middle", "font-size": 14, fill: GRAY }));
      });
      svg.appendChild(el("line", { x1: ml, y1: mt + ph, x2: W - mr, y2: mt + ph, stroke: INK, "stroke-width": 1.5 }));

      series.forEach(function (s, i) {
        if (hidden[i]) return;
        var color = s.highlight ? BLUE : seriesColor(i, false, palette);
        var d = s.points.map(function (p, k) { return (k ? "L" : "M") + xOf(p[0]).toFixed(1) + " " + yOf(p[1]).toFixed(1); }).join(" ");
        var path = el("path", {
          d: d, fill: "none", stroke: color,
          "stroke-width": s.highlight ? 3 : 2, "stroke-linejoin": "round", "stroke-linecap": "round",
          "class": "rw-line"
        });
        if (!s.highlight && !palette && DASH[i % DASH.length]) path.setAttribute("stroke-dasharray", DASH[i % DASH.length]);
        svg.appendChild(path);
        // draw-on: only for solid-dash lines (dashes can't animate the same way)
        if (!reduceMotion && (!path.getAttribute("stroke-dasharray"))) {
          try {
            var len = path.getTotalLength();
            path.style.strokeDasharray = len; path.style.strokeDashoffset = shown ? 0 : len;
            path.style.transition = "stroke-dashoffset 1.1s ease " + (i * 0.08) + "s";
          } catch (err) { /* getTotalLength unsupported */ }
        }
        // hover points
        s.points.forEach(function (p) {
          var cx = xOf(p[0]), cy = yOf(p[1]);
          if (s.highlight) svg.appendChild(el("circle", { cx: cx, cy: cy, r: 3, fill: color }));
          var hit = el("circle", { cx: cx, cy: cy, r: 11, fill: "transparent" });
          hit.style.cursor = "pointer";
          hit.addEventListener("mousemove", function (ev) {
            tip.show(ev, "<b>" + s.name + "</b> · " + fmt(p[0], xFmt) + ", " + fmt(p[1], yFmt));
          });
          hit.addEventListener("mouseleave", tip.hide);
          svg.appendChild(hit);
        });
      });

      if (data.yLabel) {
        var yl = text(15, mt + ph / 2, data.yLabel, { "font-size": 14, fill: GRAY, "text-anchor": "middle" });
        yl.setAttribute("transform", "rotate(-90 15 " + (mt + ph / 2) + ")");
        svg.appendChild(yl);
      }
      if (data.xLabel) svg.appendChild(text(ml + pw / 2, H - 8, data.xLabel, { "text-anchor": "middle", "font-size": 14, fill: GRAY }));
    }

    draw();
    onReveal(host, function () {
      shown = true;
      svg.querySelectorAll(".rw-line").forEach(function (p) { if (!p.getAttribute("stroke-dasharray") || p.style.strokeDasharray) p.style.strokeDashoffset = 0; });
    });
    addLegend(host, series, hidden, function (s, i) { return swatchBox(s.highlight ? BLUE : seriesColor(i, false, palette)); }, draw);
    addNote(host, data);
    addTitle(host, data);
  }

  /* ======================================================================
     SCATTER — with optional bubble radius (3rd value in a point)
     ====================================================================== */
  function renderScatter(host, data) {
    var W = data.width || 900, H = data.height || 500;
    var ml = 62, mr = 24, mt = 22, mb = 58;
    var pw = W - ml - mr, ph = H - mt - mb;
    var series = data.series;
    var xFmt = data.xFormat || "plain", yFmt = data.yFormat || "f2";
    var hidden = series.map(function () { return false; });
    var palette = data.palette;
    var shown = false;
    var SHAPES = ["circle", "square", "triangle", "diamond"];

    var tip = makeTip(host);
    var svg = svgRoot(W, H, data.title || "scatter plot");
    host.appendChild(svg);

    var hasBubble = series.some(function (s) { return s.points.some(function (p) { return p.length > 2; }); });
    var rMax = 0;
    if (hasBubble) series.forEach(function (s) { s.points.forEach(function (p) { if ((p[2] || 0) > rMax) rMax = p[2]; }); });

    function marker(shape, cx, cy, r, fill, stroke, hero) {
      var attrs = { fill: hero ? fill : "#fff", stroke: stroke || fill, "stroke-width": 1.6, "class": "rw-dot" };
      if (hero) attrs.fill = fill;
      var node;
      if (shape === "square") node = el("rect", Object.assign({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, rx: 1 }, attrs));
      else if (shape === "triangle") node = el("polygon", Object.assign({ points: (cx) + "," + (cy - r) + " " + (cx + r) + "," + (cy + r) + " " + (cx - r) + "," + (cy + r) }, attrs));
      else if (shape === "diamond") node = el("polygon", Object.assign({ points: cx + "," + (cy - r) + " " + (cx + r) + "," + cy + " " + cx + "," + (cy + r) + " " + (cx - r) + "," + cy }, attrs));
      else node = el("circle", Object.assign({ cx: cx, cy: cy, r: r }, attrs));
      return node;
    }

    function extent() {
      var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
      series.forEach(function (s, i) { if (hidden[i]) return; s.points.forEach(function (p) {
        if (p[0] < xmin) xmin = p[0]; if (p[0] > xmax) xmax = p[0];
        if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1];
      }); });
      if (!isFinite(xmin)) { xmin = 0; xmax = 1; ymin = 0; ymax = 1; }
      var padX = (xmax - xmin) * 0.06 || 1, padY = (ymax - ymin) * 0.08 || 1;
      return { xmin: xmin - padX, xmax: xmax + padX, ymin: ymin - padY, ymax: ymax + padY };
    }

    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var e = extent();
      var yt = ticks(e.ymin, e.ymax, 6), xt = ticks(e.xmin, e.xmax, 6);
      var xOf = function (x) { return ml + pw * (x - e.xmin) / ((e.xmax - e.xmin) || 1); };
      var yOf = function (y) { return mt + ph * (1 - (y - e.ymin) / ((e.ymax - e.ymin) || 1)); };

      yt.forEach(function (gv) {
        if (gv < e.ymin - 1e-9 || gv > e.ymax + 1e-9) return;
        var y = yOf(gv);
        svg.appendChild(el("line", { x1: ml, y1: y, x2: W - mr, y2: y, stroke: LINE }));
        svg.appendChild(text(ml - 10, y + 5, fmt(gv, yFmt), { "text-anchor": "end", "font-size": 14, fill: GRAY }));
      });
      xt.forEach(function (gv) {
        if (gv < e.xmin - 1e-9 || gv > e.xmax + 1e-9) return;
        var x = xOf(gv);
        svg.appendChild(el("line", { x1: x, y1: mt, x2: x, y2: mt + ph, stroke: LINE }));
        svg.appendChild(text(x, H - mb + 26, fmt(gv, xFmt), { "text-anchor": "middle", "font-size": 14, fill: GRAY }));
      });
      svg.appendChild(el("line", { x1: ml, y1: mt + ph, x2: W - mr, y2: mt + ph, stroke: INK, "stroke-width": 1.5 }));
      svg.appendChild(el("line", { x1: ml, y1: mt, x2: ml, y2: mt + ph, stroke: INK, "stroke-width": 1.5 }));

      series.forEach(function (s, i) {
        if (hidden[i]) return;
        var color = s.highlight ? BLUE : seriesColor(i, false, palette);
        var shape = SHAPES[i % SHAPES.length];
        s.points.forEach(function (p) {
          var r = hasBubble && p[2] != null ? (6 + 22 * Math.sqrt((p[2]) / (rMax || 1))) : (s.highlight ? 6 : 5);
          var node = marker(shape, xOf(p[0]), yOf(p[1]), r, color, color, s.highlight);
          if (hasBubble) { node.setAttribute("fill", color); node.setAttribute("fill-opacity", s.highlight ? 0.55 : 0.32); }
          node.style.cursor = "pointer";
          node.style.transition = "opacity .5s ease, transform .5s ease";
          node.style.transformBox = "fill-box"; node.style.transformOrigin = "center";
          node.style.opacity = (shown || reduceMotion) ? "1" : "0";
          node.addEventListener("mousemove", function (ev) {
            tip.show(ev, "<b>" + s.name + "</b> · " + fmt(p[0], xFmt) + ", " + fmt(p[1], yFmt) + (p[2] != null ? " · " + fmt(p[2], "plain") : ""));
          });
          node.addEventListener("mouseleave", tip.hide);
          svg.appendChild(node);
        });
      });

      if (data.yLabel) { var yl = text(15, mt + ph / 2, data.yLabel, { "font-size": 14, fill: GRAY, "text-anchor": "middle" }); yl.setAttribute("transform", "rotate(-90 15 " + (mt + ph / 2) + ")"); svg.appendChild(yl); }
      if (data.xLabel) svg.appendChild(text(ml + pw / 2, H - 8, data.xLabel, { "text-anchor": "middle", "font-size": 14, fill: GRAY }));
    }

    draw();
    onReveal(host, function () { shown = true; svg.querySelectorAll(".rw-dot").forEach(function (d) { d.style.opacity = "1"; }); });
    addLegend(host, series, hidden, function (s, i) { return swatchBox(s.highlight ? BLUE : seriesColor(i, false, palette)); }, draw);
    addNote(host, data);
    addTitle(host, data);
  }

  /* ======================================================================
     AREA — stacked or overlapping filled areas over a shared x grid
     ====================================================================== */
  function renderArea(host, data) {
    var W = data.width || 920, H = data.height || 460;
    var ml = 62, mr = 24, mt = 22, mb = 58;
    var pw = W - ml - mr, ph = H - mt - mb;
    var xs = data.x, series = data.series, stacked = data.mode !== "overlap";
    var xFmt = data.xFormat || "plain", yFmt = data.yFormat || "plain";
    var hidden = series.map(function () { return false; });
    var palette = data.palette;
    var shown = false;

    var tip = makeTip(host);
    var svg = svgRoot(W, H, data.title || "area chart");
    host.appendChild(svg);

    function maxVal() {
      var m = 0;
      xs.forEach(function (_, k) {
        if (stacked) { var sum = 0; series.forEach(function (s, i) { if (!hidden[i]) sum += (s.values[k] || 0); }); if (sum > m) m = sum; }
        else series.forEach(function (s, i) { if (!hidden[i]) { var v = s.values[k] || 0; if (v > m) m = v; } });
      });
      return m;
    }

    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var defs = el("defs", {});
      series.forEach(function (s, i) { if (!s.highlight && !palette && stacked) defs.appendChild(makePattern("rwarea-" + i, hatchOf(i))); });
      svg.appendChild(defs);

      var yt = ticks(0, maxVal() || 1, 6), ymax = yt[yt.length - 1] || 1;
      var xOf = function (k) { return ml + pw * k / ((xs.length - 1) || 1); };
      var yOf = function (v) { return mt + ph * (1 - v / ymax); };
      var baseY = mt + ph;

      yt.forEach(function (gv) { var y = yOf(gv); svg.appendChild(el("line", { x1: ml, y1: y, x2: W - mr, y2: y, stroke: LINE })); svg.appendChild(text(ml - 10, y + 5, fmt(gv, yFmt), { "text-anchor": "end", "font-size": 14, fill: GRAY })); });
      xs.forEach(function (xv, k) { if (k % Math.ceil(xs.length / 8) === 0 || k === xs.length - 1) svg.appendChild(text(xOf(k), H - mb + 26, fmt(xv, xFmt), { "text-anchor": "middle", "font-size": 14, fill: GRAY })); });

      var acc = xs.map(function () { return 0; });
      var order = series.map(function (s, i) { return i; });
      order.forEach(function (i) {
        var s = series[i]; if (hidden[i]) return;
        var color = s.highlight ? BLUE : seriesColor(i, false, palette);
        var top = [], bot = [];
        xs.forEach(function (_, k) {
          var v = s.values[k] || 0;
          var y0 = stacked ? acc[k] : 0;
          var y1 = stacked ? acc[k] + v : v;
          bot.push([xOf(k), yOf(y0)]);
          top.push([xOf(k), yOf(y1)]);
          if (stacked) acc[k] += v;
        });
        var d = "M" + top.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L ");
        for (var k = bot.length - 1; k >= 0; k--) d += " L " + bot[k][0].toFixed(1) + " " + bot[k][1].toFixed(1);
        d += " Z";
        var fill = stacked && !s.highlight && !palette ? "url(#rwarea-" + i + ")" : color;
        var area = el("path", { d: d, fill: fill, "fill-opacity": stacked ? (s.highlight ? 0.9 : 1) : 0.28, "class": "rw-area", stroke: "none" });
        if (stacked && !s.highlight && !palette) area.setAttribute("stroke", HATCH_STROKE), area.setAttribute("stroke-width", 1);
        area.style.transition = "opacity .8s ease " + (i * 0.08) + "s";
        area.style.opacity = (shown || reduceMotion) ? "1" : "0";
        svg.appendChild(area);
        // top edge line for definition
        var edge = el("path", { d: "M" + top.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L "), fill: "none", stroke: color, "stroke-width": s.highlight ? 2.5 : 1.5, "class": "rw-area" });
        edge.style.transition = "opacity .8s ease " + (i * 0.08) + "s"; edge.style.opacity = (shown || reduceMotion) ? "1" : "0";
        svg.appendChild(edge);
        // hover points on the top edge
        top.forEach(function (p, k) {
          var hit = el("circle", { cx: p[0], cy: p[1], r: 10, fill: "transparent" });
          hit.style.cursor = "pointer";
          hit.addEventListener("mousemove", function (ev) { tip.show(ev, "<b>" + s.name + "</b> · " + fmt(xs[k], xFmt) + " · " + fmt(s.values[k] || 0, yFmt)); });
          hit.addEventListener("mouseleave", tip.hide);
          svg.appendChild(hit);
        });
      });

      svg.appendChild(el("line", { x1: ml, y1: baseY, x2: W - mr, y2: baseY, stroke: INK, "stroke-width": 1.5 }));
      if (data.yLabel) { var yl = text(15, mt + ph / 2, data.yLabel, { "font-size": 14, fill: GRAY, "text-anchor": "middle" }); yl.setAttribute("transform", "rotate(-90 15 " + (mt + ph / 2) + ")"); svg.appendChild(yl); }
      if (data.xLabel) svg.appendChild(text(ml + pw / 2, H - 8, data.xLabel, { "text-anchor": "middle", "font-size": 14, fill: GRAY }));
    }

    draw();
    onReveal(host, function () { shown = true; svg.querySelectorAll(".rw-area").forEach(function (a) { a.style.opacity = "1"; }); });
    addLegend(host, series, hidden, function (s, i) { return swatchBox(s.highlight ? BLUE : seriesColor(i, false, palette)); }, draw);
    addNote(host, data);
    addTitle(host, data);
  }

  /* ======================================================================
     HBAR — ranked horizontal bars (one bar per item)
     ====================================================================== */
  function renderHBar(host, data) {
    var items = data.items;
    var xFmt = data.xFormat || "plain";
    var rowH = 40, gap = 14, mt = 14, mb = 34, ml = data.labelWidth || 150, mr = 60;
    var H = mt + mb + items.length * (rowH + gap);
    var W = data.width || 900;
    var pw = W - ml - mr;
    var grown = false;

    var tip = makeTip(host);
    var svg = svgRoot(W, H, data.title || "ranked bar chart");
    host.appendChild(svg);

    var maxV = items.reduce(function (m, it) { return Math.max(m, it.value); }, 0);
    var tk = ticks(0, maxV || 1, 5), vmax = tk[tk.length - 1] || 1;
    var xOf = function (v) { return ml + pw * v / vmax; };

    tk.forEach(function (gv) {
      var x = xOf(gv);
      svg.appendChild(el("line", { x1: x, y1: mt, x2: x, y2: H - mb, stroke: LINE }));
      svg.appendChild(text(x, H - mb + 22, fmt(gv, xFmt), { "text-anchor": "middle", "font-size": 13, fill: GRAY }));
    });

    items.forEach(function (it, i) {
      var y = mt + i * (rowH + gap);
      svg.appendChild(text(ml - 12, y + rowH / 2 + 5, it.label, { "text-anchor": "end", "font-size": 15, "font-weight": it.highlight ? 700 : 400, fill: it.highlight ? BLUE : INK }));
      var fill = it.highlight ? BLUE : HATCH_FG;
      var rect = el("rect", { x: ml, y: y, width: Math.max(2, xOf(it.value) - ml), height: rowH, rx: 3, fill: fill, "class": "rw-hbar", "fill-opacity": it.highlight ? 1 : 0.55 });
      rect.style.transformBox = "fill-box"; rect.style.transformOrigin = "left";
      rect.style.transition = "transform .8s cubic-bezier(.2,.7,.2,1) " + (i * 0.05) + "s";
      rect.style.transform = (grown || reduceMotion) ? "scaleX(1)" : "scaleX(0)";
      rect.style.cursor = "pointer";
      rect.addEventListener("mousemove", function (ev) { tip.show(ev, "<b>" + it.label + "</b> · " + fmt(it.value, xFmt)); });
      rect.addEventListener("mouseleave", tip.hide);
      svg.appendChild(rect);
      var vt = text(xOf(it.value) + 8, y + rowH / 2 + 5, fmt(it.value, xFmt), { "font-size": 14, "font-weight": it.highlight ? 700 : 400, fill: it.highlight ? BLUE : INK, "class": "rw-hval" });
      vt.style.transition = "opacity .5s ease " + (i * 0.05 + 0.3) + "s"; vt.style.opacity = (grown || reduceMotion) ? "1" : "0";
      svg.appendChild(vt);
    });
    svg.appendChild(el("line", { x1: ml, y1: mt, x2: ml, y2: H - mb, stroke: INK, "stroke-width": 1.5 }));

    onReveal(host, function () { grown = true; svg.querySelectorAll(".rw-hbar").forEach(function (b) { b.style.transform = "scaleX(1)"; }); svg.querySelectorAll(".rw-hval").forEach(function (t) { t.style.opacity = "1"; }); });
    addNote(host, data);
    addTitle(host, data);
  }

  /* ======================================================================
     DONUT — composition; sequential blue ramp, exact values on hover
     ====================================================================== */
  function renderDonut(host, data) {
    var W = data.width || 520, H = data.height || 360;
    var cx = 170, cy = H / 2, rOut = 130, rIn = 78;
    var items = data.items;
    var total = items.reduce(function (s, it) { return s + it.value; }, 0) || 1;
    var vFmt = data.valueFormat || "plain";

    var tip = makeTip(host);
    var svg = svgRoot(W, H, data.title || "donut chart");
    host.appendChild(svg);

    function arc(a0, a1, ro, ri) {
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      function pt(r, a) { return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
      var p0 = pt(ro, a0), p1 = pt(ro, a1), p2 = pt(ri, a1), p3 = pt(ri, a0);
      return "M" + p0[0].toFixed(1) + " " + p0[1].toFixed(1) +
        " A" + ro + " " + ro + " 0 " + large + " 1 " + p1[0].toFixed(1) + " " + p1[1].toFixed(1) +
        " L" + p2[0].toFixed(1) + " " + p2[1].toFixed(1) +
        " A" + ri + " " + ri + " 0 " + large + " 0 " + p3[0].toFixed(1) + " " + p3[1].toFixed(1) + " Z";
    }

    var wrap = el("g", {});
    wrap.style.transition = "opacity .7s ease, transform .7s ease";
    wrap.style.transformBox = "fill-box"; wrap.style.transformOrigin = "center";
    wrap.style.opacity = reduceMotion ? "1" : "0";
    var start = -Math.PI / 2;
    items.forEach(function (it, i) {
      var frac = it.value / total, a1 = start + frac * Math.PI * 2;
      var color = it.color || SEQ[i % SEQ.length];
      var seg = el("path", { d: arc(start, a1, rOut, rIn), fill: color, stroke: "#fff", "stroke-width": 2 });
      seg.style.cursor = "pointer";
      (function (label, val) {
        seg.addEventListener("mousemove", function (ev) { tip.show(ev, "<b>" + label + "</b> · " + fmt(val, vFmt) + " · " + (frac * 100).toFixed(0) + "%"); });
        seg.addEventListener("mouseleave", tip.hide);
      })(it.label, it.value);
      wrap.appendChild(seg);
      start = a1;
    });
    svg.appendChild(wrap);

    if (data.centerLabel) svg.appendChild(text(cx, cy - 2, data.centerLabel, { "text-anchor": "middle", "font-size": 30, "font-weight": 700, fill: INK, "font-family": "'Applied Sans Display',sans-serif" }));
    if (data.centerSub) svg.appendChild(text(cx, cy + 22, data.centerSub, { "text-anchor": "middle", "font-size": 14, fill: GRAY }));

    // legend to the right of the donut
    var lx = cx + rOut + 40, ly = cy - items.length * 12;
    items.forEach(function (it, i) {
      var y = ly + i * 26;
      svg.appendChild(el("rect", { x: lx, y: y - 10, width: 13, height: 13, rx: 2, fill: it.color || SEQ[i % SEQ.length] }));
      svg.appendChild(text(lx + 20, y, it.label, { "font-size": 14, fill: INK }));
      svg.appendChild(text(W - 12, y, (it.value / total * 100).toFixed(0) + "%", { "text-anchor": "end", "font-size": 13, fill: GRAY }));
    });

    onReveal(host, function () { wrap.style.opacity = "1"; });
    addNote(host, data);
    addTitle(host, data);
  }

  /* ---- dispatch ---------------------------------------------------------- */
  var RENDERERS = { bar: renderBar, line: renderLine, scatter: renderScatter, area: renderArea, hbar: renderHBar, donut: renderDonut };

  function mount(hostEl, data) {
    var type = hostEl.getAttribute("data-chart") || data.type;
    var fn = RENDERERS[type];
    if (!fn) { console.warn("RWCharts: unknown chart type", type); return; }
    hostEl.innerHTML = "";
    fn(hostEl, data);
    hostEl.setAttribute("data-rendered", "1");
  }
  function fallback(hostEl) {
    var src = hostEl.getAttribute("data-fallback");
    if (src) hostEl.innerHTML = '<img src="' + src + '" alt="' + (hostEl.getAttribute("data-alt") || "chart") + '">';
    else hostEl.innerHTML = '<p class="chart-note">Chart data unavailable.</p>';
  }

  function initOne(hostEl) {
    if (hostEl.getAttribute("data-rendered")) return;
    var inline = hostEl.getAttribute("data-json");
    if (inline) { try { mount(hostEl, JSON.parse(inline)); } catch (e) { fallback(hostEl); } return; }
    var src = hostEl.getAttribute("data-src");
    if (!src) { fallback(hostEl); return; }
    fetch(src).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (data) { mount(hostEl, data); })
      .catch(function () { fallback(hostEl); });
  }

  function init(root) {
    (root || document).querySelectorAll(".chart[data-chart]").forEach(initOne);
  }

  window.RWCharts = { init: init, render: mount, RENDERERS: RENDERERS };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
  else init();
})();
