const players = new Map();
const pending = new Map();
function jumpToDemo(id, time, pause) {
  const player = players.get(id);
  if (!player) { pending.set(id, { time, pause }); return; }
  player.mute();
  if (pause) player.pauseVideo();
  player.seekTo(time, true);
  if (pause) player.pauseVideo();
  else player.playVideo();
}
window.onYouTubeIframeAPIReady = function () {
  document.querySelectorAll('.youtube-player').forEach(frame => {
    const id = frame.id;
    new YT.Player(id, {
      events: {
        onReady(event) {
          event.target.mute();
          players.set(id, event.target);
          const request = pending.get(id);
          if (request) {
            pending.delete(id);
            jumpToDemo(id, request.time, request.pause);
          }
        },
        onStateChange(event) {
          if (event.data === YT.PlayerState.PLAYING) {
            players.forEach(other => { if (other !== event.target) other.pauseVideo(); });
          }
        }
      }
    });
  });
};
document.querySelectorAll('[data-video]').forEach(button => {
  button.addEventListener('click', event => {
    if (!players.has(button.dataset.video)) return;
    event.preventDefault();
    jumpToDemo(button.dataset.video, Number(button.dataset.time), button.dataset.pause === 'true');
  });
});
