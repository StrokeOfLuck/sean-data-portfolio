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
    if (hovering || focused) return;
    cancelAnimationFrame(frame);
    thumbnail.classList.remove('is-active');
    render(1);
  }

  // Listen on the art wrapper because its project link overlays the thumbnail.
  root.addEventListener('pointerenter', event => {
    if (event.pointerType === 'touch') return;
    hovering = true;
    if (!focused) start();
  });
  root.addEventListener('pointerleave', () => { hovering = false; stop(); });
  root.addEventListener('pointercancel', () => { hovering = false; stop(); });
  root.addEventListener('focusin', () => { focused = true; if (!hovering) start(); });
  root.addEventListener('focusout', event => {
    if (root.contains(event.relatedTarget)) return;
    focused = false;
    stop();
  });
})();
