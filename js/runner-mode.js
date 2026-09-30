// ===================== FUGA INFERNAL =====================
// Estilo "dinossauro do Google": a coruja corre sozinha pelas plataformas de lava
// e o jogador pula os buracos. A cada 20 segundos ela chega num checkpoint, para
// responde questões enquanto o boss vem chegando pela esquerda. Depois de quatro
// erros no checkpoint, a coruja encara o boss em quatro rodadas de contas rápidas.

import { QUIZ } from './quiz-data.js';
import { livesEl, scoreEl, statusBar } from './dom-elements.js';
import { playSfx, setAudioEnabled } from './audio.js';
import { needsRotation, isPhone } from './orientation.js';
import { shuffleInPlace } from './utils.js';
import { resetGame, hideHome } from './game-state.js';
import { resetLives } from './hud.js';
import { buildQuestionDeck, makeFightProblem } from './runner-quiz.js';
import { createSegment, generateLeg, passOwlX, currentDoor as getCurrentDoor, supportUnder as isSupported } from './runner-world.js';
import { drawLegProgress, drawFightIntro, updateRunnerHud, renderRunnerGameOver, renderCheckpointQuestion, renderFightQuestion as renderFightQuestionPanel, updateThreatLabel } from './runner-ui.js';
import { playFallSfx, stopFallSfx, playJumpSfx, playDoorSfx, updatePulse, resetPulse } from './runner-audio.js';
import { createBossController, getBossPose } from './runner-boss.js';
import { getOwlPose, getFightDeathPose, getGrabPose, getGrabFrameStart as grabFrameStart } from './runner-animations.js';
import { updateOwlPhysics } from './runner-physics.js';
import { createRunnerInput } from './runner-input.js';
import { createRunnerRenderer } from './runner-renderer.js';

import { LIVES, LEG_SECONDS, QUESTION_SECONDS, BOSS_APPEAR_AT, WRONG_PENALTY, MAX_ERRORS, MIN_RETRY_SECONDS, SPEED_START, SPEED_GAIN, JUMP_VELOCITY } from './runner-config.js';
import { FIGHT_OWL, FIGHT_BOSS, FIGHT_BOSS_HIT, FIGHT_BOSS_HIT_DURATION, BOSS_CASTS, BOSS_CAST_TIME, BOSS_SLAM_HIT, FIGHT_DEATH, FIGHT_DEATH_IMPACT_AT, FIGHT_DEATH_LANDED_AT, FIGHT_DEATH_SLAM_AT, FIGHT_DEATH_DURATION, BOSS_POWER, BOSS_POWER_IMPACT_AT, BOSS_POWER_DURATION, FIGHT_TURN_TIME, FIGHT_INTRO, FIGHT_INTRO_DURATION } from './runner-fight-assets.js';
import { OWL, RUN_FRAMES, GROUND, BOSS, PASS, PASS_DOOR_FRAME, GRAB, TILE_W, TILE_H, TILE_STEP, SURFACE, OWL_H, OWL_W, PASS_DRAW_W, CELEBRATE_TIME, PASS_FRAME_TIME, PASS_TIME, BOSS_H, STRIDE } from './runner-assets.js';

const images = {};
function loadImage(src) {
  if (!images[src]) {
    images[src] = new Image();
    images[src].src = src;
  }
  return images[src];
}

// ===================== ESTADO =====================
let root, canvas, ctx, panel, hint;
let raf = 0;
let lastTime = 0;
let active = false;
let k = 1, viewW = 0, viewH = 0, groundY = 0, owlScreenX = 0;

let state = 'run';        // run | checkpoint | resume | caught | over
let lives = LIVES;
let score = 0;
let speed = SPEED_START;
let segments = [];        // plataformas: { x, w, tiles: [índices] }
let markerX = 0;          // posição do próximo checkpoint
let doors = [];           // portas no mundo: { x (centro), passAt, rattleAt }
let legStartX = 0;

