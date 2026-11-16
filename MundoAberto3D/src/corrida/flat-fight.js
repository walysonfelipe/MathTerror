import * as THREE from 'three';
import { rumble } from './input.js';

/**
 * Arena do boss, no fundo do abismo da Dimensão Plana.
 *
 * A luta é por contas: acertou, a coruja corre e bate (o boss perde vida);
 * errou ou o tempo acabou, o boss lança a esfera π (a coruja perde um coração).
 * Arte e tempos vieram do MathTerror 2D (branch jogo-2d, js/runner-fight-assets.js).
 * Na arte original o boss fica à esquerda e a coruja à direita.
 */

const img = (name) => new URL(`../../assets/images/${name}.webp`, import.meta.url).href;

// [x, y, w, h] ou [x, y, w, h, âncoraX, âncoraY] em pixels da prancha.
// Sem âncora: meio do recorte na horizontal e a base do recorte no chão.
const OWL = {
  src: img('owl-fight-sheet'), W: 1362, H: 1155, scale: 150 / 240,
  frames: [
    [74, 34, 218, 241], [389, 32, 240, 244], [718, 39, 231, 236], [1070, 42, 259, 234],
    [46, 315, 271, 238], [344, 320, 335, 232], [748, 315, 231, 238], [1104, 306, 228, 252],
    [12, 584, 357, 250], [414, 626, 236, 205], [708, 636, 275, 198], [1002, 581, 342, 244],
    [40, 894, 296, 200], [383, 895, 271, 198], [591, 890, 462, 201], [1092, 881, 229, 219],
  ],
};
const OWL_STANCE = 3;
const OWL_COMBOS = [[4, 5, 6], [7, 8, 6], [9, 10, 11], [4, 5, 8, 11]];
const OWL_IMPACT = new Set([5, 8, 11]); // quadros em que o golpe encosta
const BOSS = {
  src: img('boss-fight-frames'), W: 1748, H: 1256, scale: 262.5 / 260,
  frames: [
    [8, 8, 317, 278, 148, 267], [445, 8, 364, 278, 180, 266], [882, 8, 407, 255, 180, 245], [1319, 8, 305, 262, 146, 251],
    [8, 322, 312, 260, 142, 251], [445, 322, 310, 264, 135, 254], [882, 322, 408, 254, 141, 246], [1319, 322, 357, 249, 120, 238],
    [8, 636, 328, 249, 162, 236], [445, 636, 297, 298, 151, 290], [882, 636, 421, 238, 176, 228], [1319, 636, 329, 278, 150, 270],
    [8, 950, 308, 266, 134, 258], [445, 950, 325, 265, 140, 257], [882, 950, 414, 261, 153, 252], [1319, 950, 381, 241, 130, 233],
  ],
};
const BOSS_GUARD = 0, BOSS_FISTS = 3;
const BOSS_CASTS = [[4, 5, 6], [12, 13, 14]];
const BOSS_SLAM = [8, 9, 10, 11];
const BOSS_SLAM_TIMES = [0.16, 0.24, 0.32, 0.3];
const BOSS_RELEASE = { x: 200, y: 135 };  // de onde a esfera sai, a partir das âncoras
const BOSS_HIT = {
  src: img('boss-strike-sheet'), W: 1448, H: 1086, scale: 262.5 / 260,
  frames: [
    [18, 3, 320, 269], [378, 6, 317, 266], [740, 3, 323, 269], [1115, 6, 318, 266],
    [37, 272, 308, 271], [381, 272, 315, 271], [741, 272, 319, 271], [1112, 272, 313, 271],
    [19, 547, 322, 268], [380, 543, 315, 268], [742, 546, 318, 266], [1113, 543, 323, 272],
    [20, 815, 316, 257], [385, 815, 324, 257], [725, 815, 336, 256], [1113, 815, 320, 257],
  ],
};
const DEATH = {
  src: img('owl-death-sheet'), W: 1448, H: 1086, scale: 0.74,
  frames: [
    [2, 66, 415, 207, 333, 204], [418, 67, 346, 208, 263, 206], [775, 69, 309, 213, 217, 207], [1179, 94, 256, 190, 151, 183],
    [86, 338, 270, 226, 153, 223], [418, 377, 292, 196, 169, 192], [790, 414, 297, 167, 160, 164], [1128, 428, 293, 150, 158, 147],
    [28, 652, 350, 164, 196, 160], [389, 683, 361, 133, 194, 130], [774, 661, 315, 154, 163, 152], [1119, 688, 310, 129, 171, 126],
    [55, 879, 324, 165, 178, 161], [417, 914, 322, 128, 174, 125], [770, 918, 319, 121, 172, 119], [1118, 918, 308, 121, 167, 118],
  ],
  times: [0.12, 0.12, 0.14, 0.12, 0.11, 0.11, 0.12, 0.12, 0.12, 0.12, 0.14, 0.14, 0.2, 0.18, 0.18, 0.18],
  ball: { dx: -134, dy: 110 },  // onde a esfera está no quadro 0, a partir das âncoras
  knock: 70, lift: 40,
};
const BANNER = {
  src: img('fight'), W: 1536, H: 1024,
  frames: [[46, 104, 722, 372, 343, 207], [768, 70, 752, 440, 384, 221], [23, 576, 737, 379, 382, 179], [804, 579, 687, 352, 347, 189]],
};

