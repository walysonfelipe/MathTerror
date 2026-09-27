import { bgVideo, gameVideo } from './dom-elements.js';
import { stopAllEffects } from './audio.js';
import { stopRunnerMode } from './runner-mode.js';

// Fundo da partida (game-bg.mp4: cortado a partir do 2º segundo e interpolado para 60 fps,
// para a câmera lenta continuar suave). 0,4× = cada volta do loop leva ~20 s.
const GAME_VIDEO_RATE = 0.4;
if (gameVideo) gameVideo.defaultPlaybackRate = GAME_VIDEO_RATE;

// Menu e partida têm vídeos de fundo diferentes: toca só o que está aparecendo.
function playOnly(show, hide) {
  hide?.pause();
  if (!show) return;
  show.muted = true;
  if (show === gameVideo) show.playbackRate = GAME_VIDEO_RATE;
  show.play().catch(() => { });
}

export function showHome() {
  document.body.classList.remove("in-game");
  playOnly(bgVideo, gameVideo);
  document.querySelector('.overlay')?.style.removeProperty('display');
  try { bgVideo.style.filter = 'brightness(0.50) contrast(1.05) saturate(1.05) hue-rotate(-6deg)'; } catch { }
}

export function hideHome() {
  document.body.classList.add("in-game");
  if (gameVideo) gameVideo.currentTime = 0;        // cada partida começa do início do vídeo
  playOnly(gameVideo, bgVideo);
  const ov = document.querySelector('.overlay');
  if (ov) ov.style.display = 'none';
}

export function resetGame() {
  stopRunnerMode();
  stopAllEffects();   // a trilha continua no menu
  showHome();
}