const owl = { x: 0, y: 0, vy: 0, grounded: true, landedAt: -1, jumpedAt: -1, crouchAt: -1, bufferedAt: -1, jumping: false, invulnerableUntil: 0 };
// progress: ameaça de 0 (longe) a 1 (pegou). x/y em coordenadas de tela, y = altura acima do chão.
const boss = { progress: 0, mode: 'hidden', modeTime: 0, x: 0, y: 0, vx: 0, vy: 0, facing: 1, walking: false, phase: 0, landedAt: -1, onLand: null };
let clock = 0;            // tempo total do modo, em segundos
let stateTime = 0;        // tempo no estado atual
let shake = 0;
let embers = [];
let dust = [];

let deck = [];
let deckIndex = 0;
let answering = false;
let errors = 0;           // erros na questão atual
let runPhase = 0;         // posição no ciclo de corrida, em quadros
let fightRound = 0;
let fightProblems = [];
let fightResults = [];
let fightEffect = '';
let fightEffectAt = 0;
let fightStartedAt = 0;
let fightIntro = false;
let fightAction = 'idle';
let fightActionAt = 0;
let fightCounterHit = false;
let fightStrikeSoundPlayed = false;
let fightCombo = 0;
let fightBossAttack = 0;
let fightDeathAt = 0;
let fightDeathReason = '';
let fightDeathConsumesLife = false;
let fightDeathImpactApplied = false;
let fightDeathOver = false;  // fim de partida veio da luta: a cena da derrota continua na tela
let hideCheckpointDoor = false;
let cameraZoom = 1;
let cameraLift = 0;         // sobe a cena da luta para o chão ficar acima do painel de respostas
let fallSounded = false;     // o assobio já tocou nesta queda

const { onKeyDown, onPointerDown, onPanelClick, pollGamepadInput } = createRunnerInput({
  isActive: () => active,
  getState: () => state,
  getCanvas: () => canvas,
  getPanel: () => panel,
  getHint: () => hint,
  getFallbackJumpHint: () => isPhone() ? 'TOQUE NA TELA PARA PULAR' : 'ESPAÇO, ↑ ou toque para pular · ESC para sair',
  jump,
  resetGame,
});

const renderer = createRunnerRenderer({
  loadImage,
  isShowingFightDeath: showingFightDeath,
  isSupported: worldX => isSupported(segments, worldX),
  getCurrentDoor,
  getOwlPose,
  getFightDeathPose,
  getGrabPose,
  getBossPose,
  fightOwlPosition: () => fightOwlPosition(),
  runFrame: () => runFrame(),
});

const {
  bossCatchX, bossTargetX, setBossMode, bossPace, bossEnter, bossLeap, updateBoss,
} = createBossController({
  boss,
  getState: () => state,
  getErrors: () => errors,
  setLives: value => { lives = value; },
  getOwlScreenX: () => owlScreenX,
  setShake: value => { shake = value; },
  raiseShake: value => { shake = Math.max(shake, value); },
  updateStatusBar,
  playSfx,
  gameOver,
  grabFrameStart,
  startGrab,
});

// ===================== MUNDO =====================
// Monta a próxima etapa: plataformas com buracos durante LEG_SECONDS de corrida,
// terminando numa plataforma longa com o checkpoint.
function buildLeg(fromX, startX) {
  legStartX = startX;
  const leg = generateLeg(fromX, startX, speed);
  segments.push(...leg.segments);
  markerX = leg.markerX;
  doors.push(leg.door);
}

// ===================== ENTRADA =====================
// Apertar pulo começa a agachada (quadro 12); a coruja sai do chão logo depois.
function jump() {
  if (state !== 'run') return;
  hint?.classList.add('is-hidden');
  if (!owl.grounded) {
    owl.bufferedAt = clock;
    return;
  }
  if (owl.crouchAt < 0) owl.crouchAt = clock;
}

