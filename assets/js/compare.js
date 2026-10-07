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

  var ADVANCE_MS = 8000; // two loops of the 4 s turntable before moving on
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
        v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
        v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("autoplay", "");
        v.preload = onScreen ? "auto" : "metadata";   // the bulk streams only once the slider is on screen
        v.setAttribute("aria-label", labels[k + 1] + " reconstruction, scene " + (i + 1));
        row.appendChild(tile(labels[k + 1], v, m === "ours", m));
      });
      return row;
    }

    // Play every video in the row right away: mobile Safari only starts fetching a video when
    // play() is called (it ignores preload), so waiting for "canplay" first would wait forever.
    // Once all five are actually playing, rewind them together so the views line up.
    function playRow(row) {
      if (reduced) return;
      var vids = Array.prototype.slice.call(row.querySelectorAll("video"));
      var pending = vids.length;
      vids.forEach(function (v) {
        v.muted = true; v.defaultMuted = true; v.playsInline = true;
        v.addEventListener("playing", function once() {
          v.removeEventListener("playing", once);
          if (--pending === 0 && onScreen) vids.forEach(function (w) { try { w.currentTime = 0; } catch (e) {} });
        });
        var p = v.play();
        if (p && p.catch) p.catch(function () {
          // refused (not ready yet): try once more when it can play
          v.addEventListener("canplay", function again() { v.removeEventListener("canplay", again); var q = v.play(); if (q && q.catch) q.catch(function () {}); });
        });
      });
    }

    // phones: never pause() -- iOS refuses a later scripted play() on a video a script paused
    var phone = window.innerWidth <= 640;
    function pauseRow(row) {
      if (phone) return;
      row.querySelectorAll("video").forEach(function (v) { v.pause(); });
    }

    // ---- navigation -----------------------------------------------------
    function show(i, dir) {
      i = (i + scenes.length) % scenes.length;
      if (i === current && viewport.querySelector(".cmp-row")) return;
      var old = viewport.querySelector(".cmp-row");
      var row = buildRow(i);
      if (!reduced && dir) row.classList.add(dir > 0 ? "slide-left" : "slide-right");
      if (old) { pauseRow(old); old.remove(); }
      viewport.appendChild(row);
      current = i;
      updateDots();
      playRow(row);
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      if (reduced || !onScreen) return;
      timer = setTimeout(function () { show(current + 1, 1); }, ADVANCE_MS);
    }

    root.querySelector(".cmp-prev").addEventListener("click", function () { show(current - 1, -1); });
    root.querySelector(".cmp-next").addEventListener("click", function () { show(current + 1, 1); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(current - 1, -1);
      if (e.key === "ArrowRight") show(current + 1, 1);
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
      b.addEventListener("click", function () { show(i, i > current ? 1 : -1); });
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
    updateDots();
    root.classList.add("is-enhanced");

    // play / advance only while the slider is on screen
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[0].isIntersecting;
        var row = viewport.querySelector(".cmp-row");
        if (onScreen) {
          Array.prototype.forEach.call(row.querySelectorAll("video"), function (v) { v.preload = "auto"; });
          playRow(row); schedule();
        } else { pauseRow(row); clearTimeout(timer); }
      }, { threshold: 0.25 }).observe(root);
    } else {
      onScreen = true;
      playRow(first);
      schedule();
    }
  });
})();
