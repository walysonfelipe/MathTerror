import * as THREE from 'three';
import { makeRounds } from './train-math.js';

/**
 * O Trem Fantasma.
 *
 * A coruja corre por cima dos vagões de um trem em movimento, num viaduto sobre o abismo.
 * Cada rodada tem uma regra (pares, tabuada do 3, contar de 4 em 4…): os vagões que seguem
 * a regra aguentam o peso, os outros desabam. São cinco rodadas até a locomotiva, onde a
 * coruja puxa o freio e o trem para num reino novo.
 *
 * A física é a mesma da trilha (de lado, eixo x). O que muda o tempo todo é a câmera:
 * de lado, de cima da cabeça, por trás, colada na cabeça, de frente, de baixo, girando em volta.
 * Em todos os planos em que se joga, "direita" continua sendo "para a frente do trem".
 */

// Medidas pensadas para o pulo normal (andando, sem correr):
// toque rápido no pulo = cai no próximo vagão; pulo segurado = passa por cima de um vagão inteiro.
const CAR_LEN = 3.8;          // vagão numerado
const CK = CAR_LEN / 3.2;     // escala dos detalhes (pensados para o vagão de 3,2 m)
const GAP = 1.0;              // vão entre vagões
const PITCH = CAR_LEN + GAP;
const SAFE_LEN = 12;          // vagão de passageiros (seguro) entre as rodadas
const START_X = -2;           // o primeiro vagão seguro começa um pouco atrás
const TENDER_LEN = 9;         // capô comprido da locomotiva, onde fica o freio
const LEVER_X = 7.5;          // posição da alavanca em cima do capô
const LEVER_H = 0.74;         // altura da pega (os braços da coruja são curtos)
const HALF_W = 1.15;          // meia largura dos vagões
const RAIL_Y = -3.42;         // topo dos trilhos (o teto dos vagões fica em y = 0)
const SPEED = 24;             // velocidade do trem (m/s): é o cenário que corre para trás
const MAX_CARS = 9, ROUNDS = 5;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (k) => { const x = clamp(k, 0, 1); return x * x * (3 - 2 * x); };
const mod = (v, m) => ((v % m) + m) % m;

function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