function launch() {
  owl.crouchAt = -1;
  owl.vy = JUMP_VELOCITY;
  owl.grounded = false;
  owl.jumpedAt = clock;
  owl.jumping = true;
  kickDust(6, -1);
  playJumpSfx();
}

function kickDust(count, direction) {
  for (let i = 0; i < count; i++) {
    dust.push({
      x: owlScreenX + (Math.random() - 0.5) * OWL_W * 0.4,
      y: groundY - 4,
      vx: direction * (40 + Math.random() * 120),
      vy: -30 - Math.random() * 60,
      r: 6 + Math.random() * 8,
      life: 1,
    });
  }
}


function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  k = Math.max(0.45, Math.min(1.1, w / 1300, h / 760));
  viewW = w / k;
  viewH = h / k;
  groundY = viewH * 0.74;
  owlScreenX = Math.max(OWL_W, viewW * 0.3);
  ctx.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
  if (owl.grounded) owl.y = groundY;
  ctx.imageSmoothingQuality = 'high';
}

// ===================== LOOP =====================
function frame(now) {
  if (!active) return;
  const dt = Math.min(0.05, (now - lastTime) / 1000 || 0);
  lastTime = now;
  // Celular em pé ou algum popup aberto: congela a corrida
  if (needsRotation() || document.querySelector('.modal-backdrop:not([hidden])')) {
    raf = requestAnimationFrame(frame);
    return;
  }
  pollGamepadInput(now);
  clock += dt;
  stateTime += dt;
  update(dt);
  draw();
  raf = requestAnimationFrame(frame);
}

// Quanto subir a cena para os pés da luta ficarem visíveis acima do painel de respostas.
function fightLift() {
  if (state !== 'fight' || panel.hidden) return 0;
  const panelTop = panel.getBoundingClientRect().top / k;
  const groundOnScreen = viewH / 2 + (groundY + 6 - viewH / 2) * cameraZoom;
  return Math.max(0, groundOnScreen - (panelTop - 8));
}

function setState(next) {
  state = next;
  stateTime = 0;
}

