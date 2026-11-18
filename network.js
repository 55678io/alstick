// 3D network globe: nodes on a sphere, linked to their nearest neighbours,
// with data packets travelling along the links. Drag to rotate.
(function () {
  const canvas = document.getElementById("net");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const N = 110;            // nodes
  const K = 3;              // links per node
  const ACCENT = "37, 99, 235"; // blue packets

  // Fibonacci sphere
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    nodes.push({ x: Math.cos(t) * r, y, z: Math.sin(t) * r, pulse: Math.random() * Math.PI * 2 });
  }

  // Nearest-neighbour links (deduplicated)
  const links = [];
  const seen = new Set();
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 }))
      .filter(o => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, K)
      .forEach(({ j }) => {
        const key = i < j ? i + "-" + j : j + "-" + i;
        if (!seen.has(key)) { seen.add(key); links.push([i, j]); }
      });
  });

  // A few long "backbone" arcs across the globe
  const arcs = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.floor(Math.random() * N);
    let b = Math.floor(Math.random() * N);
    if (b === a) b = (a + (N >> 1)) % N;
    arcs.push([a, b]);
  }

  // Packets travelling along links
  const packets = [];
  const spawn = () => {
    const useArc = Math.random() < 0.15;
    const [a, b] = useArc ? arcs[(Math.random() * arcs.length) | 0] : links[(Math.random() * links.length) | 0];
    packets.push({ a, b, t: 0, speed: (useArc ? 0.004 : 0.012) + Math.random() * 0.01, arc: useArc });
  };
  for (let i = 0; i < 26; i++) { spawn(); packets[i].t = Math.random(); }

  // Sizing
  let W = 0, H = 0, R = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.36;
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // Rotation state (auto + drag with inertia)
  let rotY = 0, rotX = -0.35, velY = 0.0035, velX = 0;
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener("pointerdown", e => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    velY = dx * 0.005; velX = dy * 0.005;
    rotY += velY; rotX += velX;
  });
  const end = () => { dragging = false; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  // Project a unit-sphere point to screen
  function project(p, cy, sy, cx, sx, scale) {
    let x = p.x * cy - p.z * sy;
    let z = p.x * sy + p.z * cy;
    let y = p.y * cx - z * sx;
    z = p.y * sx + z * cx;
    const f = 3.2 / (3.2 - z);          // perspective
    return { x: W / 2 + x * R * scale * f, y: H / 2 + y * R * scale * f, z, f };
  }

  // Point on the great-circle arc between two nodes, lifted above the surface
  function arcPoint(a, b, t, lift) {
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    const len = Math.hypot(x, y, z) || 1;
    const h = 1 + Math.sin(Math.PI * t) * lift;
    return { x: (x / len) * h, y: (y / len) * h, z: (z / len) * h };
  }

  const depthAlpha = z => 0.12 + ((z + 1) / 2) * 0.88; // back faint, front strong
  let time = 0;

  // Colour palette for node types
  const PALETTE = ["37,99,235", "6,182,212", "139,92,246", "16,185,129", "245,158,11", "244,63,94"];
  const WEIGHTS = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4, 5];
  nodes.forEach((n, i) => { n.c = PALETTE[WEIGHTS[(i * 7) % WEIGHTS.length]]; n.hub = i % 9 === 0; });

  // Lit 3D sphere (highlight top-left, darker rim)
  function ball(x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(255,255,255," + a + ")");
    g.addColorStop(0.35, "rgba(" + rgb + "," + a + ")");
    g.addColorStop(1, "rgba(" + rgb.split(",").map(v => Math.round(v * 0.55)).join(",") + "," + a + ")");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function frame() {
    time += 1;
    if (!dragging) {
      rotY += velY; rotX += velX;
      velY += (0.0035 - velY) * 0.02;   // ease back to auto-rotate
      velX *= 0.95;
      rotX += (-0.35 - rotX) * 0.01;
    }
    const cy = Math.cos(rotY), sy = Math.sin(rotY), cx = Math.cos(rotX), sx = Math.sin(rotX);
    const breathe = 1 + Math.sin(time * 0.01) * 0.015;
    const pr = q => project(q, cy, sy, cx, sx, breathe);
    const Rs = R * breathe * 3.2 / Math.sqrt(3.2 * 3.2 - 1); // on-screen sphere silhouette radius

    ctx.clearRect(0, 0, W, H);

    // Atmosphere glow
    let g = ctx.createRadialGradient(W / 2, H / 2, Rs * 0.92, W / 2, H / 2, Rs * 1.3);
    g.addColorStop(0, "rgba(56,189,248,0.28)");
    g.addColorStop(0.4, "rgba(99,102,241,0.10)");
    g.addColorStop(1, "rgba(99,102,241,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, Rs * 1.3, 0, Math.PI * 2); ctx.fill();

    // Orbit rings with coloured satellites
    for (let k = 0; k < 2; k++) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(time * (k ? -0.002 : 0.0015) + k * 1.1);
      ctx.scale(1, 0.28);
      ctx.strokeStyle = k ? "rgba(139,92,246,0.35)" : "rgba(6,182,212,0.4)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash(k ? [2, 6] : []);
      ctx.beginPath(); ctx.arc(0, 0, R * (1.3 + k * 0.18), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      const ang = time * (k ? -0.012 : 0.009);
      const m = ctx.getTransform();
      const pt = m.transformPoint(new DOMPoint(Math.cos(ang) * R * (1.3 + k * 0.18), Math.sin(ang) * R * (1.3 + k * 0.18)));
      ctx.restore();
      ball(pt.x / dpr, pt.y / dpr, 5, k ? "139,92,246" : "6,182,212", 1);
    }

    const P = nodes.map(pr);

    // Back hemisphere links and nodes (seen through the glassy globe)
    ctx.lineWidth = 1;
    for (const [i, j] of links) {
      const a = P[i], b = P[j];
      if ((a.z + b.z) / 2 >= 0) continue;
      ctx.strokeStyle = "rgba(" + nodes[i].c + "," + (0.12 + (a.z + b.z) * 0.03 + 0.06).toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    P.forEach((p, i) => { if (p.z < 0) ball(p.x, p.y, (1.6 + (p.z + 1) * 1.2) * p.f, nodes[i].c, 0.35); });

    // Glass globe body with light from the top-left
    g = ctx.createRadialGradient(W / 2 - Rs * 0.4, H / 2 - Rs * 0.45, Rs * 0.05, W / 2, H / 2, Rs);
    g.addColorStop(0, "rgba(255,255,255,0.80)");
    g.addColorStop(0.55, "rgba(236,244,255,0.62)");
    g.addColorStop(1, "rgba(186,214,250,0.55)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, Rs, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(37,99,235,0.35)"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1;

    // Latitude / longitude grid (front side only)
    ctx.strokeStyle = "rgba(37,99,235,0.13)";
    const drawLine = pts => {
      ctx.beginPath(); let on = false;
      for (const q of pts) { if (q.z < 0) { on = false; continue; } on ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); on = true; }
      ctx.stroke();
    };
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = Math.sin(lat * Math.PI / 180), r = Math.cos(lat * Math.PI / 180), pts = [];
      for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2; pts.push(pr({ x: Math.cos(t) * r, y, z: Math.sin(t) * r })); }
      drawLine(pts);
    }
    for (let lon = 0; lon < 180; lon += 30) {
      const t0 = lon * Math.PI / 180, pts = [];
      for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2; pts.push(pr({ x: Math.cos(t) * Math.cos(t0), y: Math.sin(t), z: Math.cos(t) * Math.sin(t0) })); }
      drawLine(pts);
    }

    // Front links with colour gradients
    ctx.lineWidth = 1.1;
    for (const [i, j] of links) {
      const a = P[i], b = P[j];
      if ((a.z + b.z) / 2 < 0) continue;
      const al = (depthAlpha((a.z + b.z) / 2) * 0.75).toFixed(3);
      const lg = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      lg.addColorStop(0, "rgba(" + nodes[i].c + "," + al + ")");
      lg.addColorStop(1, "rgba(" + nodes[j].c + "," + al + ")");
      ctx.strokeStyle = lg;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.lineWidth = 1;

    // Backbone arcs above the surface
    for (const [i, j] of arcs) {
      ctx.beginPath();
      for (let s = 0; s <= 24; s++) {
        const q = pr(arcPoint(nodes[i], nodes[j], s / 24, 0.22));
        s ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
      ctx.strokeStyle = "rgba(139,92,246,0.35)";
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Front nodes as lit spheres with pulsing rings
    const order = P.map((p, i) => i).filter(i => P[i].z >= 0).sort((a, b) => P[a].z - P[b].z);
    for (const i of order) {
      const p = P[i], n = nodes[i];
      const size = (n.hub ? 3.4 : 2) * (0.8 + p.z * 0.6) * p.f;
      const pulse = (Math.sin(time * 0.05 + n.pulse) + 1) / 2;
      if (n.hub || p.z > 0.5) {
        ctx.strokeStyle = "rgba(" + n.c + "," + (0.45 * pulse).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, size + 3 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
      }
      ball(p.x, p.y, size, n.c, 1);
    }

    // Packets with glowing trails
    for (let k = packets.length - 1; k >= 0; k--) {
      const pk = packets[k];
      pk.t += reduceMotion ? 0 : pk.speed;
      if (pk.t >= 1) { packets.splice(k, 1); spawn(); continue; }
      const a = nodes[pk.a], b = nodes[pk.b], col = a.c;
      for (let tail = 5; tail >= 0; tail--) {
        const tt = Math.max(0, pk.t - tail * 0.025);
        const q = pr(pk.arc ? arcPoint(a, b, tt, 0.22) : arcPoint(a, b, tt, 0));
        if (q.z < -0.15) continue;
        const al = Math.max(0.15, depthAlpha(q.z)) * (1 - tail / 6);
        if (tail === 0) {
          ctx.fillStyle = "rgba(" + col + "," + (0.25 * al).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(q.x, q.y, 7 * q.f, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "rgba(" + col + "," + al.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(q.x, q.y, (2.8 - tail * 0.35) * q.f, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (!reduceMotion || dragging) requestAnimationFrame(frame);
    else setTimeout(() => requestAnimationFrame(frame), 250);
  }
  requestAnimationFrame(frame);
})();
