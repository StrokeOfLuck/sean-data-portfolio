(() => {
 'use strict';
 const enabled = matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0;
 const canvas = document.getElementById('canvas');
 const pointers = new Map();
 const held = new Map();
 let ready = false;
 const controls = document.createElement('div');
 controls.className = 'touch-controls';
 controls.setAttribute('role', 'group');
 controls.setAttribute('aria-label', 'Two-player touch controls');
 const players = [
  {name: 'Kiki', label: 'KIKI · WASD', white: false, keys: [['up','w','KeyW',87],['left','a','KeyA',65],['down','s','KeyS',83],['right','d','KeyD',68]]},
  {name: 'Bouba', label: 'BOUBA · ARROWS', white: true, keys: [['up','ArrowUp','ArrowUp',38],['left','ArrowLeft','ArrowLeft',37],['down','ArrowDown','ArrowDown',40],['right','ArrowRight','ArrowRight',39]]}
 ];
 const symbols = {up:'↑',left:'←',down:'↓',right:'→'};
 const actions = {up:'jump',left:'move left',down:'interact',right:'move right'};
 function send(button, pressed) {
  canvas.dispatchEvent(new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
   key: button.dataset.key, code: button.dataset.code, keyCode: Number(button.dataset.keyCode),
   which: Number(button.dataset.keyCode), bubbles: true, cancelable: true, repeat: false
  }));
 }
 function press(button) {
  const count = held.get(button) || 0;
  held.set(button, count + 1);
  if (!count) { button.classList.add('is-held'); send(button, true); }
 }
 function release(button) {
  const count = held.get(button) || 0;
  if (count > 1) { held.set(button, count - 1); return; }
  if (!count) return;
  held.delete(button); button.classList.remove('is-held'); send(button, false);
 }
 function releaseAll() {
  pointers.clear();
  for (const button of held.keys()) { button.classList.remove('is-held'); send(button, false); }
  held.clear();
 }
 for (const player of players) {
  const pad = document.createElement('div');
  pad.className = 'touch-pad' + (player.white ? ' touch-pad-white' : '');
  const label = document.createElement('span'); label.className = 'touch-pad-label'; label.textContent = player.label; pad.append(label);
  for (const [direction,key,code,keyCode] of player.keys) {
   const button = document.createElement('button'); button.type = 'button'; button.className = 'touch-key';
   Object.assign(button.dataset, {direction,key,code,keyCode}); button.textContent = symbols[direction];
   button.setAttribute('aria-label', `${player.name}: ${actions[direction]}`);
   button.addEventListener('pointerdown', event => {
    if (!ready || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault(); canvas.focus({preventScroll:true});
    button.setPointerCapture(event.pointerId); pointers.set(event.pointerId, button); press(button);
   });
   const end = event => {
    const active = pointers.get(event.pointerId); if (!active) return;
    event.preventDefault(); pointers.delete(event.pointerId); release(active);
   };
   button.addEventListener('pointerup', end);
   button.addEventListener('pointercancel', end);
   button.addEventListener('lostpointercapture', end);
   button.addEventListener('keydown', event => {
    if (!ready || !['Enter',' '].includes(event.key)) return;
    event.preventDefault(); if (!event.repeat) press(button);
   });
   button.addEventListener('keyup', event => {
    if (!['Enter',' '].includes(event.key)) return;
    event.preventDefault(); release(button);
   });
   button.addEventListener('blur', () => { if (!pointers.size) releaseAll(); });
   pad.append(button);
  }
  controls.append(pad);
 }
 controls.addEventListener('contextmenu', event => event.preventDefault());
 document.body.append(controls);
 if (enabled) document.documentElement.classList.add('touch-game');
 window.addEventListener('blur', releaseAll);
 window.addEventListener('pagehide', releaseAll);
 window.addEventListener('resize', releaseAll);
 document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
 // The original Godot LevelResetManager binds reset_level to R. Send that
 // input to the running game instead of reloading its frame and losing progress.
 let resetTimer;
 function releaseReset() {
  if (!resetTimer) return;
  clearTimeout(resetTimer); resetTimer = null;
  canvas.dispatchEvent(new KeyboardEvent('keyup', {key:'r',code:'KeyR',keyCode:82,which:82,bubbles:true,cancelable:true}));
 }
 window.addEventListener('message', event => {
  if (event.source !== parent || event.origin !== location.origin || !ready) return;
  if (event.data?.game !== 'schism' || event.data.command !== 'restart-level' || resetTimer) return;
  releaseAll();
  canvas.focus({preventScroll:true});
  canvas.dispatchEvent(new KeyboardEvent('keydown', {key:'r',code:'KeyR',keyCode:82,which:82,bubbles:true,cancelable:true}));
  // Leave time for Godot's process loop to consume is_action_just_pressed.
  resetTimer = setTimeout(releaseReset, 100);
 });
 window.addEventListener('blur', releaseReset);
 window.addEventListener('pagehide', releaseReset);
 document.addEventListener('visibilitychange', () => { if (document.hidden) releaseReset(); });
 window.schismTouchControls = {enabled, ready() {ready = true; document.documentElement.classList.add('game-ready');}};
})();
