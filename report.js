// Builds the Today / Weekly / Monthly report page. Each page sets window.REPORT_KIND.
(function () {
  const kind = window.REPORT_KIND || "daily";
  const S = window.ALSTICK_STATS;
  const now = new Date();
  const fmt = (d, o) => d.toLocaleDateString("en-US", o);

  const KINDS = {
    daily:   { title: "Today's Report",  href: "dailyreport.html",   tab: "Today" },
    weekly:  { title: "Weekly Report",   href: "weeklyreport.html",  tab: "Weekly" },
    monthly: { title: "Monthly Report",  href: "monthlyreport.html", tab: "Monthly" },
  };

  let period;
  if (kind === "daily") {
    period = fmt(now, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  } else if (kind === "weekly") {
    const start = new Date(now); start.setDate(now.getDate() - now.getDay());
    const end = new Date(start); end.setDate(start.getDate() + 6);
    period = fmt(start, { month: "short", day: "numeric" }) + " – " + fmt(end, { month: "short", day: "numeric", year: "numeric" });
  } else {
    period = fmt(now, { month: "long", year: "numeric" });
  }

  const tile = (key, canvasId) => {
    const s = S[key];
    return '<div class="stat c-' + key.toLowerCase() + '">' +
      '<canvas id="' + canvasId + '"></canvas>' +
      '<div class="stat-label mono">' + s.label + '</div>' +
      '<div class="stat-value mono"><span data-count="' + s.value + '">0</span>' + (s.unit ? "<small>" + s.unit + "</small>" : "") + "</div>" +
      '<div class="stat-bar"><span data-w="' + (key === "SL" ? s.value : Math.round((s.value / Math.max(S.H.value, S.V.value, S.A.value)) * 100)) + '"></span></div>' +
      "</div>";
  };

  const main = document.querySelector("main");
  main.className = "report";
  main.innerHTML =
    '<nav class="tabs">' + Object.entries(KINDS).map(([k, v]) => '<a href="' + v.href + '"' + (k === kind ? ' class="active"' : "") + ">" + v.tab + "</a>").join("") + "</nav>" +
    '<div class="r-head"><div><div class="r-title">' + KINDS[kind].title + '</div><div class="r-period">' + period + "</div></div>" +
    '<div class="r-meta mono"><span class="chip"><i></i>NETWORK SCAN</span><div style="margin-top:6px">Generated ' +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</div></div></div>" +

    '<section class="panel"><div class="panel-label mono">3D NETWORK SCAN MODEL</div>' +
    '<canvas id="scan" aria-label="Animated 3D network scan model"></canvas>' +
    '<div class="panel-foot mono"><span>LAYERS 3 · NODES 25</span><span id="scanPct">SCAN 0%</span></div></section>' +

    '<section class="stats">' + tile("H", "w-h") + tile("V", "w-v") + tile("SL", "w-sl") + tile("A", "w-a") + "</section>" +

    '<section class="panel"><div class="panel-title mono">3D METRICS MODEL</div>' +
    '<canvas id="bars" aria-label="3D bar model of H, V and A"></canvas>' +
    '<div class="panel-foot mono"><span>DRAG TO ROTATE</span><span>' + S.SL.label + " " + S.SL.value + (S.SL.unit || "") + "</span></div></section>";

  // 3D visuals
  Viz.scanModel(document.getElementById("scan"));
  Viz.wire(document.getElementById("w-h"), "cube", "cyan");
  Viz.wire(document.getElementById("w-v"), "octa", "rose");
  Viz.gauge(document.getElementById("w-sl"), S.SL.value, "green");
  Viz.wire(document.getElementById("w-a"), "icosa", "violet");
  Viz.bars(document.getElementById("bars"), [
    { label: "H", value: S.H.value, color: "cyan" },
    { label: "V", value: S.V.value, color: "rose" },
    { label: "A", value: S.A.value, color: "violet" },
  ]);

  // Count-up numbers and bars
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min(1, (t - t0) / 1200), e = 1 - Math.pow(1 - p, 3);
    document.querySelectorAll("[data-count]").forEach(el => { el.textContent = Math.round(+el.dataset.count * e); });
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
  setTimeout(() => document.querySelectorAll("[data-w]").forEach(el => { el.style.width = el.dataset.w + "%"; }), 100);

  // Scan progress readout (follows the moving scan plane)
  const pct = document.getElementById("scanPct");
  setInterval(() => {
    const v = Math.round(((performance.now() / 1000) % 6) / 6 * 100);
    pct.textContent = "SCAN " + v + "%";
  }, 120);
})();