const DROP_TIME = 0.85, INTRO_TIME = 1.7;
const DASH = 0.22, COMBO_FPS = 8, HIT_ANIM = 0.88, BACK_AT = 0.9, HIT_END = 1.3;
const CAST_FRAME = 0.14, CAST_TIME = 0.42, TRAVEL = 0.36, IMPACT_AT = CAST_TIME + TRAVEL;
const HURT_FRAMES = 5;                    // erro que não mata: só o começo da prancha de derrota
const sum = (a, n = a.length) => a.slice(0, n).reduce((s, v) => s + v, 0);
const HURT_END = IMPACT_AT + sum(DEATH.times, HURT_FRAMES) + 0.45;
const DEATH_END = IMPACT_AT + sum(DEATH.times) + 1.7;
const SLAM_AT = IMPACT_AT + sum(DEATH.times, 6) + 0.25;
const WIN_TIME = 2.6;
// Vitória: a coruja cambaleia, desmaia, a vista pisca e embaça (como num sonho),
// a câmera fecha na cabeça dela e tudo fica branco. Depois ela acorda no mundo 3D.
const FAINT_AT = 0.9;                                 // cambaleia até aqui, depois cai
const FAINT_FRAMES = [6, 7, 10, 11, 12, 13, 14, 15];  // prancha de derrota: cai e desmaia
const FAINT_FRAME = 0.14;
const BLINKS = [[1.7, 0.3], [2.6, 0.4], [3.4, 0.55]]; // [instante, duração] de cada piscada
const ZOOM_FROM = 2.1, ZOOM_TO = 4.7, ZOOM_MAX = 5.5;
const WHITE_FROM = 3.7, DREAM_END = 5.1;
const HEAD = { x: 0.55, y: 0.5 };                     // cabeça da coruja deitada, a partir do corpo
const smooth = (k) => { const c = Math.max(0, Math.min(1, k)); return c * c * (3 - 2 * c); };

// falas da luta (sorteadas)
const TAUNTS = ['Erre uma conta e eu cobro em corações.', 'Ninguém sai do abismo sem fechar a conta.', 'Cada erro seu alimenta o meu fogo.'];
const RIGHT = ['Acertou!', 'Conta fechada!', 'Na mosca!', 'O Guardião sentiu essa!'];
const WRONG = ['Errou… o Guardião cobra.', 'Conta errada. Lá vem fogo!', 'Não fechou… segura essa!'];
const any = (list) => list[Math.floor(Math.random() * list.length)];
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// conta com 4 respostas; `tier` 0..2 vai subindo conforme o boss perde vida
function makeQuestion(tier) {
  let text, answer;
  const kind = rnd(0, tier === 0 ? 1 : 3);
  if (tier >= 2 && Math.random() < 0.45) {
    const a = rnd(3, 9), b = rnd(3, 9), c = rnd(2, 12);
    if (Math.random() < 0.5) { text = `${a} × ${b} + ${c}`; answer = a * b + c; }
    else { text = `${a} × ${b} − ${Math.min(c, a * b)}`; answer = a * b - Math.min(c, a * b); }
  } else if (kind === 0) {
    const m = tier === 0 ? 20 : 60;
    const a = rnd(4, m), b = rnd(3, m);
    text = `${a} + ${b}`; answer = a + b;
  } else if (kind === 1) {
    const m = tier === 0 ? 25 : 80;
    const b = rnd(2, m - 5), a = rnd(b, m);
    text = `${a} − ${b}`; answer = a - b;
  } else if (kind === 2) {
    const a = rnd(2, 9), b = rnd(tier >= 2 ? 6 : 2, tier >= 2 ? 12 : 9);
    text = `${a} × ${b}`; answer = a * b;
  } else {
    const b = rnd(2, 9), q = rnd(2, tier >= 2 ? 12 : 9);
    text = `${b * q} ÷ ${b}`; answer = q;
  }
  const options = new Set([answer]);
  const near = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5];
  while (options.size < 4) {
    const v = answer + near[rnd(0, near.length - 1)];
    if (v >= 0) options.add(v);
  }
  const list = [...options].sort(() => Math.random() - 0.5);
  return { text: `${text} = ?`, options: list, answer: list.indexOf(answer) };
}

