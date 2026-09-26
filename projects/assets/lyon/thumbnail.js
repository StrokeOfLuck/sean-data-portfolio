// One static georeferenced image; original GPX samples remain unsimplified.
(() => {
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const art = document.querySelector('.lyon-live');
  if (!art) return;
  const card = art.closest('.project-card');
  const canvas = art.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(hover: none) and (pointer: coarse)');
  const image = art.querySelector('img');
  let routes, bounds, ready, raf = 0, elapsed = 5000, last = 0, playing = false;
  let visible = false, played = false;
  const merc = (lon, lat) => [(lon + 180) / 360 * 524288,
    (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 524288];
  const center = merc(4.842, 45.7605);

  function stop(complete = true) {
    cancelAnimationFrame(raf); playing = false; last = 0;
    if (complete) elapsed = 5000;
    if (routes) draw();
  }
  function line(path, color) {
    ctx.lineWidth = 3.15; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke(path);
    ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke(path);
  }
  function draw() {
    const box = art.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 3);
    const w = Math.round(box.width * dpr), h = Math.round(box.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    // Full route framing for both the landscape desktop and portrait mobile cards.
    const s = Math.min(w / (bounds.maxX - bounds.minX + 20), h / (bounds.maxY - bounds.minY + 20));
    const cx = (bounds.minX + bounds.maxX) / 2, cy = (bounds.minY + bounds.maxY) / 2;
    const vx = w / s, vy = h / s;
    const cameraX = Math.max(-120 + vx / 2, Math.min(360 - vx / 2, cx));
    const cameraY = vy <= 400 ? Math.max(-45 + vy / 2, Math.min(355 - vy / 2, cy)) : cy;
    ctx.setTransform(s, 0, 0, s, w / 2 - cameraX * s, h / 2 - cameraY * s);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, -120, -45, 480, 400);
    ctx.lineCap = ctx.lineJoin = 'round';
    let head;
    for (const r of routes) {
      if (elapsed < r.offset) break;
      const f = elapsed >= 5000 ? 1 : Math.min(1, (elapsed - r.offset) / r.ms);
      if (f === 1) { line(r.path, r.color); continue; }
      const path = new Path2D(), t = r.duration * f;
      for (const seg of r.xy) {
        if (seg[0][2] > t) break;
        path.moveTo(seg[0][0], seg[0][1]); head = seg[0];
        for (let i = 1; i < seg.length; i++) {
          const a = seg[i - 1], b = seg[i];
          if (b[2] <= t) { path.lineTo(b[0], b[1]); head = b; }
          else {
            const k = (t - a[2]) / (b[2] - a[2] || 1);
            head = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
            path.lineTo(...head); break;
          }
        }
      }
      line(path, r.color); break;
    }
    if (head) {
      ctx.beginPath(); ctx.arc(head[0], head[1], 2.1, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = .8; ctx.strokeStyle = '#222'; ctx.stroke();
    }
    ctx.font = '600 18px Arial, sans-serif'; ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,25,28,.92)'; ctx.strokeText('Lyon', 74, 146);
    ctx.fillStyle = '#fff'; ctx.fillText('Lyon', 74, 146);
  }
  function tick(now) {
    if (!playing) return;
    if (last) elapsed = Math.min(5000, elapsed + now - last);
    last = now; draw();
    if (elapsed < 5000) raf = requestAnimationFrame(tick);
    else { playing = false; last = 0; }
  }
  async function load() {
    if (ready) return ready;
    ready = Promise.all([fetch(new URL('rides.json', base)).then(r => {
      if (!r.ok) throw new Error('Lyon route data unavailable'); return r.json();
    }), image.decode()]).then(([data]) => {
      routes = data;
      bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      const duration = routes.reduce((n, r) => n + r.duration, 0);
      let offset = 0;
      for (const r of routes) {
        r.offset = offset; r.ms = 5000 * (.45 / routes.length + .55 * r.duration / duration); offset += r.ms;
        r.path = new Path2D();
        r.xy = r.segments.map(seg => seg.map((p, i) => {
          const q = merc(p[0], p[1]);
          const a = [(q[0] - center[0]) * 2 / 1.3 + 110.38368, (q[1] - center[1]) * 2 / 1.3 + 149.99531, p[2]];
          bounds.minX = Math.min(bounds.minX, a[0]); bounds.maxX = Math.max(bounds.maxX, a[0]);
          bounds.minY = Math.min(bounds.minY, a[1]); bounds.maxY = Math.max(bounds.maxY, a[1]);
          if (i) r.path.lineTo(a[0], a[1]); else r.path.moveTo(a[0], a[1]);
          return a;
        }));
      }
      draw(); art.classList.add('is-ready');
      new ResizeObserver(() => draw()).observe(art);
    });
    return ready;
  }
  async function play() {
    try {
      await load();
      if (!visible || document.hidden || reduce.matches || playing) return;
      played = true; elapsed = 0; last = 0; playing = true; raf = requestAnimationFrame(tick);
    } catch (error) { console.warn('Lyon thumbnail: using satellite fallback.', error); }
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      visible = entry.isIntersecting && entry.intersectionRatio >= .5;
      if (visible) {
        if (!played) play();
      } else if (playing) stop();
    }
  }, { threshold: [.5] });
  observer.observe(art);
  card.addEventListener('mouseenter', () => { if (!touch.matches) play(); });
  card.addEventListener('focusin', play);
  card.addEventListener('mouseleave', () => { if (!touch.matches && playing) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reduce.addEventListener('change', () => { if (reduce.matches) stop(); });
})();