function update(dt) {
  shake = Math.max(0, shake - dt * 2.5);
  const targetZoom = state === 'fight' || showingFightDeath() ? 1.2 : 1;
  cameraZoom += (targetZoom - cameraZoom) * (1 - Math.exp(-dt * 4.5));
  cameraLift += (fightLift() - cameraLift) * (1 - Math.exp(-dt * 6));

  if (state === 'run') {
    const before = owl.x;
    owl.x = Math.min(owl.x + speed * dt, markerX);
    if (owl.grounded) runPhase = (runPhase + (owl.x - before) / STRIDE) % RUN_FRAMES.length;
    if (owl.x >= markerX && owl.grounded) enterCheckpoint();
  }

  // A física vertical pode rodar em qualquer estado do modo.
  updateOwlPhysics(dt, {
    owl, state, clock, groundY, viewH,
    isSupported: worldX => isSupported(segments, worldX),
    launch, kickDust,
    getRunPhase: () => runPhase,
    setRunPhase: value => { runPhase = value; },
    getFallSounded: () => fallSounded,
    setFallSounded: value => { fallSounded = value; },
    playFallSfx, lives, fellInPit,
  });

  updateBoss(dt);

  if (state === 'fight') {
    updatePulse(boss.progress);
    if (fightEffect && clock - fightEffectAt > 0.55) fightEffect = '';
    updateFightAction();
  } else if (state === 'death' && clock - fightDeathAt >= FIGHT_DEATH_DURATION) {
    gameOver(fightDeathReason);
  } else if (state === 'death' && !fightDeathImpactApplied && clock - fightDeathAt >= FIGHT_DEATH_IMPACT_AT) {
    // A esfera explode na coruja: o golpe final sempre treme e soa; só tira vida se ainda houver
    fightDeathImpactApplied = true;
    if (fightDeathConsumesLife) {
      lives--;
      updateStatusBar();
    }
    shake = 0.8;
    playSfx('impact');
  } else if (state === 'death' && clock - fightDeathAt >= FIGHT_DEATH_LANDED_AT && clock - fightDeathAt - dt < FIGHT_DEATH_LANDED_AT) {
    shake = Math.max(shake, 0.35);                 // o corpo bate no chão
  } else if (state === 'death' && clock - fightDeathAt >= FIGHT_DEATH_SLAM_AT + BOSS_SLAM_HIT && clock - fightDeathAt - dt < FIGHT_DEATH_SLAM_AT + BOSS_SLAM_HIT) {
    shake = Math.max(shake, 0.9);                  // o boss soca o chão comemorando
    playSfx('punch');
  }

  if (state === 'checkpoint' && !answering) {
    // A barra enche desde o início (mais rápido a cada erro); o boss só entra aos 70%
    boss.progress = Math.min(1, boss.progress + dt * bossPace() / QUESTION_SECONDS);
    if (boss.mode === 'hidden' && boss.progress >= BOSS_APPEAR_AT) {
      bossEnter();
      updateThreatLabel(panel, boss.mode, errors, bossPace());
    }
    updatePulse(boss.progress);                                   // batimento cresce desde o começo da pergunta
    const meter = panel.querySelector('progress');
    if (meter) meter.value = boss.progress;
    // Em telas de toque, a pergunta some quando já não há tempo útil para responder.
    panel.classList.toggle('is-near-catch', isPhone() && boss.progress >= 0.98);
    // Quando o cronômetro acaba, a luta é sempre a última chance, mesmo com menos
    // de três erros no checkpoint. A captura só acontece se perder a luta.
    if (boss.progress >= 1) beginFight();
  } else if (state === 'resume') {
    // Acertou: comemora e depois o sprite da porta mostra a coruja passando por ela
    const door = getCurrentDoor(doors);
    if (stateTime >= CELEBRATE_TIME && door.passAt < 0) door.passAt = clock;
    if (door.passAt >= 0) {
      const t = clock - door.passAt;
      if (t >= PASS_DOOR_FRAME * PASS_FRAME_TIME && t - dt < PASS_DOOR_FRAME * PASS_FRAME_TIME) playDoorSfx();
      owl.x = passOwlX(door, t);                     // a câmera acompanha a coruja do sprite
      if (t >= PASS_TIME) {
        // Sai correndo exatamente de onde a coruja do último quadro ficou
        runPhase = 0;
        setState('run');
        speed *= SPEED_GAIN;
        const lastSeg = segments[segments.length - 1];
        buildLeg(lastSeg.x + lastSeg.w, owl.x);
      }
    }
  }

  // Remove plataformas que já saíram da tela
  const camera = owl.x - owlScreenX;
  segments = segments.filter(seg => seg.x + seg.w > camera - TILE_W);
  doors = doors.filter((door, i) => i === doors.length - 1 || door.x + PASS_DRAW_W > camera - 50);

  // As brasas sobem do fundo da tela em toda a largura. Sob uma plataforma elas
  // se apagam antes de alcançar a base do chão; nos vãos sobem livres sobre a lava.
  const floorY = viewH + cameraLift;
  const groundBottom = groundY - SURFACE + TILE_H;
  const underGround = x => segments.some(seg => x > seg.x && x < seg.x + seg.w);
  const EMBER_RATE = 45;     // brasas por segundo
  const spawnCount = Math.floor(EMBER_RATE * dt + Math.random());
  for (let n = 0; n < spawnCount; n++) {
    const duration = 3 + Math.random() * 1.4;
    embers.push({
      x: camera + Math.random() * viewW,
      y: floorY + Math.random() * 20,
      vx: (Math.random() - 0.5) * 18,
      vy: 40 + Math.random() * 55,
      size: 2 + Math.random() * 3.5,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      duration,
      life: 1,
    });
  }
  const FADE = 36;
  embers.forEach(e => {
    e.age += dt;
    e.y -= e.vy * dt;
    e.x += (e.vx + Math.sin(e.age * 5 + e.phase) * 7) * dt;
    e.life = Math.max(0, 1 - e.age / e.duration);
    if (underGround(e.x)) {
      const gap = e.y - groundBottom;
      e.life = gap <= 0 ? 0 : Math.min(e.life, gap / FADE);
    }
  });
  embers = embers.filter(e => e.life > 0);

  dust.forEach(d => { d.x += (d.vx - (state === 'run' ? speed : 0)) * dt; d.y += d.vy * dt; d.vy += 60 * dt; d.life -= dt * 2.2; });
  dust = dust.filter(d => d.life > 0);
}

