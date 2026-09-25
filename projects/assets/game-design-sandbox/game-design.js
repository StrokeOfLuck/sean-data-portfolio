<script>
document.querySelectorAll("[data-game-shell]").forEach((shell) => {
  const launch = shell.querySelector("[data-game-launch]");
  const stage = shell.querySelector("[data-game-stage]");
  const frame = shell.querySelector("[data-game-frame]");
  const status = shell.querySelector("[data-game-status]");
  if (!launch || !stage || !frame) return;

  launch.addEventListener("click", () => {
    launch.hidden = true;
    stage.hidden = false;
    frame.src = frame.dataset.src;
    frame.removeAttribute("data-src");

    frame.addEventListener("load", () => {
      if (status) {
        status.textContent = "Game loaded — click inside the frame to use the keyboard.";
        window.setTimeout(() => status.remove(), 4200);
      }
      frame.focus();
    }, { once: true });
  }, { once: true });
});
</script>
