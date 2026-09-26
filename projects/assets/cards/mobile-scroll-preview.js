// Touch-first/mobile behavior: play animated project thumbnails once as they scroll into view.
// Desktop hover/focus behavior remains owned by each thumbnail's existing script.
(() => {
  const touchFirst = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!touchFirst || reduceMotion || !('IntersectionObserver' in window)) return;

  const enter = card => card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
  const leave = card => card.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));

  function schismOnce(card) {
    card.querySelectorAll('.schism-kiki, .schism-bouba').forEach(character => {
      character.style.animation = 'none';
      void character.getBoundingClientRect();
      character.style.animation = 'schism-character-hop 1s linear 1';
      character.addEventListener('animationend', () => {
        character.style.removeProperty('animation');
      }, { once: true });
    });
  }

  function videoOnce(card) {
    const video = card.querySelector('.honors-hover-video');
    if (!video) return;

    let stopped = false;
    let fallback;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(fallback);
      video.removeEventListener('timeupdate', nearEnd);
      leave(card);
    };
    const nearEnd = () => {
      if (Number.isFinite(video.duration) && video.duration > 0 &&
          video.currentTime >= Math.max(0, video.duration - 0.12)) {
        stop();
      }
    };
    const armFallback = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        fallback = setTimeout(stop, Math.min(video.duration * 1000 + 500, 15000));
      }
    };

    video.addEventListener('timeupdate', nearEnd);
    if (video.readyState >= 1) armFallback();
    else video.addEventListener('loadedmetadata', armFallback, { once: true });
    fallback = fallback || setTimeout(stop, 10000);
    enter(card);
  }

  const previews = new Map();
  const register = (target, play) => {
    if (target) previews.set(target, play);
  };

  const t8085 = document.querySelector('[data-8085-thumbnail]');
  register(t8085, () => enter(t8085.closest('.project-card')));

  const clearhouse = document.querySelector('.clearhouse-image');
  register(clearhouse, () => {
    const card = clearhouse.closest('.project-card');
    enter(card);
    setTimeout(() => leave(card), 1650);
  });

  const television = document.querySelector('.design-tv-thumbnail');
  register(television, () => {
    const card = television.closest('.project-card');
    enter(card);
    // One complete 90-frame rotation, then return to the approved still.
    setTimeout(() => leave(card), 3200);
  });

  const honors = document.querySelector('.honors-preview-art');
  register(honors, () => videoOnce(honors.closest('.project-card')));

  const schism = document.querySelector('.schism-image');
  register(schism, () => schismOnce(schism.closest('.project-card')));

  const observer = new IntersectionObserver(entries => {
    if (document.hidden) return;
    entries.forEach(entry => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;
      const play = previews.get(entry.target);
      if (!play) return;
      observer.unobserve(entry.target);
      play();
    });
  }, { threshold: [0.6] });

  previews.forEach((_play, target) => observer.observe(target));
})();