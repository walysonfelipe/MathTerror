// Física vertical da coruja: agachada, pulo, aterrissagem e queda em buracos.
import { GRAVITY } from './runner-config.js';
import { CROUCH_TIME, JUMP_BUFFER, OWL_H } from './runner-assets.js';

export function updateOwlPhysics(dt, {
  owl, state, clock, groundY, viewH, isSupported, launch, kickDust,
  getRunPhase, setRunPhase, getFallSounded, setFallSounded,
  playFallSfx, lives, fellInPit,
}) {
  const supported = isSupported(owl.x);
  if (owl.crouchAt >= 0) {
    // Sai do chão ao fim da agachada, ou na hora se a plataforma acabar.
    if (state !== 'run') owl.crouchAt = -1;
    else if (clock - owl.crouchAt >= CROUCH_TIME || !supported) launch();
  }
  if (owl.grounded && !supported) owl.grounded = false;
  if (!owl.grounded) {
    const prevY = owl.y;
    owl.vy += GRAVITY * dt;
    owl.y += owl.vy * dt;
    if (supported && prevY <= groundY + 4 && owl.y >= groundY) {
      owl.y = groundY;
      owl.vy = 0;
      owl.grounded = true;
      owl.landedAt = clock;
      owl.jumping = false;
      setRunPhase(0);
      kickDust(8, 1);
      if (state === 'run' && clock - owl.bufferedAt < JUMP_BUFFER) owl.crouchAt = clock;
      owl.bufferedAt = -1;
    } else {
      if (!getFallSounded() && owl.y > groundY + 4) {
        setFallSounded(true);
        playFallSfx(lives);
      }
      if (owl.y > viewH + OWL_H) fellInPit();
    }
  }
  return getRunPhase();
}
