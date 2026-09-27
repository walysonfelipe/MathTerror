// ===================== ATIVAÇÃO DE ÁUDIO =====================
// ===================== IMPORTS DOS MÓDULOS =====================
import { bgVideo, startBtn, survivalBtn, audioEnableBtn, audioDismissBtn, rankingBtn } from './js/dom-elements.js';
import { initFullscreen, onFullscreenChange, hideModal } from './js/fullscreen.js';
import { enableAudio } from './js/audio.js';
import { hideHome } from './js/game-state.js';
import { startScene1, initSceneEvents } from './js/scenes.js';
import { startSurvival } from './js/survival.js';
import { showRankingScreen } from './js/ranking.js';

// ===================== INICIALIZAÇÃO GLOBAL =====================
window.audioAtivo = false;

// Inicializa o vídeo de fundo
bgVideo?.play().catch(() => { });

// Inicializa módulos
initFullscreen();
initSceneEvents();

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
startBtn?.addEventListener('click', () => {
  hideHome();
  bgVideo.style.filter = 'brightness(0.4) contrast(1.1) saturate(1.1) hue-rotate(-6deg)';
  setTimeout(startScene1, 250);
});

survivalBtn?.addEventListener('click', () => {
  hideHome();
  startSurvival();
});

rankingBtn?.addEventListener('click', () => {
   showRankingScreen();
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
  document.getElementById('rewardVideo').muted = !window.audioAtivo;
  syncSound();
});
audioEnableBtn?.addEventListener('click', () => setTimeout(syncSound, 100));
audioDismissBtn?.addEventListener('click', syncSound);

// Atalhos do HUD usam as mesmas ações dos botões.
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.matches('input, textarea, select')) return;
  if (!document.getElementById('audioModal').hidden || document.getElementById('rankingScreen') || document.getElementById('nameScreen')) return;
  const quiz = document.getElementById('quiz');
  if (!quiz.hidden && document.getElementById('correctOverlay').hidden && document.getElementById('wrongFlash').hidden) {
    const index = ['1', '2', '3', '4'].indexOf(event.key);
    if (index >= 0) {
      const button = document.querySelectorAll('#qOptions > button')[index];
      if (button && !button.disabled) { event.preventDefault(); button.click(); }
    }
  }
});
