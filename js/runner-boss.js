// Simulação e modos do boss durante corrida, captura e recuo.
import {
  BOSS_SPEED, BOSS_RETREAT_SPEED, BOSS_STRIDE, BOSS_GRAVITY, BOSS_LEAP_TIME,
  BOSS_W, BOSS_WALK, BOSS_ANIMS, BOSS_CROUCH_TIME, BOSS_LAND_TIME, BOSS_FOOT,
  BOSS_GAP_LAND_TIME, BOSS_ACCEL,
  GRAB_W, GRAB_OWL_X, GRAB_BOSS_X, GRAB_GAME_OVER,
} from './runner-assets.js';
import { BOSS_APPEAR_AT } from './runner-config.js';

export function createBossController({
  boss, getState, getRunChasePace = () => 1, getChaseSpeed = () => 0, findGapJumpTarget = () => null,
  findGapLeap = () => null, getFooting = () => null,
  getCameraX = () => 0, getErrors, setLives, getOwlScreenX,
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

  function bossEnter() {
    const cameraX = getCameraX();
    let x = bossEntryX();
    // Fora da tela, mas nunca em cima do vão: recua até a borda de trás e entra saltando
    const footing = getFooting(x + cameraX);
    if (footing && !footing.supported && Number.isFinite(footing.gapStart)) x = footing.gapStart - BOSS_FOOT - cameraX;
    Object.assign(boss, { x, y: 0, vx: 0, vy: 0, facing: 1, walking: true, phase: 0, onLand: null, runSpeed: undefined, cameraX });
    setBossMode('stalk');
  }

  // runOnLand: modo em que volta a correr depois de firmar os pés (saltos sobre vãos: 'stalk' ou 'retreat')
  function bossLeap(targetX, onLand, runOnLand = false) {
    boss.walking = false;
    boss.leapTarget = targetX;
    boss.onLand = onLand;
    boss.runOnLand = runOnLand;
    setBossMode('leap-crouch');
  }

  // Enquanto pula, o boss fica preso ao mundo: na tela ele recua junto com o chão.
  function followCameraDuringLeap(cameraDelta) {
    boss.x -= cameraDelta;
    boss.leapTarget -= cameraDelta;
  }

  function updateBoss(dt) {
    boss.modeTime += dt;
    const cameraX = getCameraX();
    // Quanto o chão andou neste quadro (limitado para ignorar saltos de câmera ao reposicionar)
    const cameraDelta = Math.max(-40, Math.min(40, cameraX - (boss.cameraX ?? cameraX)));
    boss.cameraX = cameraX;
    switch (boss.mode) {
      case 'stalk': {
        const gapJump = findGapJumpTarget();
        if (gapJump?.landX !== undefined) {
          boss.facing = 1;
          boss.x -= cameraDelta;                     // já preso ao chão neste quadro: não escorrega para o vão
          bossLeap(gapJump.landX, null, 'stalk');
          break;
        }
        if (gapJump?.hold) {
          // Espera firme na borda do vão (preso ao chão, não à tela) até o alvo passar para o outro lado
          boss.x -= cameraDelta;
          boss.walking = false;
          break;
        }
        // No checkpoint ele corre direto até a coruja (getChaseSpeed); na corrida segue a barra.
        const chaseSpeed = getChaseSpeed();
        const chasePace = getState() === 'run' ? getRunChasePace() : 1;
        const target = chaseSpeed ? bossCatchX() : bossTargetX();
        // Depois de um salto ele fica para trás do alvo: ganha velocidade aos poucos em vez de disparar
        const topSpeed = chaseSpeed || BOSS_SPEED * chasePace;
        boss.runSpeed = Math.min(topSpeed, (boss.runSpeed ?? topSpeed) + BOSS_ACCEL * dt);
        const step = Math.min(boss.runSpeed * dt, Math.max(0, target - boss.x));
        boss.x += step;
        // As passadas seguem o deslocamento no chão (tela + câmera); só pela tela ele
        // deslizava parado sempre que alcançava o alvo, como logo depois de um salto.
        const groundStep = step + cameraDelta;
        boss.walking = groundStep > 0.01;
        if (boss.walking) boss.phase = (boss.phase + groundStep / BOSS_STRIDE) % BOSS_WALK.length;
        break;
      }
      case 'fight':
        break;
      case 'leap-crouch':
        followCameraDuringLeap(cameraDelta);
        if (boss.modeTime >= BOSS_CROUCH_TIME) {
          boss.vy = BOSS_GRAVITY * BOSS_LEAP_TIME / 2;
          boss.vx = (boss.leapTarget - boss.x) / BOSS_LEAP_TIME;
          setBossMode('leap-air');
        }
        break;
      case 'leap-air':
        followCameraDuringLeap(cameraDelta);
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
        followCameraDuringLeap(cameraDelta);
        if (boss.runOnLand && boss.modeTime >= BOSS_GAP_LAND_TIME) {
          // Firmou os pés depois do vão: volta a correr do zero, do 2º quadro da corrida
          const mode = boss.runOnLand;
          boss.runOnLand = false;
          boss.runSpeed = 0;
          boss.phase = 1;
          boss.walking = true;
          setBossMode(mode);
        } else if (!boss.runOnLand && boss.modeTime >= BOSS_LAND_TIME) {
          const onLand = boss.onLand;
          boss.onLand = null;
          boss.phase = 1;                            // pousou no 1º quadro da corrida: segue do 2º
          boss.walking = true;
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
      case 'retreat': {
        // Fugindo também pula os vãos, de costas para a coruja, e pousa já correndo
        const landX = boss.x > -BOSS_W ? findGapLeap(boss.x + cameraX, -1) : null;
        if (landX !== null) {
          boss.x -= cameraDelta;                     // já preso ao chão neste quadro: não escorrega para o vão
          bossLeap(landX - cameraX, null, 'retreat');
          break;
        }
        boss.runSpeed = Math.min(BOSS_RETREAT_SPEED, (boss.runSpeed ?? BOSS_RETREAT_SPEED) + BOSS_ACCEL * dt);
        boss.x -= boss.runSpeed * dt;
        boss.phase = (boss.phase + boss.runSpeed * dt / BOSS_STRIDE) % BOSS_WALK.length;
        if (boss.x < -BOSS_W) setBossMode('hidden');
        break;
      }
    }
    // Firme, na beirada ou sobre o vão (ver footingAt), com os pés do boss
    boss.footing = boss.mode === 'hidden' ? null : getFooting(boss.x + getCameraX());
  }

  return { bossCatchX, bossEntryX, bossTargetX, setBossMode, bossEnter, bossLeap, updateBoss };
}

export function getBossPose(boss, clock) {
  const loop = (name, time) => {
    const animation = BOSS_ANIMS[name];
    return { frame: animation.frames[Math.floor(time * animation.fps) % animation.frames.length] };
  };
  const walkPose = () => {
    const n = BOSS_WALK.length;
    const current = Math.floor(boss.phase) % n;
    return {
      frame: BOSS_WALK[current],
    };
  };
  switch (boss.mode) {
    case 'stalk':
      if (boss.walking) return walkPose();
      if (boss.progress <= 0.55) return loop('idle', clock);
      // Guarda parada: só respira, sem trocar de quadro (12/13 tiram os pés do chão)
      return { ...loop('guard', boss.modeTime), sy: 1 + Math.sin(clock * 5) * 0.015 };
    case 'leap-crouch': {
      const k = Math.min(1, boss.modeTime / BOSS_CROUCH_TIME);
      return { frame: 9, sx: 1 + 0.04 * k, sy: 1 - 0.06 * k };
    }
    case 'leap-air':
      // Decola esticado e encolhe as pernas depois do ponto mais alto
      return boss.vy > 0 ? { frame: 10, sx: 0.98, sy: 1.03 } : { frame: 11 };
    case 'leap-land': {
      if (boss.runOnLand) {
        // Depois do vão firma os pés parado: amortece agachado (9) e se apruma em pé (8).
        // O quadro 0 é a passada mais aberta e, congelado, parecia que ele ainda estava pulando.
        const k = Math.min(1, boss.modeTime / (BOSS_GAP_LAND_TIME * 0.45));
        return k < 1 ? { frame: 9, sx: 1 + 0.03 * (1 - k), sy: 1 - 0.04 * (1 - k) } : { frame: 8 };
      }
      // Toca o chão já no passo da corrida (pernas abertas) e só amortece de leve;
      // uma pose agachada aqui parecia que ele se abaixava de novo antes de correr
      const k = Math.min(1, boss.modeTime / BOSS_LAND_TIME);
      return { frame: BOSS_WALK[0], sx: 1 + 0.04 * (1 - k), sy: 1 - 0.05 * (1 - k) };
    }
    case 'roar': {
      const pulse = Math.sin(boss.modeTime * 30) * 0.02;
      return { frame: 15, sx: 1 + pulse, sy: 1 + pulse + 0.03 };   // ruge plantado no chão
    }
    case 'hurt':
      return { frame: 14, flash: boss.modeTime < 0.3 && Math.floor(boss.modeTime * 20) % 2 === 0 };
    case 'retreat':
      return walkPose();
    default:
      return null;
  }
}
