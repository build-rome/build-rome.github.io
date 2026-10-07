/* Research website template — slim orchestration.
   Wires: mobile nav toggle + scroll-spy, scroll-reveal, lazy video playback,
   segmented tabs with a sliding thumb, and BibTeX copy buttons.
   No build step; everything is progressive enhancement over the static HTML —
   the page is fully usable with JavaScript disabled. */
(function () {
  "use strict";

  /* ---- navigation: mobile toggle + scroll-spy ---------------------------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("nav");
    if (toggle && nav) {
      var setMenu = function (open) {
        nav.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Close navigation" : "Toggle navigation");
        document.body.classList.toggle("nav-open", open);
      };
      toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
      nav.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) setMenu(false); });
    }

    // highlight the nav link for the section currently in view (in-page anchors only)
    var links = Array.prototype.slice.call(document.querySelectorAll("#nav a"))
      .filter(function (a) { return (a.getAttribute("href") || "").charAt(0) === "#"; });
    var map = {};
    links.forEach(function (a) { var id = a.getAttribute("href").slice(1); if (document.getElementById(id)) map[id] = a; });
    var sections = Object.keys(map).map(function (id) { return document.getElementById(id); });
    if (!("IntersectionObserver" in window) || !sections.length) return;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove("active"); });
          var a = map[e.target.id]; if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sections.forEach(function (s) { obs.observe(s); });
  }

  /* ---- scroll reveal ----------------------------------------------------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach(function (i) { i.classList.add("in"); }); return; }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
    items.forEach(function (i) { obs.observe(i); });
  }

  /* ---- shared video playback -------------------------------------------- */
  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // Both the reels and comparison tiles use the same failure handling. A rejected
  // play() is not necessarily a loading problem: policy blocks need a real user
  // gesture, not another canplay listener. Keep native controls as that fallback.
  function createPlayback(v, onChange) {
    var wanted = false, pending = false, blocked = false, attempt = 0;
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.autoplay = false; // the viewport owner, not the browser, starts/stops playback
    v.controls = !!reducedMotion();
    v.setAttribute("data-playback", "idle");

    function state(value) {
      if (v.getAttribute("data-playback") === value) return;
      v.setAttribute("data-playback", value);
      if (onChange) onChange();
    }
    function failed(error, id) {
      if (id !== attempt) return; // ignore a promise from an old pause/source/row
      pending = false;
      if (!wanted || !v.isConnected || document.hidden) return;
      if (error && error.name === "AbortError") {
        v.controls = true; state("error"); return; // canplay may still recover a transient abort
      }
      blocked = true;
      v.controls = true;
      state(error && error.name === "NotAllowedError" ? "blocked" : "error");
      console.warn("Video playback failed:", v.currentSrc || v.getAttribute("src"), error);
    }
    function play(userInitiated) {
      if (reducedMotion() && !userInitiated) { v.controls = true; return; }
      if (document.hidden || !v.isConnected || (blocked && !userInitiated)) return;
      wanted = true;
      if (pending || !v.paused) return;
      blocked = false;
      pending = true;
      var id = ++attempt;
      v.muted = true;
      v.preload = "auto";
      state("loading");
      try {
        var promise = v.play();
        if (promise && promise.then) promise.then(function () {
          if (id === attempt) pending = false;
        }, function (error) { failed(error, id); });
        else pending = false;
      } catch (error) { failed(error, id); }
    }
    function pause() {
      wanted = false; pending = false; ++attempt;
      v.pause();
      if (!blocked) state("paused");
    }
    // Register once, before the first attempt; don't miss an already-fired
    // canplay event or accumulate one-shot handlers on every scroll.
    v.addEventListener("canplay", function () {
      if (wanted && !blocked && v.paused) play(false);
    });
    v.addEventListener("playing", function () {
      if (v.paused) return; // a queued event can arrive after the viewport owner paused
      if (document.hidden || !v.isConnected) { pause(); return; }
      wanted = true; pending = false; blocked = false;
      state("playing");
    });
    v.addEventListener("pause", function () {
      if (!v.paused) return;
      wanted = false; pending = false; ++attempt;
      if (!blocked) state("paused");
    });
    v.addEventListener("waiting", function () { if (wanted) state("loading"); });
    v.addEventListener("error", function () {
      pending = false; blocked = true; ++attempt;
      v.controls = true;
      state("error");
      console.warn("Video media error:", v.currentSrc || v.getAttribute("src"), v.error);
    });
    return { play: play, pause: pause };
  }
  window.RWVideo = { create: createPlayback, reducedMotion: reducedMotion };

  /* ---- viewport-managed teaser and results ------------------------------ */
  function initVideos() {
    var vids = Array.prototype.slice.call(document.querySelectorAll("video[data-autoplay]"));
    vids.forEach(function (v) {
      v._onScreen = false;
      v._playback = createPlayback(v);
    });
    function update(v, visible) {
      v._onScreen = visible;
      if (visible && !document.hidden) v._playback.play(false);
      else v._playback.pause();
    }
    function refresh() {
      vids.forEach(function (v) {
        var r = v.getBoundingClientRect();
        update(v, r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight &&
          r.right > 0 && r.left < window.innerWidth);
      });
    }
    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { update(e.target, e.isIntersecting && e.intersectionRatio > 0); });
      }, { threshold: 0.01 });
      vids.forEach(function (v) { obs.observe(v); });
    } else {
      window.addEventListener("scroll", refresh, { passive: true });
      window.addEventListener("resize", refresh);
    }
    // Use the same lifecycle on phones, tablets, and desktop. A narrow viewport
    // is not a reliable browser detector, and must not skip tab/BFCache recovery.
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    refresh();
  }

  /* ---- tabs: segmented control with a sliding blue thumb ----------------- */
  // Markup:
  //   <div class="tabs" data-tabs>
  //     <div class="tabs-nav"><span class="tabs-slider"></span>
  //       <button class="tab-btn is-active" data-tab="a">A</button>
  //       <button class="tab-btn" data-tab="b">B</button>
  //     </div>
  //     <div class="tab-panel" data-panel="a"> ... </div>
  //     <div class="tab-panel" data-panel="b" hidden> ... </div>
  //   </div>
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (root) {
      var nav = root.querySelector(".tabs-nav");
      var slider = root.querySelector(".tabs-slider");
      var btns = Array.prototype.slice.call(root.querySelectorAll(".tab-btn"));
      var panels = Array.prototype.slice.call(root.querySelectorAll(".tab-panel"));
      if (!btns.length) return;

      function moveSlider(btn) {
        if (!slider) return;
        slider.style.width = btn.offsetWidth + "px";
        slider.style.height = btn.offsetHeight + "px";
        slider.style.transform = "translate(" + (btn.offsetLeft - nav.clientLeft) + "px," + (btn.offsetTop - nav.clientTop) + "px)";
      }
      function select(key) {
        btns.forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-tab") === key); });
        panels.forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== key; });
        var active = btns.filter(function (b) { return b.getAttribute("data-tab") === key; })[0];
        if (active) moveSlider(active);
        // (re)render any charts that were hidden until now
        if (window.RWCharts) window.RWCharts.init(root);
      }

      btns.forEach(function (b) { b.addEventListener("click", function () { select(b.getAttribute("data-tab")); }); });
      var initial = (btns.filter(function (b) { return b.classList.contains("is-active"); })[0] || btns[0]);
      select(initial.getAttribute("data-tab"));
      window.addEventListener("resize", function () {
        var a = btns.filter(function (b) { return b.classList.contains("is-active"); })[0];
        if (a) moveSlider(a);
      });
    });
  }

  /* ---- BibTeX ------------------------------------------------------------ */
  // Canonical pattern: a <button id="bibtex-btn"> copies a hidden
  //   <pre id="bibtex-src">…</pre>
  // to the clipboard and flashes "BibTeX copied". For more than one citation on
  // a page, give each button a data-bibtex-src="<id>" pointing at its own source.
  function copyText(txt, onDone) {
    if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(onDone, function () {}); return; }
    var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); onDone(); } catch (e) {}
    document.body.removeChild(ta);
  }
  function wireBibtexButton(btn) {
    var src = document.getElementById(btn.getAttribute("data-bibtex-src") || "bibtex-src");
    if (!src) return;
    var label = btn.textContent;
    btn.addEventListener("click", function () {
      copyText(src.textContent.trim(), function () {
        btn.textContent = "BibTeX copied";
        setTimeout(function () { btn.textContent = label; }, 1500);
      });
    });
  }
  function initBibtex() {
    var seen = [];
    var main = document.getElementById("bibtex-btn");
    if (main) { wireBibtexButton(main); seen.push(main); }
    document.querySelectorAll("[data-bibtex-src]").forEach(function (b) {
      if (seen.indexOf(b) === -1) wireBibtexButton(b);
    });
    // Optional: a displayed .bibtex block also gets its own inline Copy button.
    document.querySelectorAll(".bibtex").forEach(function (block) {
      if (block.querySelector(".copy-btn")) return;
      var btn = document.createElement("button");
      btn.className = "copy-btn"; btn.type = "button"; btn.textContent = "Copy";
      btn.addEventListener("click", function () {
        var code = block.querySelector("code, pre");
        copyText((code || block).textContent.replace(/\s*Copy\s*$/, "").trim(), function () {
          btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy"; }, 1500);
        });
      });
      block.appendChild(btn);
    });
  }

  function boot() { initNav(); initReveal(); initVideos(); initTabs(); initBibtex(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
