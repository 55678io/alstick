// Small dependency-free 3D canvas helpers for the Alstick report pages.
(function () {
  const ACCENT = "37, 99, 235";
  const RED = "220, 38, 38";
  const COLORS = { blue: "37,99,235", cyan: "6,182,212", violet: "139,92,246", green: "16,185,129", amber: "245,158,11", rose: "244,63,94", red: "220,38,38" };
  const darker = (rgb, k) => rgb.split(",").map(v => Math.round(v * k)).join(",");
  // Lit 3D ball: highlight top-left, darker rim
  function ball(ctx, x, y, r, rgb, a) {
    a = a == null ? 1 : a;
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(255,255,255," + a + ")");
    g.addColorStop(0.35, "rgba(" + rgb + "," + a + ")");
    g.addColorStop(1, "rgba(" + darker(rgb, 0.55) + "," + a + ")");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Run a draw loop on a canvas with DPR-aware sizing; pauses when off screen.
  function loop(canvas, draw) {
    const ctx = canvas.getContext("2d");
    const s = { ctx, W: 0, H: 0, t: 0, visible: true };
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      s.W = r.width; s.H = r.height;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    new ResizeObserver(resize).observe(canvas);
    resize();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(es => { s.visible = es[0].isIntersecting; }).observe(canvas);
    }
    function frame() {
      if (s.visible) {
        s.t += reduceMotion ? 0.15 : 1;
        ctx.clearRect(0, 0, s.W, s.H);
        draw(s);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return s;
  }

  // Rotate (yaw, then pitch) and project with perspective. y is up.
  function makeProjector(s, yaw, pitch, scale, cx, cy, dist) {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    dist = dist || 4;
    return p => {
      const x1 = p.x * cyw - p.z * syw;
      const z1 = p.x * syw + p.z * cyw;
      const y2 = p.y * cp - z1 * sp;
      const z2 = p.y * sp + z1 * cp;
      const f = dist / (dist - z2);
      return { x: cx + x1 * scale * f, y: cy - y2 * scale * f, z: z2, f };
    };
  }

  const depthA = (z, lo) => (lo == null ? 0.15 : lo) + Math.max(0, Math.min(1, (z + 1.2) / 2.4)) * (1 - (lo == null ? 0.15 : lo));

  function ring(ctx, proj, y, r, n) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const q = proj({ x: Math.cos(a) * r, y, z: Math.sin(a) * r });
      i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
    }
  }

  // ---------- 3D network scan model ----------
  function scanModel(canvas) {
    const layers = [
      { y: 0.75, r: 0.28, n: 3, size: 4.6, name: "CORE", c: COLORS.violet },
      { y: 0.05, r: 0.62, n: 6, size: 3.8, name: "DIST", c: COLORS.cyan },
      { y: -0.65, r: 1.0, n: 16, size: 3.0, name: "ACCESS", c: COLORS.green },
    ];
    const nodes = [];
    layers.forEach((L, li) => {
      for (let i = 0; i < L.n; i++) {
        const a = (i / L.n) * Math.PI * 2 + li * 0.4;
        nodes.push({ x: Math.cos(a) * L.r, y: L.y, z: Math.sin(a) * L.r, layer: li, glow: 0 });
      }
    });
    const links = [];
    const byLayer = li => nodes.map((n, i) => [n, i]).filter(([n]) => n.layer === li);
    // core ring
    const core = byLayer(0);
    core.forEach(([, i], k) => links.push([i, core[(k + 1) % core.length][1]]));
    // each lower node links to the 2 nearest nodes in the layer above
    [1, 2].forEach(li => {
      byLayer(li).forEach(([n, i]) => {
        byLayer(li - 1)
          .map(([m, j]) => ({ j, d: (m.x - n.x) ** 2 + (m.z - n.z) ** 2 }))
          .sort((a, b) => a.d - b.d)
          .slice(0, li === 1 ? 2 : 1)
          .forEach(({ j }) => links.push([i, j]));
      });
    });
    const packets = [];
    const spawn = () => {
      const [a, b] = links[(Math.random() * links.length) | 0];
      packets.push({ a, b, t: 0, sp: 0.01 + Math.random() * 0.015, dir: Math.random() < 0.5 });
    };
    for (let i = 0; i < 14; i++) { spawn(); packets[i].t = Math.random(); }

    let yaw = 0.4, drag = false, lx = 0, vel = 0.004;
    canvas.addEventListener("pointerdown", e => { drag = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (drag) { vel = (e.clientX - lx) * 0.006; yaw += vel; lx = e.clientX; } });
    const up = () => { drag = false; };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    loop(canvas, s => {
      const { ctx, W, H, t } = s;
      if (!drag) { yaw += vel; vel += (0.004 - vel) * 0.03; }
      const scale = Math.min(W * 0.3, H * 0.3);
      const proj = makeProjector(s, yaw, 0.42, scale, W / 2, H * 0.54, 4);

      // floor grid
      ctx.lineWidth = 1;
      const fy = -0.95, G = 1.3, step = 0.26;
      for (let g = -G; g <= G + 1e-6; g += step) {
        const a1 = proj({ x: g, y: fy, z: -G }), a2 = proj({ x: g, y: fy, z: G });
        const b1 = proj({ x: -G, y: fy, z: g }), b2 = proj({ x: G, y: fy, z: g });
        ctx.strokeStyle = "rgba(0,0,0,0.06)";
        ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      }
      // radar sweep on the floor
      const sweep = t * 0.03;
      const c0 = proj({ x: 0, y: fy, z: 0 });
      for (let k = 0; k < 18; k++) {
        const a = sweep - k * 0.045;
        const q = proj({ x: Math.cos(a) * 1.35, y: fy, z: Math.sin(a) * 1.35 });
        ctx.strokeStyle = "rgba(" + ACCENT + "," + (0.35 * (1 - k / 18)).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      [0.45, 0.9, 1.35].forEach(r => { ring(ctx, proj, fy, r, 64); ctx.stroke(); });

      // layer platforms
      layers.forEach(L => {
        ring(ctx, proj, L.y, L.r + 0.12, 64);
        ctx.fillStyle = "rgba(" + L.c + ",0.07)"; ctx.fill();
        ctx.strokeStyle = "rgba(" + L.c + ",0.55)"; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      });

      // scan plane sweeping up and down
      const scanY = Math.sin(t * 0.018) * 0.85;
      ring(ctx, proj, scanY, 1.18, 72);
      const sc = proj({ x: 0, y: scanY, z: 0 });
      const sg = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, Math.min(W, H) * 0.45);
      sg.addColorStop(0, "rgba(6,182,212,0.18)"); sg.addColorStop(1, "rgba(37,99,235,0.05)");
      ctx.fillStyle = sg; ctx.fill();
      ctx.strokeStyle = "rgba(" + ACCENT + ",0.55)"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1;

      const P = nodes.map(n => {
        if (Math.abs(n.y - scanY) < 0.08) n.glow = 1;
        n.glow *= 0.97;
        return proj(n);
      });

      // vertical beams from floor to access layer
      nodes.forEach((n, i) => {
        if (n.layer !== 2) return;
        const b = proj({ x: n.x, y: fy, z: n.z });
        ctx.strokeStyle = "rgba(0,0,0,0.07)";
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(P[i].x, P[i].y); ctx.stroke();
      });

      // links
      links.forEach(([i, j]) => {
        const a = P[i], b = P[j];
        const al = (depthA((a.z + b.z) / 2) * 0.8).toFixed(3);
        const lg = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        lg.addColorStop(0, "rgba(" + layers[nodes[i].layer].c + "," + al + ")");
        lg.addColorStop(1, "rgba(" + layers[nodes[j].layer].c + "," + al + ")");
        ctx.strokeStyle = lg; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      ctx.lineWidth = 1;

      // packets
      for (let k = packets.length - 1; k >= 0; k--) {
        const pk = packets[k];
        pk.t += pk.sp * (reduceMotion ? 0.2 : 1);
        if (pk.t >= 1) { packets.splice(k, 1); spawn(); continue; }
        const A = nodes[pk.dir ? pk.a : pk.b], B = nodes[pk.dir ? pk.b : pk.a];
        const q = proj({ x: A.x + (B.x - A.x) * pk.t, y: A.y + (B.y - A.y) * pk.t, z: A.z + (B.z - A.z) * pk.t });
        const pc = layers[A.layer].c;
        ctx.fillStyle = "rgba(" + pc + ",0.22)";
        ctx.beginPath(); ctx.arc(q.x, q.y, 6 * q.f, 0, Math.PI * 2); ctx.fill();
        ball(ctx, q.x, q.y, 2.4 * q.f, pc, 1);
      }

      // nodes (back to front)
      P.map((p, i) => i).sort((a, b) => P[a].z - P[b].z).forEach(i => {
        const p = P[i], n = nodes[i], L = layers[n.layer];
        const r = L.size * p.f;
        const al = depthA(p.z, 0.35);
        if (n.glow > 0.05) {
          ctx.fillStyle = "rgba(" + L.c + "," + (0.3 * n.glow).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 9 * n.glow, 0, Math.PI * 2); ctx.fill();
        }
        if (n.layer === 0) { // server blocks for core
          const g2 = ctx.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
          g2.addColorStop(0, "rgba(" + L.c + ",1)"); g2.addColorStop(1, "rgba(" + darker(L.c, 0.55) + ",1)");
          ctx.fillStyle = g2; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          for (let k = 0; k < 3; k++) ctx.fillRect(p.x - r * 0.7, p.y - r * 0.6 + k * r * 0.5, r * 1.4, r * 0.18);
          ctx.fillStyle = n.glow > 0.3 ? "#22d3ee" : "#a7f3d0";
          ctx.fillRect(p.x + r * 0.45, p.y + r * 0.55, r * 0.25, r * 0.25);
        } else {
          ball(ctx, p.x, p.y, r, n.glow > 0.3 ? COLORS.blue : L.c, al);
        }
      });

      // layer labels
      ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
      layers.forEach(L => {
        ctx.fillStyle = "rgba(" + darker(L.c, 0.8) + ",0.95)";
        const q = proj({ x: -(L.r + 0.2) * Math.cos(yaw), y: L.y, z: (L.r + 0.2) * Math.sin(yaw) });
        ctx.fillText(L.name, Math.min(W - 60, Math.max(8, q.x - 50)), q.y + 3);
      });

      // HUD corner brackets
      const m = 10, l = 16;
      ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1.5;
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(x, y + dy * l); ctx.lineTo(x, y); ctx.lineTo(x + dx * l, y); ctx.stroke();
      });
      ctx.lineWidth = 1;
    });
  }

  // ---------- rotating wireframe solids for the stat tiles ----------
  const SHAPES = {
    cube: (() => {
      const v = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push({ x, y, z });
      const e = []; v.forEach((a, i) => v.forEach((b, j) => { if (j > i && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) === 2) e.push([i, j]); }));
      return { v: v.map(p => ({ x: p.x * 0.75, y: p.y * 0.75, z: p.z * 0.75 })), e };
    })(),
    octa: (() => {
      const v = [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }];
      const e = []; v.forEach((a, i) => v.forEach((b, j) => { if (j > i && !(a.x === -b.x && a.y === -b.y && a.z === -b.z)) e.push([i, j]); }));
      return { v, e };
    })(),
    icosa: (() => {
      const t = (1 + Math.sqrt(5)) / 2, s = 1 / Math.hypot(1, t);
      const raw = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
      const v = raw.map(([x, y, z]) => ({ x: x * s, y: y * s, z: z * s }));
      const e = []; v.forEach((a, i) => v.forEach((b, j) => { if (j > i && Math.abs(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - 2 * s) < 1e-6) e.push([i, j]); }));
      return { v, e };
    })(),
  };

  function wire(canvas, shapeName, color) {
    const sh = SHAPES[shapeName];
    const rgb = COLORS[color] || ACCENT;
    loop(canvas, s => {
      const { ctx, W, H, t } = s;
      const proj = makeProjector(s, t * 0.012, 0.5 + Math.sin(t * 0.008) * 0.25, Math.min(W, H) * 0.32, W / 2, H / 2, 4);
      const P = sh.v.map(proj);
      const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.5);
      glow.addColorStop(0, "rgba(" + rgb + ",0.16)"); glow.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
      ctx.lineWidth = 1.4;
      sh.e.forEach(([i, j]) => {
        const a = P[i], b = P[j];
        ctx.strokeStyle = "rgba(" + rgb + "," + depthA((a.z + b.z) / 2, 0.2).toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      ctx.lineWidth = 1;
      P.map((p, i) => i).sort((a, b) => P[a].z - P[b].z).forEach(i => {
        const p = P[i];
        ball(ctx, p.x, p.y, 3.2 * p.f, rgb, depthA(p.z, 0.35));
      });
    });
  }

  // ---------- tilted 3D ring gauge ----------
  function gauge(canvas, pct, color) {
    const gc = COLORS[color] || COLORS.green;
    loop(canvas, s => {
      const { ctx, W, H, t } = s;
      const shown = Math.min(pct, (t / 60) * pct);
      const proj = makeProjector(s, 0, 0.95, Math.min(W, H) * 0.36, W / 2, H / 2, 4);
      for (let layer = 0; layer < 3; layer++) {
        const y = -0.12 + layer * 0.12;
        ring(ctx, proj, y, 1, 72);
        ctx.strokeStyle = "rgba(0,0,0," + (0.08 + layer * 0.05) + ")"; ctx.lineWidth = 1; ctx.stroke();
      }
      // filled arc on the top ring
      const end = (shown / 100) * Math.PI * 2;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = -Math.PI / 2 + (i / 48) * end;
        const q = proj({ x: Math.cos(a), y: 0.12, z: Math.sin(a) });
        i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.strokeStyle = "rgba(" + gc + ",0.25)"; ctx.lineWidth = 10; ctx.lineCap = "round"; ctx.stroke();
      ctx.strokeStyle = "rgba(" + gc + ",1)"; ctx.lineWidth = 4; ctx.stroke(); ctx.lineWidth = 1;
      // orbiting marker
      const a = t * 0.03;
      const q = proj({ x: Math.cos(a), y: -0.12, z: Math.sin(a) });
      ball(ctx, q.x, q.y, 3.2, gc, 1);
    });
  }

  // ---------- rotating 3D bar model ----------
  function bars(canvas, items) {
    const max = Math.max(...items.map(i => i.value), 1);
    let yaw = 0.6, drag = false, lx = 0, vel = 0.003;
    canvas.addEventListener("pointerdown", e => { drag = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (drag) { vel = (e.clientX - lx) * 0.006; yaw += vel; lx = e.clientX; } });
    const up = () => { drag = false; };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    loop(canvas, s => {
      const { ctx, W, H, t } = s;
      if (!drag) { yaw += vel; vel += (0.003 - vel) * 0.03; }
      const grow = Math.min(1, t / 70);
      const proj = makeProjector(s, yaw, 0.45, Math.min(W * 0.32, H * 0.4), W / 2, H * 0.68, 5);
      // floor
      const F = 1.3;
      for (let g = -F; g <= F + 1e-6; g += 0.26) {
        const a1 = proj({ x: g, y: 0, z: -F }), a2 = proj({ x: g, y: 0, z: F });
        const b1 = proj({ x: -F, y: 0, z: g }), b2 = proj({ x: F, y: 0, z: g });
        ctx.strokeStyle = "rgba(0,0,0,0.07)";
        ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.stroke();
      }
      // boxes
      const w = 0.17, gap = 2 * F / (items.length + 1);
      const boxes = items.map((it, k) => {
        const cx = -F + gap * (k + 1), h = (it.value / max) * 1.5 * grow;
        const v = [];
        for (const y of [0, h]) for (const [dx, dz] of [[-w, -w], [w, -w], [w, w], [-w, w]]) v.push({ x: cx + dx, y, z: dz });
        const P = v.map(proj);
        const faces = [
          { idx: [0, 1, 5, 4] }, { idx: [1, 2, 6, 5] }, { idx: [2, 3, 7, 6] }, { idx: [3, 0, 4, 7] }, { idx: [4, 5, 6, 7], top: true },
        ].map(f => ({ ...f, z: f.idx.reduce((a, i) => a + P[i].z, 0) / 4 }));
        const c = proj({ x: cx, y: 0, z: 0 });
        return { it, P, faces, z: c.z, h, cx };
      }).sort((a, b) => a.z - b.z);

      boxes.forEach(b => {
        b.faces.sort((x, y) => x.z - y.z).forEach((f, n) => {
          ctx.beginPath();
          f.idx.forEach((i, k) => (k ? ctx.lineTo(b.P[i].x, b.P[i].y) : ctx.moveTo(b.P[i].x, b.P[i].y)));
          ctx.closePath();
          const bc = COLORS[b.it.color] || ACCENT;
          ctx.fillStyle = f.top ? "rgb(" + bc + ")" : "rgb(" + darker(bc, n % 2 ? 0.72 : 0.9) + ")";
          ctx.fill();
          ctx.strokeStyle = "rgba(" + darker(bc, 0.45) + ",0.9)"; ctx.stroke();
        });
      });
      // labels last so no bar covers them
      ctx.textAlign = "center";
      boxes.forEach(b => {
        const top = proj({ x: b.cx, y: b.h + 0.16, z: 0 });
        ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = "#111";
        ctx.fillText(String(Math.round(b.it.value * grow)), top.x, top.y);
        const base = proj({ x: b.cx, y: 0, z: 0 });
        ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillText(b.it.label, base.x, base.y + 22);
      });
      ctx.textAlign = "left";
    });
  }

  // ---------- realistic 3D data-centre: server racks, LEDs, cable trays ----------
  function serverRoom(canvas, opts) {
    opts = opts || {};
    const ROWS = [-0.78, 0.78], COLS = opts.cols || [-1.25, 0, 1.25];
    const UNITS = 11;
    const racks = [];
    ROWS.forEach((z, ri) => COLS.forEach((x, ci) => racks.push({
      x, z, w: 0.3, d: 0.34, h: 1.55, name: String.fromCharCode(65 + ri) + "0" + (ci + 1),
      // front faces the cold aisle in the middle
      facing: ri === 0 ? 1 : -1,
      units: Array.from({ length: UNITS }, (_, u) => ({
        kind: [0, 0, 1, 0, 2, 0, 1, 0, 0, 3, 0][(u + ci * 2 + ri * 3) % 11],
        ph: Math.random() * 10, rate: 0.05 + Math.random() * 0.25,
      })),
    })));
    // cross-aisle cables between racks (overhead)
    const cables = [];
    racks.forEach((a, i) => racks.forEach((b, j) => {
      if (j > i && a.z !== b.z && Math.abs(a.x - b.x) < 1.3) cables.push({ a, b, c: [COLORS.cyan, COLORS.blue, COLORS.violet][(i + j) % 3] });
    }));
    const packets = cables.map((c, k) => ({ c, t: Math.random(), sp: 0.006 + Math.random() * 0.008 }));

    let yaw = 0.55, drag = false, lx = 0, vel = 0.0022;
    canvas.addEventListener("pointerdown", e => { drag = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (drag) { vel = (e.clientX - lx) * 0.006; yaw += vel; lx = e.clientX; } });
    const up = () => { drag = false; };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    const LIGHT = (() => { const v = [-0.45, 0.8, 0.55], l = Math.hypot(...v); return v.map(c => c / l); })();
    const shadeOf = n => 0.38 + 0.62 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);

    loop(canvas, s => {
      const { ctx, W, H, t } = s;
      if (!drag) { yaw += vel; vel += (0.0022 - vel) * 0.03; }
      const pitch = 0.5;
      const scale = Math.min(W * 0.19, H * 0.24);
      const proj = makeProjector(s, yaw, pitch, scale, W / 2, H * 0.68, 7);
      const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const facesCam = n => { const z1 = n[0] * syw + n[2] * cyw; return n[1] * sp + z1 * cp > 0.02; };
      const poly = (pts, fill, stroke) => {
        const q = pts.map(proj);
        ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
        return q;
      };

      // Raised floor with perforated cold-aisle tiles
      const FX = 2.0, FZ = 1.7, T = 0.34;
      poly([{ x: -FX, y: 0, z: -FZ }, { x: FX, y: 0, z: -FZ }, { x: FX, y: 0, z: FZ }, { x: -FX, y: 0, z: FZ }], "#eef1f5");
      for (let x = -FX; x < FX - 1e-6; x += T) for (let z = -FZ; z < FZ - 1e-6; z += T) {
        const cold = Math.abs(z + T / 2) < 0.4;
        poly([{ x, y: 0, z }, { x: x + T, y: 0, z }, { x: x + T, y: 0, z: z + T }, { x, y: 0, z: z + T }],
          cold ? "rgba(6,182,212," + (0.10 + 0.05 * Math.sin(t * 0.04 + x * 2)).toFixed(3) + ")" : null, "rgba(120,130,150,0.22)");
      }

      // Soft contact shadows
      racks.forEach(r => {
        poly([{ x: r.x - r.w - 0.08, y: 0.001, z: r.z - r.d - 0.08 }, { x: r.x + r.w + 0.1, y: 0.001, z: r.z - r.d - 0.08 },
              { x: r.x + r.w + 0.1, y: 0.001, z: r.z + r.d + 0.1 }, { x: r.x - r.w - 0.08, y: 0.001, z: r.z + r.d + 0.1 }], "rgba(15,23,42,0.16)");
      });

      // Collect visible faces of every rack and paint back-to-front
      const faces = [];
      racks.forEach(r => {
        const x0 = r.x - r.w, x1 = r.x + r.w, z0 = r.z - r.d, z1 = r.z + r.d, h = r.h;
        const F = [
          { n: [0, 0, 1], pts: [{ x: x0, y: 0, z: z1 }, { x: x1, y: 0, z: z1 }, { x: x1, y: h, z: z1 }, { x: x0, y: h, z: z1 }] },
          { n: [0, 0, -1], pts: [{ x: x1, y: 0, z: z0 }, { x: x0, y: 0, z: z0 }, { x: x0, y: h, z: z0 }, { x: x1, y: h, z: z0 }] },
          { n: [1, 0, 0], pts: [{ x: x1, y: 0, z: z1 }, { x: x1, y: 0, z: z0 }, { x: x1, y: h, z: z0 }, { x: x1, y: h, z: z1 }] },
          { n: [-1, 0, 0], pts: [{ x: x0, y: 0, z: z0 }, { x: x0, y: 0, z: z1 }, { x: x0, y: h, z: z1 }, { x: x0, y: h, z: z0 }] },
          { n: [0, 1, 0], pts: [{ x: x0, y: h, z: z1 }, { x: x1, y: h, z: z1 }, { x: x1, y: h, z: z0 }, { x: x0, y: h, z: z0 }] },
        ];
        F.forEach(f => {
          if (!facesCam(f.n)) return;
          const zs = f.pts.map(p => proj(p).z);
          faces.push({ r, f, z: zs.reduce((a, b) => a + b, 0) / 4, front: f.n[2] === r.facing, back: f.n[2] === -r.facing });
        });
      });
      faces.sort((a, b) => a.z - b.z);

      faces.forEach(({ r, f, front, back }) => {
        const sh = shadeOf(f.n);
        const base = Math.round(34 * sh + 8), body = "rgb(" + base + "," + (base + 4) + "," + (base + 12) + ")";
        poly(f.pts, body, "rgba(0,0,0,0.65)");
        const zf = f.pts[0].z + f.n[2] * 0.002;
        if (front) {
          // server units
          const uh = (r.h - 0.12) / UNITS, xl = r.x - r.w + 0.035, xr = r.x + r.w - 0.035;
          const X = u => (r.facing > 0 ? u : -u); // mirror x so LEDs stay on the right when facing -z
          r.units.forEach((u, k) => {
            const y0 = 0.07 + k * uh + 0.01, y1 = y0 + uh - 0.02;
            const col = ["#2c3340", "#343c4b", "#1f2632", "#3a3f4a"][u.kind];
            const pts = [{ x: xl, y: y0, z: zf }, { x: xr, y: y0, z: zf }, { x: xr, y: y1, z: zf }, { x: xl, y: y1, z: zf }];
            poly(pts, col, "rgba(255,255,255,0.06)");
            const ym = (y0 + y1) / 2, cxr = r.x + X(r.w - 0.08);
            if (u.kind === 1) { // storage: drive bays
              for (let b = 0; b < 6; b++) {
                const bx = r.x + X(-r.w + 0.07 + b * 0.065);
                const a = proj({ x: bx, y: y0 + 0.012, z: zf }), c = proj({ x: bx, y: y1 - 0.012, z: zf });
                ctx.strokeStyle = "rgba(160,170,190,0.35)"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
                const on = Math.sin(t * (0.2 + b * 0.03) + u.ph + b) > 0.6;
                const l = proj({ x: bx + X(0.02), y: y1 - 0.02, z: zf });
                ctx.fillStyle = on ? "rgba(16,185,129,1)" : "rgba(16,185,129,0.25)";
                ctx.fillRect(l.x - 1, l.y - 1, 2, 2);
              }
            } else if (u.kind === 2) { // switch: port row
              for (let b = 0; b < 10; b++) {
                const l = proj({ x: r.x + X(-r.w + 0.07 + b * 0.04), y: ym, z: zf });
                const on = Math.sin(t * 0.3 + b * 1.7 + u.ph) > 0;
                ctx.fillStyle = on ? "rgba(34,211,238,0.95)" : "rgba(34,211,238,0.25)";
                ctx.fillRect(l.x - 1.2, l.y - 1, 2.4, 2);
              }
            } else { // server: vent slots
              for (let b = 0; b < 5; b++) {
                const a = proj({ x: r.x + X(-r.w + 0.07 + b * 0.05), y: ym, z: zf }), c = proj({ x: r.x + X(-r.w + 0.1 + b * 0.05), y: ym, z: zf });
                ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
              }
            }
            // status LEDs with glow
            const blink = Math.sin(t * u.rate + u.ph) > -0.2;
            const leds = [[0, u.kind === 3 && Math.sin(t * 0.02 + u.ph) > 0.7 ? "245,158,11" : "16,185,129", blink], [0.045, "59,130,246", true]];
            leds.forEach(([dx, c, on]) => {
              const l = proj({ x: cxr - X(dx), y: ym, z: zf });
              if (on) { ctx.fillStyle = "rgba(" + c + ",0.28)"; ctx.beginPath(); ctx.arc(l.x, l.y, 4.2 * l.f, 0, Math.PI * 2); ctx.fill(); }
              ctx.fillStyle = "rgba(" + c + "," + (on ? 1 : 0.25) + ")";
              ctx.beginPath(); ctx.arc(l.x, l.y, 1.6 * l.f, 0, Math.PI * 2); ctx.fill();
            });
          });
          // glass door reflection
          const q = f.pts.map(proj);
          const g = ctx.createLinearGradient(q[0].x, q[3].y, q[1].x, q[0].y);
          g.addColorStop(0, "rgba(255,255,255,0.16)"); g.addColorStop(0.45, "rgba(255,255,255,0.02)"); g.addColorStop(1, "rgba(255,255,255,0.08)");
          ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
          ctx.fillStyle = g; ctx.fill();
          // rack label
          const lb = proj({ x: r.x, y: r.h - 0.03, z: zf });
          ctx.font = "700 " + Math.max(8, 9 * lb.f) + "px ui-monospace, Menlo, monospace";
          ctx.textAlign = "center"; ctx.fillStyle = "rgba(226,232,240,0.85)"; ctx.fillText(r.name, lb.x, lb.y + 1); ctx.textAlign = "left";
        } else if (back) {
          for (let k = 1; k < 14; k++) {
            const y = (k / 14) * r.h;
            const a = proj({ x: r.x - r.w + 0.05, y, z: zf }), c = proj({ x: r.x + r.w - 0.05, y, z: zf });
            ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
          }
        } else if (f.n[1] === 1) {
          // top: fan grilles
          [-0.13, 0.13].forEach(dx => {
            ring2(ctx, proj, r.x + dx, r.h + 0.001, r.z, 0.08);
            ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.stroke();
          });
        }
      });

      // Drop cables from each rack to the overhead fibre runs
      racks.forEach(r => {
        const a = proj({ x: r.x, y: r.h, z: r.z }), b = proj({ x: r.x, y: 1.85, z: r.z });
        ctx.strokeStyle = "rgba(30,41,59,0.75)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.lineWidth = 1;
      });
      // Cross-aisle fibre runs with travelling light
      const arc = (c, u) => ({ x: c.a.x + (c.b.x - c.a.x) * u, y: 1.85 + Math.sin(Math.PI * u) * 0.28, z: c.a.z + (c.b.z - c.a.z) * u });
      cables.forEach(c => {
        ctx.beginPath();
        for (let k = 0; k <= 20; k++) { const q = proj(arc(c, k / 20)); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
        ctx.strokeStyle = "rgba(" + c.c + ",0.55)"; ctx.lineWidth = 1.6; ctx.stroke(); ctx.lineWidth = 1;
      });
      packets.forEach(pk => {
        pk.t += pk.sp * (reduceMotion ? 0.2 : 1); if (pk.t > 1) pk.t -= 1;
        const q = proj(arc(pk.c, pk.t));
        ctx.fillStyle = "rgba(" + pk.c.c + ",0.25)"; ctx.beginPath(); ctx.arc(q.x, q.y, 6 * q.f, 0, Math.PI * 2); ctx.fill();
        ball(ctx, q.x, q.y, 2.4 * q.f, pk.c.c, 1);
      });
    });
  }

  function ring2(ctx, proj, cx, y, cz, r) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2, q = proj({ x: cx + Math.cos(a) * r, y, z: cz + Math.sin(a) * r });
      i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
    }
  }

  window.Viz = { scanModel, wire, gauge, bars, serverRoom };
})();
