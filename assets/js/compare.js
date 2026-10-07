/* ==========================================================================
   Comparison slider: one scene per row (input + every method), arrows/dots to
   a thumbnail strip to switch
   scenes, slow auto-advance while on screen.
   ---------------------------------------------------------------------------
   The static HTML ships the first scene, so the section works without JS.
   Markup contract:
     <div class="cmp" data-base="assets/media/comparisons/"
          data-scenes="atlas11,nerf1,..." data-methods="ours,genrecon,...">
   Media per scene: <base><scene>/input.jpg, thumb.jpg, <method>.mp4, <method>-poster.jpg
   ========================================================================== */
(function () {
  "use strict";

  if (!window.RWVideo) return; // static videos retain their native controls
  var ADVANCE_MS = 8000; // two loops of the 4 s turntable before moving on
  var reduced = window.RWVideo.reducedMotion();

  document.querySelectorAll(".cmp").forEach(function (root) {
    var base = root.getAttribute("data-base");
    var scenes = root.getAttribute("data-scenes").split(",");
    var methods = root.getAttribute("data-methods").split(",");
    var labels = Array.prototype.map.call(root.querySelectorAll(".cmp-head span"), function (s) {
      return s.textContent;
    });
    var viewport = root.querySelector(".cmp-viewport");
    var dotsWrap = root.querySelector(".cmp-dots");
    var current = 0, timer = null, onScreen = false;
    var playButton = document.createElement("button");
    playButton.type = "button";
    playButton.className = "btn cmp-play";
    playButton.textContent = "Play comparisons";
    playButton.hidden = true;
    root.insertBefore(playButton, dotsWrap);
    // All five play() calls must happen inside this actual click, without awaiting
    // a fetch/canplay event, so browsers can use the user's playback permission.
    playButton.addEventListener("click", function () { playRow(viewport.querySelector(".cmp-row"), true); });

    // ---- build a row for one scene --------------------------------------
    function tile(label, media, isOurs, method) {
      var fig = document.createElement("figure");
      fig.className = "cmp-tile" + (isOurs ? " is-ours" : "");
      fig.appendChild(media);
      var cap = document.createElement("figcaption");
      cap.textContent = label;
      cap.setAttribute("data-method", method);
      fig.appendChild(cap);
      return fig;
    }

    function buildRow(i) {
      var id = scenes[i], row = document.createElement("div");
      row.className = "cmp-row";
      var img = document.createElement("img");
      img.src = base + id + "/input.jpg";
      img.alt = "Input photo, scene " + (i + 1);
      img.width = 768; img.height = 768;
      row.appendChild(tile(labels[0], img, false, "input"));
      methods.forEach(function (m, k) {
        var v = document.createElement("video");
        v.src = base + id + "/" + m + ".mp4";
        v.poster = base + id + "/" + m + "-poster.jpg";
        v.muted = true; v.loop = true; v.playsInline = true;
        v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
        v.preload = onScreen ? "auto" : "none";       // nothing streams until the slider is on screen
        v.setAttribute("aria-label", labels[k + 1] + " reconstruction, scene " + (i + 1));
        row.appendChild(tile(labels[k + 1], v, m === "ours", m));
      });
      wireRow(row);
      return row;
    }

    function wireRow(row) {
      var vids = Array.prototype.slice.call(row.querySelectorAll("video"));
      var aligned = false;
      vids.forEach(function (v) {
        v._playback = window.RWVideo.create(v, function () {
          if (row !== viewport.querySelector(".cmp-row")) return;
          // Align once when every clip has really started, not merely loaded.
          if (!aligned && vids.every(function (w) { return w.getAttribute("data-playback") === "playing"; })) {
            aligned = true;
            vids.forEach(function (w) { try { w.currentTime = 0; } catch (e) {} });
          }
          schedule();
        });
      });
    }

    function playRow(row, userInitiated) {
      if (!onScreen || document.hidden) return;
      // play() starts loading; do not wait for canplay before requesting playback.
      row.querySelectorAll("video").forEach(function (v) { v._playback.play(userInitiated); });
    }

    function pauseRow(row) {
      row.querySelectorAll("video").forEach(function (v) { v._playback.pause(); });
    }

    // ---- navigation -----------------------------------------------------
    function show(i, dir, userInitiated) {
      i = (i + scenes.length) % scenes.length;
      if (i === current && viewport.querySelector(".cmp-row")) return;
      var old = viewport.querySelector(".cmp-row");
      var row = buildRow(i);
      if (!reduced && dir) row.classList.add(dir > 0 ? "slide-left" : "slide-right");
      if (old) { pauseRow(old); old.remove(); }
      viewport.appendChild(row);
      current = i;
      updateDots();
      playRow(row, userInitiated && !reduced);
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      var vids = Array.prototype.slice.call(viewport.querySelectorAll("video"));
      var playing = vids.length > 0 && vids.every(function (v) {
        return !v.paused && v.getAttribute("data-playback") === "playing";
      });
      var needsPlay = vids.some(function (v) {
        return /^(blocked|error)$/.test(v.getAttribute("data-playback"));
      });
      playButton.hidden = playing || (!reduced && !needsPlay);
      // Don't cycle through frozen posters or replace clips while they buffer.
      if (reduced || !onScreen || document.hidden || !playing) return;
      timer = setTimeout(function () { show(current + 1, 1); }, ADVANCE_MS);
    }

    root.querySelector(".cmp-prev").addEventListener("click", function () { show(current - 1, -1, true); });
    root.querySelector(".cmp-next").addEventListener("click", function () { show(current + 1, 1, true); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(current - 1, -1, true);
      if (e.key === "ArrowRight") show(current + 1, 1, true);
    });

    // scene picker: a strip of input-photo thumbnails
    scenes.forEach(function (id, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", "Scene " + (i + 1));
      var img = document.createElement("img");
      img.src = base + id + "/thumb.jpg";
      img.alt = ""; img.width = 160; img.height = 160; img.loading = "lazy";
      b.appendChild(img);
      b.addEventListener("click", function () { show(i, i > current ? 1 : -1, true); });
      dotsWrap.appendChild(b);
    });
    function updateDots() {
      Array.prototype.forEach.call(dotsWrap.children, function (b, i) {
        b.classList.toggle("is-active", i === current);
        b.setAttribute("aria-current", i === current ? "true" : "false");
      });
    }

    // the static first row stays as-is; just wire it up
    var first = viewport.querySelector(".cmp-row");
    wireRow(first);
    updateDots();
    root.classList.add("is-enhanced");

    // Playback and the carousel share the same visibility lifecycle on all devices.
    function setVisibility(visible) {
      onScreen = visible;
      var row = viewport.querySelector(".cmp-row");
      if (onScreen && !document.hidden) playRow(row, false);
      else pauseRow(row);
      schedule();
    }
    function refresh() {
      var r = root.getBoundingClientRect();
      setVisibility(r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight &&
        r.right > 0 && r.left < window.innerWidth);
    }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        setVisibility(entries[0].isIntersecting && entries[0].intersectionRatio > 0);
      }, { threshold: 0.01 }).observe(root);
    } else {
      window.addEventListener("scroll", refresh, { passive: true });
      window.addEventListener("resize", refresh);
    }
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pageshow", refresh);
    refresh();
  });
})();
