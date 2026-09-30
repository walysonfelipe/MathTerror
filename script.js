// ===================== IMPORTS DOS MÓDULOS =====================
import { bgVideo, gameVideo, runnerBtn } from './js/dom-elements.js';
import { initFullscreen, onFullscreenChange } from './js/fullscreen.js';
import { isAudioEnabled, setAudioEnabled, onAudioChange } from './js/audio.js';
import { hideHome } from './js/game-state.js';
import { startRunnerMode } from './js/runner-mode.js';
import { initOrientation, maybeShowInstallHint } from './js/orientation.js';
import './js/gamepad-status.js';

// Remove o service worker/cache offline de versões antigas. O jogo agora usa os
// arquivos servidos normalmente e não mantém cópias offline.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
    .catch(() => {});
}
if ('caches' in window) {
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith('mathterror-')).map(key => caches.delete(key))))
    .catch(() => {});
}

// Mantém só a logo na tela até o vídeo poder começar a tocar.
function waitUntilPlayable(media) {
  if (!media || media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || media.error) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    media.addEventListener('canplay', resolve, { once: true });
    media.addEventListener('error', resolve, { once: true });
    // Com <source>, a falha dispara na última source, não no <video>
    media.querySelector('source:last-of-type')?.addEventListener('error', resolve, { once: true });
  });
}

// Nunca prende a tela na logo (rede lenta, Safari segurando mídia etc.)
const LOADING_TIMEOUT_MS = 5000;
const timeout = ms => new Promise(resolve => setTimeout(resolve, ms));

// ===================== INICIALIZAÇÃO GLOBAL =====================
// Inicializa o vídeo de fundo. O Safari (ex.: Modo Pouca Energia, app em segundo plano)
// pode barrar ou pausar o autoplay; cada toque/clique retoma o vídeo que está aparecendo
// (menu ou partida).
function playBgVideo() {
  const video = document.body.classList.contains('in-game') ? gameVideo : bgVideo;
  if (!video || !video.paused) return;
  video.muted = true;
  video.play().catch(() => { });
}
playBgVideo();
['pointerdown', 'touchend', 'click'].forEach(type => {
  document.addEventListener(type, playBgVideo, { capture: true, passive: true });
});

// Revela o menu só esperando o vídeo: a trilha toca em streaming quando o som liga.
Promise.race([waitUntilPlayable(bgVideo), timeout(LOADING_TIMEOUT_MS)]).then(() => {
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
  maybeShowInstallHint();
});

// Inicializa módulos
initFullscreen();
initOrientation();

// ===================== INÍCIO DO JOGO =====================
// startRunnerMode liga todo o áudio dentro deste clique (js/audio.js).
runnerBtn?.addEventListener('click', () => {
  hideHome();
  startRunnerMode();
});

// Inicialização final
onFullscreenChange();

// ===================== BOTÃO DE SOM =====================
// Só alterna o provider; o texto acompanha qualquer mudança (inclusive ao iniciar o jogo).
const soundBtn = document.getElementById('soundBtn');
soundBtn.addEventListener('click', () => setAudioEnabled(!isAudioEnabled()));
onAudioChange(on => {
  soundBtn.textContent = on ? 'Som ligado' : 'Som desligado';
  soundBtn.setAttribute('aria-pressed', String(on));
});
