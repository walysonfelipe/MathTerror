import {
  FIGHT_OWL, FIGHT_BOSS, FIGHT_BOSS_HIT, FIGHT_BOSS_HIT_FRAME_TIME,
  BOSS_CASTS, BOSS_CAST_FRAME, BOSS_CAST_TIME, BOSS_AFTER_CAST, BOSS_RELEASE,
  BOSS_SLAM, BOSS_SLAM_TIMES, FIGHT_DEATH, FIGHT_DEATH_HIT_AT, FIGHT_DEATH_TRAVEL,
  FIGHT_DEATH_SLAM_AT, BOSS_POWER, BOSS_POWER_FRAME_TIMES, BOSS_POWER_IMPACT_AT,
  BOSS_POWER_DURATION, FIGHT_TURN_TIME, FIGHT_OWL_COMBOS,
} from './runner-fight-assets.js';
import {
  OWL, BOSS, BOSS_FRAME_RECTS, PASS, GRAB, GRAB_OWL_X, PASS_FRAME_TIME, PASS_DRAW_W, PASS_DRAW_H,
  PASS_SCALE, OWL_W, OWL_H, BOSS_H, BOSS_W, GRAB_W, GRAB_H,
} from './runner-assets.js';

// Canvas rendering for runner characters, doors, and fight effects.
export function createRunnerRenderer(helpers) {
  const {
    loadImage, isShowingFightDeath, isSupported, getCurrentDoor,
    getOwlPose, getFightDeathPose, getGrabPose, getBossPose,
    fightOwlPosition, fightOwlMovePose, fightBossX,
  } = helpers;
  let ctx, state, boss, clock, fightStartedAt, fightAction, fightActionAt, fightCounterHit, fightCombo, fightBossAttack, dust, embers, segments, owl, groundY, owlScreenX, viewW, viewH, fightDeathAt, fightDeathOver, fightEffect, cameraLift, doors, hideCheckpointDoor, stateTime, runPhase, runStopped, landingPoseHeld, waitingAfterFight;
  function setScene(scene) { ({ ctx, state, boss, clock, fightStartedAt, fightAction, fightActionAt, fightCounterHit, fightCombo, fightBossAttack, dust, embers, segments, owl, groundY, owlScreenX, viewW, viewH, fightDeathAt, fightDeathOver, fightEffect, cameraLift, doors, hideCheckpointDoor, stateTime, runPhase, runStopped, landingPoseHeld, waitingAfterFight } = scene); }

  function drawEmbers(camera) {
    for (const ember of embers) {
      const x = ember.x - camera;
      if (x < -12 || x > viewW + 12 || ember.life <= 0) continue;
      const flicker = 0.72 + Math.sin(ember.age * 26 + ember.phase) * 0.28;
      const size = ember.size * (0.82 + flicker * 0.18);
      ctx.save();
      ctx.globalAlpha = ember.life * flicker;
      ctx.translate(x, ember.y);
      ctx.rotate(Math.sin(ember.age * 4 + ember.phase) * 0.22);
      ctx.shadowColor = '#ff4b12';
      ctx.shadowBlur = size * 2.4;
      ctx.fillStyle = ember.life > 0.45 ? '#ff6a1b' : '#ffb33b';
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.48, size * 1.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe6a0';
      ctx.beginPath();
      ctx.ellipse(0, size * 0.25, size * 0.16, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

function passFrame(door) {
  if (door.passAt < 0) return PASS.closed;
  const frame = Math.floor((clock - door.passAt) / PASS_FRAME_TIME);
  return frame < PASS.frames ? frame : PASS.open;
}

function isPassing() {
  const door = getCurrentDoor(doors);
  return state === 'resume' && door && door.passAt >= 0;
}

function drawDoors(camera) {
  if (hideCheckpointDoor) return;
  const img = loadImage(PASS.src);
  for (const door of doors) {
    const left = door.x - camera - PASS.doorX * PASS_SCALE;
    if (left > viewW || left + PASS_DRAW_W < 0) continue;
    const frame = passFrame(door);
    // Errou: a porta trancada chacoalha
    const rattle = clock - door.rattleAt < 0.35 ? Math.sin((clock - door.rattleAt) * 70) * 4 * (1 - (clock - door.rattleAt) / 0.35) : 0;
    const sx = (frame % PASS.cols) * PASS.w;
    const sy = Math.floor(frame / PASS.cols) * PASS.h;
    ctx.drawImage(img, sx, sy, PASS.w, PASS.h, left + rattle, groundY + 2 - PASS.ground * PASS_SCALE, PASS_DRAW_W, PASS_DRAW_H);
  }
}


function drawOwl() {
  if (boss.mode === 'grab') return;                  // a coruja está dentro do sprite de captura
  if (isShowingFightDeath()) {
    drawFightDeath();
    return;
  }
  if (state === 'fight') {
    const elapsed = clock - fightStartedAt;
    if (fightAction === 'counter' && clock - fightActionAt >= BOSS_CAST_TIME + BOSS_POWER_FRAME_TIMES.slice(0, 4).reduce((sum, time) => sum + time, 0)) return;
    let frame = 3;
    let x = fightOwlPosition();
    let flip = false;
    let lift = 0;
    const move = fightOwlMovePose();                 // correndo/pulando até o boss ou de volta
    if (elapsed < FIGHT_TURN_TIME) frame = Math.min(3, Math.floor(elapsed * 4));
    else if (move) ({ frame, flip, lift } = move);
    else if (fightAction === 'strike') {
      const combo = FIGHT_OWL_COMBOS[fightCombo % FIGHT_OWL_COMBOS.length];
      frame = combo[Math.min(combo.length - 1, Math.floor((clock - fightActionAt) * 8))];
    } else if (fightAction === 'counter' && fightCounterHit) frame = 14;
    drawFighter(FIGHT_OWL, frame, x, OWL_H / 240, flip, lift);
    return;
  }
  const img = loadImage(OWL.src);

  dust.forEach(d => {
    ctx.fillStyle = `rgba(120, 60, 45, ${d.life * 0.45})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * (1.6 - d.life * 0.6), 0, Math.PI * 2);
    ctx.fill();
  });

  if (isPassing()) return;                           // a coruja está dentro do sprite da porta

  // Sombra no chão (só quando existe chão embaixo)
  if (isSupported(segments, owl.x)) {
    const lift = Math.max(0, groundY - owl.y);
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.15, 0.55 - lift / 500)})`;
    ctx.beginPath();
    ctx.ellipse(owlScreenX, groundY + 2, OWL_W * 0.3 * Math.max(0.5, 1 - lift / 400), 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (clock < owl.invulnerableUntil && Math.floor(clock * 12) % 2 === 0) return;

  const pose = getOwlPose(owl, { state, clock, stateTime, runPhase, runStopped, landingPoseHeld, waitingAfterFight });
  const pivotY = pose.center ? OWL_H / 2 : 0;          // no ar gira pelo meio do corpo
  ctx.save();
  ctx.translate(owlScreenX, owl.y + 2 - pivotY);
  ctx.rotate(pose.rot || 0);
  ctx.scale(pose.sx || 1, pose.sy || 1);
  const drawFrame = (frame, alpha) => {
    ctx.globalAlpha = alpha;
    const sx = (frame % OWL.cols) * OWL.w;
    const sy = Math.floor(frame / OWL.cols) * OWL.h;
    ctx.drawImage(img, sx, sy, OWL.w, OWL.h, -OWL_W / 2, -OWL_H + pivotY - (pose.bob || 0), OWL_W, OWL_H);
  };
  if (pose.blend >= 1) {
    drawFrame(pose.next, 1);
  } else {
    drawFrame(pose.frame, 1);
    if (pose.blend > 0) drawFrame(pose.next, pose.blend);
  }
  ctx.restore();
}


// Derrota na luta ainda em andamento ou já parada atrás do painel de fim de partida.

function drawFightDeath() {
  const elapsed = Math.max(0, clock - fightDeathAt);
  // Enquanto o boss prepara e a esfera voa, a coruja continua em guarda
  if (elapsed < FIGHT_DEATH_HIT_AT) {
    drawFighter(FIGHT_OWL, 3, fightOwlPosition(), OWL_H / 240);
    return;
  }
  const img = loadImage(FIGHT_DEATH.src);
  if (!img.complete || !img.naturalWidth) return;
  const { frame, dx, lift } = getFightDeathPose(elapsed - FIGHT_DEATH_HIT_AT);
  const [sx, sy, sw, sh, anchorX, anchorY] = FIGHT_DEATH.frames[frame];
  const scale = Math.min(FIGHT_DEATH.scale, viewW * 0.38 / FIGHT_DEATH.maxW);
  const x = fightOwlPosition() + dx;

  // Sombra no chão: encolhe no ar e se alonga com a coruja deitada
  ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.15, 0.45 - lift / 200)})`;
  ctx.beginPath();
  ctx.ellipse(x, groundY + 3, (frame >= 6 ? 0.42 : 0.3) * OWL_W * Math.max(0.6, 1 - lift / 120), 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = '#ff3b13';
  ctx.shadowBlur = frame <= 3 ? 22 : 10;
  ctx.drawImage(img, sx, sy, sw, sh, x - anchorX * scale, groundY + 2 - lift - anchorY * scale, sw * scale, sh * scale);
  ctx.restore();
}

// Esfera π voando da mão do boss até o ponto em que ela aparece no primeiro quadro do impacto
// (end: posição e escala da esfera lá). Quadros 0–3 da power-attack, centrados pelo núcleo.
// Desacelera mas não para, emendando com a esfera ainda avançando nos quadros do impacto.
function drawPowerProjectile(travel, end, startScale) {
  const img = loadImage(BOSS_POWER.src);
  if (!img.complete || !img.naturalWidth) return;
  const frame = Math.min(3, Math.floor(travel * 4));
  const [x0, y0, w0, h0] = BOSS_POWER.frames[frame];
  const [coreX0, coreY0] = BOSS_POWER.projectileCore[frame];
  const start = bossReleasePoint();
  const eased = travel * (1.5 - 0.5 * travel);
  const x = start.x + (end.x - start.x) * eased;
  const y = start.y + (end.y - start.y) * eased - Math.sin(travel * Math.PI) * 20;
  const scale = startScale + (end.scale - startScale) * eased;
  ctx.save();
  ctx.shadowColor = '#ff5a08';
  ctx.shadowBlur = 14;
  ctx.drawImage(img, x0, y0, w0, h0, x - coreX0 * scale, y - coreY0 * scale, w0 * scale, h0 * scale);
  ctx.restore();
}

function powerScale() {
  return Math.min(BOSS_POWER.projectileScale, viewW * 0.38 / BOSS_POWER.maxW);
}

function drawFightDeathProjectile() {
  const elapsed = clock - fightDeathAt - BOSS_CAST_TIME;
  if (elapsed < 0 || elapsed >= FIGHT_DEATH_TRAVEL) return;
  const scale = Math.min(FIGHT_DEATH.scale, viewW * 0.38 / FIGHT_DEATH.maxW);
  const ball = FIGHT_DEATH.impactBall;
  drawPowerProjectile(elapsed / FIGHT_DEATH_TRAVEL, {
    x: fightOwlPosition() + ball.dx * scale,
    y: groundY + 2 - ball.dy * scale,
    scale: scale * ball.size,
  }, scale);
}


function drawGrab() {
  const img = loadImage(GRAB.src);
  const pose = getGrabPose(boss.modeTime);
  const left = owlScreenX - GRAB_OWL_X * GRAB_W;
  const top = groundY + 4 - GRAB_H;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(left + GRAB_W * 0.5, groundY + 3, GRAB_W * 0.42, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = '#ff1a0a';
  ctx.shadowBlur = 40;
  const drawFrame = (frame, alpha) => {
    ctx.globalAlpha = alpha;
    const sx = (frame % GRAB.cols) * GRAB.w;
    const sy = Math.floor(frame / GRAB.cols) * GRAB.h;
    ctx.drawImage(img, sx, sy, GRAB.w, GRAB.h, left, top, GRAB_W, GRAB_H);
  };
  drawFrame(pose.frame, 1);
  if (pose.blend > 0) drawFrame(pose.next, pose.blend);
  ctx.restore();
  // Clarão vermelho que esconde a troca dos sprites separados pela captura
  const flash = Math.max(0, 1 - boss.modeTime / 0.3);
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 20, ${flash * 0.55})`;
    ctx.fillRect(-20, -20, viewW + 40, viewH + 40 + cameraLift * 2);
  }
}

// Escala do boss na luta: igual para todas as poses (a mais larga limita em telas estreitas).
function fightBossScale() {
  return Math.min(BOSS_H / 260, viewW * 0.38 / FIGHT_BOSS.maxW);
}

// Pose do boss lançando a esfera: carrega, solta e fica de punhos fechados enquanto ela voa.
function bossCastFrame(cast, elapsed) {
  const index = Math.floor(Math.max(0, elapsed) / BOSS_CAST_FRAME);
  return index < cast.length ? cast[index] : BOSS_AFTER_CAST;
}

// Onde a esfera está na mão do boss no quadro em que ele a solta (coordenadas do mundo).
function bossReleasePoint() {
  const scale = fightBossScale();
  return { x: fightBossX() + BOSS_RELEASE.x * scale, y: groundY + 2 - BOSS_RELEASE.y * scale };
}

function drawBoss() {
  if (isShowingFightDeath()) {
    // Lança a esfera, espera a coruja cair e comemora socando o chão; depois fica em guarda.
    const elapsed = clock - fightDeathAt;
    let frame = bossCastFrame(BOSS_CASTS[0], elapsed);
    const slam = elapsed - FIGHT_DEATH_SLAM_AT;
    if (slam >= 0) {
      let i = 0;
      for (let start = 0; i < BOSS_SLAM.length; i++) {
        start += BOSS_SLAM_TIMES[i];
        if (slam < start) break;
      }
      frame = i < BOSS_SLAM.length ? BOSS_SLAM[i] : 0;
    }
    drawFighter(FIGHT_BOSS, frame, fightBossX(), fightBossScale());
    return;
  }
  if (state === 'fight') {
    if (fightAction === 'strike') {
      const elapsed = clock - fightActionAt;
      const frame = Math.min(FIGHT_BOSS_HIT.frames.length - 1, Math.floor(elapsed / FIGHT_BOSS_HIT_FRAME_TIME));
      drawFighter(FIGHT_BOSS_HIT, frame, fightBossX(), BOSS_H / 260);
      return;
    }
    let frame = 0;
    if (fightAction === 'counter') frame = bossCastFrame(BOSS_CASTS[fightBossAttack], clock - fightActionAt);
    else if (fightAction === 'approach' || fightAction === 'retreat') frame = 3;
    drawFighter(FIGHT_BOSS, frame, fightBossX(), fightBossScale());
    return;
  }
  if (boss.mode === 'grab') {
    drawGrab();
    return;
  }
  const pose = getBossPose(boss, clock);
  if (pose) {
    const img = loadImage(BOSS.src);
    // Sombra: diminui quando ele está no ar
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.15, 0.5 - boss.y / 600)})`;
    ctx.beginPath();
    ctx.ellipse(boss.x, groundY + 3, BOSS_W * 0.32 * Math.max(0.5, 1 - boss.y / 500), 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(boss.x, groundY + 2 - boss.y);
    ctx.scale((pose.sx || 1) * boss.facing, pose.sy || 1);
    ctx.shadowColor = '#ff1a0a';
    ctx.shadowBlur = 18 + boss.progress * 30;
    if (pose.flash) ctx.filter = 'brightness(2.4) saturate(0.4)';
    const drawFrame = (frame, alpha) => {
      ctx.globalAlpha = alpha;
      const [sx, sy, sw, sh] = BOSS_FRAME_RECTS[frame];
      const cellX = (frame % BOSS.cols) * BOSS.w;
      const scaleX = BOSS_W / BOSS.w;
      const scaleY = BOSS_H / BOSS.h;
      const dx = -BOSS_W / 2 + (sx - cellX) * scaleX;
      const dy = -sh * scaleY - (pose.bob || 0);          // o recorte termina nas garras
      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw * scaleX, sh * scaleY);
    };
    drawFrame(pose.frame, 1);
    if (pose.blend > 0) drawFrame(pose.next, pose.blend);
    ctx.restore();
  }
}

function drawFighter(sheet, frame, x, sourceScale, flip = false, lift = 0) {
  const img = loadImage(sheet.src);
  if (!img.complete || !img.naturalWidth) return;
  const [x0, y0, w0, h0, anchorX, anchorY] = sheet.frames[frame];
  // Só a coruja atingida ganha o clarão; no boss o halo maior parecia fazê-lo crescer
  const hit = sheet === FIGHT_OWL && fightEffect === 'owl-hit';
  if (anchorY !== undefined) {
    // Pose com âncoras próprias: tronco em x, garras no chão
    const scale = Math.min(sourceScale, viewW * 0.38 / (sheet.maxW || w0));
    ctx.save();
    ctx.translate(x, groundY + 2 - lift);
    if (flip) ctx.scale(-1, 1);
    ctx.shadowColor = hit ? '#ff3b13' : '#ff1a0a';
    ctx.shadowBlur = hit ? 34 : 16;
    ctx.drawImage(img, x0, y0, w0, h0, -anchorX * scale, -anchorY * scale, w0 * scale, h0 * scale);
    ctx.restore();
    return;
  }
  const pad = 4;
  const sx = Math.max(0, x0 - pad);
  const sy = Math.max(0, y0 - pad);
  const right = Math.min(img.naturalWidth, x0 + w0 + pad);
  const bottom = Math.min(img.naturalHeight, y0 + h0 + pad);
  const sw = right - sx;
  const sh = bottom - sy;
  const scale = Math.min(sourceScale, viewW * 0.38 / sw);
  const w = sw * scale;
  const h = sh * scale;
  ctx.save();
  ctx.translate(x, groundY + 4 - lift);
  if (flip) ctx.scale(-1, 1);
  ctx.shadowColor = hit ? '#ff3b13' : '#ff1a0a';
  ctx.shadowBlur = hit ? 34 : 16;
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h, w, h);
  ctx.restore();
}

function drawBossPowerSequence() {
  if (state === 'death') {
    drawFightDeathProjectile();
    return;
  }
  if (state !== 'fight' || fightAction !== 'counter') return;
  const elapsed = clock - fightActionAt - BOSS_CAST_TIME;   // a esfera só sai quando o boss a solta
  if (elapsed < 0) return;
  let frame = 0;
  let frameStart = 0;
  for (; frame < BOSS_POWER_FRAME_TIMES.length - 1; frame++) {
    const nextStart = frameStart + BOSS_POWER_FRAME_TIMES[frame];
    if (elapsed < nextStart) break;
    frameStart = nextStart;
  }
  if (frame < 4) {
    // Voo: termina onde a esfera está no quadro 4, já encostando na coruja
    const scale = powerScale();
    const ball = BOSS_POWER.impactBall;
    drawPowerProjectile(Math.min(1, elapsed / BOSS_POWER_FRAME_TIMES.slice(0, 4).reduce((sum, time) => sum + time, 0)), {
      x: fightOwlPosition() + ball.dx * scale,
      y: groundY + 4 - ball.dy * scale,
      scale: scale * ball.size,
    }, scale);
    return;
  }
  const [x0, y0, w0, h0, anchorX, anchorY] = BOSS_POWER.frames[frame];
  const img = loadImage(BOSS_POWER.src);
  if (!img.complete || !img.naturalWidth) return;
  const pad = 4;
  const padX = BOSS_POWER.touchingFrames.includes(frame) ? 0 : pad;
  const sx = Math.max(0, x0 - padX);
  const sy = Math.max(0, y0 - pad);
  const right = Math.min(img.naturalWidth, x0 + w0 + padX);
  const bottom = Math.min(img.naturalHeight, y0 + h0 + pad);
  const sw = right - sx;
  const sh = bottom - sy;
  const scale = powerScale();
  const w = sw * scale;
  const h = sh * scale;
  // Nos quadros compostos, ancoramos a coruja no mesmo ponto para evitar saltos
  // causados pelos limites diferentes de cada recorte. A última linha a empurra
  // para trás e para cima, como reação ao impacto, e então mostra a recuperação.
  const recoil = Math.max(0, Math.min(1, (elapsed - BOSS_POWER_IMPACT_AT) / (BOSS_POWER_DURATION - BOSS_POWER_IMPACT_AT)));
  const recoilEase = recoil * recoil * (3 - 2 * recoil);
  const owlX = fightOwlPosition() + recoilEase * 58;
  const knockbackLift = recoilEase * Math.sin(recoil * Math.PI) * 20;
  const left = owlX - (anchorX + x0 - sx) * scale;
  const top = groundY + 4 - (anchorY + y0 - sy) * scale - knockbackLift;

  ctx.save();
  // O brilho acompanha o projétil e o clarão; mantém os sprites da coruja nítidos.
  ctx.shadowColor = '#ff5a08';
  ctx.shadowBlur = frame >= 7 && frame <= 9 ? 14 : 4;
  ctx.drawImage(img, sx, sy, sw, sh, left, top, w, h);
  ctx.restore();
}



  return {
    drawEmbers(scene, camera) { setScene(scene); drawEmbers(camera); },
    drawDoors(scene, camera) { setScene(scene); drawDoors(camera); },
    drawOwl(scene) { setScene(scene); drawOwl(); },
    drawBoss(scene) { setScene(scene); drawBoss(); },
    drawBossPowerSequence(scene) { setScene(scene); drawBossPowerSequence(); },
  };
}
