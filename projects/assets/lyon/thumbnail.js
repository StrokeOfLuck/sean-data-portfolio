// Static SVG geometry: preserve every GPX sample without repainting a canvas.
(() => {
  const base = new URL('.', document.currentScript.src);
  const art = document.querySelector('.lyon-live');
  if (!art) return;
  const card = art.closest('.project-card');
  const svg = art.querySelector('.lyon-routes');
  const image = art.querySelector('img');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  const ns = 'http://www.w3.org/2000/svg';
  const total = 5000;
  let routes, bounds, ready, raf = 0, start = null, playing = false;
  let visible = false, played = false, keyboard = false, request = 0;
  const merc = (lon, lat) => [(lon + 180) / 360 * 524288,
    (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 524288];
  const center = merc(4.842, 45.7605);
  function element(tag, attrs, parent = svg) {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    parent.appendChild(node); return node;
  }
  function frame() {
    // Layout dimensions exclude the card's hover transform and device-pixel rounding.
    const w = art.clientWidth, h = art.clientHeight;
    if (!w || !h) return;
    const s = Math.min(w / (bounds.maxX - bounds.minX + 20), h / (bounds.maxY - bounds.minY + 20));
    const vx = w / s, vy = h / s;
    const cx = (bounds.minX + bounds.maxX) / 2, cy = (bounds.minY + bounds.maxY) / 2;
    const x = Math.max(-120 + vx / 2, Math.min(360 - vx / 2, cx));
    const y = vy <= 400 ? Math.max(-45 + vy / 2, Math.min(355 - vy / 2, cy)) : cy;
    svg.setAttribute('viewBox', `${x - vx / 2} ${y - vy / 2} ${vx} ${vy}`);
  }
  function reveal(elapsed) {
    for (const r of routes) {
      const f = elapsed >= total ? 1 : Math.max(0, Math.min(1, (elapsed - r.offset) / r.ms));
      const time = r.duration * f;
      for (const seg of r.parts) {
        const show = f > 0 && time >= seg.points[0][2];
        seg.node.style.visibility = show ? 'visible' : 'hidden';
        if (!show) continue;
        if (f === 1 || time >= seg.points[seg.points.length - 1][2]) {
          seg.node.style.strokeDasharray = 'none';
          continue;
        }
        let lo = 0, hi = seg.points.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (seg.points[mid][2] <= time) lo = mid; else hi = mid - 1;
        }
        const next = Math.min(lo + 1, seg.points.length - 1);
        const span = seg.points[next][2] - seg.points[lo][2];
        const fraction = span > 0 ? Math.max(0, Math.min(1, (time - seg.points[lo][2]) / span)) : 0;
        const distance = seg.lengths[lo] + (seg.lengths[next] - seg.lengths[lo]) * fraction;
        seg.node.style.strokeDasharray = `${distance} ${seg.length + 1}`;
      }
    }
  }
  function stop() {
    ++request; cancelAnimationFrame(raf); playing = false; start = null;
    if (routes) reveal(total);
  }
  function tick(now) {
    if (!playing) return;
    if (start === null) start = now;
    const elapsed = Math.min(total, now - start);
    reveal(elapsed);
    if (elapsed < total) raf = requestAnimationFrame(tick);
    else { playing = false; start = null; }
  }
  async function load() {
    if (ready) return ready;
    ready = Promise.all([fetch(new URL('rides.json', base)).then(r => {
      if (!r.ok) throw new Error('Lyon route data unavailable'); return r.json();
    }), image.decode()]).then(([data]) => {
      routes = data;
      bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      element('image', { href: image.currentSrc || image.src, x: -120, y: -45, width: 480, height: 400 });
      const duration = routes.reduce((n, r) => n + r.duration, 0);
      let offset = 0;
      for (const r of routes) {
        r.offset = offset; r.ms = total * (.45 / routes.length + .55 * r.duration / duration); offset += r.ms;
        r.parts = r.segments.filter(seg => seg.length).map(seg => {
          const points = seg.map(p => {
            const q = merc(p[0], p[1]);
            const a = [(q[0] - center[0]) * 2 / 1.3 + 110.38368, (q[1] - center[1]) * 2 / 1.3 + 149.99531, p[2]];
            bounds.minX = Math.min(bounds.minX, a[0]); bounds.maxX = Math.max(bounds.maxX, a[0]);
            bounds.minY = Math.min(bounds.minY, a[1]); bounds.maxY = Math.max(bounds.maxY, a[1]);
            return a;
          });
          let length = 0;
          const lengths = points.map((p, i) => {
            if (i) length += Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]);
            return length;
          });
          const d = points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
          const group = element('g', { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
          element('path', { d, stroke: 'rgba(0,0,0,.6)', 'stroke-width': 3.15 }, group);
          element('path', { d, stroke: r.color, 'stroke-width': 2.5 }, group);
          return { points, lengths, length, node: group };
        });
      }
      element('text', { x: 74, y: 146, fill: '#fff', stroke: 'rgba(20,25,28,.92)',
        'stroke-width': 3, 'paint-order': 'stroke', 'font-family': 'Arial, sans-serif',
        'font-size': 18, 'font-weight': 600 }).textContent = 'Lyon';
      frame(); reveal(total); art.classList.add('is-ready');
      new ResizeObserver(frame).observe(art);
    });
    return ready;
  }
  async function play(restart = false) {
    const token = ++request;
    try {
      await load();
      if (token !== request || !visible || document.hidden || reduce.matches || (playing && !restart)) return;
      cancelAnimationFrame(raf);
      played = true; start = null; playing = true; reveal(0);
      raf = requestAnimationFrame(tick);
    } catch (error) { console.warn('Lyon thumbnail: using satellite fallback.', error); }
  }
  new IntersectionObserver(entries => {
    for (const entry of entries) {
      visible = entry.isIntersecting && entry.intersectionRatio >= .5;
      if (visible && !played) play();
      else if (!visible) stop();
    }
  }, { threshold: [.5] }).observe(art);
  card.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse' && hover.matches) play(true);
  });
  document.addEventListener('keydown', event => { if (event.key === 'Tab') keyboard = true; });
  document.addEventListener('pointerdown', () => { keyboard = false; }, true);
  card.addEventListener('focusin', () => { if (keyboard) play(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  reduce.addEventListener('change', () => { if (reduce.matches) stop(); });
})();
