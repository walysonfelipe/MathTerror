// ===================== IMPORTS DOS MÓDULOS =====================
import { bgVideo, audioEnableBtn, audioDismissBtn, runnerBtn } from './js/dom-elements.js';
import { initFullscreen, onFullscreenChange, hideModal } from './js/fullscreen.js';
import { enableAudio } from './js/audio.js';
import { hideHome } from './js/game-state.js';
import { startRunnerMode } from './js/runner-mode.js';

// Mantém só a logo na tela até vídeo e música poderem começar a tocar.
function waitUntilPlayable(media) {
  if (!media || media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA || media.error) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    media.addEventListener('canplay', resolve, { once: true });
    media.addEventListener('error', resolve, { once: true });
  });
}

// ===================== INICIALIZAÇÃO GLOBAL =====================
window.audioAtivo = false;

// Inicializa o vídeo de fundo
bgVideo?.play().catch(() => { });

// Inicia o carregamento da trilha e revela o menu assim que ambos estiverem prontos.
const bgMusic = document.getElementById('bgMusic');
bgMusic?.load();
Promise.all([waitUntilPlayable(bgVideo), waitUntilPlayable(bgMusic)]).then(() => {
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
});

// Inicializa módulos
initFullscreen();

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
