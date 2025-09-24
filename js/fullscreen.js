import { fullscreenBtn, audioModal, audioEnableBtn } from './dom-elements.js';

let modalJaMostradoNesteFS = false;

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function showModal() {
  if (!audioModal) return;
  audioModal.hidden = false;
  if (audioEnableBtn) setTimeout(() => audioEnableBtn.focus({ preventScroll: true }), 0);
}

export function hideModal() {
  if (!audioModal) return;
  audioModal.hidden = true;
}

export function onFullscreenChange() {
  const ativo = isFullscreen();
  fullscreenBtn?.setAttribute('aria-pressed', ativo ? 'true' : 'false');

  if (!ativo) {
    hideModal();
    modalJaMostradoNesteFS = false;
    return;
  }

  if (!window.audioAtivo && !modalJaMostradoNesteFS) {
    modalJaMostradoNesteFS = true;
    setTimeout(() => {
      if (isFullscreen() && !window.audioAtivo) showModal();
    }, 120);
  }
}

export function initFullscreen() {
  fullscreenBtn?.addEventListener('click', async () => {
    const ativo = isFullscreen();
    try {
      if (!ativo) {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch (e) {
      console.warn('Erro ao alternar fullscreen:', e);
    }
  });

  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);
}