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

  window.Viz = { scanModel, wire, gauge, bars };
})();
