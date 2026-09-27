import { bgMusic } from './dom-elements.js';

export async function enableAudio() {
  // A escolha do jogador libera os efeitos do jogo mesmo se a trilha falhar.
  window.audioAtivo = true;
  try {
    if (bgMusic) {
      bgMusic.volume = 0.7;
      await bgMusic.play();
    }
  } catch (err) {
    console.warn("A trilha de fundo não pôde ser iniciada:", err);
  }
}

export function stopAllAudio() {
  try { bgMusic.pause(); } catch { }
}
