// Shared sections: Cupertino (US Pacific) time, photo-based Metrics and Data Center.
(function () {
  const TZ = "America/Los_Angeles"; // Cupertino, California
  const S = window.ALSTICK_STATS;

  // Current wall-clock time in Cupertino as a Date (for date maths and formatting without a zone)
  const cupertinoNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const zoneAbbr = () => new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "short" }).formatToParts(new Date()).find(p => p.type === "timeZoneName").value;

  function clock(el, withDate) {
    const tick = () => {
      const d = new Date();
      const time = d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" });
      const date = d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
      el.textContent = (withDate ? date + " · " : "") + time + " " + zoneAbbr();
    };
    tick(); setInterval(tick, 1000);
  }

  // ---------- Metrics on a real photo ----------
  function metrics(el) {
    const rows = [
      { k: "H",  color: "34,211,238" },
      { k: "V",  color: "248,113,113" },
      { k: "A",  color: "129,140,248" },
      { k: "SL", color: "52,211,153" },
    ];
    const maxCount = Math.max(S.H.value, S.V.value, S.A.value);
    el.className = "photo-panel metrics";
    el.style.setProperty("--img", "url(img/metrics.jpg)");
    el.innerHTML =
      '<div class="pp-top"><div class="pp-title mono">METRICS</div><span class="sec-chip mono" style="--acc:52,211,153"><i></i>UPDATED</span></div>' +
      '<div class="m-rows">' + rows.map(r => {
        const s = S[r.k], pct = r.k === "SL" ? s.value : Math.max(2, Math.round(s.value / maxCount * 100));
        return '<div class="m-row" style="--c:' + r.color + '">' +
          '<div class="m-label mono">' + s.label + '</div>' +
          '<div class="m-track"><span data-w="' + pct + '"></span></div>' +
          '<div class="m-val mono">' + s.value.toLocaleString("en-US") + (s.unit || "") + "</div></div>";
      }).join("") + "</div>";
    setTimeout(() => el.querySelectorAll("[data-w]").forEach(b => { b.style.width = b.dataset.w + "%"; }), 150);
  }

  // ---------- Data center photo slideshow ----------
  function datacenter(el) {
    const slides = [
      { img: "img/dc-hall.jpg",   cap: "Data hall" },
      { img: "img/dc-rack.jpg",   cap: "Server racks" },
      { img: "img/dc-switch.jpg", cap: "Core network switch" },
      { img: "img/datacenter.jpg", cap: "Cold aisle" },
    ];
    el.className = "photo-panel dc";
    el.innerHTML =
      slides.map((s, i) => '<div class="dc-slide' + (i ? "" : " on") + '" style="background-image:url(' + s.img + ')"></div>').join("") +
      '<div class="dc-shade"></div>' +
      '<div class="pp-top"><div class="pp-title mono">DATA CENTER</div><span class="sec-chip mono" style="--acc:52,211,153"><i></i>ONLINE</span></div>' +
      '<div class="dc-cap mono" id="dcCap">' + slides[0].cap + '</div>' +
      '<div class="dc-dots">' + slides.map((_, i) => "<i" + (i ? "" : ' class="on"') + "></i>").join("") + "</div>";
    const els = el.querySelectorAll(".dc-slide"), dots = el.querySelectorAll(".dc-dots i"), cap = el.querySelector(".dc-cap");
    let k = 0;
    setInterval(() => {
      els[k].classList.remove("on"); dots[k].classList.remove("on");
      k = (k + 1) % slides.length;
      els[k].classList.add("on"); dots[k].classList.add("on"); cap.textContent = slides[k].cap;
    }, 4500);
  }

  window.Sections = { cupertinoNow, clock, metrics, datacenter, TZ };
})();
