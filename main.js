(() => {
  'use strict';
  const canvas = document.getElementById('fish');
  const toggle = document.getElementById('motion-toggle');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let fish;
  try {
    fish = new window.BinaryFish(canvas, { color: '#554bc6', characterSize: 6, swimmingSpeed: 1.15 });
  } catch (error) {
    canvas.hidden = true;
    toggle.hidden = true;
    console.warn('The decorative fish could not start.', error);
    return;
  }
  toggle.hidden = false;
  let suspended = false, userPaused = false;

  function syncPlayback() {
    const still = userPaused || reducedMotion.matches;
    toggle.textContent = still ? 'Motion paused' : 'Pause motion';
    toggle.setAttribute('aria-pressed', String(still));
    toggle.disabled = reducedMotion.matches;
    if (document.hidden || suspended) fish.pause();
    else if (reducedMotion.matches) fish.showPoster();
    else if (userPaused) {
      fish.pause();
      if (!fish.hasDecodedFrame) fish.showPoster();
    }
    else Promise.resolve(fish.play()).catch(() => fish.showPoster());
  }
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    fish.resize(width, height, Math.min(window.devicePixelRatio || 1, 2));
  }
  function toggleMotion() { userPaused = !userPaused; syncPlayback(); }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  toggle.addEventListener('click', toggleMotion);
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', syncPlayback);
  function pageShow() { suspended = false; resize(); syncPlayback(); }
  function pageHide(event) {
    suspended = true; fish.pause();
    if (!event.persisted) {
      observer.disconnect();
      toggle.removeEventListener('click', toggleMotion);
      document.removeEventListener('visibilitychange', syncPlayback);
      reducedMotion.removeEventListener('change', syncPlayback);
      window.removeEventListener('pageshow', pageShow);
      window.removeEventListener('pagehide', pageHide);
      fish.dispose();
    }
  }
  window.addEventListener('pagehide', pageHide);
  window.addEventListener('pageshow', pageShow);
  resize(); syncPlayback();
})();
