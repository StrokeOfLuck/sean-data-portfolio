(() => {
 const art = document.querySelector('.schism-image');
 const button = art?.querySelector('.schism-preview-toggle');
 if (!button) return;
 const card = art.closest('.project-card');
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 let manual = null;
 function update() {
  const playing = manual ?? (!motion.matches && card.matches(':hover, :focus-within'));
  art.dataset.playing = String(playing);
  button.textContent = playing ? 'Pause preview' : 'Play preview';
  button.setAttribute('aria-pressed', String(playing));
  button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} Kiki and Bouba jumping preview`);
 }
 button.addEventListener('click', event => {
  event.stopPropagation();
  manual = art.dataset.playing !== 'true';
  update();
 });
 card.addEventListener('mouseenter', update);
 card.addEventListener('mouseleave', () => { manual = null; update(); });
 card.addEventListener('focusin', update);
 card.addEventListener('focusout', event => {
  if (!card.contains(event.relatedTarget)) manual = null;
  requestAnimationFrame(update);
 });
 motion.addEventListener('change', () => { manual = null; update(); });
 button.hidden = false;
 update();
})();
