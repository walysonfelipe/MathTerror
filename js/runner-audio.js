// Efeitos específicos do modo runner; o provider geral continua em audio.js.
import { playSfx } from './audio.js';

const FALL_SFX_START = 0.55;
const FALL_SFX_END = 4;
const FALL_SFX_END_LAST = 9;
const PULSE_MIN_VOLUME = 0.08;
const PULSE_CURVE = 1.4;

let fallSfx = null;
let pulseSfx = null;

export function playFallSfx(lives) {
  const end = lives <= 1 ? FALL_SFX_END_LAST : FALL_SFX_END;
  stopFallSfx();
  fallSfx = playSfx('fall', { offset: FALL_SFX_START, duration: end - FALL_SFX_START });
}

export function stopFallSfx() {
  fallSfx?.stop();
  fallSfx = null;
}

export function playJumpSfx() {
  playSfx('jump');
}

export function playDoorSfx() {
  playSfx('door');
}

export function updatePulse(progress) {
  if (!pulseSfx || pulseSfx.stopped) pulseSfx = playSfx('pulse', { loop: true, volume: PULSE_MIN_VOLUME });
  const threat = progress ** PULSE_CURVE;
  pulseSfx?.setVolume(PULSE_MIN_VOLUME + (1 - PULSE_MIN_VOLUME) * threat);
  pulseSfx?.setRate(0.9 + progress * 0.75);
}

export function resetPulse() {
  pulseSfx?.stop();
  pulseSfx = null;
}
