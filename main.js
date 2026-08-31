// A fixed decorative background; page scrolling never drives playback.
(() => {
  'use strict';

  const canvas = document.getElementById('fish');
  const fish = new window.BinaryFish(canvas, {
    color: '#554bc6',
    characterSize: 6,
    swimmingSpeed: 1.15,
    fishSize: 1280,
  });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let suspended = false;

  function syncPlayback() {
    if (document.hidden || suspended) {
      fish.pause();
      return;
    }
    if (reducedMotion.matches || location.protocol === 'file:') {
      fish.pause();
      fish.showPoster();
      return;
    }
    // Autoplay or decode failures must leave a fish visible, without an unhandled promise.
    Promise.resolve(fish.play()).catch(() => fish.showPoster());
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    fish.resize(width, height, Math.min(window.devicePixelRatio || 1, 2));
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', syncPlayback);
  reducedMotion.addEventListener('change', syncPlayback);
  window.addEventListener('pagehide', event => {
    suspended = true;
    fish.pause();
    if (!event.persisted) {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', syncPlayback);
      reducedMotion.removeEventListener('change', syncPlayback);
      fish.dispose();
    }
  });
  window.addEventListener('pageshow', () => {
    suspended = false;
    resize();
    syncPlayback();
  });
  resize();
  syncPlayback();
})();
