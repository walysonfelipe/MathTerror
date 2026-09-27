// ===================== IMPORTS DOS MÓDULOS =====================
import { bgVideo, runnerBtn } from './js/dom-elements.js';
import { initFullscreen, onFullscreenChange } from './js/fullscreen.js';
import { isAudioEnabled, setAudioEnabled, onAudioChange } from './js/audio.js';
import { hideHome } from './js/game-state.js';
import { startRunnerMode } from './js/runner-mode.js';
import { initOrientation, maybeShowInstallHint } from './js/orientation.js';

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
// Inicializa o vídeo de fundo. O Safari (ex.: Modo Pouca Energia) pode barrar o
// autoplay; nesse caso tenta de novo a cada toque/clique até o vídeo rodar.
function playBgVideo() {
  if (!bgVideo || !bgVideo.paused) return;
  bgVideo.muted = true;
  bgVideo.play().catch(() => { });
}
playBgVideo();
['pointerdown', 'touchend', 'click'].forEach(type => {
  document.addEventListener(type, playBgVideo, { capture: true, passive: true });
});
bgVideo?.addEventListener('playing', () => {
  ['pointerdown', 'touchend', 'click'].forEach(type => {
    document.removeEventListener(type, playBgVideo, { capture: true });
  });
}, { once: true });

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
