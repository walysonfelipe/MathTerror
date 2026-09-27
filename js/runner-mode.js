// ===================== FUGA INFERNAL =====================
// Estilo "dinossauro do Google": a coruja corre sozinha pelas plataformas de lava
// e o jogador pula os buracos. A cada 20 segundos ela chega num checkpoint, para
// e precisa responder uma questão enquanto o boss vem chegando pela esquerda.
// Acertou: o boss recua e a corrida continua. Demorou demais: o boss pega a coruja.

import { QUIZ } from './quiz-data.js';
import { livesEl, scoreEl, statusBar } from './dom-elements.js';
import { playSfx, setAudioEnabled } from './audio.js';
import { needsRotation, isPhone } from './orientation.js';
import { shuffleInPlace, cloneWithShuffledOptions, letterForIndex, isABCDLabel } from './utils.js';
import { resetGame, hideHome } from './game-state.js';
import { renderLives, renderScore, resetLives } from './hud.js';

// ===================== CONFIGURAÇÕES DO MODO =====================
const LIVES = 3;
const LEG_SECONDS = 20;          // tempo correndo até o próximo checkpoint
const QUESTION_SECONDS = 30;     // tempo da barra encher (boss pega a coruja), sem erros
const BOSS_APPEAR_AT = 0.7;      // o boss só entra na tela quando a barra passa de 70%
const ERROR_SPEEDUP = 0.75;      // cada erro deixa o boss 75% mais rápido nesta questão
const WRONG_PENALTY = 0.1;       // saltinho para frente a cada erro (0–1)
const SPEED_START = 330;         // unidades/segundo
const SPEED_GAIN = 1.08;         // aumento de velocidade a cada checkpoint
const GRAVITY = 2600;
const JUMP_VELOCITY = -1080;

// ===================== SPRITES =====================
// owl-sheet.webp: grade 4x4 de 312x270, de perfil olhando para a direita.
// Quadros alinhados pelos pés (base) e pelo centro do corpo (horizontal).
// Linha 1: 0 parada · 1 piscando · 2 olho fechado · 3 passada
// Linhas 2–3: corrida, 3 quadros por passo (passada → apoio → impulso), trocando de pé
// Linha 4: pulo — 12 agacha · 13 decola · 14 no ar (asas abertas) · 15 aterrissa
const OWL = { src: 'assets/images/owl-sheet.webp', w: 312, h: 270, cols: 4 };
const OWL_ANIMS = {
  idle: { frames: [0, 0, 0, 0, 0, 1, 2, 1, 0, 0], fps: 6 },  // parada, piscando
};
// Corrida controlada pela distância percorrida, não pelo relógio.
// Passo 1: 3 → 4 → 5 · passo 2: 6 → 7 → 8 · passo 3: 9 → 10 → 11
const RUN_FRAMES = [3, 4, 5, 6, 7, 8, 9, 10, 11];
const RUN_STEP = 3;                  // quadros por passo
// ground-sheet.webp: grade 3x4 de 244x108, alinhados pelo topo da plataforma.
const GROUND = { src: 'assets/images/ground-sheet.webp', w: 244, h: 108, cols: 3, count: 12 };
// boss-sheet.webp: grade 4x4 de 258x235, pés no chão e bico alinhado. Olha para a direita.
// Linha 1: parado/piscando · Linha 2: andando · Linha 3: salto (8 prepara, 9 decola,
// 10 no ar, 11 aterrissa) · Linha 4: 12 e 15 guarda, 13 rugido, 14 levou o golpe.
const BOSS = { src: 'assets/images/boss-sheet.webp', w: 258, h: 235, cols: 4 };
const BOSS_ANIMS = {
  idle: { frames: [0, 0, 1, 0, 3, 0, 0, 2, 0, 1], fps: 5 },
  guard: { frames: [12, 12, 15, 12, 12, 15], fps: 3 },   // já perto: posição de luta
};
const BOSS_WALK = [4, 5, 6, 7];
// door-sheet.webp: 4 modelos de porta (linhas) × 4 quadros (fechada → aberta), 217x214.
// A pedra fica no mesmo lugar em todos os quadros da linha; só a porta se mexe.
const DOOR = { src: 'assets/images/door-sheet.webp', w: 217, h: 214, cols: 4, models: 4 };
const DOOR_CENTER = [0.41, 0.44, 0.43, 0.42];   // centro da passagem de cada modelo (fração da largura)
// grab-sheet.webp: captura, boss e coruja juntos. Grade 4x3 de 296x297, boss firme no chão.
// Linha 1 (0–3): estica o braço · Linha 2 (4–7): agarra e puxa · Linha 3 (8–11): ergue a coruja rugindo.
const GRAB = { src: 'assets/images/grab-sheet.webp', w: 296, h: 297, cols: 4 };
const GRAB_OWL_X = 0.841;   // centro da coruja no quadro 0 (fração da largura)
const GRAB_BOSS_X = 0.38;   // centro do boss no quadro 0
// Passa por todos os quadros em ordem: linha 1 (1–4), linha 2 (5–8), linha 3 (9–12).
const GRAB_FRAME_TIME = 0.28;          // tempo de cada quadro
const GRAB_FRAMES = 12;
const GRAB_END = GRAB_FRAME_TIME * GRAB_FRAMES;
const GRAB_GAME_OVER = GRAB_END + 0.7; // fim de jogo só depois do último quadro

