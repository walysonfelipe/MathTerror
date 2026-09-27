// ===================== IMPORTS DOS MÓDULOS =====================
import { bgVideo, audioEnableBtn, audioDismissBtn, runnerBtn } from './js/dom-elements.js';
import { initFullscreen, onFullscreenChange, hideModal } from './js/fullscreen.js';
import { enableAudio } from './js/audio.js';
import { hideHome } from './js/game-state.js';
import { startRunnerMode } from './js/runner-mode.js';
import { initOrientation, maybeShowInstallHint } from './js/orientation.js';

// Mantém só a logo na tela até vídeo e música poderem começar a tocar.
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
window.audioAtivo = false;

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

// Inicia o carregamento da trilha, mas revela o menu só esperando o vídeo:
// o Safari do iPhone não baixa áudio antes de um toque, então a música nunca ficaria "pronta".
const bgMusic = document.getElementById('bgMusic');
bgMusic?.load();
Promise.race([waitUntilPlayable(bgVideo), timeout(LOADING_TIMEOUT_MS)]).then(() => {
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
  maybeShowInstallHint();
});

// Inicializa módulos
initFullscreen();
initOrientation();

// ===================== ATIVAÇÃO DE ÁUDIO =====================
audioEnableBtn?.addEventListener('click', async () => {
  await enableAudio();
  hideModal();
});

audioDismissBtn?.addEventListener('click', () => {
  window.audioAtivo = false;
  hideModal();
});

// ===================== INÍCIO DO JOGO =====================
runnerBtn?.addEventListener('click', () => {
  hideHome();
  startRunnerMode();
});


// Inicialização final
onFullscreenChange();

const soundBtn = document.getElementById('soundBtn');
function syncSound() {
  soundBtn.textContent = window.audioAtivo ? 'Som ligado' : 'Som desligado';
  soundBtn.setAttribute('aria-pressed', String(window.audioAtivo));
}
soundBtn.addEventListener('click', async () => {
  if (window.audioAtivo) {
    window.audioAtivo = false;
    document.querySelectorAll('audio').forEach(audio => audio.pause());
  } else {
    await enableAudio();
  }
  syncSound();
});
audioEnableBtn?.addEventListener('click', () => setTimeout(syncSound, 100));
audioDismissBtn?.addEventListener('click', syncSound);
