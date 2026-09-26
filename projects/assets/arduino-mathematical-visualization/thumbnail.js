document.querySelectorAll('.honors-preview-card').forEach(card => {
  const video = card.querySelector('video');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let hovering = false;
  let wanted = false;
  const stop = () => {
    wanted = false;
    video.pause();
    card.classList.remove('is-previewing');
    if (video.readyState > 0) video.currentTime = 0;
  };
  const start = () => {
    if (reducedMotion.matches || document.hidden) return;
    wanted = true;
    video.muted = true;
    video.play().catch(stop);
  };
  video.addEventListener('playing', () => {
    if (wanted) card.classList.add('is-previewing');
    else stop();
  });
  card.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    hovering = true;
    start();
  });
  card.addEventListener('pointerleave', () => {
    hovering = false;
    if (!card.contains(document.activeElement)) stop();
  });
  card.addEventListener('focusin', start);
  card.addEventListener('focusout', event => {
    if (!hovering && !card.contains(event.relatedTarget)) stop();
  });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) { hovering = false; stop(); }
  }).observe(card);
});
