(() => {
  'use strict';
  const canvas = document.getElementById('fish');
  const toggle = document.getElementById('motion-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  const themeLabel = themeToggle.querySelector('.theme-label');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const FISH_LIGHT = { color: '#554bc6', stripeColor: '#f7f7f2' };
  // Bright periwinkle body on the dark page so the fish stays readable;
  // markings stay paper-white and read as glowing stripes.
  const FISH_DARK = { color: '#a49bf5', stripeColor: '#f7f7f2' };
  let fish;
  // Theme stands alone: it works even when the decorative fish cannot start.
  function readStoredTheme() {
    try { return localStorage.getItem('tm-theme'); }
    catch (_) { return null; }
  }
  function applyFishTheme() {
    if (!fish) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    const palette = dark ? FISH_DARK : FISH_LIGHT;
    fish.options.color = palette.color;
    fish.options.stripeColor = palette.stripeColor;
    if (themeColor) themeColor.content = dark ? '#14141b' : '#f7f7f2';
    fish.renderCurrent();
  }
  function setTheme(mode, persist) {
    const dark = mode === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    themeLabel.textContent = dark ? 'Dark mode' : 'Light mode';
    themeToggle.setAttribute('aria-pressed', String(dark));
    if (persist) {
      try { localStorage.setItem('tm-theme', dark ? 'dark' : 'light'); }
      catch (_) {}
    }
    applyFishTheme();
  }
  function toggleTheme() {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  }
  function syncColorScheme() {
    if (readStoredTheme()) return;
    setTheme(darkQuery.matches ? 'dark' : 'light', false);
  }
  themeToggle.hidden = false;
  themeToggle.addEventListener('click', toggleTheme);
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', syncColorScheme);
  setTheme(readStoredTheme() || (darkQuery.matches ? 'dark' : 'light'), false);
  try {
    fish = new window.BinaryFish(canvas, { color: '#554bc6', characterSize: 6, swimmingSpeed: 1.15 });
  } catch (error) {
    canvas.hidden = true;
    toggle.hidden = true;
    console.warn('The decorative fish could not start.', error);
    return;
  }
  toggle.hidden = false;
  applyFishTheme();
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
      themeToggle.removeEventListener('click', toggleTheme);
      document.removeEventListener('visibilitychange', syncPlayback);
      reducedMotion.removeEventListener('change', syncPlayback);
      if (darkQuery.removeEventListener) darkQuery.removeEventListener('change', syncColorScheme);
      window.removeEventListener('pageshow', pageShow);
      window.removeEventListener('pagehide', pageHide);
      fish.dispose();
    }
  }
  window.addEventListener('pagehide', pageHide);
  window.addEventListener('pageshow', pageShow);
  resize(); syncPlayback();
})();
