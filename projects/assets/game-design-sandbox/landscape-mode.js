(() => {
 'use strict';
 const shell = document.querySelector('[data-game-shell]');
 const button = shell?.querySelector('[data-landscape-mode]');
 if (!button) return;
 const hint = shell.querySelector('[data-landscape-hint]');
 const frame = shell.querySelector('[data-game-frame]');
 let active = false;
 let enteredFullscreen = false;
 let generation = 0;
 function updateHint() {
  hint.textContent = !active ? '2 players'
   : matchMedia('(orientation: portrait)').matches
    ? 'Rotate phone ↔'
    : 'Kiki left · Bouba right';
 }
 function unlock() {
  try { screen.orientation?.unlock?.(); } catch { /* Some browsers cannot lock orientation. */ }
 }
 function leave() {
  if (!active) return;
  active = false; generation++;
  shell.classList.remove('side-by-side');
  document.body.classList.remove('side-by-side-open');
  button.setAttribute('aria-pressed', 'false'); button.textContent = 'Play side by side ↔';
  unlock(); updateHint();
  if (enteredFullscreen && document.fullscreenElement === shell) document.exitFullscreen().catch(() => {});
  enteredFullscreen = false;
  button.focus({preventScroll:true});
 }
 async function enter() {
  active = true;
  const attempt = ++generation;
  shell.classList.add('side-by-side'); document.body.classList.add('side-by-side-open');
  button.setAttribute('aria-pressed', 'true'); button.textContent = 'Exit side by side';
  updateHint();
  // The fullscreen request must begin in the original tap's activation event.
  let fullscreen;
  try {
   if (!document.fullscreenElement && shell.requestFullscreen) fullscreen = shell.requestFullscreen({navigationUI:'hide'});
  } catch { /* The fixed player remains usable when fullscreen is unavailable. */ }
  if (!frame.hasAttribute('src')) shell.querySelector('[data-game-launch]').click();
  try { if (fullscreen) { await fullscreen; enteredFullscreen = true; } } catch { /* Keep the page-filling fallback. */ }
  if (!active || attempt !== generation) {
   if (document.fullscreenElement === shell) document.exitFullscreen().catch(() => {});
   return;
  }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* The rotate hint covers unsupported browsers. */ }
  if (!active || attempt !== generation) { unlock(); return; }
  updateHint();
 }
 button.addEventListener('click', () => { if (active) leave(); else void enter(); });
 shell.querySelector('[data-close]').addEventListener('click', leave);
 window.addEventListener('resize', updateHint);
 screen.orientation?.addEventListener('change', updateHint);
 document.addEventListener('fullscreenchange', () => {
  if (active && enteredFullscreen && document.fullscreenElement !== shell) leave();
 });
 document.addEventListener('keydown', event => { if (event.key === 'Escape' && active) leave(); });
 window.addEventListener('pagehide', () => { if (active) unlock(); });
})();
