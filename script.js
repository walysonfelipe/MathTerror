// ===================== IMPORTS DOS MÓDULOS =====================
import { bgVideo, audioEnableBtn, audioDismissBtn, runnerBtn } from './js/dom-elements.js';
import { initFullscreen, onFullscreenChange, hideModal } from './js/fullscreen.js';
import { enableAudio } from './js/audio.js';
import { hideHome } from './js/game-state.js';
import { startRunnerMode } from './js/runner-mode.js';

// ===================== INICIALIZAÇÃO GLOBAL =====================
window.audioAtivo = false;

// Inicializa o vídeo de fundo
bgVideo?.play().catch(() => { });

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
