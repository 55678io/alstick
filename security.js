// Live security modules: hacker detection (H), virus scan & removal (V),
// security hardening (S L) and A. Photo backgrounds + realistic canvas overlays.
(function () {
  const S = window.ALSTICK_STATS;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pad = n => String(n).padStart(2, "0");
  const stamp = () => { const d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); };
  // Addresses from the documentation-only ranges (RFC 5737), never real hosts
  const ip = () => ["203.0.113.", "198.51.100.", "192.0.2."][(Math.random() * 3) | 0] + (2 + ((Math.random() * 250) | 0));

  function canvasLoop(canvas, draw) {
    const ctx = canvas.getContext("2d");
    const st = { ctx, W: 0, H: 0, t: 0, visible: true };
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
      st.W = r.width; st.H = r.height;
      canvas.width = Math.max(1, r.width * dpr | 0); canvas.height = Math.max(1, r.height * dpr | 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    new ResizeObserver(resize).observe(canvas); resize();
    new IntersectionObserver(e => { st.visible = e[0].isIntersecting; }).observe(canvas);
    (function f() { if (st.visible) { st.t += reduceMotion ? 0.2 : 1; ctx.clearRect(0, 0, st.W, st.H); draw(st); } requestAnimationFrame(f); })();
    return st;
  }

  function logger(el, max) {
    return (text, cls) => {
      const line = document.createElement("div");
      line.className = "log-line" + (cls ? " " + cls : "");
      line.textContent = "[" + stamp() + "] " + text;
      el.prepend(line);
      while (el.children.length > max) el.lastChild.remove();
    };
  }

  function countUp(el, to, ms) {
    const t0 = performance.now();
    (function f(t) { const p = Math.min(1, (t - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
  }

  const card = (key, cls, img, title, chip, caption) =>
    '<article class="sec ' + cls + '" style="--img:url(' + img + ')">' +
    '<div class="sec-top"><div class="sec-title mono">' + title + '</div><span class="sec-chip mono"><i></i>' + chip + "</span></div>" +
    '<div class="sec-body"><canvas class="sec-canvas"></canvas>' +
    '<div class="sec-num"><div class="mono sec-k">' + S[key].label + '</div><div class="sec-val mono"><span data-to="' + S[key].value + '">0</span>' + (S[key].unit ? "<small>" + S[key].unit + "</small>" : "") + '</div><div class="sec-cap">' + caption + "</div></div></div>" +
    '<div class="sec-log mono"></div></article>';

  function mount(root, opts) {
    opts = opts || {};
    root.classList.add("sec-grid");
    root.innerHTML =
      card("H", "sec-h", "img/soc.jpg", "HACKER DETECTION", "ACTIVE", "Hacker attempts detected") +
      card("V", "sec-v", "img/virus.jpg", "VIRUS SCAN &amp; REMOVAL", "SCANNING", "Viruses found &amp; removed") +
      card("SL", "sec-sl", "img/shield.jpg", "SECURITY HARDENING", "IN PROGRESS", "Security level, increasing") +
      card("A", "sec-a", "img/datacenter.jpg", "NETWORK ACTIVITY", "LIVE", "&nbsp;");
    root.querySelectorAll("[data-to]").forEach(el => countUp(el, +el.dataset.to, 1400));
    const [h, v, sl, a] = root.querySelectorAll(".sec");
    hackerDetection(h); virusScan(v); hardening(sl); activity(a);
  }

  // ---------- H: radar intrusion detection ----------
  function hackerDetection(el) {
    const log = logger(el.querySelector(".sec-log"), opts_lines());
    const KINDS = ["SSH brute-force", "Port scan", "SQL injection", "Malware beacon", "Credential stuffing", "RDP probe"];
    const blips = [];
    let sweep = 0;
    const spawn = () => blips.push({ a: Math.random() * Math.PI * 2, r: 1, sp: 0.0016 + Math.random() * 0.0018, state: "in", life: 1, kind: KINDS[(Math.random() * KINDS.length) | 0], src: ip() });
    for (let i = 0; i < 3; i++) { spawn(); blips[i].r = 0.5 + Math.random() * 0.45; }
    log("IDS engine online — monitoring all interfaces", "ok");
    canvasLoop(el.querySelector(".sec-canvas"), s => {
      const { ctx, W, H, t } = s, cx = W * 0.5, cy = H * 0.52, R = Math.min(W, H) * 0.44;
      sweep = (t * 0.035) % (Math.PI * 2);
      // grid rings and crosshair
      ctx.strokeStyle = "rgba(34,211,238,0.28)"; ctx.lineWidth = 1;
      for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(cx, cy, R * k / 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2, r1 = R * (k % 3 ? 0.97 : 0.93); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
      // phosphor sweep
      const g = ctx.createConicGradient ? ctx.createConicGradient(sweep - 0.9, cx, cy) : null;
      if (g) {
        g.addColorStop(0, "rgba(34,211,238,0)"); g.addColorStop(0.14, "rgba(34,211,238,0.35)"); g.addColorStop(0.145, "rgba(34,211,238,0)"); g.addColorStop(1, "rgba(34,211,238,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = "rgba(165,243,252,0.9)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke(); ctx.lineWidth = 1;
      // protected core
      ctx.fillStyle = "rgba(34,211,238,0.18)"; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#a5f3fc"; ctx.fillRect(cx - 4, cy - 5, 8, 10);
      // incoming threats
      for (let i = blips.length - 1; i >= 0; i--) {
        const b = blips[i];
        if (b.state === "in") {
          b.r -= b.sp * (reduceMotion ? 0.2 : 1);
          const d = Math.abs(((sweep - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2));
          if (d < 0.08 && b.r < 0.92) { b.state = "blocked"; log(b.kind + " from " + b.src + " → BLOCKED", "bad"); }
          if (b.r < 0.12) { b.state = "blocked"; log(b.kind + " from " + b.src + " → BLOCKED at perimeter", "bad"); }
        } else { b.life -= 0.012; }
        const x = cx + Math.cos(b.a) * b.r * R, y = cy + Math.sin(b.a) * b.r * R;
        if (b.state === "in") {
          ctx.strokeStyle = "rgba(248,113,113,0.35)"; ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx + Math.cos(b.a) * R, cy + Math.sin(b.a) * R); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = "rgba(239,68,68,0.3)"; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f87171"; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
        } else {
          const a = Math.max(0, b.life);
          ctx.strokeStyle = "rgba(248,113,113," + a + ")"; ctx.lineWidth = 1.4;
          ctx.strokeRect(x - 9, y - 9, 18, 18);
          ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); ctx.lineWidth = 1;
          ctx.font = "700 9px ui-monospace, Menlo, monospace"; ctx.fillStyle = "rgba(254,202,202," + a + ")";
          ctx.fillText("BLOCKED", x + 12, y + 3);
          if (b.life <= 0) blips.splice(i, 1);
        }
      }
      if (blips.length < 4 && Math.random() < 0.012) spawn();
    });
  }

  // ---------- V: virus scan & quarantine ----------
  function virusScan(el) {
    const log = logger(el.querySelector(".sec-log"), opts_lines());
    const total = S.V.value;
    const NAMES = ["Trojan.Agent", "Worm.Autorun", "Backdoor.Generic", "Ransom.Locker", "Spyware.Keylog", "Adware.Bundler", "Rootkit.Hidden"];
    const PATHS = ["/usr/lib/", "/var/tmp/", "/home/user/Downloads/", "/opt/app/bin/", "/etc/cron.d/", "/srv/www/uploads/"];
    let cells = [], beam = 0, removed = 0, phase = "scan", hold = 0;
    const cap = el.querySelector(".sec-cap");
    function reset() {
      const C = 18, R = 7; cells = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) cells.push({ c, r, state: "idle", k: 0 });
      const picks = new Set(); while (picks.size < total) picks.add((Math.random() * cells.length) | 0);
      picks.forEach(i => { cells[i].bad = true; cells[i].name = NAMES[(Math.random() * NAMES.length) | 0]; cells[i].path = PATHS[(Math.random() * PATHS.length) | 0] + Math.random().toString(36).slice(2, 8) + ".bin"; });
      beam = 0; removed = 0; phase = "scan";
      cap.textContent = "Scanning\u2026 0/" + total + " removed";
      log("Full system scan started", "ok");
    }
    reset();
    canvasLoop(el.querySelector(".sec-canvas"), s => {
      const { ctx, W, H } = s;
      const C = 18, R = 7, gx = W * 0.06, gy = H * 0.14, gw = W * 0.88, gh = H * 0.72, cw = gw / C, ch = gh / R;
      if (phase === "scan" && beam < 1) beam += reduceMotion ? 0.001 : 0.0042;
      if (beam >= 1 && phase === "scan" && !cells.some(c => c.state === "found")) { phase = "done"; cap.textContent = "Removed " + removed + "/" + total + " \u2014 system clean"; hold = 160; log("Scan complete — " + removed + "/" + total + " threats removed. System clean", "ok"); }
      if (phase === "done" && --hold <= 0) reset();
      const bx = gx + gw * Math.min(beam, 1);
      cells.forEach(cl => {
        const x = gx + cl.c * cw, y = gy + cl.r * ch;
        if (cl.state === "idle" && x + cw < bx) {
          if (cl.bad) { cl.state = "found"; cl.k = 1; log("Detected " + cl.name + " in " + cl.path, "bad"); }
          else cl.state = "clean";
        }
        if (cl.state === "found") { cl.k -= 0.012; if (cl.k <= 0) { cl.state = "removed"; removed++; cap.textContent = "Removed " + removed + "/" + total + " — quarantined & deleted"; log(cl.name + " quarantined & deleted", "ok"); } }
        let fill = "rgba(148,163,184,0.10)", stroke = "rgba(148,163,184,0.25)";
        if (cl.state === "clean") { fill = "rgba(16,185,129,0.10)"; stroke = "rgba(52,211,153,0.35)"; }
        if (cl.state === "found") {
          const pulse = 0.5 + 0.5 * Math.sin(s.t * 0.4);
          fill = "rgba(239,68,68," + (0.35 + pulse * 0.35) + ")"; stroke = "rgba(254,202,202,0.9)";
          const sz = Math.max(0.15, cl.k);
          ctx.fillStyle = fill; ctx.fillRect(x + cw * (1 - sz) / 2 + 1, y + ch * (1 - sz) / 2 + 1, cw * sz - 2, ch * sz - 2);
          ctx.strokeStyle = stroke; ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
          return;
        }
        if (cl.state === "removed") { fill = "rgba(16,185,129,0.22)"; stroke = "rgba(110,231,183,0.7)"; }
        ctx.fillStyle = fill; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
        ctx.strokeStyle = stroke; ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
      });
      if (phase === "scan") {
        const g = ctx.createLinearGradient(bx - 40, 0, bx, 0);
        g.addColorStop(0, "rgba(56,189,248,0)"); g.addColorStop(1, "rgba(56,189,248,0.45)");
        ctx.fillStyle = g; ctx.fillRect(bx - 40, gy - 6, 40, gh + 12);
        ctx.fillStyle = "#7dd3fc"; ctx.fillRect(bx - 1, gy - 8, 2, gh + 16);
        ctx.font = "700 10px ui-monospace, Menlo, monospace"; ctx.fillStyle = "#e0f2fe";
        ctx.fillText(Math.round(beam * 100) + "%", Math.min(bx + 4, W - 32), gy - 10);
      } else {
        ctx.font = "700 12px ui-monospace, Menlo, monospace"; ctx.fillStyle = "#6ee7b7";
        ctx.fillText("✓ SYSTEM CLEAN", gx, gy - 10);
      }
    });
  }

  // ---------- S L: security hardening ----------
  function hardening(el) {
    const log = logger(el.querySelector(".sec-log"), opts_lines());
    const STEPS = ["Firewall rules updated", "Unused ports closed", "TLS 1.3 enforced", "Disk encryption verified", "2FA enforced for admins", "Patches applied", "Intrusion prevention tuned"];
    let step = 0, prog = 0;
    canvasLoop(el.querySelector(".sec-canvas"), s => {
      const { ctx, W, H, t } = s, cx = W * 0.5, cy = H * 0.5, R = Math.min(W, H) * 0.42;
      prog += reduceMotion ? 0.002 : 0.006;
      if (prog >= 1) { prog = 0; log(STEPS[step % STEPS.length] + " ✓", "ok"); step++; }
      const layers = 5, done = step % (layers + 1);
      for (let k = layers; k >= 1; k--) {
        const r = R * (0.35 + 0.65 * k / layers);
        const active = k <= done, building = k === done + 1;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.92; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath();
        ctx.fillStyle = active ? "rgba(16,185,129," + (0.05 + 0.03 * k) + ")" : "rgba(148,163,184,0.03)";
        ctx.fill();
        ctx.lineWidth = active ? 1.8 : 1;
        ctx.strokeStyle = active ? "rgba(110,231,183,0.85)" : "rgba(148,163,184,0.3)";
        ctx.stroke();
        if (building) { // trace the layer being built
          const per = 6 * prog; ctx.beginPath();
          for (let i = 0; i <= Math.floor(per); i++) {
            const a = Math.PI / 6 + i * Math.PI / 3; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.92;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          const i2 = Math.floor(per), f = per - i2, a1 = Math.PI / 6 + i2 * Math.PI / 3, a2 = a1 + Math.PI / 3;
          const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r * 0.92, x2 = cx + Math.cos(a2) * r, y2 = cy + Math.sin(a2) * r * 0.92;
          const ex = x1 + (x2 - x1) * f, ey = y1 + (y2 - y1) * f; ctx.lineTo(ex, ey);
          ctx.strokeStyle = "#34d399"; ctx.lineWidth = 2.4; ctx.stroke();
          ctx.fillStyle = "rgba(52,211,153,0.35)"; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#d1fae5"; ctx.beginPath(); ctx.arc(ex, ey, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.lineWidth = 1;
      }
      // lock in the centre
      const lw = R * 0.22, lh = R * 0.18;
      ctx.strokeStyle = "#a7f3d0"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(cx, cy - lh * 0.15, lw * 0.32, Math.PI, 0); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(16,185,129,0.85)"; ctx.fillRect(cx - lw / 2, cy - lh * 0.15, lw, lh);
      ctx.fillStyle = "#064e3b"; ctx.fillRect(cx - 1.5, cy + lh * 0.1, 3, lh * 0.4);
      // rising indicator
      const y = cy + R * 0.95 - ((t * 0.6) % (R * 0.6));
      ctx.fillStyle = "rgba(110,231,183,0.6)"; ctx.font = "700 11px ui-monospace, Menlo, monospace"; ctx.fillText("▲", W * 0.86, y);
    });
    log("Hardening policy loaded — raising security level", "ok");
  }

  // ---------- A: live network activity ----------
  function activity(el) {
    const log = logger(el.querySelector(".sec-log"), opts_lines());
    const series = Array.from({ length: 60 }, () => 0.4 + Math.random() * 0.2);
    let tick = 0;
    canvasLoop(el.querySelector(".sec-canvas"), s => {
      const { ctx, W, H } = s;
      if (++tick % 6 === 0) { const last = series[series.length - 1]; series.push(Math.min(0.95, Math.max(0.1, last + (Math.random() - 0.5) * 0.18))); series.shift(); }
      ctx.strokeStyle = "rgba(148,163,184,0.18)";
      for (let k = 1; k < 4; k++) { const y = H * k / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      const pts = series.map((v, i) => [i / (series.length - 1) * W, H * (1 - v)]);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(129,140,248,0.45)"); g.addColorStop(1, "rgba(129,140,248,0)");
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = "#a5b4fc"; ctx.lineWidth = 2; ctx.stroke(); ctx.lineWidth = 1;
      const [lx, ly] = pts[pts.length - 1];
      ctx.fillStyle = "rgba(165,180,252,0.35)"; ctx.beginPath(); ctx.arc(lx - 2, ly, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e0e7ff"; ctx.beginPath(); ctx.arc(lx - 2, ly, 2.5, 0, Math.PI * 2); ctx.fill();
    });
    log("Traffic monitor online", "ok");
    setInterval(() => log("Flow " + ip() + " → core-0" + (1 + (Math.random() * 3 | 0)) + "  " + (20 + (Math.random() * 900 | 0)) + " kB/s"), 2600);
  }

  let LINES = 4;
  function opts_lines() { return LINES; }
  window.Sec = { mount: (root, o) => { LINES = (o && o.lines) || 4; mount(root, o); } };
})();
