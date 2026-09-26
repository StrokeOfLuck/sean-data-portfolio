(() => {
  document.querySelectorAll('.design-tv-thumbnail').forEach((canvas) => {
    const card = canvas.closest('.project-card');
    const context = canvas.getContext('2d');
    if (!card || !context) return;
    // Higher resolution preserves the approved panel's fractional cell sizes.
    canvas.width = 900;
    canvas.height = 725;
    const cleanup = document.createElement('canvas');
    cleanup.width = 900;
    cleanup.height = 725;
    const corrected = cleanup.getContext('2d');
    const sheet = new Image();
    let hovered = false, focused = false, playing = false, timer, frame = 0;
    const paint = () => {
      canvas.dataset.frame = String(frame);
      if (!sheet.complete || !sheet.naturalWidth) return;
      context.setTransform(5, 0, 0, 5, 0, 0);
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, 180, 145);
      // Frame the original TV artwork without the bottom palette strip.
      context.drawImage(sheet, (frame % 10) * 225 + 24,
        Math.floor(frame / 10) * 175, 180, 145, 0, 0, 180, 145);
      // Blend the approved still cleanup into the first moving frames.
      if (frame < 5) {
        corrected.setTransform(1, 0, 0, 1, 0, 0);
        corrected.clearRect(0, 0, 900, 725);
        corrected.drawImage(canvas, 0, 0);
        corrected.setTransform(5, 0, 0, 5, 0, 0);
        if (frame === 0) {
          corrected.fillStyle = 'rgb(29,43,83)';
          corrected.fillRect(22, 56, 24, 3);
        }
        corrected.fillStyle = 'rgb(95,87,79)';
        corrected.fillRect(130, 99, 24, 25);
        corrected.fillStyle = 'rgb(131,118,156)';
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 5; col++) {
            if ((row + col) % 2 === 0)
              corrected.fillRect(130 + col * 4.8, 103 + row * 3.6, 4.8, 3.6);
          }
        }
        context.save();
        context.globalAlpha = 1 - frame / 5;
        context.drawImage(cleanup, 0, 0, 180, 145);
        context.restore();
      }
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
