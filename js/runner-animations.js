// Cálculo de poses do runner, sem acesso ao canvas nem ao estado global do jogo.
import { JUMP_VELOCITY } from './runner-config.js';
import { FIGHT_DEATH, FIGHT_DEATH_STARTS } from './runner-fight-assets.js';
import {
  OWL_ANIMS, RUN_FRAMES, RUN_STEP, RUN_BOB, CROUCH_TIME, LAND_TIME,
  CELEBRATE_TIME, HOP_TIME, GRAB_FRAMES, GRAB_FRAME_TIME,
} from './runner-assets.js';

export function getOwlPose(owl, { state, clock, stateTime, runPhase }) {
  const deg = Math.PI / 180;
  const loop = (name, time) => {
    const animation = OWL_ANIMS[name];
    return { frame: animation.frames[Math.floor(time * animation.fps) % animation.frames.length] };
  };
  const hop = time => {
    const p = (time / HOP_TIME) % 1;
    const air = Math.min(1, Math.max(0, (p - 0.12) / 0.72));
    const frame = p < 0.12 ? 12 : p < 0.4 ? 13 : p < 0.84 ? 14 : 15;
    return { frame, bob: Math.sin(Math.PI * air) * 34 };
  };

  if (state === 'caught' || state === 'over') {
    return { frame: 12, sx: 1 + Math.sin(clock * 45) * 0.02, sy: 0.97 };
  }
  if (owl.crouchAt >= 0) {
    const k = Math.min(1, (clock - owl.crouchAt) / CROUCH_TIME);
    return { frame: 12, sx: 1 + 0.08 * k, sy: 1 - 0.12 * k };
  }
  if (!owl.grounded) {
    const v = owl.vy / -JUMP_VELOCITY;
    const blend = !owl.jumping ? 1 : Math.min(1, Math.max(0, (v + 0.1) / 0.25));
    const stretch = Math.min(1, Math.abs(v)) * 0.06;
    return { frame: 13, next: 14, blend, sx: 1 - stretch / 2, sy: 1 + stretch, rot: Math.max(-1, Math.min(1, v)) * 7 * deg, center: true };
  }

  const sinceLand = clock - owl.landedAt;
  if (sinceLand < LAND_TIME) {
    const k = sinceLand / LAND_TIME;
    const running = state === 'run';
    return {
      frame: 15,
      next: running ? RUN_FRAMES[0] : undefined,
      blend: running ? Math.max(0, (k - 0.55) / 0.45) : 0,
      sx: 1 + 0.1 * (1 - k),
      sy: 1 - 0.14 * (1 - k),
    };
  }
  if (state === 'resume' && stateTime < CELEBRATE_TIME) return hop(stateTime);
  if (state === 'checkpoint') return loop('idle', stateTime);

  const n = RUN_FRAMES.length;
  const current = Math.floor(runPhase) % n;
  const stepPhase = (runPhase % RUN_STEP) / RUN_STEP;
  const lift = Math.cos(Math.PI * stepPhase) ** 2;
  const planted = 1 - lift;
  return {
    frame: RUN_FRAMES[current],
    next: RUN_FRAMES[(current + 1) % n],
    blend: Math.max(0, (runPhase % 1 - 0.7) / 0.3),
    bob: RUN_BOB * lift,
    rot: (1.5 + lift * 1.5) * deg,
    sx: 1 + planted * 0.02,
    sy: 1 - planted * 0.025,
  };
}

export function getFightDeathPose(t) {
  let frame = 0;
  while (frame < 15 && t >= FIGHT_DEATH_STARTS[frame + 1]) frame++;
  const slide = Math.max(0, Math.min(1, (t - FIGHT_DEATH_STARTS[2]) / (FIGHT_DEATH_STARTS[10] - FIGHT_DEATH_STARTS[2])));
  const dx = FIGHT_DEATH.knockback * (1 - (1 - slide) ** 3);
  const air = (t - FIGHT_DEATH_STARTS[3]) / (FIGHT_DEATH_STARTS[6] - FIGHT_DEATH_STARTS[3]);
  const lift = air > 0 && air < 1 ? FIGHT_DEATH.lift * Math.sin(Math.PI * air) : 0;
  return { frame, dx, lift };
}

export function getGrabPose(t) {
  const frame = Math.min(GRAB_FRAMES - 1, Math.floor(t / GRAB_FRAME_TIME));
  const k = (t / GRAB_FRAME_TIME) % 1;
  const last = frame === GRAB_FRAMES - 1;
  return { frame, next: frame + 1, blend: last ? 0 : Math.max(0, (k - 0.85) / 0.15) };
}

export function getGrabFrameStart(frame) {
  return frame * GRAB_FRAME_TIME;
}
