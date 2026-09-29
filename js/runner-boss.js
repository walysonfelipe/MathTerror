// Simulação e modos do boss durante corrida, captura e recuo.
import {
  BOSS_SPEED, BOSS_RETREAT_SPEED, BOSS_STRIDE, BOSS_GRAVITY, BOSS_LEAP_TIME,
  BOSS_W, BOSS_WALK, BOSS_ANIMS, GRAB_W, GRAB_OWL_X, GRAB_BOSS_X, GRAB_GAME_OVER,
} from './runner-assets.js';
import { BOSS_APPEAR_AT, ERROR_SPEEDUP } from './runner-config.js';

export function createBossController({
  boss, getState, getErrors, setLives, getOwlScreenX,
  setShake, raiseShake, updateStatusBar, playSfx, gameOver,
  grabFrameStart, startGrab,
}) {
  function bossEntryX() {
    return -BOSS_W * 0.6;
  }

  function bossCatchX() {
    return getOwlScreenX() - (GRAB_OWL_X - GRAB_BOSS_X) * GRAB_W + BOSS_W * 0.03;
  }

  function bossTargetX() {
    const k = Math.max(0, Math.min(1, (boss.progress - BOSS_APPEAR_AT) / (1 - BOSS_APPEAR_AT)));
    return bossEntryX() + (bossCatchX() - bossEntryX()) * k;
  }

  function setBossMode(mode) {
    boss.mode = mode;
    boss.modeTime = 0;
  }

  function bossPace() {
    return 1 + getErrors() * ERROR_SPEEDUP;
  }

  function bossEnter() {
    Object.assign(boss, { x: bossEntryX(), y: 0, vx: 0, vy: 0, facing: 1, walking: true, phase: 0, onLand: null });
    setBossMode('stalk');
  }

  function bossLeap(targetX, onLand) {
    boss.walking = false;
    boss.leapTarget = targetX;
    boss.onLand = onLand;
    setBossMode('leap-crouch');
  }

  function updateBoss(dt) {
    boss.modeTime += dt;
    switch (boss.mode) {
      case 'stalk': {
        const step = Math.min(BOSS_SPEED * dt, Math.max(0, bossTargetX() - boss.x));
        boss.x += step;
        boss.phase = (boss.phase + step / BOSS_STRIDE) % BOSS_WALK.length;
        boss.walking = step > 0.01;
        break;
      }
      case 'fight':
        break;
      case 'leap-crouch':
        if (boss.modeTime >= 0.16) {
          boss.vy = BOSS_GRAVITY * BOSS_LEAP_TIME / 2;
          boss.vx = (boss.leapTarget - boss.x) / BOSS_LEAP_TIME;
          setBossMode('leap-air');
        }
        break;
      case 'leap-air':
        boss.x += boss.vx * dt;
        boss.vy -= BOSS_GRAVITY * dt;
        boss.y += boss.vy * dt;
        if (boss.y <= 0 && boss.vy < 0) {
          boss.y = 0;
          boss.x = boss.leapTarget;
          raiseShake(0.9);
          setBossMode('leap-land');
        }
        break;
      case 'leap-land':
        if (boss.modeTime >= 0.2) {
          const onLand = boss.onLand;
          boss.onLand = null;
          if (onLand) onLand();
          else setBossMode('roar');
        }
        break;
      case 'roar':
        if (boss.modeTime >= 0.8 && getState() !== 'caught' && getState() !== 'over') setBossMode('stalk');
        break;
      case 'hurt':
        boss.x -= 260 * Math.max(0, 1 - boss.modeTime * 2.5) * dt;
        if (boss.modeTime >= 0.55) {
          boss.facing = -1;
          boss.walking = true;
          setBossMode('retreat');
        }
        break;
      case 'grab': {
        const grabAt = grabFrameStart(4);
        if (boss.modeTime >= grabAt && boss.modeTime - dt < grabAt) {
          setShake(1.6);
          setLives(0);
          updateStatusBar();
          playSfx('scare');
        }
        const liftAt = grabFrameStart(9);
        if (boss.modeTime >= liftAt) raiseShake(0.35);
        if (boss.modeTime >= GRAB_GAME_OVER && getState() === 'caught') gameOver('O boss pegou a coruja.');
        break;
      }
      case 'retreat':
        boss.x -= BOSS_RETREAT_SPEED * dt;
        boss.phase = (boss.phase + BOSS_RETREAT_SPEED * dt / BOSS_STRIDE) % BOSS_WALK.length;
        if (boss.x < -BOSS_W) setBossMode('hidden');
        break;
    }
  }

  return { bossCatchX, bossTargetX, setBossMode, bossPace, bossEnter, bossLeap, updateBoss };
}

export function getBossPose(boss, clock) {
  const loop = (name, time) => {
    const animation = BOSS_ANIMS[name];
    return { frame: animation.frames[Math.floor(time * animation.fps) % animation.frames.length] };
  };
  const walkPose = () => {
    const n = BOSS_WALK.length;
    const current = Math.floor(boss.phase) % n;
    const step = Math.sin(Math.PI * boss.phase / 2);
    return {
      frame: BOSS_WALK[current],
      next: BOSS_WALK[(current + 1) % n],
      blend: Math.max(0, (boss.phase % 1 - 0.65) / 0.35),
      bob: 6 * step * step,
      sy: 1 - (1 - step * step) * 0.03,
    };
  };
  switch (boss.mode) {
    case 'stalk':
      if (boss.walking) return walkPose();
      return boss.progress > 0.55 ? loop('guard', boss.modeTime) : loop('idle', clock);
    case 'leap-crouch': {
      const k = Math.min(1, boss.modeTime / 0.16);
      return { frame: 8, sx: 1 + 0.06 * k, sy: 1 - 0.1 * k };
    }
    case 'leap-air':
      return { frame: boss.vy > 0 ? 9 : 10, sy: 1.04, sx: 0.98 };
    case 'leap-land': {
      const k = boss.modeTime / 0.2;
      return { frame: 11, sx: 1 + 0.08 * (1 - k), sy: 1 - 0.12 * (1 - k) };
    }
    case 'roar': {
      const pulse = Math.sin(boss.modeTime * 30) * 0.02;
      return { frame: 13, sx: 1 + pulse, sy: 1 + pulse + 0.03 };
    }
    case 'hurt':
      return { frame: 14, flash: boss.modeTime < 0.3 && Math.floor(boss.modeTime * 20) % 2 === 0 };
    case 'retreat':
      return walkPose();
    default:
      return null;
  }
}