// ---------- texturas desenhadas ----------
const woodTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#6a5a4c'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {
    g.fillStyle = `rgba(${40 + Math.random() * 30},${30 + Math.random() * 20},${22 + Math.random() * 16},.55)`;
    g.fillRect(x, 0, 32, h);
    g.fillStyle = '#0009'; g.fillRect(x, 0, 2, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.14})`; g.fillRect(x + 3 + Math.random() * 26, Math.random() * h, 1.5, 20 + Math.random() * 60); }
  }
  // ferrugem e fuligem escorrendo
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * w, y = Math.random() * h * 0.5, l = 30 + Math.random() * 90;
    const gr = g.createLinearGradient(0, y, 0, y + l);
    gr.addColorStop(0, 'rgba(20,8,4,.5)'); gr.addColorStop(1, 'rgba(20,8,4,0)');
    g.fillStyle = gr; g.fillRect(x, y, 3 + Math.random() * 6, l);
  }
});
const deckTex = () => canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#1c1a22'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${90 + Math.random() * 50},${100 + Math.random() * 60},${0.1 + Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = '#3a2a1e'; g.fillRect(20, 6, 24, h - 12); // dormente
  g.fillStyle = '#0008'; g.fillRect(20, 6, 3, h - 12);
});
const windowTex = () => canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h * 0.45, 4, w / 2, h / 2, w * 0.7);
  gr.addColorStop(0, '#d8ff9a'); gr.addColorStop(0.55, '#5aa83a'); gr.addColorStop(1, '#16300f');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // um passageiro que não desceu
  g.fillStyle = '#081006e0';
  g.beginPath(); g.arc(w / 2, h * 0.5, 20, 0, 7); g.fill();
  g.fillRect(w / 2 - 30, h * 0.64, 60, h);
  g.fillStyle = '#d8ff9a'; g.fillRect(w / 2 - 10, h * 0.47, 5, 4); g.fillRect(w / 2 + 5, h * 0.47, 5, 4);
  g.strokeStyle = '#120c08'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
});
const skylineTex = (seed, trees) => canvasTex(1024, 256, (g, w, h) => {
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  g.fillStyle = trees ? '#0a0914' : '#15132c';
  g.beginPath(); g.moveTo(0, h);
  let y = h * 0.55;
  const y0 = y;
  for (let x = 0; x <= w; x += 16) {
    y = clamp(y + (rnd() - 0.5) * 38, h * 0.2, h * 0.85);
    if (x > w - 160) y += (y0 - y) * ((x - (w - 160)) / 160); // fecha igual ao começo (emenda sem degrau)
    g.lineTo(x, y);
  }
  g.lineTo(w, h); g.fill();
  if (!trees) return;
  g.strokeStyle = '#0a0914';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, base = h * (0.5 + rnd() * 0.3), top = base - 40 - rnd() * 70;
    g.lineWidth = 3 + rnd() * 3;
    g.beginPath(); g.moveTo(x, h); g.lineTo(x, top); g.stroke();
    g.lineWidth = 2;
    for (let b = 0; b < 5; b++) { const by = top + rnd() * 50, d = (rnd() < 0.5 ? -1 : 1) * (10 + rnd() * 26); g.beginPath(); g.moveTo(x, by); g.lineTo(x + d, by - 8 - rnd() * 18); g.stroke(); }
  }
});
const glowTex = (inner, outer) => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
const moonTex = () => canvasTex(256, 256, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 40, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(232,238,255,1)'); gr.addColorStop(0.42, 'rgba(214,224,255,1)'); gr.addColorStop(0.46, 'rgba(150,170,255,.35)'); gr.addColorStop(1, 'rgba(120,140,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
  g.fillStyle = 'rgba(120,130,170,.35)';
  for (const [x, y, r] of [[105, 100, 16], [150, 135, 22], [120, 160, 9], [160, 95, 8]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
});

const CSS = `
#train-hud { position: fixed; top: max(8px, env(safe-area-inset-top)); left: 50%; transform: translate(-50%, -160%); z-index: 6; pointer-events: none; text-align: center;
  width: max-content; max-width: min(60vw, 600px); padding: 7px 22px 9px; border-radius: 12px; background: linear-gradient(#140d0aee, #070505f2);
  box-shadow: inset 0 0 0 1px #8a6a3a99, 0 8px 22px #000c; transition: transform .5s cubic-bezier(.3,1.3,.5,1); }
#train-hud.show { transform: translate(-50%, 0); }
#train-hud .tr-k { font: 600 clamp(9px, 1.3vw, 12px)/1 var(--font-num); letter-spacing: .2em; color: #b9a27c; }
#train-hud .tr-t { margin-top: 3px; font: 700 clamp(17px, min(3vw, 6.4vh), 30px)/1.1 var(--font-title); letter-spacing: .03em; color: var(--gold, #f2c45a); text-shadow: 0 2px 0 #2a1608, 0 4px 10px #000; }
#train-hud .tr-h { margin-top: 2px; font: italic clamp(12px, min(1.8vw, 3.6vh), 16px)/1.2 var(--font-text); color: #e8d8b8; }
#train-hud .tr-go { display: none; margin-top: 8px; font: 600 clamp(9px, 1.2vw, 12px)/1 var(--font-num); letter-spacing: .16em; color: #c8ffb0; animation: trGo 1.3s ease-in-out infinite; }
@keyframes trGo { 50% { opacity: .35; } }
#train-hud.show.big { transform: translate(-50%, 9vh) scale(1.3); transform-origin: 50% 0; box-shadow: inset 0 0 0 1px #c8a05a, 0 0 0 200vmax #0008, 0 8px 22px #000c; }
#train-hud.big .tr-go { display: block; }
/* celular deitado: a regra em destaque desceria por cima dos corações; fica logo abaixo do HUD */
@media (max-height: 460px) { #train-hud.show.big { transform: translate(-50%, 70px) scale(1.12); } }
/* celular deitado estreito: a faixa da regra no topo bateria no painel de vida; desce abaixo do HUD */
@media (max-height: 460px) and (max-width: 760px) { #train-hud.show { transform: translate(-50%, 64px); } }
#train-hud.big .tr-h { display: block; }
:root.touch #train-hud .key-only, :root:not(.touch) #train-hud .touch-only { display: none; }
#train-hud.flip .tr-t { animation: trFlip .7s cubic-bezier(.3,1.5,.5,1); }
@keyframes trFlip { 0% { transform: scale(1.5) rotate(-3deg); color: #fff; } 100% { transform: none; } }
@media (max-height: 420px) { #train-hud .tr-h { display: none; } #train-hud { padding: 5px 16px 6px; } }
#train-steam { position: fixed; inset: 0; z-index: 9; pointer-events: none; opacity: 0; background: radial-gradient(circle at 50% 60%, #fff, #e4eaee 55%, #b4c0c8); }
`;

// planos de câmera em que se joga, na ordem de cada rodada (a troca acontece a cada dois vagões)
const SHOT_PLAN = [
  ['lado', 'cima', 'tras'],
  ['iso', 'cabeca', 'ladoBaixo', 'cima'],
  ['frente', 'tras', 'cima', 'cabeca'],
  ['cabeca', 'ladoBaixo', 'iso', 'cima', 'tras'],
  ['lado', 'cima', 'frente', 'cabeca', 'tras'],
];
const PLAY_SHOTS = ['lado', 'cima', 'tras', 'iso', 'cabeca', 'frente', 'ladoBaixo'];
const SIDE_SHOTS = new Set(['lado', 'ladoBaixo', 'iso', 'frente', 'orbita', 'placa', 'partida', 'alcapao', 'alavanca', 'rodas', 'adeus']);

export function createTrain({ sfx, character, stats, el, cb }) {
  const scene = new THREE.Scene();
  // céu de noite: escuro em cima, arroxeado perto do horizonte (as serras aparecem recortadas nele)
  scene.background = canvasTex(8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#07071a'); gr.addColorStop(0.45, '#1c1a44'); gr.addColorStop(0.62, '#4a3a70'); gr.addColorStop(1, '#1a1a36');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(0x1e1c3c, 30, 170);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, ...o });

  // ---------- luz ----------
  const hemi = new THREE.HemisphereLight(0x8a92d8, 0x2a2030, 1.35);
  const moonLight = new THREE.DirectionalLight(0xb4c2ff, 2.2);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  Object.assign(moonLight.shadow.camera, { left: -20, right: 20, top: 12, bottom: -12, near: 1, far: 70 });
  moonLight.shadow.bias = -0.0006;
  moonLight.shadow.normalBias = 0.03;
  const lantern = new THREE.PointLight(0xff9a48, 26, 14, 1.6);
  const locoLight = new THREE.PointLight(0x6aff4a, 30, 22, 1.5);
  const brakeLight = new THREE.PointLight(0xffa040, 0, 12, 1.4); // clarão das faíscas na freada
  scene.add(hemi, moonLight, moonLight.target, lantern, locoLight, brakeLight);

  // ---------- materiais e peças repetidas ----------
  const wood = woodTex();
  // cores de trem de carga velho: ferrugem, laranja e madeira
  const boxMat = std({ map: wood, color: 0xd8705a });      // vagão fechado
  const gondolaMat = std({ map: wood, color: 0xe08a4a });  // gôndola
  const tankMat = std({ color: 0xe8a84a, roughness: 0.55, metalness: 0.25 }); // tanque
  const crateMat = std({ map: wood, color: 0xe0b888 });    // caixote na plataforma
  const deckWoodMat = std({ map: wood, color: 0xb07a58 });
  const coalMat = std({ color: 0x1c1c22, roughness: 1, flatShading: true });
  const safeMat = std({ map: wood, color: 0xc0604c });
  const dieselMat = std({ color: 0xd87a2c, roughness: 0.6, metalness: 0.2 });
  const dieselDark = std({ color: 0x8a4a1c, roughness: 0.7, metalness: 0.2 });
  const railYellow = std({ color: 0xe8c040, roughness: 0.6 });
  const roofMat = std({ color: 0x4a3a3c, roughness: 0.8, metalness: 0.1 });
  const ironMat = std({ color: 0x2a2a30, roughness: 0.5, metalness: 0.7 });
  const blackMat = std({ color: 0x24242c, roughness: 0.6, metalness: 0.3 });
  const stoneMat = std({ color: 0x4a4860 });
  const winMat = new THREE.MeshBasicMaterial({ map: windowTex() });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x9aff6a });
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff4030 });

  const G = {
    carBody: new THREE.BoxGeometry(CAR_LEN, 2.3, HALF_W * 2),
    carRoof: new THREE.BoxGeometry(CAR_LEN + 0.16, 0.2, HALF_W * 2 + 0.3),
    carBand: new THREE.BoxGeometry(0.12, 2.34, HALF_W * 2 + 0.06),
    gondola: new THREE.BoxGeometry(CAR_LEN, 1.9, HALF_W * 2),
    gondolaRib: new THREE.BoxGeometry(0.1, 1.94, HALF_W * 2 + 0.1),
    gondolaRim: new THREE.BoxGeometry(CAR_LEN + 0.1, 0.14, HALF_W * 2 + 0.14),
    cargo: new THREE.BoxGeometry(CAR_LEN - 0.16, 0.62, HALF_W * 2 - 0.16),
    tank: new THREE.CylinderGeometry(1.02, 1.02, CAR_LEN - 0.5, 16),
    tankCap: new THREE.SphereGeometry(1.02, 16, 10),
    tankBand: new THREE.CylinderGeometry(1.05, 1.05, 0.14, 16),
    tankWalk: new THREE.BoxGeometry(CAR_LEN, 0.2, 1.4),
    tankDome: new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10),
    flatDeck: new THREE.BoxGeometry(CAR_LEN, 0.26, HALF_W * 2),
    crate: new THREE.BoxGeometry(CAR_LEN - 0.3, 2.2, HALF_W * 2 - 0.3),
    crateBand: new THREE.BoxGeometry(0.14, 2.24, HALF_W * 2 - 0.24),
    ladder: new THREE.BoxGeometry(0.06, 2.2, 0.06),
    carBase: new THREE.BoxGeometry(CAR_LEN - 0.2, 0.26, 1.9),
    wheel: new THREE.CylinderGeometry(0.4, 0.4, 0.16, 9),
    link: new THREE.BoxGeometry(GAP + 0.2, 0.14, 0.22),
    post: new THREE.BoxGeometry(0.1, 1.7, 0.1),
    board: new THREE.PlaneGeometry(2.4 * CK, 1.5 * CK),
    roofBoard: new THREE.PlaneGeometry(2.7 * CK, 1.69 * CK),
    debris: new THREE.BoxGeometry(0.8, 0.08, 0.28),
  };

  function mesh(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function addWheels(g, xs, list) {
    for (const x of xs) for (const z of [-0.85, 0.85]) {
      const w = mesh(G.wheel, ironMat, x, RAIL_Y + 0.4, z, g);
      w.rotation.x = Math.PI / 2;
      list.push(w);
    }
  }
  const shadows = (g, skip = []) => g.traverse((o) => { if (o.isMesh && !skip.includes(o.material) && !o.material.isMeshBasicMaterial) o.castShadow = o.receiveShadow = true; });

  const wheels = [];
  const trainRoot = new THREE.Group();
  scene.add(trainRoot);

  // ---------- vagão numerado ----------
  // a placa aparece três vezes: na lateral, pintada no teto (para a câmera de cima)
  // e numa tabuleta acesa que sempre encara a câmera (para qualquer outro ângulo)
  function buildCar(i) {
    const g = new THREE.Group();
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 160;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    // quatro tipos de vagão de carga, todos com o topo na mesma altura
    const type = i % 4;
    let sideZ = HALF_W + 0.02;
    if (type === 0) { // vagão fechado, de tábuas, com teto e escada
      mesh(G.carBody, boxMat, 0, -1.35, 0, g);
      mesh(G.carRoof, roofMat, 0, -0.1, 0, g);
      for (const x of [-CAR_LEN / 2 + 0.2, CAR_LEN / 2 - 0.2]) mesh(G.carBand, ironMat, x, -1.35, 0, g);
      mesh(G.ladder, ironMat, CAR_LEN / 2 - 0.12, -1.35, HALF_W + 0.05, g);
    } else if (type === 1) { // gôndola aberta, cheia de carvão até a boca
      mesh(G.gondola, gondolaMat, 0, -1.55, 0, g);
      for (const x of [-1.45, -0.5, 0.5, 1.45].map((v) => v * CK)) mesh(G.gondolaRib, ironMat, x, -1.55, 0, g);
      mesh(G.gondolaRim, ironMat, 0, -0.62, 0, g);
      mesh(G.cargo, coalMat, 0, -0.31, 0, g);
    } else if (type === 2) { // vagão-tanque, com passarela em cima
      mesh(G.tank, tankMat, 0, -1.3, 0, g).rotation.z = Math.PI / 2;
      for (const sx of [-1, 1]) mesh(G.tankCap, tankMat, sx * (CAR_LEN / 2 - 0.25), -1.3, 0, g).scale.x = 0.32;
      for (const x of [-0.75 * CK, 0.75 * CK]) mesh(G.tankBand, ironMat, x, -1.3, 0, g).rotation.z = Math.PI / 2;
      mesh(G.tankWalk, deckWoodMat, 0, -0.1, 0, g);
      mesh(G.tankDome, ironMat, 0.75 * CK, -0.05, -0.85, g);
      mesh(G.ladder, ironMat, -CAR_LEN / 2 + 0.3, -1.3, 1.06, g);
      sideZ = 1.07;
    } else { // plataforma de madeira carregando um caixote
      mesh(G.flatDeck, deckWoodMat, 0, -2.36, 0, g);
      mesh(G.crate, crateMat, 0, -1.1, 0, g);
      for (const x of [-0.95 * CK, 0.95 * CK]) mesh(G.crateBand, ironMat, x, -1.1, 0, g);
      sideZ = HALF_W - 0.13;
    }
    mesh(G.carBase, ironMat, 0, -2.62, 0, g);
    mesh(G.link, ironMat, CAR_LEN / 2 + GAP / 2, -2.6, 0, g);
    addWheels(g, [-1.0 * CK, 1.0 * CK], wheels);
    const boardMat = new THREE.MeshBasicMaterial({ map: tex });
    mesh(G.board, boardMat, 0, -1.3, sideZ, g);
    const roofPaint = mesh(G.roofBoard, std({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45, roughness: 1 }), 0, 0.012, 0, g);
    roofPaint.rotation.x = -Math.PI / 2;
    mesh(G.post, ironMat, 0, 0.85, -HALF_W - 0.12, g);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.scale.set(2.4, 1.5, 1);
    sprite.position.set(0, 2.45, -HALF_W - 0.12);
    g.add(sprite);
    shadows(g);
    roofPaint.castShadow = false;
    trainRoot.add(g);
    return { group: g, canvas, ctx: canvas.getContext('2d'), tex, label: '', ok: true, done: false, state: 'idle', t: 0, vy: 0, x: 0, idx: 0, round: 0, solid: null };
  }

  function drawBoard(car, state = 'idle') {
    const g = car.ctx, w = 256, h = 160;
    g.fillStyle = state === 'ok' ? '#0c2410' : state === 'bad' ? '#3a0a08' : '#17110d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0005';
    for (let y = 40; y < h; y += 40) g.fillRect(0, y, w, 3);
    g.strokeStyle = state === 'ok' ? '#7aff5a' : state === 'bad' ? '#ff5a3a' : '#a8824a';
    g.lineWidth = 8;
    g.strokeRect(6, 6, w - 12, h - 12);
    const n = car.label.length;
    const size = n <= 2 ? 112 : n === 3 ? 94 : n === 4 ? 76 : n === 5 ? 62 : 52;
    g.font = `700 ${size}px Cinzel, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = state === 'ok' ? '#5aff3a' : state === 'bad' ? '#ff2a10' : '#ff9a3a';
    g.shadowBlur = 16;
    g.fillStyle = state === 'ok' ? '#c8ffb0' : state === 'bad' ? '#ffc0b0' : '#f6e8c6';
    g.fillText(car.label, w / 2, h / 2 + 6);
    g.shadowBlur = 0;
    car.tex.needsUpdate = true;
  }

  const cars = Array.from({ length: MAX_CARS * ROUNDS }, (_, i) => buildCar(i));

  // ---------- vagão seguro (passageiros), com a tabuleta da regra ----------
  function buildSafe() {
    const g = new THREE.Group();
    const L = SAFE_LEN;
    mesh(new THREE.BoxGeometry(L, 2.3, HALF_W * 2), safeMat, 0, -1.35, 0, g);
    mesh(new THREE.BoxGeometry(L + 0.2, 0.2, HALF_W * 2 + 0.36), roofMat, 0, -0.1, 0, g);
    mesh(new THREE.BoxGeometry(L - 0.4, 0.26, 1.9), ironMat, 0, -2.62, 0, g);
    mesh(G.link, ironMat, L / 2 + GAP / 2, -2.6, 0, g);
    addWheels(g, [-L / 2 + 1.1, -L / 2 + 2.4, L / 2 - 2.4, L / 2 - 1.1], wheels);
    // nervuras de ferro, escada e janelinhas gradeadas (alguém ficou lá dentro)
    const rib = new THREE.BoxGeometry(0.1, 2.34, HALF_W * 2 + 0.08);
    for (let x = -L / 2 + 0.15; x <= L / 2 - 0.1; x += 1.3) mesh(rib, ironMat, x, -1.35, 0, g);
    mesh(G.ladder, ironMat, L / 2 - 0.5, -1.35, HALF_W + 0.07, g);
    mesh(G.ladder, ironMat, L / 2 - 0.9, -1.35, HALF_W + 0.07, g);
    const winGeo = new THREE.PlaneGeometry(0.9, 0.95);
    for (let x = -L / 2 + 0.8; x < L / 2 - 1.2; x += 2.6) {
      mesh(winGeo, winMat, x, -1.0, HALF_W + 0.02, g);
      mesh(winGeo, winMat, x, -1.0, -HALF_W - 0.02, g).rotation.y = Math.PI;
    }
    // lampiões nas pontas do teto
    for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) {
      mesh(G.post, ironMat, x, 0.85, -HALF_W - 0.1, g);
      mesh(new THREE.SphereGeometry(0.16, 10, 8), lampMat, x, 1.8, -HALF_W - 0.1, g);
    }
    // tabuleta da regra, presa na beirada de trás do teto
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 200;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Group();
    mesh(new THREE.BoxGeometry(5.3, 2.15, 0.12), blackMat, 0, 2.0, -0.07, sign);
    mesh(new THREE.PlaneGeometry(5.1, 1.99), new THREE.MeshBasicMaterial({ map: tex }), 0, 2.0, 0, sign);
    for (const x of [-2.2, 2.2]) mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), ironMat, x, 0.5, -0.07, sign);
    sign.position.set(0.5, 0, -HALF_W - 0.05);
    g.add(sign);
    shadows(g);
    trainRoot.add(g);
    return { group: g, sign, canvas, ctx: canvas.getContext('2d'), tex };
  }
  function drawRule(safe, round, n) {
    const g = safe.ctx, w = 512, h = 200;
    g.fillStyle = '#15100c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a8824a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#b9a27c'; g.font = '600 24px Cinzel, serif';
    g.fillText(`REGRA ${n} DE ${ROUNDS}`, w / 2, 42);
    g.fillStyle = '#f6e8c6';
    let size = 54;
    do { g.font = `700 ${size}px Cinzel, serif`; size -= 2; } while (g.measureText(round.title).width > w - 44 && size > 20);
    g.shadowColor = '#ff9a3a'; g.shadowBlur = 14;
    g.fillText(round.title, w / 2, 118);
    g.shadowBlur = 0;
    safe.tex.needsUpdate = true;
  }
  const safes = Array.from({ length: ROUNDS }, buildSafe);
  // alçapão no teto do primeiro vagão: é por ele que a coruja sobe depois de embarcar
  const HATCH_X = 3;
  const hatchLid = new THREE.Group();
  {
    const g = safes[0].group, lx = HATCH_X - (START_X + SAFE_LEN / 2);
    const hole = mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ color: 0x000000 }), lx, 0.006, 0, g);
    hole.rotation.x = -Math.PI / 2;
    hatchLid.position.set(lx - 0.6, 0.02, 0);
    mesh(new THREE.BoxGeometry(1.2, 0.07, 1.2), ironMat, 0.6, 0.03, 0, hatchLid);
    g.add(hatchLid);
  }

  // ---------- locomotiva a diesel: capô comprido (por onde a coruja anda), cabine e nariz ----------
  const loco = new THREE.Group();
  const leverPivot = new THREE.Group();
  const leverKnob = new THREE.Vector3();
  const chimney = new THREE.Vector3();
  const LOCO_WHEELS = [1.0, 2.3, 3.6, 10.4, 11.7, 13.0];
  {
    const T = TENDER_LEN, FULL = 14.6;
    const bx = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, loco);
    bx(FULL + 0.4, 0.36, HALF_W * 2 + 0.5, blackMat, FULL / 2, -2.5, 0);          // estrado
    bx(4.2, 0.7, 1.7, blackMat, 6.8, -3.0, 0);                                    // tanque de óleo
    bx(T, 2.2, 1.9, dieselMat, T / 2, -1.25, 0);                                  // capô comprido
    bx(T + 0.05, 0.14, 2.1, dieselDark, T / 2, -0.07, 0);                         // topo do capô (onde se anda)
    for (let x = 0.9; x < T - 0.6; x += 1.5) { bx(1.0, 1.3, 0.05, dieselDark, x, -1.2, 0.96); bx(1.0, 1.3, 0.05, dieselDark, x, -1.2, -0.96); } // venezianas
    bx(0.6, 0.5, 0.6, blackMat, 2.4, 0.2, -0.65);                                 // escapamento
    chimney.set(2.4, 0.5, -0.65);
    // corrimão amarelo dos dois lados
    for (const z of [-HALF_W - 0.18, HALF_W + 0.18]) {
      bx(FULL - 0.4, 0.06, 0.06, railYellow, FULL / 2, -1.45, z);
      for (let x = 0.3; x < FULL; x += 1.75) bx(0.06, 0.9, 0.06, railYellow, x, -1.9, z);
    }
    // cabine do maquinista, mais alta que o capô
    bx(2.9, 4.0, HALF_W * 2 + 0.1, dieselMat, T + 1.45, -0.35, 0);
    bx(3.3, 0.2, HALF_W * 2 + 0.6, dieselDark, T + 1.45, 1.75, 0);
    const cabWin = new THREE.PlaneGeometry(1.2, 0.95);
    mesh(cabWin, winMat, T + 1.45, 0.85, HALF_W + 0.07, loco);
    mesh(cabWin, winMat, T + 1.45, 0.85, -HALF_W - 0.07, loco).rotation.y = Math.PI;
    for (const z of [-0.55, 0.55]) mesh(new THREE.PlaneGeometry(0.8, 0.9), winMat, T - 0.02, 0.85, z, loco).rotation.y = -Math.PI / 2;
    // nariz curto, farol e limpa-trilhos
    bx(2.7, 1.9, 1.9, dieselMat, T + 4.25, -1.4, 0);
    bx(2.75, 0.12, 2.0, dieselDark, T + 4.25, -0.42, 0);
    mesh(new THREE.SphereGeometry(0.3, 12, 10), greenMat, T + 5.62, -0.8, 0, loco);
    bx(1.0, 0.5, 0.05, blackMat, T + 5.62, -1.5, 0).rotation.y = Math.PI / 2;
    const plow = bx(0.5, 1.0, HALF_W * 2 + 0.3, blackMat, T + 5.85, -2.95, 0);
    plow.rotation.z = -0.45;
    for (const z of [-0.85, 0.85]) bx(3.6, 0.5, 0.12, blackMat, 2.3, -2.95, z), bx(3.6, 0.5, 0.12, blackMat, 11.7, -2.95, z); // truques
    addWheels(loco, LOCO_WHEELS, wheels);
    // freio: uma alavanca alta no caminho da coruja, com pega vermelha
    bx(0.5, 0.24, 0.5, ironMat, LEVER_X, 0.12, 0);
    leverPivot.position.set(LEVER_X, 0.2, 0);
    mesh(new THREE.BoxGeometry(0.1, 0.72, 0.1), railYellow, 0, 0.36, 0, leverPivot);
    mesh(new THREE.BoxGeometry(0.12, 0.12, 0.86), redMat, 0, LEVER_H, 0, leverPivot); // pega em T, atravessada, na altura do ombro da coruja
    loco.add(leverPivot);
    shadows(loco);
    trainRoot.add(loco);
  }

  // ---------- cenário que corre para trás ----------
  const DECK_L = 420;
  const deckMap = deckTex();
  deckMap.repeat.set(DECK_L / 1.1, 1);
  const follow = new THREE.Group(); // tudo que acompanha a câmera ao longo do trem
  scene.add(follow);
  const deck = mesh(new THREE.BoxGeometry(DECK_L, 0.6, 5.2), std({ map: deckMap, color: 0xb0b0c0 }), 0, RAIL_Y - 0.4, 0, follow);
  deck.receiveShadow = true;
  for (const z of [-0.85, 0.85]) mesh(new THREE.BoxGeometry(DECK_L, 0.1, 0.1), ironMat, 0, RAIL_Y - 0.05, z, follow);
  for (const z of [-2.5, 2.5]) mesh(new THREE.BoxGeometry(DECK_L, 0.55, 0.22), stoneMat, 0, RAIL_Y + 0.1, z, follow);
  // abismo: um mar de névoa lá embaixo
  const abyss = mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: 0x1e1c3c }), 0, -34, 0, follow);
  abyss.rotation.x = -Math.PI / 2;
  // serras e floresta morta ao longe (dos dois lados)
  const farTex = skylineTex(7, false), nearTex = skylineTex(31, true);
  farTex.repeat.set(4, 1); nearTex.repeat.set(5, 1);
  const layerMat = (map, color) => new THREE.MeshBasicMaterial({ map, color, transparent: true, fog: false, depthWrite: false });
  const farA = mesh(new THREE.PlaneGeometry(1100, 120), layerMat(farTex, 0xffffff), 0, -2, -170, follow);
  const nearA = mesh(new THREE.PlaneGeometry(800, 70), layerMat(nearTex, 0xffffff), 0, -14, -95, follow);
  const farB = mesh(new THREE.PlaneGeometry(1100, 120), layerMat(farTex, 0xffffff), 0, -2, 170, follow);
  farB.rotation.y = Math.PI;
  farA.renderOrder = -3; farB.renderOrder = -3; nearA.renderOrder = -2;
  // lua e estrelas
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex(), fog: false, depthWrite: false }));
  moon.scale.set(46, 46, 1);
  moon.position.set(72, 46, -160);
  moon.renderOrder = -4;
  follow.add(moon);
  {
    const n = 420, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.04 + Math.random() * 1.45, r = 330;
      pos.set([Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xc8d0ff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
    stars.renderOrder = -5;
    stars.frustumCulled = false;
    follow.add(stars);
  }

  // pilares do viaduto e postes de luz: passam voando
  const dummy = new THREE.Object3D();
  function instanced(geo, mat, n) {
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  const PILLAR_N = 14, PILLAR_P = 26;
  const pillars = instanced(new THREE.BoxGeometry(3, 60, 4.6), stoneMat, PILLAR_N);
  const POST_N = 16, POST_P = 22;
  const posts = instanced(new THREE.BoxGeometry(0.14, 3.6, 0.14), ironMat, POST_N * 2);
  const postLamps = instanced(new THREE.SphereGeometry(0.2, 8, 6), lampMat, POST_N * 2);
  const postGlow = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: glowTex('rgba(255,220,150,1)', 'rgba(255,150,60,.5)'), size: 2.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  postGlow.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POST_N * 2 * 3), 3));
  postGlow.frustumCulled = false;
  scene.add(postGlow);

  // riscos de vento
  const WIND_N = 90;
  const windBase = Array.from({ length: WIND_N }, () => {
    const side = Math.random() < 0.5 ? -1 : 1;
    return { x: Math.random() * 90, y: -2 + Math.random() * 11, z: side * (2 + Math.random() * 9), len: 1.5 + Math.random() * 4, k: 1.2 + Math.random() * 0.8 };
  });
  const windGeo = new THREE.BufferGeometry();
  windGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WIND_N * 6), 3));
  const wind = new THREE.LineSegments(windGeo, new THREE.LineBasicMaterial({ color: 0xaab4ff, transparent: true, opacity: 0.2, depthWrite: false }));
  wind.frustumCulled = false;
  scene.add(wind);

  // fumaça da chaminé
  const SMOKE_N = 18;
  const smokeMap = glowTex('rgba(210,220,230,.9)', 'rgba(150,160,180,.35)');
  const smoke = Array.from({ length: SMOKE_N }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false;
    scene.add(s);
    return { s, life: 0, max: 1, vx: 0, vy: 0, vz: 0 };
  });
  let smokeT = 0;

  // faíscas do freio
  const SPARK_N = 70;
  const sparkPos = new Float32Array(SPARK_N * 3).fill(-999), sparkVel = new Float32Array(SPARK_N * 3), sparkLife = new Float32Array(SPARK_N);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffc860, size: 0.3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sparks.frustumCulled = false;
  scene.add(sparks);

  // tábuas voando quando um vagão cede
  const debris = Array.from({ length: 14 }, () => {
    const m = mesh(G.debris, deckWoodMat, 0, -99, 0, scene);
    m.visible = false;
    return { m, life: 0, v: new THREE.Vector3(), r: new THREE.Vector3() };
  });

  // ---------- HTML: placa da regra e vapor do fim ----------
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const mk = (id, html = '') => { const d = document.createElement('div'); d.id = id; d.innerHTML = html; document.body.append(d); return d; };
  const hud = mk('train-hud', '<div class="tr-k"></div><div class="tr-t"></div><div class="tr-h"></div><div class="tr-go"><span class="key-only">ESPAÇO</span><span class="pad-only">A</span><span class="touch-only">TOQUE EM PULAR</span> PARA CONTINUAR</div>');
  const hudK = hud.querySelector('.tr-k'), hudT = hud.querySelector('.tr-t'), hudH = hud.querySelector('.tr-h');
  const steam = mk('train-steam');
  function setBanner(k, t, h) {
    hudK.textContent = k; hudT.textContent = t; hudH.textContent = h;
    hud.classList.remove('flip');
    void hud.offsetWidth;
    hud.classList.add('flip', 'show');
  }

  // ---------- estado ----------
  let player = null, level = 0, running = false;
  let phase = 'off', pt = 0;
  let rounds = [], solids = [], safeSolids = [];
  let reached = 0;        // último vagão seguro alcançado (0 = o primeiro … 3 = a locomotiva)
  let lastCar = null;
  let shot = 'lado', plan = SHOT_PLAN;
  let scroll = 0, speedK = 1, clackT = 0, shake = 0, steamK = 0, leverK = 0;
  let armW = 0, lean = 0, standX0 = 0, braked = false, stopped = false, hissed = false, fovKick = 0, lurch = 0;
  let climb = 0, readRound = 0; // a coruja segurando e puxando a alavanca
  let locoX = 0, endX = 0;
  let snap = true, sideK = 1, focusY = 0;
  const camPos = new THREE.Vector3(), camAt = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
  const wantPos = new THREE.Vector3(), wantAt = new THREE.Vector3(), wantUp = new THREE.Vector3(0, 1, 0);
  let camFov = 38, wantFov = 38, camRoll = 0, wantRoll = 0;
  const UP = new THREE.Vector3(0, 1, 0), TOP = new THREE.Vector3(0, 0, -1);

  const BRAKE_T = 7.4; // quanto tempo o trem leva para parar depois do freio
  const LEVER_FROM = -0.28, LEVER_TO = 0.24; // inclinação da alavanca: solta → puxada
  const busy = () => phase === 'intro' || phase === 'pass' || phase === 'read' || phase === 'end';

  // ---------- monta o trem desta travessia ----------
  function layout(list) {
    rounds = list;
    solids = [];
    safeSolids = [];
    const addSafe = (i, x0, x1) => {
      const s = { minX: x0, maxX: x1, minY: -2.6, maxY: 0, kind: 'ground', safe: i };
      solids.push(s);
      safeSolids[i] = s;
    };
    for (const c of cars) { c.group.visible = false; c.solid = null; }
    let x = START_X;
    for (let r = 0; r < ROUNDS; r++) {
      const safe = safes[r];
      safe.group.position.set(x + SAFE_LEN / 2, 0, 0);
      drawRule(safe, rounds[r], r + 1);
      addSafe(r, x, x + SAFE_LEN);
      x += SAFE_LEN + GAP;
      rounds[r].cars.slice(0, MAX_CARS).forEach((spec, i) => {
        const c = cars[r * MAX_CARS + i];
        Object.assign(c, { label: spec.label, ok: spec.ok, done: false, state: 'idle', t: 0, vy: 0, x: x + CAR_LEN / 2, idx: i, round: r });
        c.group.visible = true;
        c.group.position.set(c.x, 0, 0);
        c.group.rotation.set(0, 0, 0);
        drawBoard(c);
        c.solid = { minX: x, maxX: x + CAR_LEN, minY: -2.6, maxY: 0, kind: 'plank', car: c };
        solids.push(c.solid);
        x += PITCH;
      });
    }
    locoX = x;
    loco.position.set(x, 0, 0);
    addSafe(ROUNDS, x, x + TENDER_LEN);
    solids.push({ minX: x + TENDER_LEN, maxX: x + TENDER_LEN + 3, minY: -2.6, maxY: 9, kind: 'block' });
    endX = x + LEVER_X - 0.1; // a alavanca fica no caminho: não dá para passar dela
    api.maxX = endX;
  }

  function start(lv, pl) {
    level = lv;
    player = pl;
    running = true;
    layout(makeRounds(lv));
    plan = lv === 0 ? SHOT_PLAN : SHOT_PLAN.map((_, r) => {
      const bag = PLAY_SHOTS.slice().sort(() => Math.random() - 0.5);
      return [r === 0 ? 'lado' : bag.find((s) => s !== 'lado'), ...bag.filter((s) => s !== 'lado').slice(1, 4)];
    });
    scene.add(character.root);
    character.root.visible = true;
    character.root.scale.setScalar(1);
    reached = 0; lastCar = null; shot = plan[0][0];
    scroll = 0; speedK = 1; clackT = 0; shake = 0; steamK = 0; leverK = 0; focusY = 0;
    armW = 0; lean = 0; braked = false; stopped = false; hissed = false; fovKick = 0; lurch = 0; climb = 0;
    speedK = 0; // o trem ainda está parado na estação: ele arranca durante a abertura
    hud.classList.remove('big');
    hatchLid.rotation.z = 0;
    leverPivot.rotation.z = LEVER_FROM;
    steam.style.transition = 'none';
    steam.style.opacity = '0';
    for (const d of debris) { d.life = 0; d.m.visible = false; }
    sparkPos.fill(-999);
    for (const p of smoke) { p.life = 0; p.s.visible = false; }
    hud.classList.remove('show');
    phase = 'intro'; pt = 0; snap = true;
    cb.onCine?.(true);
    sfx.trainWhistle(0.8);
  }

  function stop() {
    const was = running;
    running = false;
    hud.classList.remove('show', 'big');
    steam.style.transition = 'opacity 1.6s';
    steam.style.opacity = '0';
    if (phase !== 'off' && was) cb.onCine?.(false);
    if (was && phase !== 'end') phase = 'over'; // a cena continua na tela de fim de jogo, parada no último plano
  }

  // ---------- acontecimentos ----------
  function startRound(r) {
    const R = rounds[r];
    setBanner(`REGRA DO TREM · ${r + 1} DE ${ROUNDS}`, R.title, R.hint);
    shot = plan[r][0];
  }

  // pausa para ler a regra: o cartão vai para o meio da tela e só sai quando o jogador apertar o pulo
  function beginRead(r) {
    phase = 'read'; pt = 0; readRound = r;
    startRound(r);
    hud.classList.add('big');
    cb.onCine?.(false); // os botões de toque voltam (é o de pular que continua)
  }

  function reachSafe(i) {
    reached = i;
    lastCar = null;
    stats.coins += 3;
    sfx.gateOk?.();
    cb.rumble?.(0.3, 160);
    if (i >= ROUNDS) {
      setBanner('A LOCOMOTIVA', 'Puxe o freio!', 'Corra até a alavanca vermelha.');
      cb.toast?.('A locomotiva!', 'Alguém ainda está na cabine. Puxe o freio antes que ele perceba.', 3.2);
      shot = 'iso';
      return;
    }
    // vagão seguro: a câmera dá uma volta inteira em torno da coruja enquanto a regra muda
    phase = 'pass'; pt = 0;
    cb.onCine?.(true);
    character.play('look_around', { fade: 0.2, restart: true });
    cb.toast?.('Regra cumprida! +3 moedas', 'A tabuleta virou sozinha…', 1.8);
  }

  function landOn(c) {
    if (c.ok) {
      if (!c.done) { c.done = true; drawBoard(c, 'ok'); stats.coins++; sfx.coin(); }
      const seq = plan[c.round];
      shot = seq[Math.min(seq.length - 1, Math.floor((c.idx + 1) / 2))];
    } else if (c.state === 'idle') {
      c.state = 'crack';
      c.t = 0.16;
      drawBoard(c, 'bad');
      sfx.trainCrack();
      cb.rumble?.(0.9, 350);
      shake = 0.7;
      cb.toast?.('Desabou!', `${c.label} não segue a regra.`, 1.8);
    }
  }

  function burst(c) {
    for (const d of debris) {
      d.life = 1.4 + Math.random() * 0.6;
      d.m.visible = true;
      d.m.position.set(c.x + (Math.random() - 0.5) * CAR_LEN, -0.1, (Math.random() - 0.5) * 2);
      d.v.set(-4 - Math.random() * 9, 3 + Math.random() * 7, (Math.random() - 0.5) * 7);
      d.r.set(Math.random() * 9, Math.random() * 9, Math.random() * 9);
    }
  }

  /** caiu e voltou para o último vagão seguro (o main.js avisa) */
  function onRespawn() {
    lastCar = null;
    snap = true;
    shot = plan[Math.min(reached, ROUNDS - 1)][0];
    if (reached >= ROUNDS) shot = 'iso';
    if (el.blood) el.blood.style.opacity = '0.6';
  }

  function update(dt, time, input) {
    if (!player) return;
    const P = player.P;
    pt += dt;

    // ----- fases -----
    if (phase !== 'read' && phase !== 'run') input?.consumeJump();
    if (phase === 'intro') {
      // o trem arranca da estação; a coruja abre o alçapão e sobe para o teto
      speedK = smooth(pt / 4.6);
      hatchLid.rotation.z = smooth((pt - 2.2) / 0.5) * 1.9 - smooth((pt - 4.3) / 0.6) * 1.9;
      climb = smooth((pt - 2.8) / 1.1);
      if (pt >= 5.9) beginRead(0);
    } else if (phase === 'pass') {
      P.vx = 0;
      if (pt >= 2.1) beginRead(reached);
    } else if (phase === 'read') {
      P.vx = 0;
      speedK = 1;
      const go = input?.consumeJump();
      if (go && pt > 0.9) {
        phase = 'run';
        hud.classList.remove('big');
        shot = plan[readRound][0];
        if (readRound === 0) cb.onPlay?.();
      }
    } else if (phase === 'end') {
      // 1) anda até a alavanca  2) estica os braços e segura  3) puxa com o corpo todo  4) o trem freia
      const standX = locoX + LEVER_X - 0.45;
      P.vx = 0; P.facing = 1;
      if (pt < 0.6) P.x = standX0 + (standX - standX0) * smooth(pt / 0.6);
      else { P.x = standX; character.play('idle', { fade: 0.25 }); }
      armW = smooth((pt - 0.5) / 0.55);
      leverK = smooth((pt - 1.35) / 0.7);
      leverPivot.rotation.z = LEVER_FROM + (LEVER_TO - LEVER_FROM) * leverK + (pt > 1.1 && pt < 1.35 ? Math.sin(pt * 70) * 0.012 : 0);
      // inclina para a frente ao pegar, joga o peso para trás ao puxar e fica segurando firme
      lean = 0.16 * smooth((pt - 0.5) / 0.6) - 0.4 * leverK + (leverK >= 1 ? Math.sin(pt * 40) * 0.012 * speedK : 0);
      if (!braked && pt >= 1.35) {
        braked = true;
        sfx.trainBrake(BRAKE_T);
        sfx.trainWhistle(1);
        cb.rumble?.(1, 1200);
        fovKick = 14; // a lente abre de susto quando o freio pega
        cb.toast?.('O trem está freando…', 'O ferro grita nos trilhos. Segure firme!', 3.4);
      }
      // freada comprida: perde velocidade rápido no começo e depois vai se arrastando até parar
      const bk = clamp((pt - 1.4) / BRAKE_T, 0, 1);
      const before = speedK;
      speedK = braked ? Math.pow(1 - bk, 1.7) : 1;
      // tranco: tudo é jogado para a frente enquanto o trem perde velocidade
      lurch += ((before - speedK) / Math.max(dt, 1e-3) * 2.2 - lurch) * Math.min(1, dt * 4);
      shake = Math.max(shake, braked && !stopped ? 0.12 + 0.5 * speedK : 0);
      if (braked && !stopped && pt > 3.2 && Math.floor(pt * 1.1) !== Math.floor((pt - dt) * 1.1)) { sfx.trainHiss(0.5, 0.6); cb.rumble?.(0.5, 200); }
      if (!stopped && bk >= 1) {
        // parou de vez: os engates batem em fila, um último tranco, e o silêncio
        stopped = true;
        sfx.trainClank();
        sfx.playClip?.('sino', 0.35);
        cb.rumble?.(1, 500);
        shake = 0.9;
        lurch = -1.4;
        fovKick = -6;
      }
      const tEnd = 1.4 + BRAKE_T; // instante em que para
      if (stopped && !hissed && pt > tEnd + 0.7) { hissed = true; sfx.trainHiss(2.6, 1.2); }
      steamK = smooth((pt - tEnd - 0.8) / 1.6);
      steam.style.transition = 'none';
      steam.style.opacity = steamK.toFixed(3);
      if (pt >= tEnd + 2.9) { phase = 'off'; running = false; cb.onCine?.(false); cb.onExit?.(); return; }
    } else if (phase === 'run' && !P.dead) {
      const s = P.grounded ? P.ground : null;
      if (s?.car) { if (s.car !== lastCar) { lastCar = s.car; landOn(s.car); } }
      else if (s && s.safe > reached) reachSafe(s.safe);
      if (reached >= ROUNDS && P.grounded && P.x > locoX + LEVER_X - 1.7) {
        phase = 'end'; pt = 0;
        standX0 = P.x;
        P.vx = 0; P.facing = 1;
        cb.onCine?.(true);
        hud.classList.remove('show');
        character.play('walk', { fade: 0.15 });
      }
    }

    // ----- trem andando: cenário para trás -----
    if (phase !== 'over') scroll += SPEED * speedK * dt;
    const fx = P.x;
    follow.position.x = fx;
    deckMap.offset.x = mod((fx - DECK_L / 2 + scroll) / 1.1, 1);
    farTex.offset.x = mod(scroll * 0.00035, 1);
    nearTex.offset.x = mod(scroll * 0.0011, 1);

    const span = PILLAR_N * PILLAR_P;
    for (let i = 0; i < PILLAR_N; i++) {
      dummy.position.set(fx - span / 2 + mod(i * PILLAR_P - scroll - (fx - span / 2), span), RAIL_Y - 0.7 - 30, 0);
      dummy.updateMatrix();
      pillars.setMatrixAt(i, dummy.matrix);
    }
    pillars.instanceMatrix.needsUpdate = true;
    const pspan = POST_N * POST_P;
    const gp = postGlow.geometry.attributes.position;
    for (let i = 0; i < POST_N * 2; i++) {
      const far = i < POST_N;
      const x = fx - pspan / 2 + mod((i % POST_N) * POST_P + (far ? 0 : POST_P / 2) - scroll - (fx - pspan / 2), pspan);
      const z = far ? -2.5 : 2.5;
      dummy.position.set(x, RAIL_Y + 2.0, z);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
      dummy.position.y = RAIL_Y + 3.9;
      dummy.updateMatrix();
      postLamps.setMatrixAt(i, dummy.matrix);
      gp.setXYZ(i, x, RAIL_Y + 3.9, z);
    }
    posts.instanceMatrix.needsUpdate = true;
    postLamps.instanceMatrix.needsUpdate = true;
    gp.needsUpdate = true;

    const wp = windGeo.attributes.position;
    for (let i = 0; i < WIND_N; i++) {
      const b = windBase[i];
      const x = fx - 45 + mod(b.x - scroll * b.k - (fx - 45), 90);
      wp.setXYZ(i * 2, x, b.y, b.z);
      wp.setXYZ(i * 2 + 1, x + b.len * (0.2 + speedK * 0.8), b.y, b.z);
    }
    wp.needsUpdate = true;
    wind.material.opacity = 0.2 * speedK;

    const spin = (SPEED * speedK * dt) / 0.4;
    for (const w of wheels) w.rotation.y -= spin;
    // o trem inteiro balança de leve (só o desenho; o chão da física não mexe)
    trainRoot.position.y = Math.sin(time * 9) * 0.012 * speedK;
    fovKick += (0 - fovKick) * Math.min(1, dt * 1.6);
    if (phase !== 'end') lurch = 0;

    // batida das rodas nas emendas do trilho
    clackT -= dt * speedK;
    if (clackT <= 0 && running && speedK > 0.05) { clackT = 0.52; sfx.trainClack(0.55 + 0.3 * speedK); }

    // ----- vagões que cedem -----
    for (const c of cars) {
      if (c.state === 'crack') {
        c.t -= dt;
        c.group.position.set(c.x + (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.08, 0);
        if (c.t <= 0) { c.state = 'fall'; c.solid.dead = true; c.vy = -2; burst(c); }
      } else if (c.state === 'fall') {
        c.vy -= 34 * dt;
        c.group.position.y += c.vy * dt;
        c.group.position.x -= 7 * dt;
        c.group.rotation.z += dt * 0.9;
        c.group.rotation.x += dt * 0.7;
        if (c.group.position.y < -60) { c.state = 'gone'; c.group.visible = false; }
      }
    }
    for (const d of debris) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.v.y -= 26 * dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.r.x * dt; d.m.rotation.y += d.r.y * dt; d.m.rotation.z += d.r.z * dt;
      if (d.life <= 0) d.m.visible = false;
    }

    // ----- fumaça -----
    smokeT -= dt;
    if (smokeT <= 0) {
      smokeT = 0.16;
      const p = smoke.find((q) => q.life <= 0);
      if (p) {
        p.life = p.max = 3 + Math.random() * 1.5;
        p.s.visible = true;
        p.s.position.set(locoX + chimney.x, chimney.y, chimney.z);
        p.vx = -SPEED * (0.25 + Math.random() * 0.15) * speedK - 0.4;
        p.vy = 2.4 + Math.random() * 1.6;
        p.vz = -0.6 - Math.random() * 1.8;
      }
    }
    for (const p of smoke) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = 1 - p.life / p.max;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.vy *= 1 - dt * 0.5;
      p.s.scale.setScalar(1.2 + k * 8);
      p.s.material.opacity = 0.3 * Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k);
      if (p.life <= 0) p.s.visible = false;
    }

    // ----- faíscas do freio -----
    const braking = phase === 'end' && braked && speedK > 0.04;
    for (let i = 0; i < SPARK_N; i++) {
      sparkLife[i] -= dt;
      if (sparkLife[i] <= 0) {
        if (!braking) { sparkPos[i * 3 + 1] = -999; continue; }
        sparkLife[i] = 0.25 + Math.random() * 0.45;
        const wx = locoX + LOCO_WHEELS[i % LOCO_WHEELS.length];
        sparkPos.set([wx, RAIL_Y + 0.05, i % 2 ? 0.95 : -0.95], i * 3);
        sparkVel.set([-(5 + Math.random() * 14) * speedK - 2, 1 + Math.random() * 5, (Math.random() - 0.5) * 3], i * 3);
      }
      sparkVel[i * 3 + 1] -= 16 * dt;
      for (let a = 0; a < 3; a++) sparkPos[i * 3 + a] += sparkVel[i * 3 + a] * dt;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    brakeLight.position.set(locoX + 2.4, RAIL_Y + 0.5, 1.6);
    brakeLight.intensity = braking ? (30 + Math.random() * 50) * (0.3 + speedK) : 0;

    // ----- luzes -----
    lantern.position.set(P.x + P.facing * 0.4, P.y + 1.4, 1.2);
    lantern.intensity = 26 * (0.9 + Math.sin(time * 13) * 0.04 + Math.sin(time * 7.3) * 0.06);
    locoLight.position.set(locoX + TENDER_LEN - 0.8, 1.2, 0.6);
    locoLight.intensity = 30 * (0.8 + Math.sin(time * 5) * 0.2);
    moonLight.position.set(fx - 7, 24, 10);
    moonLight.target.position.set(fx + 2, -1, 0);
    shake = Math.max(0, shake - dt * 1.6);
  }

  // ---------- câmera ----------
  // cada plano diz onde a câmera quer estar, para onde olha, qual lado é "para cima" e a abertura da lente
  function aim(name, P, time, tanH) {
    const x = P.x, y = focusY;
    wantUp.copy(UP);
    wantRoll = Math.sin(time * 1.7) * 0.012;
    wantFov = 38;
    let k = 3.4;
    switch (name) {
      case 'lado': // de lado, como na trilha
        wantPos.set(x + 3, y + 3.6, 14.5); wantAt.set(x + 3, y + 0.3, 0);
        break;
      case 'ladoBaixo': // do nível dos trilhos, olhando para cima
        wantPos.set(x + 0.5, y - 2.3, 10); wantAt.set(x + 3.6, y + 1.3, 0);
        wantFov = 46; wantRoll = Math.sin(time * 1.3) * 0.03 - 0.03;
        break;
      case 'cima': { // de cima da cabeça: os números pintados nos tetos
        const h = clamp(13 / Math.max(0.55, tanH / 0.61), 13, 22);
        wantPos.set(x + 4, y + h, 2.2); wantAt.set(x + 4.4, y, 0);
        wantUp.copy(TOP); wantFov = 50; wantRoll = Math.sin(time * 0.9) * 0.02;
        break;
      }
      case 'tras': // por trás, olhando o trem inteiro pela frente
        wantPos.set(x - 7.5, y + 4.6, 2.6); wantAt.set(x + 7, y + 0.5, -0.3);
        wantFov = 60; wantRoll = Math.sin(time * 1.5) * 0.035;
        break;
      case 'cabeca': // colada em cima da cabeça da coruja
        wantPos.set(x - 2.3, y + 3.5, 0.25); wantAt.set(x + 8, y - 0.9, -0.1);
        wantFov = 68; wantRoll = Math.sin(time * 2.1) * 0.03;
        break;
      case 'iso': // de trás e do alto, em diagonal
        wantPos.set(x - 6, y + 7.5, 10.5); wantAt.set(x + 4, y - 0.2, 0);
        wantFov = 44;
        break;
      case 'frente': // da frente, em diagonal: os vagões vêm na direção da câmera
        wantPos.set(x + 12, y + 6, 9); wantAt.set(x + 2.6, y + 0.2, 0);
        wantFov = 46; wantRoll = Math.sin(time * 1.4) * 0.025 + 0.02;
        break;
      case 'queda': // caindo: a câmera fica lá em cima vendo a coruja sumir na névoa
        wantPos.set(x + 0.4, 6.5, 1.8); wantAt.set(x, P.y, 0);
        wantUp.copy(TOP); wantFov = 55; k = 5;
        break;
      case 'orbita': { // volta inteira em torno da coruja (vagão seguro)
        const a = smooth(pt / 2.1) * Math.PI * 2;
        wantPos.set(x + Math.sin(a) * 7.5, y + 2.6 + Math.sin(a * 0.5) * 1.6, Math.cos(a) * 7.5); wantAt.set(x, y + 1.1, 0);
        wantFov = 48; wantRoll = Math.sin(a) * 0.08; k = 7;
        break;
      }
      case 'partida': // abertura: o trem arrancando da estação, visto de baixo, bem de perto
        wantPos.set(x + 9 - pt * 1.2, y - 1.9, 12 - pt * 0.8); wantAt.set(x + 2, y - 1.0, 0);
        wantFov = 46; wantRoll = -0.04; k = 2;
        break;
      case 'alcapao': // a coruja saindo pelo alçapão do teto
        wantPos.set(x + 3.4 - (pt - 2.3) * 0.4, y + 2.3, 3.4); wantAt.set(x, y + 0.6, 0);
        wantFov = 42; wantRoll = 0.04; k = 3;
        break;
      case 'placa': { // parado no vagão seguro, lendo a tabuleta da regra
        const sx = safes[readRound].group.position.x + 0.5;
        wantPos.set(sx + Math.sin(time * 0.5) * 0.5, 2.9, 11.5); wantAt.set(sx, 1.25, 0);
        wantFov = 40; k = 2.6;
        break;
      }
      case 'rodas': // freando: rente aos trilhos, as rodas travadas soltando faísca
        wantPos.set(locoX + 5.6 - (pt - 3.4) * 0.5, RAIL_Y + 0.55, 3.2); wantAt.set(locoX + 2.6, RAIL_Y + 0.5, 0.6);
        wantFov = 52; wantRoll = Math.sin(time * 23) * 0.012 - 0.05; k = 5;
        break;
      case 'alavanca': { // a coruja segurando o freio: perto, de lado, chegando devagar
        const push = smooth(pt / 3);
        wantPos.set(x + 1.5 - push * 0.4, y + 1.2 - push * 0.2, 3.6 - push * 0.9); wantAt.set(x + 0.35, y + 0.85, 0);
        wantFov = 40; wantRoll = 0.05 * push; k = 4;
        break;
      }
      case 'adeus': { // o trem parando, visto de longe, girando devagar
        const t = pt - 5.6, a = 0.45 + t * 0.14;
        wantPos.set(x + 4 + Math.sin(a) * 22, y + 4.5 + t * 0.7, Math.cos(a) * 22); wantAt.set(x + 2, y, 0);
        wantFov = 42; k = 1.8;
        break;
      }
    }
    return k;
  }

  function currentShot(P) {
    if (phase === 'intro') return pt < 2.3 ? 'partida' : pt < 4.7 ? 'alcapao' : 'cima';
    if (phase === 'read') return 'placa';
    if (phase === 'pass') return 'orbita';
    if (phase === 'end') return pt < 3.4 ? 'alavanca' : pt < 5.6 ? 'rodas' : 'adeus';
    if (P.dead || (!P.grounded && P.y < -1.4)) return 'queda';
    return shot;
  }

  function placeCamera(dt, camera, time) {
    if (!player) return;
    const P = player.P;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    // a altura do foco acompanha os pulos só pela metade (a câmera não fica pulando junto)
    focusY += (clamp(P.y, -1.5, 6) * 0.45 - focusY) * Math.min(1, dt * 4);
    const name = currentShot(P);
    const k = aim(name, P, time, tanH);
    if (snap) {
      camPos.copy(wantPos); camAt.copy(wantAt); camUp.copy(wantUp); camFov = wantFov; camRoll = wantRoll;
      snap = false;
    } else {
      const a = Math.min(1, dt * k);
      camPos.lerp(wantPos, a); camAt.lerp(wantAt, a);
      camUp.lerp(wantUp, Math.min(1, dt * k * 1.2)).normalize();
      camFov += (wantFov - camFov) * a;
      camRoll += (wantRoll - camRoll) * a;
    }
    const sh = shake * 0.35;
    camera.up.copy(camUp);
    camera.position.set(camPos.x + lurch * 0.5 + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh);
    camera.lookAt(camAt);
    camera.rotateZ(camRoll + lurch * 0.02);
    if (lurch) camera.rotateX(-lurch * 0.03); // a câmera mergulha para a frente no tranco
    // telas em pé abrem mais a lente
    const fov = clamp((camFov + fovKick) * (camera.aspect < 1 ? 1.35 : 1), 20, 95);
    if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
    // de lado a coruja fica levemente virada para a câmera; nos outros planos, reta no trilho
    sideK += ((SIDE_SHOTS.has(name) ? 1 : 0) - sideK) * Math.min(1, dt * 5);
    if (!P.dead && phase !== 'end') character.root.rotation.y = P.yaw + P.facing * 0.35 * (1 - sideK);
  }

  // ---------- a coruja segura a alavanca ----------
  // chamado depois da animação do esqueleto: o corpo inclina e os dois braços apontam para a pega vermelha
  const arms = ['L', 'R'].map((sd) => ['Upperarm', 'Forearm', 'Hand'].map((n) => character.bone(`${sd}_${n}`)));
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vd = new THREE.Vector3();
  const qd = new THREE.Quaternion(), qw = new THREE.Quaternion(), qp = new THREE.Quaternion(), qi = new THREE.Quaternion(), qs = new THREE.Quaternion();
  const poseE = new THREE.Euler(0, 0, 0, 'YXZ');
  function aimBone(bone, child, target, w) {
    bone.getWorldPosition(va);
    child.getWorldPosition(vb);
    vd.copy(target).sub(va).normalize();
    qd.setFromUnitVectors(vb.sub(va).normalize(), vd);
    qs.copy(qi).slerp(qd, w);
    bone.getWorldQuaternion(qw);
    qw.premultiply(qs);
    bone.parent.getWorldQuaternion(qp);
    bone.quaternion.copy(qp.invert().multiply(qw));
    bone.updateMatrixWorld(true);
  }
  function afterAnim() {
    const root = character.root;
    if (phase === 'intro' && player) {
      // dentro do vagão até o alçapão abrir; depois sobe para o teto
      root.visible = pt > 2.7;
      root.position.y = player.P.y - 1.95 * (1 - climb);
      return;
    }
    if (phase !== 'end' || armW <= 0.001) return;
    root.quaternion.setFromEuler(poseE.set(lean, Math.PI / 2 - 0.12, 0));
    root.updateMatrixWorld(true);
    leverPivot.updateWorldMatrix(true, false);
    for (const [upper, fore, hand] of arms) {
      if (!upper || !fore || !hand) continue;
      // cada mão segura a pega do seu lado
      upper.getWorldPosition(va);
      leverKnob.set(0, LEVER_H, va.z > 0 ? 0.3 : -0.3).applyMatrix4(leverPivot.matrixWorld);
      aimBone(upper, fore, leverKnob, armW);
      aimBone(fore, hand, leverKnob, armW);
    }
  }

  function render(renderer, camera) {
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
  }

  /** a tela de carregamento desenha esta cena uma vez (tudo visível) para a GPU já conhecer as peças */
  function prewarm() {
    layout(makeRounds(0));
  }

  const api = {
    scene, start, stop, update, render, prewarm, placeCamera, onRespawn, afterAnim,
    minX: START_X + 0.3, maxX: 100,
    /** em cena (abertura, volta da câmera, freio): o jogador não anda */
    get busy() { return busy(); },
    get phase() { return phase; },
    get rounds() { return rounds; },
    get shot() { return player ? currentShot(player.P) : shot; },
    // a física do jogador usa estas funções (mesma interface do mundo)
    solidsNear: (x0, x1) => solids.filter((s) => !s.dead && s.maxX > x0 && s.minX < x1),
    hitBlock() {},
    clearEnemiesNear() {},
    pitFall() {},
    // em cima do trem a coruja corre sempre na mesma velocidade (sem botão de correr): toque no pulo = próximo vagão, pulo segurado = pula um vagão
    tune: { speed: 1.4, strict: true, noRun: true },
    isWater: () => true, // sem espinhos lá embaixo: a última queda some no abismo
  };
  return api;
}