// ---------- painel da pergunta (HTML por cima do jogo) ----------
const CSS = `
#fight-ui { position: fixed; left: 50%; top: max(64px, 9vh); transform: translateX(-50%); z-index: 30; width: min(92vw, 620px);
  display: flex; flex-direction: column; align-items: center; gap: 10px; font-family: var(--font-num); color: var(--bone); pointer-events: none; }
#fight-ui[hidden] { display: none; }
#fight-ui .fu-boss { width: 100%; display: flex; flex-direction: column; gap: 4px; align-items: center; }
#fight-ui .fu-name { font-family: var(--font-title); font-size: clamp(18px, 2.6vw, 26px); color: #ffb070; text-shadow: 0 2px 0 #000, 0 0 14px #ff3a0a88; letter-spacing: .04em; }
#fight-ui .fu-hp { width: 100%; height: 16px; border-radius: 9px; background: #1a0808; border: 2px solid #6a3a1e; box-shadow: 0 0 0 2px #0e0606, 0 4px 14px #000a; overflow: hidden; }
#fight-ui .fu-hp i { display: block; height: 100%; width: 100%; background: linear-gradient(180deg, #ff7a3a, #d8200c 55%, #7a0a04); transition: width .45s cubic-bezier(.2,.8,.3,1); box-shadow: inset 0 2px 0 #ffffff40; }
#fight-ui .fu-card { width: 100%; box-sizing: border-box; padding: 12px 16px 14px; border-radius: 14px; background: linear-gradient(180deg, #2a1414ee, #120808f2);
  border: 2px solid #6a3a1e; box-shadow: 0 0 0 2px #0e0606, 0 10px 30px #000c, inset 0 1px 0 #ffffff18; display: flex; flex-direction: column; gap: 10px; align-items: center;
  pointer-events: auto; transition: opacity .2s, transform .2s; }
#fight-ui.wait .fu-card { opacity: 0; transform: translateY(-8px); pointer-events: none; }
#fight-ui .fu-q { font-size: clamp(26px, 5vw, 42px); font-weight: 700; color: var(--gold); text-shadow: 0 2px 0 #000; letter-spacing: .04em; }
#fight-ui .fu-time { width: 100%; height: 6px; border-radius: 4px; background: #00000080; overflow: hidden; }
#fight-ui .fu-time i { display: block; height: 100%; width: 100%; background: #ffc45a; transform-origin: left; }
#fight-ui .fu-time.low i { background: #ff4a2a; }
#fight-ui .fu-opts { width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
#fight-ui .fu-opts button { font: 700 clamp(18px, 3.2vw, 26px) var(--font-num); color: var(--bone); padding: 10px 4px; border-radius: 10px; cursor: pointer;
  background: linear-gradient(180deg, #5a2a1a, #34140e); border: 2px solid #8a5a2a; box-shadow: 0 3px 0 #1a0a06; position: relative; touch-action: manipulation; }
#fight-ui .fu-opts button:hover, #fight-ui .fu-opts button:focus-visible { background: linear-gradient(180deg, #8a3a1e, #4a1a10); outline: none; border-color: #ffc070; }
#fight-ui .fu-opts button kbd { position: absolute; left: 6px; top: 3px; font: 600 11px var(--font-num); color: #c8a878; opacity: .8; }
html.touch #fight-ui .fu-opts button kbd { display: none; }
#fight-ui .fu-opts button.ok { background: linear-gradient(180deg, #3a8a3a, #16501a); border-color: #b8ff9a; }
#fight-ui .fu-opts button.bad { background: linear-gradient(180deg, #a0201a, #520a08); border-color: #ff8a7a; }
#fight-ui .fu-msg { min-height: 1.3em; font-family: var(--font-title); font-size: clamp(20px, 3.4vw, 32px); text-shadow: 0 2px 0 #000, 0 0 16px #000; }
#fight-ui .fu-msg.good { color: #b8ff9a; } #fight-ui .fu-msg.bad { color: #ff8a6a; }
#dream-fx { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
#dream-fx[hidden] { display: none; }
#dream-fx i { position: absolute; inset: 0; opacity: 0; }
#dream-fx .lid { background: #000; } #dream-fx .white { background: #fff; }
#dream-fx.wake .white { animation: dream-white 2.6s ease-out forwards; }
#dream-fx.wake .lid { animation: dream-lid 2.6s linear forwards; }
@keyframes dream-white { 0%, 12% { opacity: 1; } 100% { opacity: 0; } }
@keyframes dream-lid { 0%, 28% { opacity: 0; } 38% { opacity: .85; } 48%, 62% { opacity: 0; } 72% { opacity: .65; } 84%, 100% { opacity: 0; } }
@media (max-height: 460px) { #fight-ui { top: 46px; gap: 5px; } #fight-ui .fu-card { padding: 6px 12px 8px; gap: 6px; } #fight-ui .fu-opts button { padding: 6px 4px; } #fight-ui .fu-name { font-size: 16px; } }
`;

