// Builds the Today / Weekly / Monthly report page. Each page sets window.REPORT_KIND.
(function () {
  const kind = window.REPORT_KIND || "daily";
  const S = window.ALSTICK_STATS;
  const now = Sections.cupertinoNow();   // dates follow Cupertino, CA time
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
    '<div class="r-person"><div class="r-person-k mono">REPORT FOR</div><div class="r-person-name">' + (window.ALSTICK_REPORT_FOR || "") + "</div></div>" +
    '<div class="r-head"><div><div class="r-title">' + KINDS[kind].title + '</div>' +
    '<div class="r-period">' + period + "</div></div>" +
    '<div class="r-meta mono"><span class="chip"><i></i>CUPERTINO, CA</span><div class="r-clock" id="cupClock"></div></div></div>' +

    '<section id="secmods"></section>' +
    '<section id="metrics"></section>' +
    '<section id="dc"></section>' +
    '<section class="panel"><div class="panel-label mono">NETWORK SCAN</div>' +
    '<canvas id="scan" aria-label="Animated network scan model"></canvas>' +
    '<div class="panel-foot mono"><span>LAYERS 3 \u00b7 NODES 25</span><span id="scanPct">SCAN 0%</span></div></section>';

  Sections.clock(document.getElementById("cupClock"), true);
  Sec.mount(document.getElementById("secmods"));
  Sections.metrics(document.getElementById("metrics"));
  Sections.datacenter(document.getElementById("dc"));
  Viz.scanModel(document.getElementById("scan"));

  // Scan progress readout (follows the moving scan plane)
  const pct = document.getElementById("scanPct");
  setInterval(() => {
    const v = Math.round(((performance.now() / 1000) % 6) / 6 * 100);
    pct.textContent = "SCAN " + v + "%";
  }, 120);
})();
