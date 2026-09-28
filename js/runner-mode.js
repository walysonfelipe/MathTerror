// ===================== FUGA INFERNAL =====================
// Estilo "dinossauro do Google": a coruja corre sozinha pelas plataformas de lava
// e o jogador pula os buracos. A cada 20 segundos ela chega num checkpoint, para
// responde questões enquanto o boss vem chegando pela esquerda. Depois de quatro
// erros no checkpoint, a coruja encara o boss em quatro rodadas de contas rápidas.

import { QUIZ } from './quiz-data.js';
import { livesEl, scoreEl, statusBar } from './dom-elements.js';
import { playSfx, setAudioEnabled } from './audio.js';
import { needsRotation, isPhone } from './orientation.js';
import { shuffleInPlace, cloneWithShuffledOptions, letterForIndex, isABCDLabel } from './utils.js';
import { resetGame, hideHome } from './game-state.js';
import { renderLives, renderScore, resetLives, spriteNumber } from './hud.js';

// ===================== CONFIGURAÇÕES DO MODO =====================
const LIVES = 3;
const LEG_SECONDS = 20;          // tempo correndo até o próximo checkpoint
const QUESTION_SECONDS = 30;     // tempo da barra encher (boss pega a coruja), sem erros
const BOSS_APPEAR_AT = 0.7;      // o boss só entra na tela quando a barra passa de 70%
const ERROR_SPEEDUP = 0.75;      // cada erro deixa o boss 75% mais rápido nesta questão
const WRONG_PENALTY = 0.1;       // saltinho para frente a cada erro (0–1)
const MAX_ERRORS = 3;            // o modo de luta abre quando passa de 3 erros
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
// Limites alfa individuais das 16 poses, na ordem de leitura das pranchas.
// Cada pose mantém o seu tamanho e proporção próprios; não é recortada por quadrantes.
const FIGHT_OWL = {
  src: 'assets/images/owl-fight-sheet.webp',
  frames: [
    [74, 34, 218, 241], [389, 32, 240, 244], [718, 39, 231, 236], [1070, 42, 259, 234],
    [46, 315, 271, 238], [344, 320, 335, 232], [748, 315, 231, 238], [1104, 306, 228, 252],
    [12, 584, 357, 250], [414, 626, 236, 205], [708, 636, 275, 198], [1002, 581, 342, 244],
    [40, 894, 296, 200], [383, 895, 271, 198], [591, 890, 462, 201], [1092, 881, 229, 219],
  ],
};
const FIGHT_BOSS = {
  src: 'assets/images/boss-fight-sheet.webp',
  frames: [
    [16, 10, 308, 262], [357, 13, 351, 257], [716, 26, 392, 245], [1122, 19, 290, 252],
    [23, 285, 302, 252], [374, 280, 301, 257], [708, 290, 397, 248], [1093, 297, 349, 240],
    [13, 573, 323, 236], [374, 525, 288, 288], [677, 584, 411, 228], [1116, 546, 314, 266],
    [18, 812, 293, 256], [356, 812, 312, 258], [679, 821, 401, 249], [1072, 832, 376, 235],
  ],
};
// Reação do boss ao golpe: 16 recortes alfa individuais, em ordem de leitura.
// Os sprites vão da preparação (0–3), passam pelos impactos (4–11) e terminam
// com a reação forte e a recuperação (12–15).
const FIGHT_BOSS_HIT = {
  src: 'assets/images/boss-strike-sheet.webp',
  frames: [
    [18, 3, 320, 269], [378, 6, 317, 266], [740, 3, 323, 269], [1115, 6, 318, 266],
    [37, 272, 308, 271], [381, 272, 315, 271], [741, 272, 319, 271], [1112, 272, 313, 271],
    [19, 547, 322, 268], [380, 543, 315, 268], [742, 546, 318, 266], [1113, 543, 323, 272],
    [20, 815, 316, 257], [385, 815, 324, 257], [725, 815, 336, 256], [1113, 815, 320, 257],
  ],
};
const FIGHT_BOSS_HIT_DURATION = 0.88;
const FIGHT_BOSS_HIT_FRAME_TIME = FIGHT_BOSS_HIT_DURATION / FIGHT_BOSS_HIT.frames.length;
// Sequência do poder do boss: disparo (0–3), impacto (4–11), queda/recuperação (12–15).
// Os limites seguem o alfa real de cada pose (incluindo brasas e faíscas), sem quadrantes uniformes.
// [x, y, w, h, anchorX, anchorY]: âncoras relativas ao canto do recorte; anchorY é a linha do chão.
const BOSS_POWER = {
  src: 'assets/images/boss-power-attack-sheet.webp',
  frames: [
    [36, 60, 315, 171, 248], [391, 62, 322, 169, 255], [746, 66, 319, 164, 256], [1099, 61, 322, 170, 257],
    [7, 320, 382, 194, 293, 198], [389, 322, 365, 193, 284, 196], [754, 315, 354, 200, 257, 204], [1108, 301, 331, 215, 215, 219],
    [15, 537, 375, 244, 281, 248], [401, 537, 362, 237, 270, 240], [774, 564, 353, 204, 246, 195], [1136, 565, 302, 187, 206, 194],
    [80, 817, 278, 202, 177, 201], [419, 839, 324, 192, 167, 196], [801, 846, 243, 188, 135, 192], [1172, 830, 203, 207, 101, 211],
  ],
  // Na segunda linha as poses se encostam: margem lateral extra puxaria a coruja vizinha.
  touchingFrames: [4, 5, 6, 7],
  projectileCoreX: [248, 255, 256, 257],
  projectileScale: 0.76,
};
// Tempos por pose: aproximação curta, impacto legível e recuo/recuperação mais longos.
const BOSS_POWER_FRAME_TIMES = [
  0.12, 0.12, 0.12, 0.12,
  0.10, 0.10, 0.10, 0.10,
  0.12, 0.12, 0.12, 0.12,
  0.14, 0.14, 0.14, 0.14,
];
const BOSS_POWER_IMPACT_AT = BOSS_POWER_FRAME_TIMES.slice(0, 8).reduce((sum, time) => sum + time, 0);
const BOSS_POWER_DURATION = BOSS_POWER_FRAME_TIMES.reduce((sum, time) => sum + time, 0);
const FIGHT_TURN_TIME = 0.8;
// Letreiro "Fight" antes da primeira pergunta: 0 surge, 1 explode, 2 e 3 pulsam.
// [x, y, w, h, anchorX, anchorY]: recorte pelo alfa de cada quadrante e centro das letras,
// para a palavra não pular entre quadros com contornos de fogo diferentes.
const FIGHT_INTRO = {
  src: 'assets/images/figth.webp',
  frames: [
    [46, 104, 722, 372, 343, 207], [768, 70, 752, 440, 384, 221],
    [23, 576, 737, 379, 382, 179], [804, 579, 687, 352, 347, 189],
  ],
  baseW: 722,
  baseH: 372,
};
const FIGHT_INTRO_DURATION = 1.5;
const FIGHT_OWL_COMBOS = [
  [4, 5, 6],       // soco e recuperação
  [7, 8, 6],       // chute e recuperação
  [9, 10, 11],     // esquiva baixa e golpe de asa
  [4, 5, 8, 11],   // sequência final
];
const FIGHT_BOSS_ATTACKS = [
  [4, 5, 6, 7],     // esfera de fogo
  [8, 9, 10, 11],  // golpe no chão
  [12, 13, 14, 15], // rajada de energia
];
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
// door-pass-sheet.webp (gerado de image.png): grade 4x5 de 472x252, coruja e porta juntas.
// Toda célula alinhada pelo arco da porta (centro em x=244), então a porta fica parada no mundo.
// 0–15: passagem (chega · empurra a porta · entra · sai do outro lado) · 16: fechada · 17: aberta.
const PASS = { src: 'assets/images/door-pass-sheet.webp', w: 472, h: 252, cols: 4, doorX: 244, ground: 242, frames: 16, closed: 16, open: 17 };
// Centro da coruja em relação ao centro da porta em cada quadro (px do sprite, medido).
const PASS_OWL_DX = [-172, -144, -144, -104, -105, -92, -68, -77, -25, -12, -7, -5, 108, 123, 132, 152];
const PASS_DOOR_FRAME = 4;           // quadro em que a coruja empurra a porta (som)
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
const PASS_SCALE = 1;                // unidades do mundo por px do sprite (coruja do mesmo tamanho da corrida)
const PASS_DRAW_W = PASS.w * PASS_SCALE;
const PASS_DRAW_H = PASS.h * PASS_SCALE;
// Sequência depois do acerto (segundos desde o acerto):
const CELEBRATE_TIME = 0.45;         // coruja comemora
const PASS_FRAME_TIME = 0.1;         // cada quadro da passagem pela porta
const PASS_TIME = PASS.frames * PASS_FRAME_TIME;
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
let fightCombo = 0;
let fightBossAttack = 0;
let hideCheckpointDoor = false;
let cameraZoom = 1;
let cameraLift = 0;         // sobe a cena da luta para o chão ficar acima do painel de respostas

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
  // Porta fechada à frente: a coruja parada em markerX fica onde está no 1º quadro da passagem
  doors.push({ x: markerX - PASS_OWL_DX[0] * PASS_SCALE, passAt: -1, rattleAt: -1 });
}