// Tamanhos no "mundo" (unidades). O canvas escala tudo para caber na tela.
const TILE_W = 240;
const TILE_H = TILE_W * GROUND.h / GROUND.w;
const TILE_STEP = TILE_W * 0.94;     // leve sobreposição para esconder as bordas
const SURFACE = TILE_H * 0.14;       // distância do topo do sprite até o chão pisável
const OWL_H = 150;
const OWL_W = OWL_H * OWL.w / OWL.h;
const FOOT = OWL_W * 0.16;           // meia largura dos pés para colisão
const DOOR_H = OWL_H * 2.2;
const DOOR_W = DOOR_H * DOOR.w / DOOR.h;
const DOOR_OPEN_TIME = 0.6;          // porta abrindo (4 quadros)
// Sequência depois do acerto (segundos desde o acerto):
const CELEBRATE_TIME = 0.45;         // coruja comemora
const ENTER_START = CELEBRATE_TIME + DOOR_OPEN_TIME;
const ENTER_TIME = 0.8;              // coruja anda para dentro da porta
const EXIT_FADE = 0.4;               // coruja reaparece do outro lado
const BOSS_H = OWL_H * 1.75;
// Na captura a cena fica 1,3x maior que o boss normal: ele "cresce" por cima da coruja.
const GRAB_H = BOSS_H * (GRAB.h / 235) * 1.3;
const GRAB_W = GRAB_H * GRAB.w / GRAB.h;
const BOSS_W = BOSS_H * BOSS.w / BOSS.h;
const BOSS_SPEED = 240;              // velocidade máxima para acompanhar a barra
const BOSS_RETREAT_SPEED = 320;      // fugindo depois de levar um acerto
const BOSS_STRIDE = 14;              // unidades por quadro de caminhada
const BOSS_GRAVITY = 3200;
const BOSS_LEAP_TIME = 0.6;          // tempo no ar de cada salto
const STRIDE = 18;                   // unidades percorridas por quadro de corrida (evita pé deslizando)
const RUN_BOB = 7;                   // quanto o corpo sobe na passagem entre os passos
const CROUCH_TIME = 0.08;            // agachada antes de sair do chão (quadro 12)
const LAND_TIME = 0.16;              // aterrissagem antes de voltar a correr (quadro 15)
const JUMP_BUFFER = 0.15;            // aperto logo antes de tocar o chão já vale como pulo
const HOP_TIME = CELEBRATE_TIME;      // um pulinho de comemoração parado no lugar

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
let doors = [];           // portas no mundo: { x, model, openAt, rattleAt }
let legStartX = 0;

const owl = { x: 0, y: 0, vy: 0, grounded: true, landedAt: -1, jumpedAt: -1, crouchAt: -1, bufferedAt: -1, jumping: false, invulnerableUntil: 0, enter: 0, fadeInAt: -1, hiddenUntilX: 0 };
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

