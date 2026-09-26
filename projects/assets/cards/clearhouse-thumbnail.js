// Decorative counts are a snapshot of ClearHouse, not a live data feed.
(() => {
  const root = document.querySelector('.clearhouse-image');
  if (!root) return;
  const thumbnail = root.querySelector('.ch-thumbnail');
  const numbers = Array.from(root.querySelectorAll('.ch-number'));
  const totals = numbers.map(element => Number(element.textContent.replaceAll(',', '')));
  let frame = 0;
  let hovering = false;
  let focused = false;
  let visible = false;
  let active = false;
  const touchLayout = window.matchMedia('(hover: none), (pointer: coarse)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function render(progress) {
    numbers.forEach((element, index) => {
      element.textContent = Math.round(totals[index] * progress).toLocaleString('en-US');
    });
  }

  function start() {
    cancelAnimationFrame(frame);
    thumbnail.classList.add('is-active');
    render(0);
    let started;
    function tick(time) {
      if (started === undefined) started = time;
      const progress = Math.min((time - started) / 1400, 1);
      render(1 - Math.pow(1 - progress, 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    thumbnail.classList.remove('is-active');
    render(1);
  }

  function update() {
    const shouldAnimate = !document.hidden && !reducedMotion.matches &&
      (hovering || focused || (touchLayout.matches && visible));
    if (shouldAnimate === active) return;
    active = shouldAnimate;
    if (active) start();
    else stop();
  }

  // Touch screens have no hover, including wide unfolded phone screens.
  // Start on entry and stop offscreen; resizing does not restart an active run.
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    update();
  });
  observer.observe(root);
  touchLayout.addEventListener('change', update);
  reducedMotion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);

  // Listen on the art wrapper because its project link overlays the thumbnail.
  root.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovering = true;
    update();
  });
  root.addEventListener('pointerleave', () => { hovering = false; update(); });
  root.addEventListener('pointercancel', () => { hovering = false; update(); });
  root.addEventListener('focusin', () => { focused = true; update(); });
  root.addEventListener('focusout', event => {
    if (root.contains(event.relatedTarget)) return;
    focused = false;
    update();
  });
})();
