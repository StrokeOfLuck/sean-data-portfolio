(() => {
  document.querySelectorAll('.design-tv-thumbnail').forEach((canvas) => {
    const card = canvas.closest('.project-card');
    const context = canvas.getContext('2d');
    if (!card || !context) return;
    const sheet = new Image();
    let hovered = false, focused = false, playing = false, timer, frame = 0;
    const paint = () => {
      canvas.dataset.frame = String(frame);
      if (!sheet.complete || !sheet.naturalWidth) return;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, 180, 145);
      // Frame the original TV artwork without the bottom palette strip.
      context.drawImage(sheet, (frame % 10) * 225 + 24,
        Math.floor(frame / 10) * 175, 180, 145, 0, 0, 180, 145);
    };
    const tick = () => {
      if (!playing) return;
      frame = (frame + 1) % 90;
      paint();
      timer = setTimeout(tick, frame === 0 ? 220 : 30);
    };
    const update = () => {
      const next = hovered || focused;
      if (next === playing) return;
      playing = next;
      clearTimeout(timer);
      frame = 0;
      paint();
      if (playing && sheet.complete && sheet.naturalWidth) timer = setTimeout(tick, 220);
    };
    sheet.onload = () => { paint(); if (playing) timer = setTimeout(tick, 220); };
    sheet.src = canvas.dataset.frames;
    paint();
    card.addEventListener('pointerenter', e => { hovered = e.pointerType !== 'touch'; update(); });
    card.addEventListener('pointerleave', () => { hovered = false; update(); });
    card.addEventListener('focusin', () => { focused = true; update(); });
    card.addEventListener('focusout', e => { focused = card.contains(e.relatedTarget); update(); });
  });
})();
