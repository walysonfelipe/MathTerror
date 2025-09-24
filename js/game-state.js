import { scene1, storyTextEl, continueBtn, storyScrollEl, bgVideo } from './dom-elements.js';
import { stopAllAudio } from './audio.js';
import { resetQuizUI } from './quiz.js';
import { abortStoryTyping } from './story.js';

export function showHome() {
  document.querySelector('.overlay')?.style.removeProperty('display');
  try { bgVideo.style.filter = 'brightness(0.50) contrast(1.05) saturate(1.05) hue-rotate(-6deg)'; } catch { }
}

export function hideHome() {
  const ov = document.querySelector('.overlay');
  if (ov) ov.style.display = 'none';
}

export function resetStoryUI() {
  if (storyTextEl) storyTextEl.textContent = "";
  if (continueBtn) {
    continueBtn.hidden = true;
    continueBtn.classList.remove('is-visible');
  }
  if (storyScrollEl) storyScrollEl.scrollTop = 0;
}

export function resetGame() {
  abortStoryTyping();
  stopAllAudio();

  if (scene1) scene1.hidden = true;
  resetStoryUI();
  resetQuizUI();

  showHome();
}