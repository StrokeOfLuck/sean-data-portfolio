(() => {
  document.querySelectorAll('.design-tv-thumbnail').forEach((image) => {
    const card = image.closest('.project-card');
    if (!card) return;
    let hovered = false;
    let focused = false;
    let playing = false;
    const update = () => {
      const next = hovered || focused;
      if (next === playing) return;
      playing = next;
      image.src = next ? image.dataset.animation : image.dataset.still;
    };
    card.addEventListener('pointerenter', (event) => {
      hovered = event.pointerType !== 'touch';
      update();
    });
    card.addEventListener('pointerleave', () => { hovered = false; update(); });
    card.addEventListener('focusin', () => { focused = true; update(); });
    card.addEventListener('focusout', (event) => {
      focused = card.contains(event.relatedTarget);
      update();
    });
  });
})();
