import { CONFIG } from './config.js';
import { storyTextEl, storyScrollEl, narration } from './dom-elements.js';
import { stopTypeSfx, startNarration, playTypeSfx } from './audio.js';

// ===================== HISTÓRIA =====================
export const historiaCap1 = [
  "Nas sombras do desconhecido, um guardião desperta.",
  "Seus olhos ardem em chamas, observando cada passo que você dá.",
  "Ele não fala, mas você sente sua presença em cada batida do coração.",
  "Portas surgirão diante de você. Atrás de algumas, há esperança.",
  "Atrás de outras… apenas o vazio e o terror.",
  "Avance com cautela.",
  "O guardião espera",
  "pronto para testar sua coragem.",
  "Uma escolha errada,",
  "e ele estará à sua frente.",
  "Bem-vindo",
  "ao corredor",
  "do medo.",
  "Você ousa continuar?"
].join("\n\n");

let typingActive = false;
let typingTimerId = null;

export async function typewriterFixedDuration(el, texto) {
  el.textContent = "";
  typingActive = true;
  stopTypeSfx();
  await startNarration();

  const perChar = Math.max(4, CONFIG.TYPE_CHAR_DELAY | 0);

  await new Promise(resolve => {
    let i = 0;

    const tick = () => {
      if (!typingActive) return resolve();

      el.textContent += texto.charAt(i);

      playTypeSfx(i);

      if (storyScrollEl && storyScrollEl.scrollHeight > storyScrollEl.clientHeight) {
        storyScrollEl.scrollTo({ top: storyScrollEl.scrollHeight, behavior: 'smooth' });
      }

      i++;
      if (i < texto.length) {
        const jitter = perChar * (0.7 + Math.random() * 0.6);
        typingTimerId = setTimeout(tick, jitter);
      } else {
        typingActive = false;
        stopTypeSfx();
        resolve();
      }
    };

    typingTimerId = setTimeout(tick, perChar);
  });
}

export function abortStoryTyping({ showFullText = false } = {}) {
  // Para a digitação imediatamente
  typingActive = false;
  if (typingTimerId) clearTimeout(typingTimerId);
  stopTypeSfx();

  // Para a narração imediatamente
  try {
    if (narration) {
      narration.pause();
      narration.currentTime = 0;
    }
  } catch {}

  // Revela todo o texto (opcional)
  if (showFullText && storyTextEl) {
    storyTextEl.textContent = historiaCap1;
  }
}