// ===================== MUNDO =====================
function addSegment(x, tileCount) {
  const tiles = Array.from({ length: tileCount }, () => Math.floor(Math.random() * GROUND.count));
  const seg = { x, w: tileCount * TILE_STEP + (TILE_W - TILE_STEP), tiles };
  segments.push(seg);
  return seg;
}

// Monta a próxima etapa: plataformas com buracos durante LEG_SECONDS de corrida,
// terminando numa plataforma longa com o checkpoint.
function buildLeg(fromX, startX) {
  legStartX = startX;
  const end = startX + speed * LEG_SECONDS;
  let x = fromX;
  while (x < end - TILE_STEP * 14) {
    x += 90 + Math.random() * 90;                        // buraco pulável
    const seg = addSegment(x, 2 + Math.floor(Math.random() * 4));
    x = seg.x + seg.w;
  }
  x += 110;
  const last = addSegment(x, Math.ceil((end - x) / TILE_STEP) + 6);
  markerX = Math.max(end, last.x + TILE_STEP * 2);
  // Porta fechada logo à frente de onde a coruja para
  const model = Math.floor(Math.random() * DOOR.models);
  doors.push({ model, x: doorwayX(markerX) - DOOR_W * DOOR_CENTER[model], openAt: -1, rattleAt: -1 });
}

// Centro da passagem da porta no mundo, para uma coruja parada em stopX.
function doorwayX(stopX) {
  return stopX + OWL_W * 0.75;
}

function currentDoor() {
  return doors[doors.length - 1];
}

