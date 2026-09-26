// Decorative counts are a snapshot of ClearHouse, not a live data feed.
(() => {
  const root = document.querySelector('.clearhouse-image');
  if (!root) return;
  const card = root.closest('.project-card');
  const thumbnail = root.querySelector('.ch-thumbnail');
  const numbers = Array.from(root.querySelectorAll('.ch-number'));
  const totals = numbers.map(element => Number(element.textContent.replaceAll(',', '')));
  let frame = 0;
  let hovering = false;
  let focused = false;
  let active = false;

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
    const shouldAnimate = !document.hidden && (hovering || focused);
    if (shouldAnimate === active) return;
    active = shouldAnimate;
    if (active) start();
    else stop();
  }

  document.addEventListener('visibilitychange', update);

  // Match the 8085 card: preview on whole-card hover or keyboard focus.
  card.addEventListener('mouseenter', () => {
    hovering = true;
    update();
  });
  card.addEventListener('mouseleave', () => { hovering = false; update(); });
  card.addEventListener('pointercancel', () => { hovering = false; update(); });
  card.addEventListener('focusin', () => { focused = true; update(); });
  card.addEventListener('focusout', event => {
    if (card.contains(event.relatedTarget)) return;
    focused = false;
    update();
  });
})();