function fellInPit() {
  lives--;
  updateStatusBar();
  shake = 1;
  if (lives <= 0) {
    gameOver('A coruja caiu na lava.');
    return;
  }
  // Renasce caindo do céu na próxima plataforma segura. O assobio da queda para aqui.
  stopFallSfx();
  const next = segments.find(seg => seg.x + seg.w > owl.x + OWL_W) || segments[segments.length - 1];
  owl.x = Math.min(markerX, Math.max(owl.x, next.x + TILE_W * 0.6));
  owl.y = -OWL_H;
  owl.vy = 0;
  owl.grounded = false;
  owl.crouchAt = -1;
  owl.jumping = false;
  owl.invulnerableUntil = clock + 1.5;
  fallSounded = false;
}

// ===================== DESENHO =====================
function getRendererState() {
  return { ctx, state, boss, clock, fightStartedAt, fightAction, fightActionAt, fightCounterHit,
    fightCombo, fightBossAttack, dust, embers, segments, owl, groundY, owlScreenX, viewW, viewH,
    fightDeathAt, fightDeathOver, fightEffect, cameraLift, doors, hideCheckpointDoor, stateTime, runPhase };
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 12 * shake);
  if (cameraLift > 0.5) ctx.translate(0, -cameraLift);
  if (Math.abs(cameraZoom - 1) > 0.001) {
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-viewW / 2, -viewH / 2);
  }

  // Céu escuro por cima do vídeo de fundo
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, '#05060899');
  sky.addColorStop(0.7, '#1a050588');
  sky.addColorStop(1, '#4a0a06dd');
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, viewW + 40, viewH + 40 + cameraLift * 2);

  const camera = owl.x - owlScreenX;
  const scene = getRendererState();
  renderer.drawEmbers(scene, camera);
  const groundImg = loadImage(GROUND.src);
  const tileY = groundY - SURFACE;
  for (const seg of segments) {
    if (seg.x - camera > viewW || seg.x + seg.w - camera < -TILE_W) continue;
    seg.tiles.forEach((tile, i) => {
      const sx = (tile % GROUND.cols) * GROUND.w;
      const sy = Math.floor(tile / GROUND.cols) * GROUND.h;
      ctx.drawImage(groundImg, sx, sy, GROUND.w, GROUND.h, seg.x - camera + i * TILE_STEP, tileY, TILE_W, TILE_H);
    });
  }

  renderer.drawDoors(scene, camera);
  renderer.drawOwl(scene);
  renderer.drawBoss(scene);
  renderer.drawBossPowerSequence(scene);
  drawLegProgress(ctx, { state, owlX: owl.x, legStartX, markerX, viewW, viewH });
  ctx.restore();
  drawFightIntro(ctx, loadImage, { state, fightIntro, clock, fightStartedAt, viewW, viewH });
}

// Fechada até o acerto · quadros da passagem (coruja incluída) · aberta depois.

function beginFightDeath(reason, consumesLife = false) {
  fightDeathReason = reason;
  fightDeathAt = clock;
  fightDeathConsumesLife = consumesLife;
  fightDeathImpactApplied = false;
  fightEffect = '';
  fightIntro = false;
  fightAction = 'idle';
  panel.hidden = true;
  setState('death');
}

function showingFightDeath() {
  return state === 'death' || (state === 'over' && fightDeathOver);
}