function makePanel() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'fight-ui';
  root.hidden = true;
  root.innerHTML = `
    <div class="fu-boss"><div class="fu-name">π · O Guardião do Abismo</div><div class="fu-hp"><i></i></div></div>
    <div class="fu-card">
      <div class="fu-q"></div>
      <div class="fu-time"><i></i></div>
      <div class="fu-opts">${[0, 1, 2, 3].map((i) => `<button type="button" data-i="${i}"><kbd>${i + 1}</kbd><span></span></button>`).join('')}</div>
    </div>
    <div class="fu-msg"></div>`;
  document.body.append(root);
  const fx = document.createElement('div');
  fx.id = 'dream-fx';
  fx.hidden = true;
  fx.innerHTML = '<i class="lid"></i><i class="white"></i>';
  document.body.append(fx);
  return {
    root, fx, lid: fx.firstChild, white: fx.lastChild,
    hp: root.querySelector('.fu-hp i'),
    q: root.querySelector('.fu-q'),
    time: root.querySelector('.fu-time'),
    timeBar: root.querySelector('.fu-time i'),
    buttons: [...root.querySelectorAll('.fu-opts button')],
    msg: root.querySelector('.fu-msg'),
  };
}

/**
 * ctx: { scene, plane, flatMat, sheet, tiles: () => materiais do chão, tile: { w, h, step, surface },
 *        splash(x, y, n), sfx, U, camY, cb: { onHurt, onWin, onLose } }
 */