// Posição da coruja (mundo) durante a passagem: vai do 1º ao último quadro em ritmo
// constante, para a câmera não dar trancos quando ela some dentro da porta.
function passOwlX(door, t) {
  const from = PASS_OWL_DX[0], to = PASS_OWL_DX[PASS.frames - 1];
  return door.x + (from + (to - from) * Math.min(1, t / PASS_TIME)) * PASS_SCALE;
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
  if (state === 'checkpoint' || state === 'fight') {
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
  const targetZoom = state === 'fight' ? 1.2 : 1;
  cameraZoom += (targetZoom - cameraZoom) * (1 - Math.exp(-dt * 4.5));
  cameraLift += (fightLift() - cameraLift) * (1 - Math.exp(-dt * 6));

  if (state === 'run') {
    const before = owl.x;
    owl.x = Math.min(owl.x + speed * dt, markerX);
    if (owl.grounded) runPhase = (runPhase + (owl.x - before) / STRIDE) % RUN_FRAMES.length;
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

  if (state === 'fight') {
    updatePulse();
    if (fightEffect && clock - fightEffectAt > 0.55) fightEffect = '';
    updateFightAction();
  }

  if (state === 'checkpoint' && !answering) {
    // A barra enche desde o início (mais rápido a cada erro); o boss só entra aos 70%
    boss.progress = Math.min(1, boss.progress + dt * bossPace() / QUESTION_SECONDS);
    if (boss.mode === 'hidden' && boss.progress >= BOSS_APPEAR_AT) {
      bossEnter();
      updateThreatLabel();
    }
    updatePulse();                                   // batimento cresce desde o começo da pergunta
    const meter = panel.querySelector('progress');
    if (meter) meter.value = boss.progress;
    // Em telas de toque, a pergunta some quando já não há tempo útil para responder.
    panel.classList.toggle('is-near-catch', isPhone() && boss.progress >= 0.98);
    // Quando o cronômetro acaba, a luta é sempre a última chance, mesmo com menos
    // de quatro erros no checkpoint. A captura só acontece se perder a luta.
    if (boss.progress >= 1) beginFight();
  } else if (state === 'resume') {
    // Acertou: comemora e depois o sprite da porta mostra a coruja passando por ela
    const door = currentDoor();
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
  if (cameraLift > 0.5) ctx.translate(0, -cameraLift);
  if (Math.abs(cameraZoom - 1) > 0.001) {
    ctx.translate(viewW / 2, viewH / 2);
    ctx.scale(cameraZoom, cameraZoom);
    ctx.translate(-viewW / 2, -viewH / 2);
  }

  // Céu escuro por cima do vídeo de fundo + brilho de lava
  const sky = ctx.createLinearGradient(0, 0, 0, viewH);
  sky.addColorStop(0, '#05060899');
  sky.addColorStop(0.7, '#1a050588');
  sky.addColorStop(1, '#4a0a06dd');
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, viewW + 40, viewH + 40 + cameraLift * 2);

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
  drawBossPowerSequence();
  drawLegProgress();
  ctx.restore();
  drawFightIntro();
}

// Fora da câmera (zoom, tremor e subida da luta) para o letreiro ficar sempre centralizado.
function drawFightIntro() {
  if (state !== 'fight' || !fightIntro) return;
  const img = loadImage(FIGHT_INTRO.src);
  if (!img.complete || !img.naturalWidth) return;
  const t = clock - fightStartedAt;
  let frame;
  let pop = 1;
  if (t < 0.12) {
    frame = 0;
    const p = t / 0.12;
    pop = 1.6 - 0.6 * p * p;
  } else if (t < 0.34) frame = 1;
  else frame = 2 + (Math.floor((t - 0.34) / 0.09) % 2);
  const out = Math.max(0, (t - (FIGHT_INTRO_DURATION - 0.25)) / 0.25);
  const [sx, sy, sw, sh, anchorX, anchorY] = FIGHT_INTRO.frames[frame];
  // Mesma escala para todos os quadros: o quadro da explosão fica naturalmente maior.
  const scale = Math.min(viewW * 0.62, viewH * 0.46 * FIGHT_INTRO.baseW / FIGHT_INTRO.baseH) / FIGHT_INTRO.baseW * pop * (1 + out * 0.25);
  const w = sw * scale;
  const h = sh * scale;
  ctx.save();
  ctx.globalAlpha = Math.min(1, t / 0.08) * (1 - out);
  ctx.drawImage(img, sx, sy, sw, sh, viewW / 2 - anchorX * scale, viewH * 0.44 - anchorY * scale, w, h);
  ctx.restore();
}

// Fechada até o acerto · quadros da passagem (coruja incluída) · aberta depois.
function passFrame(door) {
  if (door.passAt < 0) return PASS.closed;
  const frame = Math.floor((clock - door.passAt) / PASS_FRAME_TIME);
  return frame < PASS.frames ? frame : PASS.open;
}

function isPassing() {
  const door = currentDoor();
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
  if (state === 'fight') {
    const elapsed = clock - fightStartedAt;
    if (fightAction === 'counter' && clock - fightActionAt >= BOSS_POWER_FRAME_TIMES.slice(0, 4).reduce((sum, time) => sum + time, 0)) return;
    let frame = 3;
    let x = fightOwlPosition();
    let flip = false;
    if (elapsed < FIGHT_TURN_TIME) frame = Math.min(3, Math.floor(elapsed * 4));
    else if (fightAction === 'approach') frame = runFrame();
    else if (fightAction === 'strike') {
      const combo = FIGHT_OWL_COMBOS[fightCombo % FIGHT_OWL_COMBOS.length];
      frame = combo[Math.min(combo.length - 1, Math.floor((clock - fightActionAt) * 8))];
    }
    else if (fightAction === 'retreat') {
      frame = runFrame();
      flip = true;
    } else if (fightAction === 'counter' && fightCounterHit) frame = 14;
    drawFighter(FIGHT_OWL, frame, x, OWL_H / 240, flip);
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
  if (supportUnder(owl.x)) {
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
        lives = 0;                                     // pegou a coruja: rachando só os corações que restavam
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
    ctx.fillRect(-20, -20, viewW + 40, viewH + 40 + cameraLift * 2);
  }
}

function drawBoss() {
  if (state === 'fight') {
    if (fightAction === 'strike') {
      const elapsed = clock - fightActionAt;
      const frame = Math.min(FIGHT_BOSS_HIT.frames.length - 1, Math.floor(elapsed / FIGHT_BOSS_HIT_FRAME_TIME));
      drawFighter(FIGHT_BOSS_HIT, frame, viewW * 0.25, BOSS_H / 260);
      return;
    }
    let frame = 0;
    if (fightAction === 'counter') {
      const attack = FIGHT_BOSS_ATTACKS[fightBossAttack];
      frame = attack[Math.min(attack.length - 1, Math.floor((clock - fightActionAt) * 5))];
    }
    else if (fightAction === 'approach' || fightAction === 'retreat') frame = 3;
    drawFighter(FIGHT_BOSS, frame, viewW * 0.25, BOSS_H / 260);
    return;
  }
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

function drawFighter(sheet, frame, x, sourceScale, flip = false) {
  const img = loadImage(sheet.src);
  if (!img.complete || !img.naturalWidth) return;
  const [x0, y0, w0, h0] = sheet.frames[frame];
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
  ctx.translate(x, groundY + 4);
  if (flip) ctx.scale(-1, 1);
  ctx.shadowColor = fightEffect ? '#ff3b13' : '#ff1a0a';
  ctx.shadowBlur = fightEffect ? 34 : 16;
  ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h, w, h);
  ctx.restore();
}

function drawBossPowerSequence() {
  if (state !== 'fight' || fightAction !== 'counter') return;
  const elapsed = clock - fightActionAt;
  let frame = 0;
  let frameStart = 0;
  for (; frame < BOSS_POWER_FRAME_TIMES.length - 1; frame++) {
    const nextStart = frameStart + BOSS_POWER_FRAME_TIMES[frame];
    if (elapsed < nextStart) break;
    frameStart = nextStart;
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
  const scale = Math.min(BOSS_POWER.projectileScale, viewW * 0.38 / sw);
  const w = sw * scale;
  const h = sh * scale;
  let left;
  let top;

  if (frame < 4) {
    // A primeira linha mostra os quatro quadros do projétil atravessando a arena.
    const travel = Math.min(1, elapsed / BOSS_POWER_FRAME_TIMES.slice(0, 4).reduce((sum, time) => sum + time, 0));
    const startX = viewW * 0.34;
    const coreX = startX + (fightOwlPosition() - startX) * (1 - (1 - travel) ** 2);
    const coreY = groundY - OWL_H * 0.82 - Math.sin(travel * Math.PI) * 22;
    left = coreX - (BOSS_POWER.projectileCoreX[frame] + x0 - sx) * scale;
    top = coreY - h * 0.5;
  } else {
    // Nos quadros compostos, ancoramos a coruja no mesmo ponto para evitar saltos
    // causados pelos limites diferentes de cada recorte. A última linha a empurra
    // para trás e para cima, como reação ao impacto, e então mostra a recuperação.
    const recoil = Math.max(0, Math.min(1, (elapsed - BOSS_POWER_IMPACT_AT) / (BOSS_POWER_DURATION - BOSS_POWER_IMPACT_AT)));
    const recoilEase = recoil * recoil * (3 - 2 * recoil);
    const owlX = fightOwlPosition() + recoilEase * 58;
    const knockbackLift = recoilEase * Math.sin(recoil * Math.PI) * 20;
    left = owlX - (anchorX + x0 - sx) * scale;
    top = groundY + 4 - (anchorY + y0 - sy) * scale - knockbackLift;
  }

  ctx.save();
  // O brilho acompanha o projétil e o clarão; mantém os sprites da coruja nítidos.
  ctx.shadowColor = '#ff5a08';
  ctx.shadowBlur = frame < 4 || (frame >= 7 && frame <= 9) ? 14 : 4;
  ctx.drawImage(img, sx, sy, sw, sh, left, top, w, h);
  ctx.restore();
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
  hideCheckpointDoor = false;
  setBossMode('hidden');
  boss.progress = 0;
  errors = 0;
  answering = false;
  if (deckIndex >= deck.length) buildDeck();
  renderQuestion(deck[deckIndex++]);
}

function makeFightProblem(operation) {
  let a, b, answer;
  if (operation === '+') {
    a = 2 + Math.floor(Math.random() * 19);
    b = 1 + Math.floor(Math.random() * 19);
    answer = a + b;
  } else if (operation === '−') {
    a = 10 + Math.floor(Math.random() * 31);
    b = 1 + Math.floor(Math.random() * a);
    answer = a - b;
  } else if (operation === '×') {
    a = 2 + Math.floor(Math.random() * 10);
    b = 2 + Math.floor(Math.random() * 10);
    answer = a * b;
  } else {
    b = 2 + Math.floor(Math.random() * 9);
    answer = 2 + Math.floor(Math.random() * 10);
    a = b * answer;
  }
  const choices = new Set([answer]);
  while (choices.size < 4) {
    const offset = 1 + Math.floor(Math.random() * 5);
    choices.add(Math.max(0, answer + (Math.random() < 0.5 ? -offset : offset)));
  }
  const options = shuffleInPlace([...choices]);
  return { text: `${a} ${operation} ${b} = ?`, options, answer: options.indexOf(answer) };
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
  updatePulse();
  // A pergunta só aparece depois do letreiro; o giro da coruja acontece por baixo dele.
  fightIntro = true;
  panel.hidden = true;
  panel.innerHTML = '';
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
  if (fightAction === 'approach' && elapsed >= 0.56) {
    fightAction = 'strike';
    fightActionAt = clock;
  } else if (fightAction === 'strike' && elapsed >= FIGHT_BOSS_HIT_DURATION) {
    fightAction = 'retreat';
    fightActionAt = clock;
  } else if (fightAction === 'retreat' && elapsed >= 0.58) {
    completeFightRound();
  } else if (fightAction === 'counter') {
    if (!fightCounterHit && elapsed >= BOSS_POWER_IMPACT_AT) {
      fightCounterHit = true;
      fightEffect = 'owl-hit';
      fightEffectAt = clock;
      lives--;
      shake = 0.8;
      updateStatusBar();
      const feedback = panel.querySelector('.answer-feedback');
      if (feedback) feedback.textContent = 'O poder do boss atingiu a coruja!';
    }
    if (elapsed >= BOSS_POWER_DURATION) completeFightRound();
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
  panel.hidden = false;
  panel.classList.add('is-fight-question');
  panel.classList.remove('is-near-catch');
  panel.innerHTML = `
    <div class="runner-question-head"><span class="hud-label runner-threat">LUTA CONTRA O BOSS · ${fightRound + 1}/4</span></div>
    <h2 class="quiz-title"></h2>
    <div class="quiz-options"></div>
    <p class="answer-feedback" role="status" aria-live="polite"></p>`;
  panel.querySelector('.quiz-title').textContent = problem.text;
  panel.querySelector('.answer-feedback').textContent = feedbackText;
  const options = panel.querySelector('.quiz-options');
  const turning = fightRound === 0 && clock - fightStartedAt < FIGHT_TURN_TIME;
  problem.options.forEach((value, index) => {
    const button = document.createElement('button');
    button.className = 'btn btn--blood quiz-option';
    button.type = 'button';
    button.disabled = turning;
    button.textContent = `${index + 1}) ${value}`;
    button.addEventListener('click', () => answerFight(index === problem.answer));
    options.appendChild(button);
  });
  if (turning) {
    const remaining = Math.max(0, (FIGHT_TURN_TIME - (clock - fightStartedAt)) * 1000);
    setTimeout(() => {
      if (state !== 'fight' || fightRound !== 0) return;
      options.querySelectorAll('button').forEach(button => { button.disabled = false; });
      if (!isPhone()) options.querySelector('button')?.focus({ preventScroll: true });
    }, remaining);
  } else if (!isPhone()) {
    requestAnimationFrame(() => options.querySelector('button')?.focus({ preventScroll: true }));
  }
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
  } else {
    fightResults.push(false);
    fightBossAttack = fightRound % FIGHT_BOSS_ATTACKS.length;
    feedback.textContent = 'O boss prepara seu poder!';
    fightAction = 'counter';
    fightActionAt = clock;
    fightCounterHit = false;
  }
  updateStatusBar();
}

function finishFight() {
  const hits = fightResults.filter(Boolean).length;
  if (hits < 2 || lives <= 0) {
    gameOver('O boss venceu a luta.');
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
  panel.hidden = false;
  panel.classList.remove('is-fight-question', 'is-near-catch');
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
    updateStatusBar();                                // coração da vez esvazia mais um pouco
    currentDoor().rattleAt = clock;
    boss.progress = Math.min(1, boss.progress + WRONG_PENALTY);
    if (errors > MAX_ERRORS) beginFight();
    else if (boss.progress >= 1) caught();
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

// Batimento: começa baixinho na pergunta e fica mais alto e mais rápido conforme o boss chega.
// Curva > 1 guarda o susto para o fim: ~8% no início, ~60% quando o boss aparece (70%), 100% colado.
const PULSE_MIN_VOLUME = 0.08;
const PULSE_CURVE = 1.4;
function updatePulse() {
  if (!pulseSfx || pulseSfx.stopped) pulseSfx = playSfx('pulse', { loop: true, volume: PULSE_MIN_VOLUME });
  const threat = boss.progress ** PULSE_CURVE;
  pulseSfx?.setVolume(PULSE_MIN_VOLUME + (1 - PULSE_MIN_VOLUME) * threat);
  pulseSfx?.setRate(0.9 + boss.progress * 0.75);
}

function resetPulse() {
  pulseSfx?.stop();
  pulseSfx = null;
}

// ===================== HUD =====================
function updateStatusBar() {
  if (!statusBar) return;
  statusBar.hidden = false;
  // Erros na pergunta atual esvaziam o coração da vez; acertou (answering), ele enche de volta
  const drain = state === 'checkpoint' && !answering ? errors : 0;
  renderLives(livesEl, lives, LIVES, drain);
  renderScore(scoreEl, score);
}

// ===================== FIM DE PARTIDA =====================
// Painel (gameover-panel.webp), botões (gameover-buttons.webp) e números (digits-sheet.webp)
// vêm de fimdepartidaHUd.png, botoesHudFimDepartida.png e numeros.png.

function gameOver(reason) {
  if (!active || state === 'over') return;
  setState('over');
  resetPulse();
  panel.hidden = false;
  panel.classList.remove('is-fight-question', 'is-near-catch');
  panel.classList.add('is-game-over');
  // Textos fixos já estão desenhados nas imagens: ficam só para leitores de tela (go-sr)
  panel.innerHTML = `
    <section class="game-over-card" aria-labelledby="gameOverTitle">
      <p class="go-sr">FUGA INFERNAL · FIM DE PARTIDA</p>
      <h2 id="gameOverTitle" class="game-over-title"></h2>
      <div class="game-over-result">
        <span class="go-sr">QUESTÕES CERTAS: ${score}</span>
        <span class="go-number" aria-hidden="true">${spriteNumber(score)}</span>
      </div>
      <div class="game-over-actions">
        <button type="button" class="go-btn go-btn--retry" data-action="retry"><span class="go-sr">TENTAR NOVAMENTE</span></button>
        <button type="button" class="go-btn go-btn--home" data-action="home"><span class="go-sr">VOLTAR AO MENU</span></button>
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
  [OWL.src, GROUND.src, BOSS.src, PASS.src, GRAB.src, FIGHT_OWL.src, FIGHT_BOSS.src, FIGHT_BOSS_HIT.src, BOSS_POWER.src, FIGHT_INTRO.src].forEach(loadImage);

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
  cameraZoom = 1;
  cameraLift = 0;
  hideCheckpointDoor = false;
  fightAction = 'idle';
  fightIntro = false;
  fightCounterHit = false;
  embers = [];
  boss.progress = 0;
  setBossMode('hidden');
  buildDeck();

  // Chão inicial sem buracos cobrindo a tela toda
  segments = [];
  const first = addSegment(-owlScreenX - TILE_W, Math.ceil((viewW + TILE_W * 2) / TILE_STEP));
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