// ===================== BOSS / DESENHO =====================

// ===================== CHECKPOINT / PERGUNTA =====================
function buildDeck() {
  deck = buildQuestionDeck(QUIZ);
  deckIndex = 0;
}

function enterCheckpoint() {
  setState('checkpoint');
  hideCheckpointDoor = false;
  setBossMode('hidden');
  boss.progress = 0;
  errors = 0;
  answering = false;
  if (deckIndex >= deck.length) buildDeck();
  renderQuestion(deck[deckIndex++]);
}


function beginFight() {
  setState('fight');
  fightStartedAt = clock;
  fightAction = 'idle';
  fightActionAt = clock;
  fightCounterHit = false;
  hideCheckpointDoor = true;
  answering = false;
  fightRound = 0;
  fightProblems = [];
  fightResults = [];
  const operations = shuffleInPlace(['+', '−', '×', '÷']);
  for (const operation of operations) fightProblems.push(makeFightProblem(operation));
  boss.progress = 1;
  boss.facing = 1;
  setBossMode('fight');
  fightEffect = '';
  updatePulse(boss.progress);
  // A pergunta só aparece depois do letreiro; o giro da coruja acontece por baixo dele.
  fightIntro = true;
  panel.hidden = true;
  panel.innerHTML = '';
  playSfx('fight');
}

function fightOwlPosition() {
  const start = viewW * 0.75;
  const target = viewW * 0.25 + BOSS_H * 0.9;
  const elapsed = clock - fightActionAt;
  if (fightAction === 'approach') {
    const p = Math.min(1, elapsed / 0.56);
    return start + (target - start) * (1 - (1 - p) ** 3);
  }
  if (fightAction === 'strike') return target;
  if (fightAction === 'retreat') {
    const p = Math.min(1, elapsed / 0.58);
    const eased = p * p * (3 - 2 * p);
    return target + (start - target) * eased;
  }
  return start;
}

function runFrame() {
  return [13, 12][Math.floor((clock - fightActionAt) * 12) % 2];
}

function updateFightAction() {
  if (fightIntro) {
    if (clock - fightStartedAt >= FIGHT_INTRO_DURATION) {
      fightIntro = false;
      renderFightQuestion();
    }
    return;
  }
  const elapsed = clock - fightActionAt;
  if (fightAction === 'strike' && !fightStrikeSoundPlayed && elapsed >= FIGHT_BOSS_HIT_DURATION * 4 / FIGHT_BOSS_HIT.frames.length) {
    fightStrikeSoundPlayed = true;
    playSfx('punch');
  }
  if (fightAction === 'approach' && elapsed >= 0.56) {
    fightAction = 'strike';
    fightActionAt = clock;
  } else if (fightAction === 'strike' && elapsed >= FIGHT_BOSS_HIT_DURATION) {
    fightAction = 'retreat';
    fightActionAt = clock;
  } else if (fightAction === 'retreat' && elapsed >= 0.58) {
    completeFightRound();
  } else if (fightAction === 'counter') {
    if (!fightCounterHit && elapsed >= BOSS_CAST_TIME + BOSS_POWER_IMPACT_AT) {
      fightCounterHit = true;
      playSfx('impact');
      fightEffect = 'owl-hit';
      fightEffectAt = clock;
      lives--;
      shake = 0.8;
      updateStatusBar();
      const feedback = panel.querySelector('.answer-feedback');
      if (feedback) feedback.textContent = 'O poder do boss atingiu a coruja!';
    }
    if (elapsed >= BOSS_CAST_TIME + BOSS_POWER_DURATION) completeFightRound();
  }
}

function completeFightRound() {
  fightRound++;
  if (fightRound >= 4) {
    finishFight();
    return;
  }
  fightAction = 'idle';
  fightActionAt = clock;
  fightCounterHit = false;
  answering = false;
  fightEffect = '';
  renderFightQuestion();
}

