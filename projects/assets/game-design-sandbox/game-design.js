<script>
(() => {
 const shell=document.querySelector('[data-game-shell]'); if(!shell)return;
 const launch=shell.querySelector('[data-game-launch]'),stage=shell.querySelector('[data-game-stage]'),frame=shell.querySelector('iframe'),status=shell.querySelector('[data-game-status]'),actions=shell.querySelector('.player-actions');
 const volumeInput=shell.querySelector('[data-volume]'), muteButton=shell.querySelector('[data-mute]'),volumeValue=shell.querySelector('[data-volume-value]'),audioStatus=shell.querySelector('[data-audio-status]');
 const restartButton=shell.querySelector('[data-restart]');
 let volume=10,muted=false;
 function sendVolume(){const value=muted?0:volume;volumeValue.textContent=value+'%';muteButton.textContent=muted?'Unmute':'Mute';muteButton.setAttribute('aria-pressed',String(muted));if(frame.hasAttribute('src'))frame.contentWindow.postMessage({game:'schism',command:'volume',value:value/100},url.origin);}
 volumeInput.addEventListener('input',()=>{volume=Number(volumeInput.value);muted=volume===0;sendVolume();});
 muteButton.addEventListener('click',()=>{muted=!muted;if(!muted&&volume===0){volume=10;volumeInput.value='10';}sendVolume();});
 let timer; const url=new URL(frame.dataset.src,location.href);
 function stop(){restartButton.disabled=true;clearTimeout(timer);frame.removeAttribute('src');stage.hidden=true;launch.hidden=false;actions.hidden=true;status.textContent='Loads when you press play.';}
 function start(){restartButton.disabled=true;clearTimeout(timer);launch.hidden=true;stage.hidden=false;actions.hidden=false;status.textContent='Downloading Schism… this may take a moment.';frame.src=url.href;timer=setTimeout(()=>{status.textContent='Still waiting for the game. Check your connection, or close the game and try again.';},90000);}
 launch.addEventListener('click',start);
 restartButton.addEventListener('click',()=>{if(restartButton.disabled)return;frame.contentWindow.postMessage({game:'schism',command:'restart-level'},url.origin);frame.focus();});
 shell.querySelector('[data-close]').addEventListener('click',()=>{stop();launch.focus();});
 shell.querySelector('[data-fullscreen]').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await shell.requestFullscreen();}catch{status.textContent='Fullscreen is unavailable in this browser. You can still play here.';}});
 window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==url.origin)return;const data=event.data;if(!data||data.game!=='schism')return;if(data.state==='volume'){audioStatus.textContent=data.value===0?'Game audio muted':'Game volume updated';return;}if(data.state==='ready'){restartButton.disabled=false;sendVolume();clearTimeout(timer);status.textContent=matchMedia('(any-pointer: coarse)').matches?'Use the two touch pads. Up jumps; down interacts.':'Click game to use keyboard.';frame.focus();}else if(data.state==='error'){restartButton.disabled=true;clearTimeout(timer);status.textContent='The game could not start. Close it and try again, or use a browser with WebGL 2 support.';}else if(data.state==='progress'){status.textContent='Downloading Schism… '+Math.min(100,Math.max(0,Number(data.percent)||0))+'%';}});
 const motionButton=document.querySelector('[data-motion-toggle]');
 const animatedImages=[...document.querySelectorAll('[data-animation]')];
 let paused=false;
 function setMotion(){animatedImages.forEach(img=>{img.src=paused?img.dataset.still:img.dataset.animation;});motionButton.textContent=paused?'Play animations':'Pause animations';motionButton.setAttribute('aria-pressed',String(paused));}
 if(motionButton){setMotion();motionButton.addEventListener('click',()=>{paused=!paused;setMotion();});}
 const dialog=document.querySelector('.image-dialog');
 document.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>{const img=button.querySelector('img');dialog.querySelector('img').src=img.src;dialog.querySelector('img').alt=img.alt;dialog.querySelector('p').textContent=img.alt;dialog.showModal();}));
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
})();
</script>

<script src="assets/game-design-sandbox/landscape-mode.js"></script>
