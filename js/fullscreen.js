import { fullscreenBtn } from './dom-elements.js';
import { lockLandscape } from './orientation.js';

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function onFullscreenChange() {
  const ativo = isFullscreen();
  fullscreenBtn?.setAttribute('aria-pressed', ativo ? 'true' : 'false');
  if (ativo) lockLandscape();
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
