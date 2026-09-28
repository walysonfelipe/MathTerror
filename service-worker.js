const CACHE_NAME = 'mathterror-static-v2';
const APP_SHELL = [
  './', './index.html', './style.css', './manifest.json', './script.js',
  './js/audio.js', './js/config.js', './js/dom-elements.js', './js/fullscreen.js',
  './js/game-state.js', './js/hud.js', './js/orientation.js', './js/quiz-data.js',
  './js/runner-mode.js', './js/utils.js',
  './assets/audio/jump.mp3', './assets/audio/porta.mp3', './assets/audio/pulse.mp3',
  './assets/audio/susto.mp3', './assets/audio/voicebosch-falling-whistle-cartoon-180579.mp3',
  './assets/audio/music-mobile.mp3',
  './assets/fonts/murder.ttf', './assets/fonts/Signatures.otf',
  './assets/images/boss-sheet.webp', './assets/images/digits-sheet.webp',
  './assets/images/door-pass-sheet.webp', './assets/images/favicon.png',
  './assets/images/fullscreen-btn-sheet.webp', './assets/images/gameover-buttons.webp',
  './assets/images/gameover-panel.webp', './assets/images/ground-sheet.webp',
  './assets/images/hearts-sheet.webp', './assets/images/hud-frame-3.webp',
  './assets/images/icon-180.png', './assets/images/icon-512.png',
  './assets/images/icon-maskable-512.png', './assets/images/logo.webp',
  './assets/images/mathog.jpg', './assets/images/owl-sheet.webp',
  './assets/images/sound-btn-sheet.webp', './assets/images/grab-sheet.webp',
  './assets/images/quiz/curva.webp', './assets/images/quiz/parabola.webp',
  './assets/images/quiz/reta.webp', './assets/images/quiz/retacrescente.webp',
  './assets/images/quiz/resp1n.webp', './assets/images/quiz/resp1_2n.webp',
  './assets/images/quiz/resp1_3n.webp', './assets/images/quiz/resp1s.webp',
  './assets/videos/game-bg.mp4', './assets/videos/menu-mobile.mp4'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('mathterror-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
