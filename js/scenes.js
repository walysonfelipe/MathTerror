import { scene1, char1, storyScrollEl, continueBtn, skipBtn, bgVideo } from './dom-elements.js';
import { typewriterFixedDuration, abortStoryTyping, historiaCap1 } from './story.js';
import { startQuiz } from './quiz.js';

export async function startScene1() {
  if (!scene1) return;
  scene1.hidden = false;

  // ao iniciar a cena, deixa o "Pular diálogo" visível
  if (skipBtn) skipBtn.hidden = false;

  if (char1) {
    char1.style.animation = 'none';
    void char1.offsetWidth;
    char1.style.animation = '';
  }

  if (storyScrollEl) storyScrollEl.scrollTop = 0;

  await typewriterFixedDuration(document.getElementById('storyText'), historiaCap1);

  // a introdução acabou: esconde o "Pular diálogo" e mostra "Continuar ▶"
  if (storyScrollEl) {
    storyScrollEl.scrollTo({ top: storyScrollEl.scrollHeight, behavior: 'smooth' });
    setTimeout(() => {
      if (skipBtn) skipBtn.hidden = true;
      continueBtn.hidden = false;
      continueBtn.classList.add('is-visible');
      continueBtn.focus({ preventScroll: true });
    }, 320);
  } else {
    if (skipBtn) skipBtn.hidden = true;
    continueBtn.hidden = false;
    continueBtn.classList.add('is-visible');
    continueBtn.focus({ preventScroll: true });
  }
}

export function initSceneEvents() {
  continueBtn?.addEventListener('click', () => {
    if (skipBtn) skipBtn.hidden = true;
    abortStoryTyping();
    scene1.hidden = true;
    try { bgVideo.style.filter = 'brightness(0.35) contrast(1.1) saturate(1.05) hue-rotate(-6deg)'; } catch { }
    startQuiz();
  });

  // Botão "Pular diálogo"
  skipBtn?.addEventListener('click', () => {
    abortStoryTyping({ showFullText: false });
    if (skipBtn) skipBtn.hidden = true;
    if (scene1) scene1.hidden = true;
    try { bgVideo.style.filter = 'brightness(0.35) contrast(1.1) saturate(1.05) hue-rotate(-6deg)'; } catch {}
    startQuiz();
  });
}