function renderFightQuestion(feedbackText = '') {
  const problem = fightProblems[fightRound];
  renderFightQuestionPanel(panel, problem, fightRound, clock - fightStartedAt, FIGHT_TURN_TIME,
    answerFight, () => state === 'fight' && fightRound === 0, isPhone(), feedbackText);
}

function answerFight(correct) {
  if (state !== 'fight' || answering) return;
  answering = true;
  panel.querySelectorAll('button').forEach(button => { button.disabled = true; });
  fightEffect = correct ? 'boss-hit' : 'owl-hit';
  fightEffectAt = clock;
  const feedback = panel.querySelector('.answer-feedback');
  if (correct) {
    fightCombo = fightResults.filter(Boolean).length;
    score++;
    fightResults.push(true);
    feedback.textContent = 'Acertou! A coruja corre para atacar!';
    fightAction = 'approach';
    fightActionAt = clock;
    fightStrikeSoundPlayed = false;
    playSfx('whoosh');
  } else {
    fightResults.push(false);
    fightBossAttack = fightRound % BOSS_CASTS.length;
    feedback.textContent = 'O boss prepara seu poder!';
    fightAction = 'counter';
    fightActionAt = clock;
    fightCounterHit = false;
    playSfx('spell');
  }
  updateStatusBar();
  if (!correct && lives === 1) beginFightDeath('O boss venceu a luta.', true);
}

function finishFight() {
  const hits = fightResults.filter(Boolean).length;
  if (hits < 2 || lives <= 0) {
    playSfx('spell');
    beginFightDeath('O boss venceu a luta.');
    return;
  }
  panel.hidden = true;
  resetPulse();
  hideCheckpointDoor = false;
  setBossMode('retreat');
  boss.facing = -1;
  boss.walking = true;
  fightResults = [];
  setState('resume');
}

function renderQuestion(node) {
  renderCheckpointQuestion(panel, node, answer, isPhone());
}

function answer(correct, button) {
  if (state !== 'checkpoint' || answering) return;
  const feedback = panel.querySelector('.answer-feedback');
  if (correct) {
    answering = true;
    score++;
    updateStatusBar();
    resetPulse();
    panel.querySelectorAll('button').forEach(b => b.disabled = true);
    feedback.textContent = 'Acertou! O boss recuou.';
    setBossMode('hurt');
    Object.assign(boss, { walking: false, y: 0, vy: 0, onLand: null });
    boss.progress = 0;
    setTimeout(() => {
      if (!active) return;
      panel.hidden = true;
      setState('resume');
    }, 700);
  } else {
    button.disabled = true;
    feedback.textContent = 'Errou! O boss avançou.';
    errors++;
    updateThreatLabel(panel, boss.mode, errors, bossPace());
    updateStatusBar();                                // coração da vez esvazia mais um pouco
    getCurrentDoor(doors).rattleAt = clock;
    if (errors >= MAX_ERRORS) {
      beginFight();
      return;
    }
    // O boss avança, mas sempre sobra tempo para a próxima tentativa no ritmo atual
    const maxProgress = 1 - MIN_RETRY_SECONDS * bossPace() / QUESTION_SECONDS;
    boss.progress = Math.max(boss.progress, Math.min(maxProgress, boss.progress + WRONG_PENALTY));
    if (boss.mode === 'hidden' && boss.progress >= BOSS_APPEAR_AT) bossEnter();
    else if (boss.mode === 'stalk') bossLeap(bossTargetX());   // salta para frente e ruge
  }
}

function caught() {
  if (state === 'caught') return;
  setState('caught');
  panel.hidden = true;
  resetPulse();
  // Chega colado na coruja (salto se ainda estiver longe) e começa a captura
  boss.progress = 1;
  if (boss.mode === 'hidden') bossEnter();
  if (Math.abs(boss.x - bossCatchX()) > 20 || boss.y > 0) bossLeap(bossCatchX(), startGrab);
  else startGrab();
}

