// ===================== ATIVAÇÃO DE ÁUDIO =====================
// ===================== IMPORTS DOS MÓDULOS =====================
import { bgVideo, startBtn, survivalBtn, audioEnableBtn, audioDismissBtn } from './js/dom-elements.js';
import { initFullscreen, onFullscreenChange, hideModal } from './js/fullscreen.js';
import { enableAudio } from './js/audio.js';
import { hideHome } from './js/game-state.js';
import { startScene1, initSceneEvents } from './js/scenes.js';
import { startSurvival } from './js/survival.js';

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


// Inicialização final
onFullscreenChange();