export function createFight(ctx) {
  const { scene, plane, flatMat, sheet, splash, sfx, U, camY, cb } = ctx;
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const ui = makePanel();

  // um desenho por prancha; só um da coruja e um do boss aparecem de cada vez
  const sprites = {};
  const loader = new THREE.TextureLoader();
  const ready = Promise.all([OWL, BOSS, BOSS_HIT, DEATH, BANNER].map((d) => loader.loadAsync(d.src))).then((texs) => {
    const names = ['owl', 'boss', 'bossHit', 'death', 'banner'];
    const orders = [6, 5, 5, 6, 9];
    texs.forEach((t, i) => {
      sheet(t);
      const mesh = plane(flatMat({ map: t }), 1, 1, orders[i]);
      mesh.visible = false;
      group.add(mesh);
      sprites[names[i]] = { mesh, tex: t, def: [OWL, BOSS, BOSS_HIT, DEATH, BANNER][i] };
    });
  });

  // mostra o recorte `f` com a âncora em (x, y); devolve a escala usada (metros por pixel)
  function show(name, f, x, y, { flip = false, k = 1, alpha = 1, rot = 0 } = {}) {
    const s = sprites[name];
    const [rx, ry, w, h, ax = w / 2, ay = h] = s.def.frames[f];
    const m = (s.def.scale ?? 1) * U * k;
    s.tex.repeat.set(w / s.def.W, h / s.def.H);
    s.tex.offset.set(rx / s.def.W, 1 - (ry + h) / s.def.H);
    const dir = flip ? -1 : 1;
    s.mesh.scale.set(w * m * dir, h * m, 1);
    s.mesh.position.set(x + (w / 2 - ax) * m * dir, y - (h / 2 - ay) * m, 0);
    s.mesh.rotation.z = rot;
    s.mesh.material.opacity = alpha;
    s.mesh.visible = alpha > 0;
    return m;
  }
  const hide = (...names) => names.forEach((n) => { if (sprites[n]) sprites[n].mesh.visible = false; });

  // esfera π do boss (fogo desenhado) e chão da arena
  let ball = null, ballCore = null, built = false;
  function build() {
    if (built) return;
    built = true;
    const { w, h, step, surface } = ctx.tile;
    const mats = ctx.tiles();
    for (let i = -7; i <= 7; i++) {
      const m = plane(mats[(i + 70) * 5 % mats.length], w, h, 3);
      m.position.set(i * step, surface - h / 2, 0);
      group.add(m);
    }
    ball = plane(ctx.fire.glow, 2.4, 2.4, 7);
    ballCore = plane(ctx.fire.core, 1.2, 1.2, 8);
    ball.visible = ballCore.visible = false;
    group.add(ball, ballCore);
  }

  // ---------- estado ----------
  let active = false, phase = 'off', t = 0, player = null;
  let bossHP = 5, bossMax = 5, limit = 14, timeLeft = 0, question = null, round = 0, wrongs = 0;
  let owlX = 4, bossX = -4, lethal = false, lastFrame = -1, shake = 0, boomT = 0, done = false;

  function setPhase(p) { phase = p; t = 0; lastFrame = -1; }

  // ---------- sonho: piscadas, vista embaçada e o clarão branco ----------
  const gameCanvas = () => document.querySelector('body > canvas');
  let wakeTimer = 0;
  function dreamFx(lid, white, blur) {
    ui.fx.hidden = false;
    ui.fx.classList.remove('wake');
    ui.lid.style.opacity = lid.toFixed(3);
    ui.white.style.opacity = white.toFixed(3);
    const c = gameCanvas();
    if (c) { c.style.transition = ''; c.style.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px) brightness(${(1 + blur * 0.04).toFixed(2)})` : ''; }
  }
  function clearDream() {
    clearTimeout(wakeTimer);
    ui.fx.hidden = true;
    ui.fx.classList.remove('wake');
    ui.lid.style.opacity = ui.white.style.opacity = '';
    const c = gameCanvas();
    if (c) { c.style.transition = ''; c.style.filter = ''; }
  }
  // já no mundo 3D: o branco some devagar, com duas piscadas, e a vista volta a ficar nítida
  function wake() {
    ui.lid.style.opacity = ui.white.style.opacity = '';
    ui.fx.classList.add('wake');
    const c = gameCanvas();
    if (c) { c.style.transition = 'filter 2.4s ease-out'; c.style.filter = 'blur(0px)'; }
    clearTimeout(wakeTimer);
    wakeTimer = setTimeout(clearDream, 2700);
  }

  function ask() {
    setPhase('ask');
    const tier = bossHP > bossMax * 0.66 ? 0 : bossHP > bossMax * 0.33 ? 1 : 2;
    question = makeQuestion(tier);
    timeLeft = limit;
    ui.q.textContent = question.text;
    ui.buttons.forEach((b, i) => { b.className = ''; b.disabled = false; b.lastElementChild.textContent = question.options[i]; });
    ui.msg.textContent = '';
    ui.root.classList.remove('wait');
    if (document.body.classList.contains('pad')) ui.buttons[0].focus();
  }

  function answer(i) {
    if (!active || phase !== 'ask') return;
    const right = i === question.answer;
    ui.buttons.forEach((b) => { b.disabled = true; });
    ui.buttons[question.answer].classList.add('ok');
    if (i >= 0 && !right) ui.buttons[i].classList.add('bad');
    ui.msg.className = `fu-msg ${right ? 'good' : 'bad'}`;
    ui.msg.textContent = right ? any(RIGHT) : i < 0 ? 'O tempo acabou… e ele não espera.' : any(WRONG);
    setTimeout(() => { if (phase !== 'ask') ui.root.classList.add('wait'); }, 420);
    if (right) { round++; setPhase('hit'); sfx.gateOk?.(); }
    else {
      wrongs++;
      lethal = player.P.hearts <= 1;
      setPhase('miss');
      sfx.playClip?.('luta-spell', 0.6);
    }
  }
  ui.buttons.forEach((b, i) => b.addEventListener('click', () => answer(i)));
  addEventListener('keydown', (e) => {
    if (!active || phase !== 'ask' || e.repeat) return;
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
    if (n !== undefined) { e.preventDefault(); answer(n); }
  });

  function start(pl, visits, halfW) {
    player = pl;
    build();
    active = true; done = false;
    clearDream();
    group.visible = true;
    bossMax = bossHP = 5 + Math.min(2, visits);
    limit = Math.max(9, 14 - visits * 1.5);
    round = 0; wrongs = 0; lethal = false; shake = 0;
    const side = Math.min(4.4, halfW * 0.46);
    owlX = side; bossX = -side;
    pl.P.hearts = 3; // a luta começa com as vidas cheias
    pl.P.invuln = 0;
    ui.hp.style.width = '100%';
    ui.msg.className = 'fu-msg bad';
    ui.msg.textContent = `“${any(TAUNTS)}”`;
    ui.root.classList.add('wait');
    ui.root.hidden = false;
    setPhase('drop');
  }

  function stop() {
    if (active && phase !== 'dream') clearDream(); // (no sonho, quem limpa é o despertar)
    active = false;
    phase = 'off';
    group.visible = false;
    ui.root.hidden = true;
  }

  function hurtOwl() {
    const P = player.P;
    P.hearts = Math.max(0, P.hearts - 1);
    sfx.playClip?.('luta-impact', 0.7);
    sfx.hurt?.();
    rumble(lethal ? 1 : 0.6, lethal ? 600 : 220);
    shake = 0.5;
    cb.onHurt?.();
  }

  // ---------- lógica ----------
  function update(dt) {
    if (!active) return;
    t += dt;
    shake = Math.max(0, shake - dt * 1.8);

    if (phase === 'drop') {
      if (t >= DROP_TIME) { setPhase('intro'); splash(owlX, 0.1, 14); sfx.land?.(1, 'pedra'); sfx.playClip?.('luta-fight', 0.7); shake = 0.3; }
    } else if (phase === 'intro') {
      if (t >= INTRO_TIME) ask();
    } else if (phase === 'ask') {
      timeLeft -= dt;
      ui.timeBar.style.transform = `scaleX(${Math.max(0, timeLeft / limit).toFixed(3)})`;
      ui.time.classList.toggle('low', timeLeft < limit * 0.3);
      if (timeLeft <= 0) answer(-1);
    } else if (phase === 'hit') {
      if (t >= HIT_END) {
        if (bossHP <= 0) { setPhase('win'); ui.root.classList.add('wait'); ui.msg.textContent = ''; sfx.rumble?.(); }
        else ask();
      }
    } else if (phase === 'miss') {
      const before = t - dt;
      if (before < IMPACT_AT && t >= IMPACT_AT) hurtOwl();
      if (lethal && before < SLAM_AT + 0.4 && t >= SLAM_AT + 0.4) { shake = 0.6; sfx.boom?.(0.6); splash(bossX + 1.6, 0.1, 20); }
      if (!lethal && t >= HURT_END) ask();
      if (lethal && t >= DEATH_END && !done) { done = true; ui.root.hidden = true; cb.onLose(); }
    } else if (phase === 'win') {
      boomT -= dt;
      if (t < 1.7 && boomT <= 0) {
        boomT = 0.13;
        splash(bossX + (Math.random() - 0.5) * 2.4, 0.4 + Math.random() * 2.6, 12);
        sfx.boom?.(0.25);
        shake = Math.max(shake, 0.25);
      }
      if (t >= WIN_TIME) { setPhase('dream'); ui.root.hidden = true; cb.onFaint?.(); }
    } else if (phase === 'dream') {
      const blink = Math.max(0, ...BLINKS.map(([at, w]) => 1 - Math.abs(t - at) / (w / 2)));
      dreamFx(Math.min(0.92, blink), smooth((t - WHITE_FROM) / (DREAM_END - WHITE_FROM - 0.2)), smooth((t - 1.2) / 2.6) * 7);
      if (t >= DREAM_END && !done) { done = true; cb.onWin(); wake(); }
    }
  }

  // ---------- desenho ----------
  function place(dt, time) {
    const view = { shake: 0, zoom: 1, x: 0, y: 0 };
    if (!active || !sprites.owl) return view;
    hide('owl', 'boss', 'bossHit', 'death', 'banner');
    ball.visible = ballCore.visible = false;
    const P = player.P;
    const breathe = Math.sin(time * 3) * 0.012;

    if (phase === 'drop') {
      // a coruja chega caindo; o boss já espera
      const k = Math.min(1, t / DROP_TIME);
      show('owl', 0, owlX, 10 * (1 - k * k), { rot: (1 - k) * 2.5 });
      show('boss', BOSS_GUARD, bossX, 0, { k: 1 + breathe });
    } else if (phase === 'intro') {
      show('owl', Math.min(OWL_STANCE, Math.floor(t * 5)), owlX, 0);
      show('boss', t < 0.5 ? BOSS_GUARD : 1, bossX, 0);
      // letreiro FIGHT: surge, explode e pulsa
      const f = t < 0.22 ? 0 : t < 0.42 ? 1 : 2 + (Math.floor(t / 0.14) % 2);
      const grow = t < 0.22 ? 0.5 + (t / 0.22) * 0.5 : 1;
      show('banner', f, 0, camY + 0.6, { k: (7.5 / 722 / U) * grow, alpha: Math.min(1, (INTRO_TIME - t) / 0.25) });
    } else if (phase === 'ask') {
      show('owl', OWL_STANCE, owlX, 0, { k: 1 + breathe });
      show('boss', BOSS_GUARD, bossX, 0, { k: 1 - breathe });
    } else if (phase === 'hit') {
      // corre até o boss, bate e volta
      const reach = bossX + 2.5;
      const combo = OWL_COMBOS[(round - 1) % OWL_COMBOS.length];
      let x = owlX, f = OWL_STANCE;
      if (t < DASH) { x = owlX + (reach - owlX) * (t / DASH); f = 13; }
      else if (t < BACK_AT) {
        x = reach;
        f = combo[Math.min(combo.length - 1, Math.floor((t - DASH) * COMBO_FPS))];
        if (f !== lastFrame && OWL_IMPACT.has(f)) {
          // o golpe encostou: só o primeiro tira vida
          if (!combo.slice(0, combo.indexOf(f)).some((q) => OWL_IMPACT.has(q))) {
            bossHP--;
            ui.hp.style.width = `${Math.max(0, (bossHP / bossMax) * 100)}%`;
          }
          sfx.playClip?.('luta-punch', 0.7);
          splash(bossX + 0.6, 1.6, 12);
          rumble(0.4, 120);
          shake = 0.35;
        }
        lastFrame = f;
      } else { const k = Math.min(1, (t - BACK_AT) / (HIT_END - BACK_AT - 0.1)); x = reach + (owlX - reach) * k; f = k < 1 ? 12 : OWL_STANCE; }
      show('owl', f, x, 0);
      const ht = t - DASH - 0.1;
      if (ht >= 0 && ht < HIT_ANIM) show('bossHit', Math.min(15, Math.floor((ht / HIT_ANIM) * 16)), bossX, 0);
      else show('boss', BOSS_GUARD, bossX, 0);
    } else if (phase === 'miss') {
      // boss: carrega, solta a esfera e fecha os punhos (ou comemora batendo no chão)
      const cast = BOSS_CASTS[(wrongs - 1) % BOSS_CASTS.length];
      let bf = t < CAST_TIME ? cast[Math.min(2, Math.floor(t / CAST_FRAME))] : BOSS_FISTS;
      if (lethal && t >= SLAM_AT) {
        let st = t - SLAM_AT, i = 0;
        while (i < BOSS_SLAM.length - 1 && st > BOSS_SLAM_TIMES[i]) { st -= BOSS_SLAM_TIMES[i]; i++; }
        bf = t - SLAM_AT > sum(BOSS_SLAM_TIMES) + 0.3 ? BOSS_GUARD : BOSS_SLAM[i];
      }
      const bm = show('boss', bf, bossX, 0);
      const dm = DEATH.scale * U;
      if (t < IMPACT_AT) {
        show('owl', OWL_STANCE, owlX, 0);
        if (t >= CAST_TIME) {
          // esfera voando da mão do boss até a coruja
          const k = (t - CAST_TIME) / TRAVEL;
          const x0 = bossX + BOSS_RELEASE.x * bm, y0 = BOSS_RELEASE.y * bm;
          const x1 = owlX + DEATH.ball.dx * dm, y1 = DEATH.ball.dy * dm;
          const bx = x0 + (x1 - x0) * k, by = y0 + (y1 - y0) * k;
          ball.visible = ballCore.visible = true;
          ball.position.set(bx, by, 0);
          ballCore.position.set(bx, by, 0);
          ball.scale.setScalar(2.4 + Math.sin(time * 40) * 0.25);
        }
      } else {
        // prancha de derrota: explosão, arremesso e (se for a última vida) a queda inteira
        let dtm = t - IMPACT_AT, i = 0;
        const last = lethal ? DEATH.frames.length - 1 : HURT_FRAMES - 1;
        while (i < last && dtm > DEATH.times[i]) { dtm -= DEATH.times[i]; i++; }
        const total = sum(DEATH.times, lethal ? 9 : HURT_FRAMES);
        const k = Math.min(1, (t - IMPACT_AT) / total);
        const push = (lethal ? DEATH.knock : DEATH.knock * 0.35) * dm * k * (2 - k);
        const lift = i >= 3 && i <= 5 ? DEATH.lift * dm * Math.sin(k * Math.PI) : 0;
        if (!lethal && t - IMPACT_AT > sum(DEATH.times, HURT_FRAMES)) {
          // levantou: pisca um pouco e volta para a guarda
          if (Math.floor(time * 18) % 2) show('owl', OWL_STANCE, owlX, 0);
        } else show('death', i, owlX + push, lift);
      }
    } else if (phase === 'win') {
      // boss derrotado: treme com explosões e desmancha
      show('owl', t < 0.4 ? OWL_STANCE : 0, owlX, 0);
      const fade = Math.max(0, 1 - Math.max(0, t - 1.5) / 0.7);
      show('bossHit', 4 + (Math.floor(t * 14) % 8), bossX + (Math.random() - 0.5) * 0.12, -Math.max(0, t - 1.5) * 1.2, { alpha: fade });
    }
    else if (phase === 'dream') {
      // sozinha na arena: cambaleia, cai desmaiada e a câmera fecha na cabeça dela
      if (t < FAINT_AT) show('owl', 0, owlX + Math.sin(t * 9) * 0.07 * (t / FAINT_AT), 0, { rot: Math.sin(t * 6.5) * 0.16 * (t / FAINT_AT) });
      else show('death', FAINT_FRAMES[Math.min(FAINT_FRAMES.length - 1, Math.floor((t - FAINT_AT) / FAINT_FRAME))], owlX, 0);
      const e = smooth((t - ZOOM_FROM) / (ZOOM_TO - ZOOM_FROM));
      view.zoom = 1 + (ZOOM_MAX - 1) * e;
      view.x = (owlX + HEAD.x) * e;
      view.y = (HEAD.y - camY) * e;
    }
    view.shake = shake * 0.35;
    return view;
  }

  /** tela de carregamento: mostra um de cada para a GPU já conhecer */
  function prewarm() {
    if (!sprites.owl) return;
    build();
    for (const n of Object.keys(sprites)) show(n, 0, 0, 0);
  }

  return {
    ready, start, stop, update, place, prewarm,
    get active() { return active; },
    get won() { return phase === 'win'; },
  };
}