function startGrab() {
  boss.x = bossCatchX();
  boss.y = 0;
  setBossMode('grab');
  shake = 1.2;
}

// ===================== HUD =====================
function updateStatusBar() {
  updateRunnerHud({ statusBar, livesEl, scoreEl, lives, maxLives: LIVES, score, state, answering, errors });
}

// ===================== FIM DE PARTIDA =====================
// Painel (gameover-panel.webp), botões (gameover-buttons.webp) e números (digits-sheet.webp)
// vêm de fimdepartidaHUd.png, botoesHudFimDepartida.png e numeros.png.

function gameOver(reason) {
  if (!active || state === 'over') return;
  fightDeathOver = state === 'death';
  setState('over');
  resetPulse();
  renderRunnerGameOver(panel, reason, score, () => {
    resetGame();
    hideHome();
    startRunnerMode();
  }, resetGame, isPhone());
}

// ===================== INÍCIO / PARADA =====================
// Chamado pelo resetGame para não deixar loop, eventos nem canvas para trás.
export function stopRunnerMode() {
  if (!active && !root) return;
  active = false;
  cancelAnimationFrame(raf);
  resetPulse();
  stopFallSfx();
  fallSounded = false;
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('resize', resize);
  root?.remove();
  root = null;
  if (statusBar) statusBar.hidden = true;
}

// Sempre chamado de um clique (Iniciar / Tentar novamente): liga todo o áudio no gesto.
export function startRunnerMode() {
  stopRunnerMode();
  setAudioEnabled(true);
  [OWL.src, GROUND.src, BOSS.src, PASS.src, GRAB.src, FIGHT_OWL.src, FIGHT_BOSS.src, FIGHT_BOSS_HIT.src, BOSS_POWER.src, FIGHT_DEATH.src, FIGHT_INTRO.src].forEach(loadImage);

  root = document.createElement('div');
  root.className = 'runner';
  root.innerHTML = `
    <canvas class="runner-canvas" aria-label="Coruja correndo pelas plataformas"></canvas>
    <p class="runner-hint">${isPhone() ? 'TOQUE NA TELA PARA PULAR' : 'ESPAÇO, ↑ ou toque para pular · ESC para sair'}</p>
    <section class="runner-question" hidden></section>`;
  document.body.appendChild(root);
  canvas = root.querySelector('canvas');
  ctx = canvas.getContext('2d');
  panel = root.querySelector('.runner-question');
  hint = root.querySelector('.runner-hint');
  panel.addEventListener('click', onPanelClick, true);
  canvas.addEventListener('pointerdown', onPointerDown);
  // Toques rápidos no canvas não podem virar seleção/zoom do navegador (Safari)
  canvas.addEventListener('touchstart', event => event.preventDefault(), { passive: false });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', resize);
  resize();

  lives = LIVES;
  score = 0;
  speed = SPEED_START;
  clock = 0;
  shake = 0;
  cameraZoom = 1;
  cameraLift = 0;
  hideCheckpointDoor = false;
  fightAction = 'idle';
  fightIntro = false;
  fightCounterHit = false;
  fightDeathOver = false;
  embers = [];
  boss.progress = 0;
  setBossMode('hidden');
  buildDeck();

  // Chão inicial sem buracos cobrindo a tela toda
  segments = [];
  const first = createSegment(-owlScreenX - TILE_W, Math.ceil((viewW + TILE_W * 2) / TILE_STEP));
  segments.push(first);
  Object.assign(owl, { x: 0, y: groundY, vy: 0, grounded: true, landedAt: -1, jumpedAt: -1, crouchAt: -1, bufferedAt: -1, jumping: false, invulnerableUntil: 0 });
  doors = [];
  dust = [];
  runPhase = 0;
  buildLeg(first.x + first.w, owl.x);
  setState('run');

  resetLives(livesEl);
  updateStatusBar();
  active = true;
  lastTime = performance.now();
  raf = requestAnimationFrame(frame);
}
