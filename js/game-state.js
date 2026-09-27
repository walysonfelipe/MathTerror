import { bgVideo } from './dom-elements.js';
import { stopAllAudio } from './audio.js';
import { stopRunnerMode } from './runner-mode.js';

export function showHome() {
  document.body.classList.remove("in-game");
  document.querySelector('.overlay')?.style.removeProperty('display');
  try { bgVideo.style.filter = 'brightness(0.50) contrast(1.05) saturate(1.05) hue-rotate(-6deg)'; } catch { }
}

export function hideHome() {
  document.body.classList.add("in-game");
  const ov = document.querySelector('.overlay');
  if (ov) ov.style.display = 'none';
}

export function resetGame() {
  stopRunnerMode();
  stopAllAudio();
  showHome();
}
