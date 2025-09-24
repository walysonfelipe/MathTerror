import { bgMusic, typeSfxEl, narration } from './dom-elements.js';
import { CONFIG } from './config.js';

export async function enableAudio() {
  try {
    bgMusic.volume = 0.7;
    await bgMusic.play();
    window.audioAtivo = true;
  } catch (err) {
    console.warn("Erro ao ativar áudio:", err);
  }
}

export function stopTypeSfx() {
  try {
    if (typeSfxEl) {
      typeSfxEl.pause();
      typeSfxEl.currentTime = 0;
    }
  } catch { }
}

export async function startNarration() {
  if (!window.audioAtivo || !narration) return;
  try {
    narration.currentTime = 0;
    narration.volume = 0.9;
    await narration.play();
  } catch (e) {
    console.warn("Falha narração:", e);
  }
}

export function stopAllAudio() {
  try { narration.pause(); narration.currentTime = 0; } catch { }
  try { bgMusic.pause(); } catch { }
  stopTypeSfx();
}

export function playTypeSfx(charIndex) {
  if (window.audioAtivo && typeSfxEl && (charIndex % CONFIG.TYPE_SFX_EVERY === 0)) {
    try {
      typeSfxEl.currentTime = 0;
      typeSfxEl.volume = CONFIG.TYPE_SFX_VOLUME;
      typeSfxEl.play().catch(() => { });
    } catch { }
  }
}