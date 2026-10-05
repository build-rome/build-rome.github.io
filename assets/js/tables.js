/* Sortable data tables. Click a sortable header (th.sortable) to sort rows;
   numeric columns sort numerically (using data-sort when present), text columns
   lexically. Pending cells (.tbd) and dash cells always sort to the bottom.
   Group rows (.group-row) sort within their section only. Third click on a
   header restores the original markup order. Exposed as RWtables.init(). */
(function () {
  "use strict";

  function cellValue(cell) {
    if (!cell) return { empty: true };
    if (cell.classList.contains("tbd")) return { empty: true };
    var ds = cell.getAttribute("data-sort");
    var raw = ds != null ? ds : cell.textContent.trim();
    if (raw === "" || raw === "—" || raw === "-" || raw === "--") return { empty: true };
    var num = parseFloat(raw.replace(/[, ]/g, ""));
    if (!isNaN(num) && /^[-+]?[0-9.,]+$/.test(raw.replace(/\s/g, ""))) return { num: num };
    return { text: raw.toLowerCase() };
  }

  function compare(a, b, dir) {
    if (a.empty && b.empty) return 0;
    if (a.empty) return 1;   // empties always last regardless of dir
    if (b.empty) return -1;
    var r;
    if (a.num != null && b.num != null) r = a.num - b.num;
    else r = String(a.text).localeCompare(String(b.text));
    return dir === "desc" ? -r : r;
  }

  function restoreOrder(tbody, originalRows) {
    originalRows.forEach(function (tr) { tbody.appendChild(tr); });
  }

  function rowCells(rows, colIndex) {
    return rows.map(function (tr) { return { tr: tr, val: cellValue(tr.children[colIndex]) }; });
  }

  function sortFlat(tbody, colIndex, dir) {
    var rows = Array.prototype.slice.call(tbody.rows);
    var keyed = rowCells(rows, colIndex);
    keyed.sort(function (x, y) { return compare(x.val, y.val, dir); });
    keyed.forEach(function (o) { tbody.appendChild(o.tr); });
  }

  function sortWithinGroups(tbody, colIndex, dir) {
    var rows = Array.prototype.slice.call(tbody.rows);
    var segments = [], cur = null;
    rows.forEach(function (tr) {
      if (tr.classList.contains("group-row")) { cur = { head: tr, body: [] }; segments.push(cur); }
      else if (cur) cur.body.push(tr);
      else { cur = { head: null, body: [tr] }; segments.push(cur); }
    });
    segments.forEach(function (seg) {
      var keyed = rowCells(seg.body, colIndex);
      keyed.sort(function (x, y) { return compare(x.val, y.val, dir); });
      if (seg.head) tbody.appendChild(seg.head);
      keyed.forEach(function (o) { tbody.appendChild(o.tr); });
    });
  }

  function makeSortable(table) {
    var ths = table.querySelectorAll("thead th.sortable");
    if (!ths.length) return;
    var tbody = table.tBodies[0];
    if (!tbody) return;
    var hasGroups = !!tbody.querySelector("tr.group-row");
    var originalRows = Array.prototype.slice.call(tbody.rows);

    ths.forEach(function (th, colIndex) {
      th.setAttribute("role", "button");
      th.setAttribute("tabindex", "0");
      function activate() {
        var cur = th.getAttribute("data-dir");
        var dir = cur === "asc" ? "desc" : cur === "desc" ? "none" : "asc";
        ths.forEach(function (h) { h.removeAttribute("data-dir"); var s = h.querySelector(".sort-ind"); if (s) s.remove(); });
        if (dir === "none") { restoreOrder(tbody, originalRows); return; }
        th.setAttribute("data-dir", dir);
        var ind = document.createElement("span");
        ind.className = "sort-ind";
        ind.textContent = dir === "asc" ? "▲" : "▼";
        th.appendChild(ind);
        if (hasGroups) sortWithinGroups(tbody, colIndex, dir); else sortFlat(tbody, colIndex, dir);
      }
      th.addEventListener("click", activate);
      th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } });
    });
  }

  function init(root) { (root || document).querySelectorAll("table.data").forEach(makeSortable); }

  window.RWtables = { init: init };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); });
  else init();
})();