function supportUnder(worldX) {
  return segments.some(seg => worldX + FOOT > seg.x + 18 && worldX - FOOT < seg.x + seg.w - 18);
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

function onKeyDown(event) {
  if (!active || event.repeat) return;
  if (event.key === 'Escape') {
    resetGame();
    return;
  }
  if (state === 'run' && (event.code === 'Space' || event.key === 'ArrowUp' || event.key === 'w')) {
    event.preventDefault();
    jump();
    return;
  }
  if (state === 'checkpoint') {
    const index = ['1', '2', '3', '4'].indexOf(event.key);
    const button = panel.querySelectorAll('.quiz-options > button')[index];
    if (button && !button.disabled) {
      event.preventDefault();
      button.click();
    }
  }
}

function onPointerDown(event) {
  if (event.target === canvas) jump();
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
  clock += dt;
  stateTime += dt;
  update(dt);
  draw();
  raf = requestAnimationFrame(frame);
}

function setState(next) {
  state = next;
  stateTime = 0;
}

function update(dt) {
  shake = Math.max(0, shake - dt * 2.5);

  if (state === 'run') {
    const before = owl.x;
    owl.x = Math.min(owl.x + speed * dt, markerX);
    if (owl.grounded) runPhase = (runPhase + (owl.x - before) / STRIDE) % RUN_FRAMES.length;
    if (owl.hiddenUntilX && owl.x >= owl.hiddenUntilX) {
      owl.hiddenUntilX = 0;
      owl.fadeInAt = clock;
    }
    if (owl.x >= markerX && owl.grounded) enterCheckpoint();
  }

  // Física vertical (vale em qualquer estado)
  const supported = supportUnder(owl.x);
  if (owl.crouchAt >= 0) {
    // Sai do chão ao fim da agachada, ou na hora se a plataforma acabar
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
      runPhase = 0;                  // volta a correr pelo quadro de apoio
      kickDust(8, 1);
      if (state === 'run' && clock - owl.bufferedAt < JUMP_BUFFER) owl.crouchAt = clock;
      owl.bufferedAt = -1;
    } else {
      // Passou da altura do chão sem plataforma embaixo: não tem mais como pousar
      if (!fallSounded && owl.y > groundY + 4) {
        fallSounded = true;
        playFallSfx();
      }
      if (owl.y > viewH + OWL_H) fellInPit();
    }
  }

  updateBoss(dt);

  if (state === 'checkpoint' && !answering) {
    // A barra enche desde o início (mais rápido a cada erro); o boss só entra aos 70%
    boss.progress = Math.min(1, boss.progress + dt * bossPace() / QUESTION_SECONDS);
    if (boss.mode === 'hidden' && boss.progress >= BOSS_APPEAR_AT) {
      bossEnter();
      updateThreatLabel();
    }
    if (boss.mode !== 'hidden') updatePulse();
    const meter = panel.querySelector('progress');
    if (meter) meter.value = boss.progress;
    if (boss.progress >= 1) caught();
  } else if (state === 'resume') {
    // Acertou: comemora, a porta abre, a coruja entra e sai do outro lado
    const door = currentDoor();
    if (stateTime >= CELEBRATE_TIME && door.openAt < 0) {
      door.openAt = clock;
      playDoorSfx();
    }
    if (stateTime >= ENTER_START) {
      const k = Math.min(1, (stateTime - ENTER_START) / ENTER_TIME);
      const before = owl.x;
      owl.x = markerX + (doorwayX(markerX) - markerX) * Math.min(1, k / 0.6);
      runPhase = (runPhase + (owl.x - before) / STRIDE) % RUN_FRAMES.length;
      owl.enter = Math.max(0, (k - 0.35) / 0.65);    // encolhe e escurece entrando na porta
      if (k >= 1) {
        owl.enter = 0;
        owl.hiddenUntilX = door.x + DOOR_W * 0.95;    // segue invisível e aparece do outro lado
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
  doors = doors.filter((door, i) => i === doors.length - 1 || door.x + DOOR_W > camera - 50);

  // Brasas subindo do chão
  if (Math.random() < dt * 14) {
    embers.push({ x: Math.random() * viewW, y: viewH, vy: 40 + Math.random() * 70, life: 1 });
  }
  embers.forEach(e => { e.y -= e.vy * dt; e.x += Math.sin(e.y / 40) * 0.4; e.life -= dt * 0.35; });
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
function draw() {
  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);
  if (shake > 0) ctx.translate((Math.random() - 0.5) * 18 * shake, (Math.random() - 0.5) * 12 * shake);

  // Céu escuro por cima do vídeo de fundo + brilho de lava
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, '#05060899');
  sky.addColorStop(0.7, '#1a050588');
  sky.addColorStop(1, '#4a0a06dd');
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, viewW + 40, viewH + 40);

  embers.forEach(e => {
    ctx.fillStyle = `rgba(255, ${90 + e.life * 80 | 0}, 40, ${e.life})`;
    ctx.fillRect(e.x, e.y, 3, 3);
  });

  const camera = owl.x - owlScreenX;
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

  drawDoors(camera);
  drawOwl();
  drawBoss();
  drawLegProgress();
  ctx.restore();
}

function drawDoors(camera) {
  const img = loadImage(DOOR.src);
  for (const door of doors) {
    const x = door.x - camera;
    if (x > viewW || x + DOOR_W < 0) continue;
    const frame = door.openAt < 0 ? 0 : Math.min(3, Math.floor((clock - door.openAt) / DOOR_OPEN_TIME * 4));
    // Errou: a porta trancada chacoalha
    const rattle = clock - door.rattleAt < 0.35 ? Math.sin((clock - door.rattleAt) * 70) * 4 * (1 - (clock - door.rattleAt) / 0.35) : 0;
    ctx.drawImage(img, frame * DOOR.w, door.model * DOOR.h, DOOR.w, DOOR.h, x + rattle, groundY + 6 - DOOR_H, DOOR_W, DOOR_H);
  }
}

// Decide o que desenhar: quadro atual, próximo quadro para fundir e deformações.
function owlPose() {
  const deg = Math.PI / 180;
  const loop = (name, time) => {
    const a = OWL_ANIMS[name];
    return { frame: a.frames[Math.floor(time * a.fps) % a.frames.length] };
  };
  // Pulinho no lugar: agacha, sobe de asas abertas e aterrissa
  const hop = time => {
    const p = (time / HOP_TIME) % 1;
    const air = Math.min(1, Math.max(0, (p - 0.12) / 0.72));
    const frame = p < 0.12 ? 12 : p < 0.4 ? 13 : p < 0.84 ? 14 : 15;
    return { frame, bob: Math.sin(Math.PI * air) * 34 };
  };
  // Pega pelo boss / fim de jogo: encolhida, tremendo
  if (state === 'caught' || state === 'over') {
    return { frame: 12, sx: 1 + Math.sin(clock * 45) * 0.02, sy: 0.97 };
  }

  // 1) Começando a pular: agacha no chão
  if (owl.crouchAt >= 0) {
    const k = Math.min(1, (clock - owl.crouchAt) / CROUCH_TIME);
    return { frame: 12, sx: 1 + 0.08 * k, sy: 1 - 0.12 * k };
  }

  // 2) No ar: 13 subindo, fundindo em 14 no topo do pulo e descendo até o chão
  if (!owl.grounded) {
    const v = owl.vy / -JUMP_VELOCITY;               // -1 saindo do chão · +1 voltando
    // Caindo sem ter pulado (saiu da beirada ou renasceu): direto no quadro 14
    const blend = !owl.jumping ? 1 : Math.min(1, Math.max(0, (v + 0.1) / 0.25));
    const stretch = Math.min(1, Math.abs(v)) * 0.06;
    return { frame: 13, next: 14, blend, sx: 1 - stretch / 2, sy: 1 + stretch, rot: Math.max(-1, Math.min(1, v)) * 7 * deg, center: true };
  }

  // 3) Chegou no chão: 15 amassado, fundindo de volta na corrida
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
  if (state === 'resume' && stateTime < ENTER_START) return loop('idle', 0);
  if (state === 'checkpoint') return loop('idle', stateTime);

  // 4) Correndo: a cada passo o corpo sobe na passada e desce no apoio, trocando de pé
  const n = RUN_FRAMES.length;
  const current = Math.floor(runPhase) % n;
  const stepPhase = (runPhase % RUN_STEP) / RUN_STEP;  // 0 → 1 dentro do passo
  const lift = Math.cos(Math.PI * stepPhase) ** 2;     // 1 na passada · 0 no apoio
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

function drawOwl() {
  if (boss.mode === 'grab') return;                  // a coruja está dentro do sprite de captura
  const img = loadImage(OWL.src);

  dust.forEach(d => {
    ctx.fillStyle = `rgba(120, 60, 45, ${d.life * 0.45})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * (1.6 - d.life * 0.6), 0, Math.PI * 2);
    ctx.fill();
  });

  // Entrando na porta: encolhe (vai para o fundo), escurece e some.
  // Saindo do outro lado: reaparece aos poucos.
  const depth = 1 - owl.enter * 0.45;
  const fadeIn = owl.fadeInAt < 0 ? 1 : Math.min(1, (clock - owl.fadeInAt) / EXIT_FADE);
  const owlAlpha = owl.hiddenUntilX ? 0 : (1 - owl.enter * owl.enter) * fadeIn;
  if (owlAlpha <= 0) return;

  // Sombra no chão (só quando existe chão embaixo)
  if (supportUnder(owl.x) && owl.enter < 0.3) {
    const lift = Math.max(0, groundY - owl.y);
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0.15, 0.55 - lift / 500)})`;
    ctx.beginPath();
    ctx.ellipse(owlScreenX, groundY + 2, OWL_W * 0.3 * Math.max(0.5, 1 - lift / 400), 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (clock < owl.invulnerableUntil && Math.floor(clock * 12) % 2 === 0) return;

  const pose = owlPose();
  const pivotY = pose.center ? OWL_H / 2 : 0;          // no ar gira pelo meio do corpo
  ctx.save();
  ctx.translate(owlScreenX, owl.y + 2 - pivotY - owl.enter * 10);
  ctx.rotate(pose.rot || 0);
  ctx.scale((pose.sx || 1) * depth, (pose.sy || 1) * depth);
  if (owl.enter > 0) ctx.filter = `brightness(${1 - owl.enter * 0.75})`;
  const drawFrame = (frame, alpha) => {
    ctx.globalAlpha = alpha * owlAlpha;
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

// ===================== BOSS =====================
// Onde o boss para, na tela, de acordo com a ameaça (0 = na borda, 1 = em cima da coruja).
function bossEntryX() { return -BOSS_W * 0.6; }   // fora da tela, à esquerda
function bossCatchX() { return owlScreenX - (GRAB_OWL_X - GRAB_BOSS_X) * GRAB_W + BOSS_W * 0.03; }
// De 70% a 100% da barra ele percorre o caminho da borda da tela até a coruja.
function bossTargetX() {
  const k = Math.max(0, Math.min(1, (boss.progress - BOSS_APPEAR_AT) / (1 - BOSS_APPEAR_AT)));
  return bossEntryX() + (bossCatchX() - bossEntryX()) * k;
}

function setBossMode(mode) {
  boss.mode = mode;
  boss.modeTime = 0;
}

function bossPace() {
  return 1 + errors * ERROR_SPEEDUP;
}

function bossEnter() {
  Object.assign(boss, { x: bossEntryX(), y: 0, vx: 0, vy: 0, facing: 1, walking: true, phase: 0, onLand: null });
  setBossMode('stalk');
}

// Salto: agacha (8), decola (9), voa (10) e aterrissa (11) no ponto de destino.
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
      // Caminhada contínua acompanhando a barra (sem parar e arrancar)
      const step = Math.min(BOSS_SPEED * dt, Math.max(0, bossTargetX() - boss.x));
      boss.x += step;
      boss.phase = (boss.phase + step / BOSS_STRIDE) % BOSS_WALK.length;
      boss.walking = step > 0.01;
      break;
    }
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
        shake = Math.max(shake, 0.9);
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
      if (boss.modeTime >= 0.8 && state !== 'caught' && state !== 'over') setBossMode('stalk');
      break;
    case 'hurt':
      // Levou o acerto: é empurrado para trás e depois foge
      boss.x -= 260 * Math.max(0, 1 - boss.modeTime * 2.5) * dt;
      if (boss.modeTime >= 0.55) {
        boss.facing = -1;
        boss.walking = true;
        setBossMode('retreat');
      }
      break;
    case 'grab': {
      const grabAt = grabFrameStart(4);                // momento em que ele agarra
      if (boss.modeTime >= grabAt && boss.modeTime - dt < grabAt) {
        shake = 1.6;
        lives = 0;                                     // pegou a coruja: todos os corações ficam vazios
        updateStatusBar();
        playSfx('scare');
      }
      const liftAt = grabFrameStart(9);                // ergueu a coruja: tremor do rugido
      if (boss.modeTime >= liftAt) shake = Math.max(shake, 0.35);
      if (boss.modeTime >= GRAB_GAME_OVER && state === 'caught') gameOver('O boss pegou a coruja.');
      break;
    }
    case 'retreat':
      boss.x -= BOSS_RETREAT_SPEED * dt;
      boss.phase = (boss.phase + BOSS_RETREAT_SPEED * dt / BOSS_STRIDE) % BOSS_WALK.length;
      if (boss.x < -BOSS_W) setBossMode('hidden');
      break;
  }
}

function bossPose() {
  const loop = (name, time) => {
    const a = BOSS_ANIMS[name];
    return { frame: a.frames[Math.floor(time * a.fps) % a.frames.length] };
  };
  const walkPose = () => {
    const n = BOSS_WALK.length;
    const current = Math.floor(boss.phase) % n;
    const step = Math.sin(Math.PI * boss.phase / 2);
    return {
      frame: BOSS_WALK[current],
      next: BOSS_WALK[(current + 1) % n],
      blend: Math.max(0, (boss.phase % 1 - 0.65) / 0.35),
      bob: 6 * step * step,                            // pisada pesada
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
      // Rugido: estufa o peito pulsando
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

function drawGrab() {
  const img = loadImage(GRAB.src);
  const pose = grabPose(boss.modeTime);
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
    ctx.fillRect(-20, -20, viewW + 40, viewH + 40);
  }
}

function drawBoss() {
  if (boss.mode === 'grab') {
    drawGrab();
    return;
  }
  const pose = bossPose();
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
      const sx = (frame % BOSS.cols) * BOSS.w;
      const sy = Math.floor(frame / BOSS.cols) * BOSS.h;
      ctx.drawImage(img, sx, sy, BOSS.w, BOSS.h, -BOSS_W / 2, -BOSS_H - (pose.bob || 0), BOSS_W, BOSS_H);
    };
    drawFrame(pose.frame, 1);
    if (pose.blend > 0) drawFrame(pose.next, pose.blend);
    ctx.restore();
  }
}

function drawLegProgress() {
  if (state !== 'run') return;
  const p = Math.max(0, Math.min(1, (owl.x - legStartX) / (markerX - legStartX)));
  const w = Math.min(360, viewW * 0.5);
  const x = (viewW - w) / 2;
  const y = viewH - 34;
  ctx.fillStyle = '#ffffff22';
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = '#df302e';
  ctx.fillRect(x, y, w * p, 4);
  ctx.fillStyle = '#e9e6de';
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PRÓXIMO DESAFIO', viewW / 2, y - 10);
}

// ===================== CHECKPOINT / PERGUNTA =====================
function buildDeck() {
  const idxs = Array.from({ length: QUIZ.length }, (_, i) => i);
  shuffleInPlace(idxs);
  deck = idxs.map(i => cloneWithShuffledOptions(QUIZ[i]));
  deckIndex = 0;
}

function enterCheckpoint() {
  setState('checkpoint');
  setBossMode('hidden');
  boss.progress = 0;
  errors = 0;
  answering = false;
  if (deckIndex >= deck.length) buildDeck();
  renderQuestion(deck[deckIndex++]);
}

function renderQuestion(node) {
  panel.hidden = false;
  panel.innerHTML = `
    <div class="runner-question-head">
      <span class="hud-label runner-threat">CHECKPOINT · SILÊNCIO...</span>
      <progress max="1" value="0" aria-label="Distância do boss"></progress>
    </div>
    <h2 class="quiz-title"></h2>
    <div class="quiz-options"></div>
    <p class="answer-feedback" role="status" aria-live="polite"></p>`;
  const title = panel.querySelector('.quiz-title');
  if (node.questionText || node.question) {
    title.textContent = node.questionText || node.question;
  } else if (node.questionImage) {
    const img = document.createElement('img');
    img.src = node.questionImage;
    img.alt = 'Questão';
    img.className = 'quiz-image';
    title.appendChild(img);
  }

  const options = panel.querySelector('.quiz-options');
  node.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn--blood quiz-option';
    btn.type = 'button';
    const letter = letterForIndex(i);
    if (opt && typeof opt === 'object') {
      const figure = document.createElement('figure');
      figure.className = 'option-figure';
      if (opt.img) {
        const image = document.createElement('img');
        image.src = opt.img;
        image.alt = opt.alt || 'Alternativa';
        image.className = 'option-image';
        figure.appendChild(image);
      }
      const figcap = document.createElement('figcaption');
      figcap.className = 'option-caption';
      const hasLabel = typeof opt.label === 'string' && opt.label.trim() !== '' && !isABCDLabel(opt.label);
      figcap.textContent = hasLabel ? `${letter} — ${opt.label}` : letter;
      figure.appendChild(figcap);
      btn.appendChild(figure);
    } else {
      btn.textContent = `${letter}) ${String(opt)}`;
    }
    btn.addEventListener('click', () => answer(i === node.answer, btn));
    options.appendChild(btn);
  });
  // Foco automático é para teclado; no celular o contorno parecia resposta já marcada
  if (!isPhone()) requestAnimationFrame(() => options.querySelector('button')?.focus({ preventScroll: true }));
}

function updateThreatLabel() {
  const label = panel.querySelector('.runner-threat');
  if (!label) return;
  if (boss.mode === 'hidden' && errors === 0) label.textContent = 'CHECKPOINT · SILÊNCIO...';
  else if (errors === 0) label.textContent = 'O BOSS SE APROXIMA';
  else label.textContent = `O BOSS SE APROXIMA · ${bossPace().toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}× MAIS RÁPIDO`;
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
    updateThreatLabel();
    currentDoor().rattleAt = clock;
    boss.progress = Math.min(1, boss.progress + WRONG_PENALTY);
    if (boss.progress >= 1) caught();
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

// Quadro da captura no tempo t: 0→11 em ordem e para no último (coruja erguida).
function grabPose(t) {
  const frame = Math.min(GRAB_FRAMES - 1, Math.floor(t / GRAB_FRAME_TIME));
  const k = (t / GRAB_FRAME_TIME) % 1;
  const last = frame === GRAB_FRAMES - 1;
  // Fusão curta só no finalzinho de cada quadro, para cada um aparecer inteiro
  return { frame, next: frame + 1, blend: last ? 0 : Math.max(0, (k - 0.85) / 0.15) };
}

function grabFrameStart(frame) {
  return frame * GRAB_FRAME_TIME;
}

// ===================== ÁUDIO =====================
// Tudo passa pelo provider (js/audio.js): aqui só decide o que tocar e quando.
const FALL_SFX_START = 0.55;         // pula o silêncio do começo do arquivo
const FALL_SFX_END = 4;              // quedas que ainda deixam vida: corta no segundo 4
const FALL_SFX_END_LAST = 9;         // queda que tira a última vida: vai até o segundo 9
let fallSounded = false;             // o assobio já tocou nesta queda
let fallSfx = null;
let pulseSfx = null;

function playFallSfx() {
  // Toca antes de descontar a vida: com 1 vida restante, esta é a queda final
  const end = lives <= 1 ? FALL_SFX_END_LAST : FALL_SFX_END;
  stopFallSfx();
  fallSfx = playSfx('fall', { offset: FALL_SFX_START, duration: end - FALL_SFX_START });
}

function stopFallSfx() {
  fallSfx?.stop();
  fallSfx = null;
}

function playJumpSfx() {
  playSfx('jump');
}

function playDoorSfx() {
  playSfx('door');
}

// Batimento: mais alto e mais rápido conforme o boss chega perto
function updatePulse() {
  if (!pulseSfx || pulseSfx.stopped) pulseSfx = playSfx('pulse', { loop: true });
  pulseSfx?.setVolume(0.2 + boss.progress * 0.8);
  pulseSfx?.setRate(0.95 + boss.progress * 0.7);
}

function resetPulse() {
  pulseSfx?.stop();
  pulseSfx = null;
}

// ===================== HUD =====================
function updateStatusBar() {
  if (!statusBar) return;
  statusBar.hidden = false;
  renderLives(livesEl, lives, LIVES);
  renderScore(scoreEl, score);
}

// ===================== FIM DE PARTIDA =====================
function gameOver(reason) {
  if (!active || state === 'over') return;
  setState('over');
  resetPulse();
  panel.hidden = false;
  panel.classList.add('is-game-over');
  panel.innerHTML = `
    <section class="game-over-card" aria-labelledby="gameOverTitle">
      <p class="game-over-kicker">FUGA INFERNAL · FIM DE PARTIDA</p>
      <h2 id="gameOverTitle" class="game-over-title"></h2>
      <div class="game-over-result"><span>QUESTÕES CERTAS</span><strong>${score}</strong></div>
      <div class="game-over-actions">
        <button type="button" class="btn btn--blood-primary" data-action="retry">TENTAR NOVAMENTE</button>
        <button type="button" class="btn" data-action="home">VOLTAR AO MENU</button>
      </div>
    </section>`;
  panel.querySelector('.game-over-title').textContent = reason;
  const retry = panel.querySelector('[data-action="retry"]');
  retry.addEventListener('click', () => {
    resetGame();
    hideHome();
    startRunnerMode();
  });
  panel.querySelector('[data-action="home"]').addEventListener('click', resetGame);
  if (!isPhone()) requestAnimationFrame(() => retry.focus({ preventScroll: true }));
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
  [OWL.src, GROUND.src, BOSS.src, DOOR.src, GRAB.src].forEach(loadImage);

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
  embers = [];
  boss.progress = 0;
  setBossMode('hidden');
  buildDeck();

  // Chão inicial sem buracos cobrindo a tela toda
  segments = [];
  const first = addSegment(-owlScreenX - TILE_W, Math.ceil((viewW + TILE_W * 2) / TILE_STEP));
  Object.assign(owl, { x: 0, y: groundY, vy: 0, grounded: true, landedAt: -1, jumpedAt: -1, crouchAt: -1, bufferedAt: -1, jumping: false, invulnerableUntil: 0, enter: 0, fadeInAt: -1, hiddenUntilX: 0 });
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
