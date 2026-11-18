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

  const main = document.querySelector("main");
  main.className = "report";
  main.innerHTML =
    '<nav class="tabs">' + Object.entries(KINDS).map(([k, v]) => '<a href="' + v.href + '"' + (k === kind ? ' class="active"' : "") + ">" + v.tab + "</a>").join("") + "</nav>" +
    '<div class="r-head"><div><div class="r-title">' + KINDS[kind].title + '</div><div class="r-period">' + period + "</div></div>" +
    '<div class="r-meta mono"><span class="chip"><i></i>NETWORK SCAN</span><div style="margin-top:6px">Generated ' +
    now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</div></div></div>" +

    '<section id="secmods"></section>' +
    '<section class="panel"><div class="panel-label mono">3D NETWORK SCAN MODEL</div>' +
    '<canvas id="scan" aria-label="Animated 3D network scan model"></canvas>' +
    '<div class="panel-foot mono"><span>LAYERS 3 · NODES 25</span><span id="scanPct">SCAN 0%</span></div></section>' +

    '<section class="panel dark"><div class="panel-label mono">DATA CENTER \u00b7 3D SERVER RACKS</div>' +
    '<canvas id="servers" aria-label="Animated 3D server racks"></canvas>' +
    '<div class="panel-foot mono"><span>RACKS 6 \u00b7 COLD AISLE</span><span>DRAG TO ROTATE</span></div></section>' +

    

    '<section class="panel"><div class="panel-title mono">3D METRICS MODEL</div>' +
    '<canvas id="bars" aria-label="3D bar model of H, V and A"></canvas>' +
    '<div class="panel-foot mono"><span>DRAG TO ROTATE</span><span>' + S.SL.label + " " + S.SL.value + (S.SL.unit || "") + "</span></div></section>";

  // 3D visuals
  Viz.scanModel(document.getElementById("scan"));
  Viz.serverRoom(document.getElementById("servers"));
  Sec.mount(document.getElementById("secmods"));
  Viz.bars(document.getElementById("bars"), [
    { label: "H", value: S.H.value, color: "cyan" },
    { label: "V", value: S.V.value, color: "rose" },
    { label: "A", value: S.A.value, color: "violet" },
  ]);

  // Scan progress readout (follows the moving scan plane)
  const pct = document.getElementById("scanPct");
  setInterval(() => {
    const v = Math.round(((performance.now() / 1000) % 6) / 6 * 100);
    pct.textContent = "SCAN " + v + "%";
  }, 120);
})();
